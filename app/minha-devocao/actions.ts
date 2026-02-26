"use server";

import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  devotionCampaigns,
  devotionConditionDailyStatuses,
  devotionConditions,
  devotionDailyLogs,
  devotionReminders,
  eventReminders,
  notificationDeliveries,
  notificationPreferences,
  userEvents,
} from "@/db/schema";
import {
  DEVOTION_TYPES,
  MAX_RETROACTIVE_CHECKIN_DAYS,
  addDaysToIsoDate,
  canCheckInDate,
  clamp,
  getCampaignEndIsoDate,
  getDayIndexFromStart,
  getTodayIsoForTimezone,
  normalizeReminderMinutes,
} from "@/lib/devotion/planner";
import { getDeterministicVerseOfDay } from "@/lib/devotion/verse-of-day";
import { acquireIdempotencyLock, createIdempotencyKey } from "@/lib/idempotency";
import { scheduleReminderDeliveriesForEvent } from "@/lib/calendar/reminder-scheduler";

const devotionTypeSchema = z.enum(DEVOTION_TYPES);

const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1, "Informe um nome.").max(160),
    description: z.string().trim().max(4_000).optional(),
    purpose: z.string().trim().min(2, "Informe um propósito.").max(140),
    type: devotionTypeSchema,
    durationDays: z.coerce.number().int().min(1).max(730),
    startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string().trim().min(3).max(80).default("America/Sao_Paulo"),
    priestName: z.string().trim().max(140).optional(),
    conditionNames: z.array(z.string().trim().max(140)).max(12).default([]),
    conditionDescriptions: z.array(z.string().trim().max(500)).max(12).default([]),
    reminderMinutes: z.array(z.coerce.number().int().min(0).max(20_160)).max(8).default([]),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  });

function normalizeConditions(names: string[], descriptions: string[]) {
  const conditions: Array<{ name: string; description: string | null; sortOrder: number }> = [];

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index]?.trim() ?? "";
    const description = descriptions[index]?.trim() ?? "";

    if (!name) {
      continue;
    }

    conditions.push({
      name,
      description: description.length > 0 ? description : null,
      sortOrder: conditions.length,
    });
  }

  return conditions;
}

const campaignIdSchema = z.object({
  campaignId: z.string().trim().min(1),
});

