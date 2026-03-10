import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userEvents } from "@/db/schema";
import {
  getLocalIsoDate,
  getUpcomingCatholicEvents,
  type CatholicEvent,
} from "@/lib/liturgical-calendar";

type UserEventRow = {
  id: string;
  title: string;
  message: string | null;
  startAt: Date;
  recurrence: string;
  recurrenceInterval: number;
  recurrenceUntil: Date | null;
};

export type UpcomingPanelUserEvent = {
  id: string;
  title: string;
  message: string | null;
  date: string;
};

export type UpcomingPanelDay = {
  date: string;
  liturgicalEvent: CatholicEvent;
  userEvents: UpcomingPanelUserEvent[];
};

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
}): UpcomingPanelUserEvent[] {
  const { event, rangeStart, rangeEnd } = params;
  const startIso = getLocalIsoDate(event.startAt);
  const startDate = isoDayToDate(startIso);

  if (event.recurrence === "none") {
    if (startDate >= rangeStart && startDate <= rangeEnd) {
      return [
        {
          id: `${event.id}-${startIso}`,
          title: event.title,
          message: event.message,
          date: startIso,
        },
      ];
    }

    return [];
  }

  const untilDate = event.recurrenceUntil
    ? isoDayToDate(getLocalIsoDate(event.recurrenceUntil))
    : rangeEnd;
  const hardLimit = new Date(Math.min(untilDate.getTime(), rangeEnd.getTime()));

  const occurrences: UpcomingPanelUserEvent[] = [];
  const maxIterations = 5000;
  let cursor = new Date(startDate);
  let i = 0;

  while (cursor < rangeStart && cursor <= hardLimit && i < maxIterations) {
    cursor = addByRecurrence(cursor, event.recurrence, Math.max(1, event.recurrenceInterval));
    i += 1;
  }

  while (cursor <= hardLimit && i < maxIterations) {
    if (cursor >= rangeStart) {
      const occurrenceIso = getLocalIsoDate(cursor);
      occurrences.push({
        id: `${event.id}-${occurrenceIso}`,
        title: event.title,
        message: event.message,
        date: occurrenceIso,
      });
    }

    cursor = addByRecurrence(cursor, event.recurrence, Math.max(1, event.recurrenceInterval));
    i += 1;
  }

  return occurrences;
}

async function fetchUserEvents(userId: string): Promise<UserEventRow[]> {
  const rows = await db
    .select({
      id: userEvents.id,
      title: userEvents.title,
      message: userEvents.message,
      startAt: userEvents.startAt,
      recurrence: userEvents.recurrence,
      recurrenceInterval: userEvents.recurrenceInterval,
      recurrenceUntil: userEvents.recurrenceUntil,
    })
    .from(userEvents)
    .where(eq(userEvents.userId, userId))
    .orderBy(asc(userEvents.startAt));

  return rows;
}

export async function getUpcomingPanelDays(params?: {
  days?: number;
  userId?: string | null;
}): Promise<UpcomingPanelDay[]> {
  const days = Math.max(1, Math.min(params?.days ?? 5, 5));
  const liturgicalDays = getUpcomingCatholicEvents(days);

  if (!params?.userId) {
    return liturgicalDays.map((liturgicalEvent) => ({
      date: liturgicalEvent.date,
      liturgicalEvent,
      userEvents: [],
    }));
  }

  const rangeStart = isoDayToDate(liturgicalDays[0].date);
  const rangeEnd = isoDayToDate(liturgicalDays[liturgicalDays.length - 1].date);
  const events = await fetchUserEvents(params.userId);

  const userEventsByDate = new Map<string, UpcomingPanelUserEvent[]>();

  for (const event of events) {
    const occurrences = expandUserEventOccurrences({
      event,
      rangeStart,
      rangeEnd,
    });

    for (const occurrence of occurrences) {
      const current = userEventsByDate.get(occurrence.date) ?? [];
      current.push(occurrence);
      userEventsByDate.set(occurrence.date, current);
    }
  }

  return liturgicalDays.map((liturgicalEvent) => ({
    date: liturgicalEvent.date,
    liturgicalEvent,
    userEvents: (userEventsByDate.get(liturgicalEvent.date) ?? []).sort((a, b) =>
      a.title.localeCompare(b.title, "pt-BR"),
    ),
  }));
}