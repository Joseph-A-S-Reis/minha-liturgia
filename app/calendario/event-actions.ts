"use server";

import { and, asc, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  eventReminders,
  notificationDeliveries,
  notificationPreferences,
  userEvents,
} from "@/db/schema";
import { acquireIdempotencyLock, createIdempotencyKey } from "@/lib/idempotency";
import { scheduleReminderDeliveriesForEvent } from "@/lib/calendar/reminder-scheduler";

const recurrenceSchema = z.enum(["none", "daily", "weekly", "monthly", "yearly"]);

const createUserEventSchema = z.object({
  title: z.string().trim().min(1, "Informe um título.").max(160),
  message: z.string().trim().max(4000).optional(),
  eventDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence: recurrenceSchema.default("none"),
  recurrenceInterval: z.coerce.number().int().min(1).max(30).default(1),
  recurrenceUntil: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
      const date = new Date(`${value}T23:59:59.999Z`);
      if (Number.isNaN(date.getTime())) return undefined;
      return date;
    }),
  remindBeforeMinutes: z.coerce.number().int().min(0).max(60 * 24 * 14).default(0),
  timezone: z.string().trim().min(3).max(80).default("America/Sao_Paulo"),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const deleteUserEventSchema = z.object({
  id: z.string().trim().min(1),
});

export type UserCalendarEvent = {
  id: string;
  title: string;
  message: string | null;
  startAt: Date;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval: number;
  recurrenceUntil: Date | null;
};

async function requireUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  return session.user.id;
}

export async function createUserEventAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = createUserEventSchema.parse({
    title: formData.get("title"),
    message: formData.get("message"),
    eventDate: formData.get("eventDate"),
    recurrence: formData.get("recurrence"),
    recurrenceInterval: formData.get("recurrenceInterval"),
    recurrenceUntil: formData.get("recurrenceUntil"),
    remindBeforeMinutes: formData.get("remindBeforeMinutes"),
    timezone: formData.get("timezone"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const [userPreference] = await db
    .select({ timezone: notificationPreferences.timezone })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  const eventTimezone = userPreference?.timezone || parsed.timezone || "America/Sao_Paulo";

  const startsAt = new Date(`${parsed.eventDate}T09:00:00.000Z`);

  const actionKey = createIdempotencyKey("calendar:event:create", {
    title: parsed.title,
    message: parsed.message ?? null,
    eventDate: parsed.eventDate,
    recurrence: parsed.recurrence,
    recurrenceInterval: parsed.recurrenceInterval,
    recurrenceUntil: parsed.recurrenceUntil?.toISOString() ?? null,
    remindBeforeMinutes: parsed.remindBeforeMinutes,
    timezone: eventTimezone,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "calendar:event:create",
    actionKey,
    ttlSeconds: 180,
  });

  if (!canProcess) {
    return;
  }

  const eventId = crypto.randomUUID();

  await db.insert(userEvents).values({
    id: eventId,
    userId,
    title: parsed.title,
    message: parsed.message,
    startAt: startsAt,
    allDay: true,
    timezone: eventTimezone,
    recurrence: parsed.recurrence,
    recurrenceInterval: parsed.recurrenceInterval,
    recurrenceUntil: parsed.recurrenceUntil,
    source: "custom",
  });

  if (parsed.remindBeforeMinutes > 0) {
    await db.insert(eventReminders).values([
      {
        id: crypto.randomUUID(),
        eventId,
        userId,
        remindBeforeMinutes: parsed.remindBeforeMinutes,
        channel: "push",
      },
      {
        id: crypto.randomUUID(),
        eventId,
        userId,
        remindBeforeMinutes: parsed.remindBeforeMinutes,
        channel: "email",
      },
    ]);

    try {
      await scheduleReminderDeliveriesForEvent(eventId);
    } catch (cause) {
      console.error("[calendar] falha ao agendar lembretes", cause);
    }
  }

  revalidatePath("/calendario");
}

export async function deleteUserEventAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = deleteUserEventSchema.parse({
    id: formData.get("id"),
  });

  await db
    .delete(userEvents)
    .where(and(eq(userEvents.id, parsed.id), eq(userEvents.userId, userId)));

  await db
    .update(notificationDeliveries)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
      errorMessage: "Evento removido pelo usuário.",
    })
    .where(
      and(
        eq(notificationDeliveries.userId, userId),
        eq(notificationDeliveries.eventId, parsed.id),
        eq(notificationDeliveries.status, "pending"),
      ),
    );

  revalidatePath("/calendario");
}

export async function getUserCalendarEventsAction(): Promise<UserCalendarEvent[]> {
  const userId = await requireUserId();

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
    .where(and(eq(userEvents.userId, userId), gte(userEvents.startAt, new Date("2000-01-01"))))
    .orderBy(asc(userEvents.startAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    startAt: row.startAt,
    recurrence:
      row.recurrence === "daily" ||
      row.recurrence === "weekly" ||
      row.recurrence === "monthly" ||
      row.recurrence === "yearly"
        ? row.recurrence
        : "none",
    recurrenceInterval: row.recurrenceInterval,
    recurrenceUntil: row.recurrenceUntil,
  }));
}
