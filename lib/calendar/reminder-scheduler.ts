import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import { db } from "@/db/client";
import {
  devotionCampaigns,
  eventReminders,
  notificationPreferences,
  notificationDeliveries,
  userEvents,
  users,
} from "@/db/schema";
import { sendEmail } from "@/lib/mailer";
import { sendPushToUser } from "@/lib/calendar/push";
import { buildAbsoluteAppUrl } from "@/lib/app-url";

type EventRow = {
  id: string;
  userId: string;
  title: string;
  message: string | null;
  startAt: Date;
  recurrence: string;
  recurrenceInterval: number;
  recurrenceUntil: Date | null;
};

type ReminderJobData = {
  deliveryId: string;
};

export const REMINDER_DELIVERY_QUEUE = "calendar-reminder-delivery";

let bossPromise: Promise<PgBoss> | null = null;

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL não definido para o scheduler de lembretes.");
  }
  return url;
}

async function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({
        connectionString: getDatabaseUrl(),
        schedule: true,
        supervise: true,
        migrate: true,
      });

      await boss.start();

      try {
        await boss.createQueue(REMINDER_DELIVERY_QUEUE, {
          retryLimit: 0,
          expireInSeconds: 10 * 60,
          retentionSeconds: 7 * 24 * 60 * 60,
          deleteAfterSeconds: 7 * 24 * 60 * 60,
        });
      } catch {
        // Queue may already exist.
      }

      return boss;
    })();
  }

  return bossPromise;
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

function getHourInTimezone(date: Date, timezone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const hourPart = parts.find((part) => part.type === "hour")?.value;
    if (!hourPart) return null;

    const hour = Number(hourPart);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
      return null;
    }

    return hour;
  } catch {
    return null;
  }
}

function isInQuietHours(currentHour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart === quietEnd) {
    return false;
  }

  if (quietStart < quietEnd) {
    return currentHour >= quietStart && currentHour < quietEnd;
  }

  return currentHour >= quietStart || currentHour < quietEnd;
}

function computeQuietHoursDeferredTime(params: {
  now: Date;
  timezone: string;
  quietStart: number;
  quietEnd: number;
}): Date | null {
  const { now, timezone, quietStart, quietEnd } = params;

  if (quietStart === quietEnd) {
    return null;
  }

  const stepMinutes = 15;
  const maxChecks = Math.ceil((48 * 60) / stepMinutes);
  let candidate = new Date(now.getTime() + stepMinutes * 60 * 1000);

  for (let i = 0; i < maxChecks; i += 1) {
    const hour = getHourInTimezone(candidate, timezone);
    if (hour !== null && !isInQuietHours(hour, quietStart, quietEnd)) {
      return candidate;
    }

    candidate = new Date(candidate.getTime() + stepMinutes * 60 * 1000);
  }

  return null;
}

function getOccurrenceStarts(params: {
  event: EventRow;
  rangeStart: Date;
  rangeEnd: Date;
}): Date[] {
  const { event, rangeStart, rangeEnd } = params;

  const first = new Date(event.startAt);

  if (event.recurrence === "none") {
    if (first >= rangeStart && first <= rangeEnd) {
      return [first];
    }

    return [];
  }

  const until = event.recurrenceUntil ? new Date(event.recurrenceUntil) : rangeEnd;
  const end = new Date(Math.min(until.getTime(), rangeEnd.getTime()));

  const out: Date[] = [];
  const maxIterations = 800;

  let cursor = new Date(first);
  let i = 0;

  while (cursor <= end && i < maxIterations) {
    if (cursor >= rangeStart) {
      out.push(new Date(cursor));
    }

    cursor = addByRecurrence(cursor, event.recurrence, Math.max(1, event.recurrenceInterval));
    i += 1;
  }

  return out;
}

async function enqueueDeliveryJob(deliveryId: string, scheduledFor: Date) {
  const boss = await getBoss();

  await boss.send(
    REMINDER_DELIVERY_QUEUE,
    { deliveryId } satisfies ReminderJobData,
    {
      startAfter: scheduledFor,
      singletonKey: `delivery-${deliveryId}`,
    },
  );
}