const saveDailyNoteSchema = z.object({
  campaignId: z.string().trim().min(1),
  dateLocal: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(12_000),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const checkInSchema = z.object({
  campaignId: z.string().trim().min(1),
  dateLocal: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const completeConditionSchema = z.object({
  campaignId: z.string().trim().min(1),
  conditionId: z.string().trim().min(1),
  dateLocal: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const updateRemindersSchema = z.object({
  campaignId: z.string().trim().min(1),
  reminderMinutes: z.array(z.coerce.number().int().min(0).max(20_160)).max(8).default([]),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const updateCampaignSchema = z
  .object({
    campaignId: z.string().trim().min(1),
    name: z.string().trim().min(1, "Informe um nome.").max(160),
    description: z.string().trim().max(4_000).optional(),
    purpose: z.string().trim().min(2, "Informe um propósito.").max(140),
    type: devotionTypeSchema,
    durationDays: z.coerce.number().int().min(1).max(730),
    startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string().trim().min(3).max(80).default("America/Sao_Paulo"),
    priestName: z.string().trim().max(140).optional(),
    conditionNames: z.array(z.string().trim().max(140)).max(12).default([]),
    conditionDescriptions: z.array(z.string().trim().max(500)).max(12).default([]),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  });

const deleteCampaignSchema = z.object({
  campaignId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

async function requireUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  return session.user.id;
}

function normalizeStartDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function getCampaignOwnedByUser(campaignId: string, userId: string) {
  const [campaign] = await db
    .select()
    .from(devotionCampaigns)
    .where(and(eq(devotionCampaigns.id, campaignId), eq(devotionCampaigns.userId, userId)))
    .limit(1);

  return campaign ?? null;
}

async function resolveCampaignDateContext(params: {
  campaignId: string;
  userId: string;
  dateLocal: string;
}) {
  const campaign = await getCampaignOwnedByUser(params.campaignId, params.userId);

  if (!campaign) {
    throw new Error("Campanha não encontrada.");
  }

  const startDate = normalizeStartDate(campaign.startDate);
  const dayIndex = getDayIndexFromStart(startDate, params.dateLocal);
  const endDate = getCampaignEndIsoDate(startDate, campaign.durationDays);

  if (dayIndex < 1 || dayIndex > campaign.durationDays || params.dateLocal > endDate) {
    throw new Error("A data informada está fora da duração da campanha.");
  }

  return {
    campaign,
    startDate,
    endDate,
    dayIndex,
  };
}

async function getCampaignConditionOwnedByUser(params: {
  campaignId: string;
  conditionId: string;
  userId: string;
}) {
  const [condition] = await db
    .select({
      id: devotionConditions.id,
      campaignId: devotionConditions.campaignId,
    })
    .from(devotionConditions)
    .where(
      and(
        eq(devotionConditions.id, params.conditionId),
        eq(devotionConditions.campaignId, params.campaignId),
        eq(devotionConditions.userId, params.userId),
      ),
    )
    .limit(1);

  return condition ?? null;
}

export async function createDevotionCampaignAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = createCampaignSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    purpose: formData.get("purpose"),
    type: formData.get("type"),
    durationDays: formData.get("durationDays"),
    startDate: formData.get("startDate"),
    timezone: formData.get("timezone"),
    priestName: formData.get("priestName"),
    conditionNames: formData.getAll("conditionName"),
    conditionDescriptions: formData.getAll("conditionDescription"),
    reminderMinutes: formData.getAll("reminderMinutes"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const [userPreference] = await db
    .select({ timezone: notificationPreferences.timezone })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  const timezone = userPreference?.timezone || parsed.timezone || "America/Sao_Paulo";
  const conditions = normalizeConditions(parsed.conditionNames, parsed.conditionDescriptions);
  const reminderMinutes = normalizeReminderMinutes(parsed.reminderMinutes);

  const actionKey = createIdempotencyKey("devotion:campaign:create", {
    name: parsed.name,
    purpose: parsed.purpose,
    type: parsed.type,
    durationDays: parsed.durationDays,
    conditions,
    startDate: parsed.startDate,
    timezone,
    priestName: parsed.priestName ?? null,
    reminders: reminderMinutes,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:campaign:create",
    actionKey,
    ttlSeconds: 180,
  });

  if (!canProcess) {
    return;
  }

  const campaignId = crypto.randomUUID();
  const linkedEventId = crypto.randomUUID();
  const startsAt = new Date(`${parsed.startDate}T09:00:00.000Z`);
  const recurrenceUntil = new Date(startsAt);
  recurrenceUntil.setUTCDate(recurrenceUntil.getUTCDate() + Math.max(0, parsed.durationDays - 1));

  await db.insert(userEvents).values({
    id: linkedEventId,
    userId,
    title: `Minha Devoção · ${parsed.name}`,
    message: parsed.description || `Campanha de ${parsed.type} (${parsed.purpose}).`,
    startAt: startsAt,
    allDay: true,
    timezone,
    recurrence: "daily",
    recurrenceInterval: 1,
    recurrenceUntil,
    source: "devotion",
  });

  await db.insert(devotionCampaigns).values({
    id: campaignId,
    userId,
    linkedEventId,
    name: parsed.name,
    description: parsed.description,
    purpose: parsed.purpose,
    type: parsed.type,
    durationDays: parsed.durationDays,
    startDate: new Date(`${parsed.startDate}T00:00:00.000Z`),
    timezone,
    priestName: parsed.type === "penitencia" ? parsed.priestName : null,
    status: "active",
  });

  if (conditions.length > 0) {
    await db.insert(devotionConditions).values(
      conditions.map((condition) => ({
        id: crypto.randomUUID(),
        campaignId,
        userId,
        name: condition.name,
        description: condition.description,
        sortOrder: condition.sortOrder,
      })),
    );
  }

  if (reminderMinutes.length > 0) {
    await db.insert(devotionReminders).values(
      reminderMinutes.map((minute) => ({
        id: crypto.randomUUID(),
        campaignId,
        userId,
        remindBeforeMinutes: minute,
        channel: "push",
      })),
    );

    await db.insert(eventReminders).values(
      reminderMinutes.map((minute) => ({
        id: crypto.randomUUID(),
        eventId: linkedEventId,
        userId,
        remindBeforeMinutes: minute,
        channel: "push",
      })),
    );

    try {
      await scheduleReminderDeliveriesForEvent(linkedEventId);
    } catch (cause) {
      console.error("[minha-devocao] falha ao agendar lembretes", cause);
    }
  }

  revalidatePath("/minha-devocao");
}

export async function getUserDevotionCampaignsAction() {
  const userId = await requireUserId();

  const campaigns = await db
    .select({
      id: devotionCampaigns.id,
      name: devotionCampaigns.name,
      description: devotionCampaigns.description,
      purpose: devotionCampaigns.purpose,
      type: devotionCampaigns.type,
      durationDays: devotionCampaigns.durationDays,
      startDate: devotionCampaigns.startDate,
      timezone: devotionCampaigns.timezone,
      priestName: devotionCampaigns.priestName,
      status: devotionCampaigns.status,
      updatedAt: devotionCampaigns.updatedAt,
    })
    .from(devotionCampaigns)
    .where(eq(devotionCampaigns.userId, userId))
    .orderBy(desc(devotionCampaigns.updatedAt));

  if (campaigns.length === 0) {
    return [];
  }

  const campaignIds = campaigns.map((campaign) => campaign.id);

  const logs = await db
    .select({
      campaignId: devotionDailyLogs.campaignId,
      checkedInAt: devotionDailyLogs.checkedInAt,
    })
    .from(devotionDailyLogs)
    .where(
      and(
        inArray(devotionDailyLogs.campaignId, campaignIds),
        eq(devotionDailyLogs.userId, userId),
        isNotNull(devotionDailyLogs.checkedInAt),
      ),
    );

  const reminders = await db
    .select({
      campaignId: devotionReminders.campaignId,
      remindBeforeMinutes: devotionReminders.remindBeforeMinutes,
      isEnabled: devotionReminders.isEnabled,
    })
    .from(devotionReminders)
    .where(
      and(
        inArray(devotionReminders.campaignId, campaignIds),
        eq(devotionReminders.userId, userId),
        eq(devotionReminders.channel, "push"),
      ),
    )
    .orderBy(asc(devotionReminders.remindBeforeMinutes));

  const conditions = await db
    .select({
      campaignId: devotionConditions.campaignId,
      id: devotionConditions.id,
    })
    .from(devotionConditions)
    .where(
      and(
        inArray(devotionConditions.campaignId, campaignIds),
        eq(devotionConditions.userId, userId),
      ),
    );

  const checkinsByCampaign = new Map<string, number>();
  for (const log of logs) {
    checkinsByCampaign.set(log.campaignId, (checkinsByCampaign.get(log.campaignId) ?? 0) + 1);
  }

  const reminderMap = new Map<string, number[]>();
  for (const reminder of reminders) {
    if (!reminder.isEnabled) {
      continue;
    }

    const current = reminderMap.get(reminder.campaignId) ?? [];
    current.push(reminder.remindBeforeMinutes);
    reminderMap.set(reminder.campaignId, current);
  }

  const conditionCountMap = new Map<string, number>();
  for (const condition of conditions) {
    conditionCountMap.set(
      condition.campaignId,
      (conditionCountMap.get(condition.campaignId) ?? 0) + 1,
    );
  }

  return campaigns.map((campaign) => {
    const checkedInDays = checkinsByCampaign.get(campaign.id) ?? 0;

    return {
      ...campaign,
      checkedInDays,
      progressPercent: Math.round((checkedInDays / campaign.durationDays) * 100),
      reminderMinutes: reminderMap.get(campaign.id) ?? [],
      conditionCount: conditionCountMap.get(campaign.id) ?? 0,
    };
  });
}

export async function getDevotionCampaignDetailAction(campaignId: string) {
  const userId = await requireUserId();
  const parsed = campaignIdSchema.parse({ campaignId });

  const campaign = await getCampaignOwnedByUser(parsed.campaignId, userId);

  if (!campaign) {
    return null;
  }

  const startDate = normalizeStartDate(campaign.startDate);
  const todayIso = getTodayIsoForTimezone(campaign.timezone);

  const logs = await db
    .select({
      dayIndex: devotionDailyLogs.dayIndex,
      dateLocal: devotionDailyLogs.dateLocal,
      note: devotionDailyLogs.note,
      checkedInAt: devotionDailyLogs.checkedInAt,
      updatedAt: devotionDailyLogs.updatedAt,
    })
    .from(devotionDailyLogs)
    .where(
      and(
        eq(devotionDailyLogs.campaignId, campaign.id),
        eq(devotionDailyLogs.userId, userId),
      ),
    )
    .orderBy(asc(devotionDailyLogs.dayIndex));

  const reminders = await db
    .select({
      remindBeforeMinutes: devotionReminders.remindBeforeMinutes,
      isEnabled: devotionReminders.isEnabled,
    })
    .from(devotionReminders)
    .where(
      and(
        eq(devotionReminders.campaignId, campaign.id),
        eq(devotionReminders.userId, userId),
        eq(devotionReminders.channel, "push"),
      ),
    )
    .orderBy(asc(devotionReminders.remindBeforeMinutes));

  const conditions = await db
    .select({
      id: devotionConditions.id,
      name: devotionConditions.name,
      description: devotionConditions.description,
      sortOrder: devotionConditions.sortOrder,
    })
    .from(devotionConditions)
    .where(
      and(
        eq(devotionConditions.campaignId, campaign.id),
        eq(devotionConditions.userId, userId),
      ),
    )
    .orderBy(asc(devotionConditions.sortOrder));

  const conditionStatuses = await db
    .select({
      conditionId: devotionConditionDailyStatuses.conditionId,
      dateLocal: devotionConditionDailyStatuses.dateLocal,
      completedAt: devotionConditionDailyStatuses.completedAt,
    })
    .from(devotionConditionDailyStatuses)
    .where(
      and(
        eq(devotionConditionDailyStatuses.campaignId, campaign.id),
        eq(devotionConditionDailyStatuses.userId, userId),
      ),
    );

  const logsByDate = new Map(logs.map((log) => [log.dateLocal, log]));
  const conditionStatusKeySet = new Set(
    conditionStatuses.map((status) => `${status.conditionId}::${status.dateLocal}`),
  );

  const totalDays = campaign.durationDays;
  const endDate = getCampaignEndIsoDate(startDate, totalDays);
  const rawTodayIndex = getDayIndexFromStart(startDate, todayIso);
  const currentDayIndex = clamp(rawTodayIndex, 1, totalDays);

  const days = Array.from({ length: totalDays }, (_, index) => {
    const dayIndex = index + 1;
    const dateLocal = addDaysToIsoDate(startDate, index);
    const existing = logsByDate.get(dateLocal);
    const checkWindow = canCheckInDate({
      targetIsoDate: dateLocal,
      todayIsoDate: todayIso,
      maxRetroDays: MAX_RETROACTIVE_CHECKIN_DAYS,
    });
    const dayConditions = conditions.map((condition) => {
      const statusKey = `${condition.id}::${dateLocal}`;

      return {
        id: condition.id,
        name: condition.name,
        description: condition.description,
        completed: conditionStatusKeySet.has(statusKey),
      };
    });
    const allConditionsCompleted = dayConditions.every((condition) => condition.completed);

    return {
      dayIndex,
      dateLocal,
      note: existing?.note ?? "",
      checkedInAt: existing?.checkedInAt ?? null,
      canCheckIn: checkWindow.withinWindow,
      outsideWindow: checkWindow.tooOld || checkWindow.isFuture,
      conditions: dayConditions,
      allConditionsCompleted,
    };
  });

  const checkedInDays = logs.filter((log) => Boolean(log.checkedInAt)).length;
  const verseOfDay = await getDeterministicVerseOfDay({
    purpose: campaign.purpose,
    dayIndex: currentDayIndex,
    versionId: "ave-maria",
  });

  return {
    campaign,
    startDate,
    endDate,
    todayIso,
    currentDayIndex,
    checkedInDays,
    progressPercent: Math.round((checkedInDays / totalDays) * 100),
    reminders: reminders.filter((item) => item.isEnabled).map((item) => item.remindBeforeMinutes),
    conditions,
    days,
    verseOfDay,
  };
}

export async function saveDevotionDailyNoteAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = saveDailyNoteSchema.parse({
    campaignId: formData.get("campaignId"),
    dateLocal: formData.get("dateLocal"),
    note: formData.get("note"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:day:note", {
    campaignId: parsed.campaignId,
    dateLocal: parsed.dateLocal,
    note: parsed.note,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:day:note",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const context = await resolveCampaignDateContext({
    campaignId: parsed.campaignId,
    userId,
    dateLocal: parsed.dateLocal,
  });

  await db
    .insert(devotionDailyLogs)
    .values({
      id: crypto.randomUUID(),
      campaignId: context.campaign.id,
      userId,
      dayIndex: context.dayIndex,
      dateLocal: parsed.dateLocal,
      note: parsed.note,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [devotionDailyLogs.campaignId, devotionDailyLogs.dateLocal],
      set: {
        note: parsed.note,
        dayIndex: context.dayIndex,
        updatedAt: new Date(),
      },
    });

  await db
    .update(devotionCampaigns)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(devotionCampaigns.id, context.campaign.id));

  revalidatePath(`/minha-devocao/${context.campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function checkInDevotionDayAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = checkInSchema.parse({
    campaignId: formData.get("campaignId"),
    dateLocal: formData.get("dateLocal"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:day:checkin", {
    campaignId: parsed.campaignId,
    dateLocal: parsed.dateLocal,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:day:checkin",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const context = await resolveCampaignDateContext({
    campaignId: parsed.campaignId,
    userId,
    dateLocal: parsed.dateLocal,
  });

  const todayIso = getTodayIsoForTimezone(context.campaign.timezone);
  const checkWindow = canCheckInDate({
    targetIsoDate: parsed.dateLocal,
    todayIsoDate: todayIso,
    maxRetroDays: MAX_RETROACTIVE_CHECKIN_DAYS,
  });

  if (!checkWindow.withinWindow) {
    if (checkWindow.isFuture) {
      throw new Error("Não é possível fazer check-in em dias futuros.");
    }

    throw new Error("Essa data está fora da janela de check-in (3 dias retroativos).");
  }

  const campaignConditions = await db
    .select({ id: devotionConditions.id })
    .from(devotionConditions)
    .where(
      and(
        eq(devotionConditions.campaignId, context.campaign.id),
        eq(devotionConditions.userId, userId),
      ),
    );

  if (campaignConditions.length > 0) {
    const completedConditions = await db
      .select({ conditionId: devotionConditionDailyStatuses.conditionId })
      .from(devotionConditionDailyStatuses)
      .where(
        and(
          eq(devotionConditionDailyStatuses.campaignId, context.campaign.id),
          eq(devotionConditionDailyStatuses.userId, userId),
          eq(devotionConditionDailyStatuses.dateLocal, parsed.dateLocal),
        ),
      );

    const completedConditionIds = new Set(completedConditions.map((condition) => condition.conditionId));
    const allConditionsCompleted = campaignConditions.every((condition) =>
      completedConditionIds.has(condition.id),
    );

    if (!allConditionsCompleted) {
      throw new Error("Conclua as condições deste dia antes de confirmar o check-in.");
    }
  }

  await db
    .insert(devotionDailyLogs)
    .values({
      id: crypto.randomUUID(),
      campaignId: context.campaign.id,
      userId,
      dayIndex: context.dayIndex,
      dateLocal: parsed.dateLocal,
      checkedInAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [devotionDailyLogs.campaignId, devotionDailyLogs.dateLocal],
      set: {
        dayIndex: context.dayIndex,
        checkedInAt: new Date(),
        updatedAt: new Date(),
      },
    });

  await db
    .update(devotionCampaigns)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(devotionCampaigns.id, context.campaign.id));

  revalidatePath(`/minha-devocao/${context.campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function completeDevotionConditionDayAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = completeConditionSchema.parse({
    campaignId: formData.get("campaignId"),
    conditionId: formData.get("conditionId"),
    dateLocal: formData.get("dateLocal"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:condition:complete", {
    campaignId: parsed.campaignId,
    conditionId: parsed.conditionId,
    dateLocal: parsed.dateLocal,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:condition:complete",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const context = await resolveCampaignDateContext({
    campaignId: parsed.campaignId,
    userId,
    dateLocal: parsed.dateLocal,
  });

  const condition = await getCampaignConditionOwnedByUser({
    campaignId: parsed.campaignId,
    conditionId: parsed.conditionId,
    userId,
  });

  if (!condition) {
    throw new Error("Condição não encontrada para esta campanha.");
  }

  const todayIso = getTodayIsoForTimezone(context.campaign.timezone);
  const checkWindow = canCheckInDate({
    targetIsoDate: parsed.dateLocal,
    todayIsoDate: todayIso,
    maxRetroDays: MAX_RETROACTIVE_CHECKIN_DAYS,
  });

  if (!checkWindow.withinWindow) {
    if (checkWindow.isFuture) {
      throw new Error("Não é possível concluir condição em dias futuros.");
    }

    throw new Error("Essa data está fora da janela permitida para concluir condições.");
  }

  await db
    .insert(devotionConditionDailyStatuses)
    .values({
      id: crypto.randomUUID(),
      campaignId: context.campaign.id,
      conditionId: condition.id,
      userId,
      dayIndex: context.dayIndex,
      dateLocal: parsed.dateLocal,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [devotionConditionDailyStatuses.conditionId, devotionConditionDailyStatuses.dateLocal],
      set: {
        dayIndex: context.dayIndex,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  await db
    .update(devotionCampaigns)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(devotionCampaigns.id, context.campaign.id));

  revalidatePath(`/minha-devocao/${context.campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function updateCampaignReminderTimesAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = updateRemindersSchema.parse({
    campaignId: formData.get("campaignId"),
    reminderMinutes: formData.getAll("reminderMinutes"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const reminderMinutes = normalizeReminderMinutes(parsed.reminderMinutes);

  const actionKey = createIdempotencyKey("devotion:campaign:reminders", {
    campaignId: parsed.campaignId,
    reminderMinutes,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:campaign:reminders",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const campaign = await getCampaignOwnedByUser(parsed.campaignId, userId);

  if (!campaign) {
    throw new Error("Campanha não encontrada.");
  }

  await db
    .delete(devotionReminders)
    .where(
      and(
        eq(devotionReminders.campaignId, campaign.id),
        eq(devotionReminders.userId, userId),
        eq(devotionReminders.channel, "push"),
      ),
    );

  if (campaign.linkedEventId) {
    await db
      .delete(eventReminders)
      .where(and(eq(eventReminders.eventId, campaign.linkedEventId), eq(eventReminders.userId, userId)));

    await db
      .update(notificationDeliveries)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
        errorMessage: "Lembretes da campanha atualizados.",
      })
      .where(
        and(
          eq(notificationDeliveries.userId, userId),
          eq(notificationDeliveries.eventId, campaign.linkedEventId),
          eq(notificationDeliveries.status, "pending"),
        ),
      );
  }

  if (reminderMinutes.length > 0) {
    await db.insert(devotionReminders).values(
      reminderMinutes.map((minute) => ({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        userId,
        remindBeforeMinutes: minute,
        channel: "push",
      })),
    );

    if (campaign.linkedEventId) {
      await db.insert(eventReminders).values(
        reminderMinutes.map((minute) => ({
          id: crypto.randomUUID(),
          eventId: campaign.linkedEventId!,
          userId,
          remindBeforeMinutes: minute,
          channel: "push",
        })),
      );

      try {
        await scheduleReminderDeliveriesForEvent(campaign.linkedEventId);
      } catch (cause) {
        console.error("[minha-devocao] falha ao reagendar lembretes", cause);
      }
    }
  }

  await db
    .update(devotionCampaigns)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(devotionCampaigns.id, campaign.id));

  revalidatePath(`/minha-devocao/${campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function updateDevotionCampaignAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = updateCampaignSchema.parse({
    campaignId: formData.get("campaignId"),
    name: formData.get("name"),
    description: formData.get("description"),
    purpose: formData.get("purpose"),
    type: formData.get("type"),
    durationDays: formData.get("durationDays"),
    startDate: formData.get("startDate"),
    timezone: formData.get("timezone"),
    priestName: formData.get("priestName"),
    conditionNames: formData.getAll("conditionName"),
    conditionDescriptions: formData.getAll("conditionDescription"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const conditions = normalizeConditions(parsed.conditionNames, parsed.conditionDescriptions);
  const actionKey = createIdempotencyKey("devotion:campaign:update", {
    campaignId: parsed.campaignId,
    name: parsed.name,
    description: parsed.description ?? null,
    purpose: parsed.purpose,
    type: parsed.type,
    durationDays: parsed.durationDays,
    startDate: parsed.startDate,
    timezone: parsed.timezone,
    priestName: parsed.type === "penitencia" ? parsed.priestName ?? null : null,
    conditions,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:campaign:update",
    actionKey,
    ttlSeconds: 180,
  });

  if (!canProcess) {
    return;
  }

  const campaign = await getCampaignOwnedByUser(parsed.campaignId, userId);

  if (!campaign) {
    throw new Error("Campanha não encontrada.");
  }

  const startAt = new Date(`${parsed.startDate}T09:00:00.000Z`);
  const recurrenceUntil = new Date(startAt);
  recurrenceUntil.setUTCDate(recurrenceUntil.getUTCDate() + Math.max(0, parsed.durationDays - 1));
  const now = new Date();
  const newStartDateIso = parsed.startDate;
  const newEndDateIso = getCampaignEndIsoDate(newStartDateIso, parsed.durationDays);

  await db
    .update(devotionCampaigns)
    .set({
      name: parsed.name,
      description: parsed.description,
      purpose: parsed.purpose,
      type: parsed.type,
      durationDays: parsed.durationDays,
      startDate: new Date(`${parsed.startDate}T00:00:00.000Z`),
      timezone: parsed.timezone,
      priestName: parsed.type === "penitencia" ? parsed.priestName : null,
      updatedAt: now,
    })
    .where(eq(devotionCampaigns.id, campaign.id));

  if (campaign.linkedEventId) {
    await db
      .update(userEvents)
      .set({
        title: `Minha Devoção · ${parsed.name}`,
        message: parsed.description || `Campanha de ${parsed.type} (${parsed.purpose}).`,
        startAt,
        timezone: parsed.timezone,
        recurrenceUntil,
        updatedAt: now,
      })
      .where(and(eq(userEvents.id, campaign.linkedEventId), eq(userEvents.userId, userId)));

    await db
      .update(notificationDeliveries)
      .set({
        status: "cancelled",
        updatedAt: now,
        errorMessage: "Campanha atualizada: agendamento recalculado.",
      })
      .where(
        and(
          eq(notificationDeliveries.userId, userId),
          eq(notificationDeliveries.eventId, campaign.linkedEventId),
          eq(notificationDeliveries.status, "pending"),
        ),
      );

    try {
      await scheduleReminderDeliveriesForEvent(campaign.linkedEventId);
    } catch (cause) {
      console.error("[minha-devocao] falha ao reagendar após atualização da campanha", cause);
    }
  }

  const existingConditions = await db
    .select({ id: devotionConditions.id, sortOrder: devotionConditions.sortOrder })
    .from(devotionConditions)
    .where(
      and(
        eq(devotionConditions.campaignId, campaign.id),
        eq(devotionConditions.userId, userId),
      ),
    )
    .orderBy(asc(devotionConditions.sortOrder));

  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index];
    const existing = existingConditions[index];

    if (existing) {
      await db
        .update(devotionConditions)
        .set({
          name: condition.name,
          description: condition.description,
        })
        .where(eq(devotionConditions.id, existing.id));
      continue;
    }

    await db.insert(devotionConditions).values({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      userId,
      name: condition.name,
      description: condition.description,
      sortOrder: condition.sortOrder,
    });
  }

  const obsoleteConditions = existingConditions.slice(conditions.length);
  if (obsoleteConditions.length > 0) {
    await db
      .delete(devotionConditions)
      .where(inArray(devotionConditions.id, obsoleteConditions.map((item) => item.id)));
  }

  const existingLogs = await db
    .select({ id: devotionDailyLogs.id, dateLocal: devotionDailyLogs.dateLocal })
    .from(devotionDailyLogs)
    .where(and(eq(devotionDailyLogs.campaignId, campaign.id), eq(devotionDailyLogs.userId, userId)));

  for (const log of existingLogs) {
    const dayIndex = getDayIndexFromStart(newStartDateIso, log.dateLocal);
    const outsideRange = dayIndex < 1 || dayIndex > parsed.durationDays || log.dateLocal > newEndDateIso;

    if (outsideRange) {
      await db.delete(devotionDailyLogs).where(eq(devotionDailyLogs.id, log.id));
      continue;
    }

    await db
      .update(devotionDailyLogs)
      .set({
        dayIndex,
        updatedAt: now,
      })
      .where(eq(devotionDailyLogs.id, log.id));
  }

  const existingConditionStatuses = await db
    .select({ id: devotionConditionDailyStatuses.id, dateLocal: devotionConditionDailyStatuses.dateLocal })
    .from(devotionConditionDailyStatuses)
    .where(
      and(
        eq(devotionConditionDailyStatuses.campaignId, campaign.id),
        eq(devotionConditionDailyStatuses.userId, userId),
      ),
    );

  for (const status of existingConditionStatuses) {
    const dayIndex = getDayIndexFromStart(newStartDateIso, status.dateLocal);
    const outsideRange = dayIndex < 1 || dayIndex > parsed.durationDays || status.dateLocal > newEndDateIso;

    if (outsideRange) {
      await db.delete(devotionConditionDailyStatuses).where(eq(devotionConditionDailyStatuses.id, status.id));
      continue;
    }

    await db
      .update(devotionConditionDailyStatuses)
      .set({
        dayIndex,
        updatedAt: now,
      })
      .where(eq(devotionConditionDailyStatuses.id, status.id));
  }

  revalidatePath(`/minha-devocao/${campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function deleteDevotionCampaignAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = deleteCampaignSchema.parse({
    campaignId: formData.get("campaignId"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:campaign:delete", {
    campaignId: parsed.campaignId,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:campaign:delete",
    actionKey,
    ttlSeconds: 180,
  });

  if (!canProcess) {
    return;
  }

  const campaign = await getCampaignOwnedByUser(parsed.campaignId, userId);

  if (!campaign) {
    throw new Error("Campanha não encontrada.");
  }

  if (campaign.linkedEventId) {
    await db
      .update(notificationDeliveries)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
        errorMessage: "Campanha removida pelo usuário.",
      })
      .where(
        and(
          eq(notificationDeliveries.userId, userId),
          eq(notificationDeliveries.eventId, campaign.linkedEventId),
          eq(notificationDeliveries.status, "pending"),
        ),
      );

    await db
      .delete(userEvents)
      .where(and(eq(userEvents.id, campaign.linkedEventId), eq(userEvents.userId, userId)));
  }

  await db.delete(devotionCampaigns).where(eq(devotionCampaigns.id, campaign.id));

  revalidatePath("/minha-devocao");
  redirect("/minha-devocao");
}

