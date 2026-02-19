import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import ical from "ical-generator";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { icsTokens, userEvents, users } from "@/db/schema";
import { getYearCatholicEvents, type CatholicEvent } from "@/lib/liturgical-calendar";
import { buildAbsoluteAppUrl } from "@/lib/app-url";

type UserEventRow = {
  id: string;
  title: string;
  message: string | null;
  startAt: Date;
  allDay: boolean;
  recurrence: string;
  recurrenceInterval: number;
  recurrenceUntil: Date | null;
};

type EventOccurrence = {
  uid: string;
  title: string;
  description?: string;
  date: string;
  allDay: boolean;
};

function mustReadIcsPepper(): string {
  const pepper = process.env.ICS_TOKEN_PEPPER?.trim();
  if (!pepper) {
    throw new Error("ICS_TOKEN_PEPPER não configurado.");
  }
  return pepper;
}

function hashIcsToken(rawToken: string): string {
  return createHash("sha256")
    .update(`${rawToken}.${mustReadIcsPepper()}`)
    .digest("hex");
}

function dateToIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoDayToDate(isoDay: string): Date {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addByRecurrence(base: Date, recurrence: string, interval: number): Date {
  const next = new Date(base);

  if (recurrence === "daily") {
    next.setDate(next.getDate() + interval);
    return next;
  }

  if (recurrence === "weekly") {
    next.setDate(next.getDate() + interval * 7);
    return next;
  }

  if (recurrence === "monthly") {
    next.setMonth(next.getMonth() + interval);
    return next;
  }

  if (recurrence === "yearly") {
    next.setFullYear(next.getFullYear() + interval);
    return next;
  }

  return next;
}

function expandUserEventOccurrences(params: {
  event: UserEventRow;
  rangeStart: Date;
  rangeEnd: Date;
}): EventOccurrence[] {
  const { event, rangeStart, rangeEnd } = params;

  const startIso = dateToIsoDay(event.startAt);
  const startDate = isoDayToDate(startIso);

  if (event.recurrence === "none") {
    if (startDate >= rangeStart && startDate <= rangeEnd) {
      return [
        {
          uid: `user-${event.id}-${startIso}`,
          title: event.title,
          description: event.message ?? undefined,
          date: startIso,
          allDay: event.allDay,
        },
      ];
    }

    return [];
  }

  const untilDate = event.recurrenceUntil
    ? isoDayToDate(dateToIsoDay(event.recurrenceUntil))
    : rangeEnd;

  const hardLimit = new Date(Math.min(untilDate.getTime(), rangeEnd.getTime()));

  const occurrences: EventOccurrence[] = [];
  const maxIterations = 600;
  let cursor = new Date(startDate);
  let i = 0;

  while (cursor <= hardLimit && i < maxIterations) {
    if (cursor >= rangeStart) {
      const occurrenceIso = dateToIsoDay(cursor);
      occurrences.push({
        uid: `user-${event.id}-${occurrenceIso}`,
        title: event.title,
        description: event.message ?? undefined,
        date: occurrenceIso,
        allDay: event.allDay,
      });
    }

    cursor = addByRecurrence(cursor, event.recurrence, Math.max(1, event.recurrenceInterval));
    i += 1;
  }

  return occurrences;
}

function liturgicalToOccurrence(event: CatholicEvent): EventOccurrence {
  return {
    uid: `liturgical-${event.date}-${event.title}`,
    title: event.title,
    description: event.description,
    date: event.date,
    allDay: true,
  };
}

async function fetchUserEvents(userId: string): Promise<UserEventRow[]> {
  return db
    .select({
      id: userEvents.id,
      title: userEvents.title,
      message: userEvents.message,
      startAt: userEvents.startAt,
      allDay: userEvents.allDay,
      recurrence: userEvents.recurrence,
      recurrenceInterval: userEvents.recurrenceInterval,
      recurrenceUntil: userEvents.recurrenceUntil,
    })
    .from(userEvents)
    .where(eq(userEvents.userId, userId));
}

async function fetchUserName(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;
  return row.name || row.email || null;
}

export async function buildUserCalendarIcs(params: {
  userId: string;
  includeLiturgical?: boolean;
}): Promise<string> {
  const includeLiturgical = params.includeLiturgical ?? true;

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), 0, 1);
  const rangeEnd = new Date(now.getFullYear() + 2, 11, 31);

  const [eventRows, userName] = await Promise.all([
    fetchUserEvents(params.userId),
    fetchUserName(params.userId),
  ]);

  const calendar = ical({
    name: `Minha Liturgia${userName ? ` · ${userName}` : ""}`,
    description: "Calendário litúrgico e eventos pessoais do Minha Liturgia",
    prodId: { company: "Minha Liturgia", product: "Calendario" },
    url: buildAbsoluteAppUrl("/calendario"),
    ttl: 60 * 60,
    scale: "gregorian",
  });

  const occurrences: EventOccurrence[] = [];

  for (const event of eventRows) {
    occurrences.push(...expandUserEventOccurrences({ event, rangeStart, rangeEnd }));
  }

  if (includeLiturgical) {
    for (let year = rangeStart.getFullYear(); year <= rangeEnd.getFullYear(); year += 1) {
      const liturgicalEvents = getYearCatholicEvents(year);
      occurrences.push(...liturgicalEvents.map(liturgicalToOccurrence));
    }
  }

  const byUid = new Map<string, EventOccurrence>();
  for (const occurrence of occurrences) {
    byUid.set(occurrence.uid, occurrence);
  }

  const sorted = Array.from(byUid.values()).sort((a, b) => a.date.localeCompare(b.date));

  for (const event of sorted) {
    const startDate = isoDayToDate(event.date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);

    calendar.createEvent({
      id: event.uid,
      summary: event.title,
      description: event.description,
      start: startDate,
      end: endDate,
      allDay: event.allDay,
      url: buildAbsoluteAppUrl("/calendario"),
    });
  }

  return calendar.toString();
}

export async function createIcsTokenForUser(userId: string): Promise<{ rawToken: string; url: string }> {
  const rawToken = randomBytes(24).toString("base64url");
  const tokenHash = hashIcsToken(rawToken);

  await db.insert(icsTokens).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    description: "Token de assinatura ICS",
  });

  return {
    rawToken,
    url: buildAbsoluteAppUrl(`/api/calendario/ics/${rawToken}`),
  };
}

export async function resolveUserIdByIcsToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashIcsToken(rawToken);
  const now = new Date();

  const [match] = await db
    .select({ id: icsTokens.id, userId: icsTokens.userId })
    .from(icsTokens)
    .where(
      and(
        eq(icsTokens.tokenHash, tokenHash),
        isNull(icsTokens.revokedAt),
        or(isNull(icsTokens.expiresAt), gt(icsTokens.expiresAt, now)),
      ),
    )
    .orderBy(desc(icsTokens.createdAt))
    .limit(1);

  if (!match) {
    return null;
  }

  await db
    .update(icsTokens)
    .set({ lastUsedAt: now })
    .where(eq(icsTokens.id, match.id));

  return match.userId;
}