export async function scheduleReminderDeliveriesForEvent(eventId: string) {
  const [event] = await db
    .select({
      id: userEvents.id,
      userId: userEvents.userId,
      title: userEvents.title,
      message: userEvents.message,
      startAt: userEvents.startAt,
      recurrence: userEvents.recurrence,
      recurrenceInterval: userEvents.recurrenceInterval,
      recurrenceUntil: userEvents.recurrenceUntil,
    })
    .from(userEvents)
    .where(eq(userEvents.id, eventId))
    .limit(1);

  if (!event) {
    return { inserted: 0, queued: 0 };
  }

  const reminders = await db
    .select({
      id: eventReminders.id,
      userId: eventReminders.userId,
      channel: eventReminders.channel,
      remindBeforeMinutes: eventReminders.remindBeforeMinutes,
    })
    .from(eventReminders)
    .where(and(eq(eventReminders.eventId, eventId), eq(eventReminders.isEnabled, true)));

  if (reminders.length === 0) {
    return { inserted: 0, queued: 0 };
  }

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 5 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

  const occurrences = getOccurrenceStarts({
    event,
    rangeStart,
    rangeEnd,
  });

  if (occurrences.length === 0) {
    return { inserted: 0, queued: 0 };
  }

  const reminderIds = reminders.map((r) => r.id);
  const existingDeliveries = await db
    .select({
      reminderId: notificationDeliveries.reminderId,
      scheduledFor: notificationDeliveries.scheduledFor,
    })
    .from(notificationDeliveries)
    .where(
      and(
        isNotNull(notificationDeliveries.reminderId),
        inArray(notificationDeliveries.reminderId, reminderIds),
      ),
    );

  const existing = new Set(
    existingDeliveries
      .filter((d) => Boolean(d.reminderId))
      .map((d) => `${d.reminderId}:${d.scheduledFor.toISOString()}`),
  );

  const rowsToInsert: Array<{
    id: string;
    userId: string;
    eventId: string;
    reminderId: string;
    channel: string;
    status: string;
    scheduledFor: Date;
  }> = [];

  for (const occurrence of occurrences) {
    for (const reminder of reminders) {
      const scheduled = new Date(
        occurrence.getTime() - reminder.remindBeforeMinutes * 60 * 1000,
      );
      const scheduledFor = scheduled < now ? now : scheduled;
      const key = `${reminder.id}:${scheduledFor.toISOString()}`;

      if (existing.has(key)) {
        continue;
      }

      existing.add(key);
      rowsToInsert.push({
        id: crypto.randomUUID(),
        userId: event.userId,
        eventId: event.id,
        reminderId: reminder.id,
        channel: reminder.channel,
        status: "pending",
        scheduledFor,
      });
    }
  }

  if (rowsToInsert.length === 0) {
    return { inserted: 0, queued: 0 };
  }

  const inserted = await db
    .insert(notificationDeliveries)
    .values(rowsToInsert)
    .returning({
      id: notificationDeliveries.id,
      scheduledFor: notificationDeliveries.scheduledFor,
    });

  await Promise.all(inserted.map((row) => enqueueDeliveryJob(row.id, row.scheduledFor)));

  return {
    inserted: inserted.length,
    queued: inserted.length,
  };
}

export async function scheduleReminderDeliveriesBackfill(options?: {
  limitEvents?: number;
}) {
  const limitEvents = Math.max(1, Math.min(400, options?.limitEvents ?? 120));

  const events = await db
    .select({
      id: userEvents.id,
    })
    .from(userEvents)
    .orderBy(asc(userEvents.startAt))
    .limit(limitEvents);

  let inserted = 0;
  let queued = 0;

  for (const event of events) {
    const result = await scheduleReminderDeliveriesForEvent(event.id);
    inserted += result.inserted;
    queued += result.queued;
  }

  return {
    scannedEvents: events.length,
    inserted,
    queued,
  };
}

async function executeDelivery(deliveryId: string): Promise<"sent" | "failed" | "skipped" | "deferred"> {
  const [row] = await db
    .select({
      deliveryId: notificationDeliveries.id,
      userId: notificationDeliveries.userId,
      channel: notificationDeliveries.channel,
      status: notificationDeliveries.status,
      scheduledFor: notificationDeliveries.scheduledFor,
      eventSource: userEvents.source,
      eventTitle: userEvents.title,
      eventMessage: userEvents.message,
      devotionCampaignId: devotionCampaigns.id,
      userEmail: users.email,
      preferenceTimezone: notificationPreferences.timezone,
      preferenceEmailEnabled: notificationPreferences.emailEnabled,
      preferencePushEnabled: notificationPreferences.pushEnabled,
      preferenceQuietStart: notificationPreferences.quietHoursStart,
      preferenceQuietEnd: notificationPreferences.quietHoursEnd,
    })
    .from(notificationDeliveries)
    .leftJoin(userEvents, eq(userEvents.id, notificationDeliveries.eventId))
    .leftJoin(devotionCampaigns, eq(devotionCampaigns.linkedEventId, userEvents.id))
    .leftJoin(users, eq(users.id, notificationDeliveries.userId))
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, notificationDeliveries.userId))
    .where(eq(notificationDeliveries.id, deliveryId))
    .limit(1);

  if (!row) {
    return "skipped";
  }

  if (row.status === "sent" || row.status === "cancelled") {
    return "skipped";
  }

  if (row.scheduledFor > new Date(Date.now() + 30 * 1000)) {
    return "skipped";
  }

  const now = new Date();

  const pushEnabled = row.preferencePushEnabled ?? true;
  const emailEnabled = row.preferenceEmailEnabled ?? true;

  if ((row.channel === "push" && !pushEnabled) || (row.channel === "email" && !emailEnabled)) {
    await db
      .update(notificationDeliveries)
      .set({
        status: "cancelled",
        updatedAt: now,
        errorMessage: `Canal ${row.channel} desabilitado nas preferências do usuário.`,
      })
      .where(eq(notificationDeliveries.id, deliveryId));

    return "skipped";
  }

  if (
    typeof row.preferenceQuietStart === "number" &&
    typeof row.preferenceQuietEnd === "number"
  ) {
    const timezone = row.preferenceTimezone || "America/Sao_Paulo";
    const currentHour = getHourInTimezone(now, timezone);

    if (
      currentHour !== null &&
      isInQuietHours(currentHour, row.preferenceQuietStart, row.preferenceQuietEnd)
    ) {
      const deferredTo = computeQuietHoursDeferredTime({
        now,
        timezone,
        quietStart: row.preferenceQuietStart,
        quietEnd: row.preferenceQuietEnd,
      });

      if (deferredTo) {
        await db
          .update(notificationDeliveries)
          .set({
            status: "pending",
            scheduledFor: deferredTo,
            updatedAt: now,
            errorMessage: "Lembrete reagendado por horário silencioso.",
          })
          .where(eq(notificationDeliveries.id, deliveryId));

        await enqueueDeliveryJob(deliveryId, deferredTo);
        return "deferred";
      }
    }
  }

  try {
    const destinationUrl =
      row.eventSource === "devotion" && row.devotionCampaignId
        ? `/minha-devocao/${row.devotionCampaignId}`
        : "/calendario";

    if (row.channel === "push") {
      const summary = await sendPushToUser({
        userId: row.userId,
        payload: {
          title: row.eventTitle ?? "Minha Liturgia",
          body: row.eventMessage ?? "Você tem um lembrete do calendário.",
          url: destinationUrl,
          tag: "calendar-reminder",
        },
        recordDeliveryLog: false,
      });

      if (summary.sent === 0) {
        if (emailEnabled && row.userEmail) {
          await sendEmail({
            to: row.userEmail,
            subject: `Lembrete: ${row.eventTitle ?? "Evento"}`,
            html: `
              <h2>Lembrete do Minha Liturgia</h2>
              <p><strong>${row.eventTitle ?? "Evento"}</strong></p>
              <p>${row.eventMessage ?? "Seu lembrete está programado para agora."}</p>
              <p><a href="${buildAbsoluteAppUrl(destinationUrl)}">Abrir lembrete</a></p>
              <p style="font-size:12px;color:#666">(Enviado por fallback de e-mail porque não havia assinatura push ativa.)</p>
            `,
          });
        } else {
          throw new Error("Nenhuma assinatura push ativa para o usuário.");
        }
      }
    } else if (row.channel === "email") {
      if (!row.userEmail) {
        throw new Error("Usuário sem e-mail para receber lembrete.");
      }

      await sendEmail({
        to: row.userEmail,
        subject: `Lembrete: ${row.eventTitle ?? "Evento"}`,
        html: `
          <h2>Lembrete do Minha Liturgia</h2>
          <p><strong>${row.eventTitle ?? "Evento"}</strong></p>
          <p>${row.eventMessage ?? "Seu lembrete está programado para agora."}</p>
          <p><a href=\"${buildAbsoluteAppUrl(destinationUrl)}\">Abrir lembrete</a></p>
        `,
      });
    }

    await db
      .update(notificationDeliveries)
      .set({
        status: "sent",
        sentAt: now,
        updatedAt: now,
        errorMessage: null,
      })
      .where(eq(notificationDeliveries.id, deliveryId));

    return "sent";
  } catch (cause) {
    await db
      .update(notificationDeliveries)
      .set({
        status: "failed",
        updatedAt: now,
        errorMessage:
          cause instanceof Error
            ? cause.message.slice(0, 4000)
            : "Falha inesperada no envio do lembrete.",
      })
      .where(eq(notificationDeliveries.id, deliveryId));

    return "failed";
  }
}

export async function processReminderDeliveryQueue(options?: {
  batchSize?: number;
  maxBatches?: number;
}) {
  const boss = await getBoss();
  const batchSize = Math.max(1, Math.min(100, options?.batchSize ?? 25));
  const maxBatches = Math.max(1, Math.min(20, options?.maxBatches ?? 6));

  let batches = 0;
  let jobs = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let deferred = 0;

  while (batches < maxBatches) {
    const fetched = await boss.fetch<ReminderJobData>(REMINDER_DELIVERY_QUEUE, {
      batchSize,
      includeMetadata: true,
    });

    if (fetched.length === 0) {
      break;
    }

    for (const job of fetched) {
      jobs += 1;

      const result = await executeDelivery(job.data.deliveryId);

      if (result === "sent") sent += 1;
      if (result === "failed") failed += 1;
      if (result === "skipped") skipped += 1;
      if (result === "deferred") deferred += 1;

      await boss.complete(REMINDER_DELIVERY_QUEUE, job.id);
    }

    batches += 1;
  }

  return {
    batches,
    jobs,
    sent,
    failed,
    skipped,
    deferred,
  };
}
