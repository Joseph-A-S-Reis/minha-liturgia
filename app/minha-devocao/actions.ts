"use server";

import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  devotionCampaigns,
  devotionConfessionNotes,
  devotionConfessionSins,
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
  CONFESSION_FREQUENCY_OPTIONS,
  CONFESSION_NATURE_OPTIONS_BY_TYPE,
  CONFESSION_NATURE_OPTIONS,
  CONFESSION_ROOT_SINS,
  CONFESSION_SIN_TYPES,
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
    purpose: z.string().trim().max(140).optional(),
    type: devotionTypeSchema,
    durationDays: z.coerce.number().int().min(1).max(730),
    startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string().trim().min(3).max(80).default("America/Sao_Paulo"),
    priestName: z.string().trim().max(140).optional(),
    conditionNames: z.array(z.string().trim().max(140)).max(12).default([]),
    conditionDescriptions: z.array(z.string().trim().max(500)).max(12).default([]),
    confessionSinTypes: z.array(z.string().trim().max(24)).max(60).default([]),
    confessionNatures: z.array(z.string().trim().max(180)).max(60).default([]),
    confessionRootSins: z.array(z.string().trim().max(48)).max(60).default([]),
    confessionFrequencies: z.array(z.string().trim().max(60)).max(60).default([]),
    confessionDetails: z.array(z.string().trim().max(2_000)).max(60).default([]),
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

function normalizeConfessionSins(params: {
  sinTypes: string[];
  natures: string[];
  rootSins: string[];
  frequencies: string[];
  details: string[];
}) {
  const sins: Array<{
    sinType: (typeof CONFESSION_SIN_TYPES)[number];
    nature: (typeof CONFESSION_NATURE_OPTIONS)[number] | null;
    rootSin: (typeof CONFESSION_ROOT_SINS)[number];
    frequency: string | null;
    details: string | null;
    sortOrder: number;
  }> = [];

  const rows = Math.max(
    params.sinTypes.length,
    params.natures.length,
    params.rootSins.length,
    params.frequencies.length,
    params.details.length,
  );

  for (let index = 0; index < rows; index += 1) {
    const rawSinType = params.sinTypes[index]?.trim() ?? "";
    const rawNature = params.natures[index]?.trim() ?? "";
    const rawRootSin = params.rootSins[index]?.trim() ?? "";
    const rawFrequency = params.frequencies[index]?.trim() ?? "";
    const rawDetails = params.details[index]?.trim() ?? "";

    if (!rawSinType || !rawRootSin) {
      continue;
    }

    const sinType = confessionSinTypeSchema.parse(rawSinType);
    const nature = normalizeConfessionNature(sinType, rawNature);
    const rootSin = confessionRootSinSchema.parse(rawRootSin);
    const frequency = rawFrequency.length > 0 ? confessionFrequencySchema.parse(rawFrequency) : null;

    sins.push({
      sinType,
      nature,
      rootSin,
      frequency,
      details: rawDetails.length > 0 ? rawDetails : null,
      sortOrder: sins.length,
    });
  }

  return sins;
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

const confessionSinTypeSchema = z.enum(CONFESSION_SIN_TYPES);
const confessionNatureSchema = z.enum(CONFESSION_NATURE_OPTIONS);
const confessionGodNatureSchema = z.enum(CONFESSION_NATURE_OPTIONS_BY_TYPE.mandamento_de_deus);
const confessionChurchNatureSchema = z.enum(CONFESSION_NATURE_OPTIONS_BY_TYPE.mandamento_da_igreja);
const confessionRootSinSchema = z.enum(CONFESSION_ROOT_SINS);
const confessionFrequencySchema = z.enum(CONFESSION_FREQUENCY_OPTIONS);

function normalizeConfessionNature(
  sinType: (typeof CONFESSION_SIN_TYPES)[number],
  rawNature: string,
): (typeof CONFESSION_NATURE_OPTIONS)[number] | null {
  const normalizedNature = rawNature.trim();

  if (sinType === "outro") {
    return null;
  }

  if (!normalizedNature) {
    throw new Error("Selecione a natureza para o tipo informado.");
  }

  if (sinType === "mandamento_de_deus") {
    return confessionGodNatureSchema.parse(normalizedNature);
  }

  return confessionChurchNatureSchema.parse(normalizedNature);
}

const confessionNoteSchema = z.object({
  campaignId: z.string().trim().min(1),
  note: z.string().trim().min(1, "Informe a anotação.").max(12_000),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const updateConfessionNoteSchema = z.object({
  campaignId: z.string().trim().min(1),
  noteId: z.string().trim().min(1),
  note: z.string().trim().min(1, "Informe a anotação.").max(12_000),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const deleteConfessionNoteSchema = z.object({
  campaignId: z.string().trim().min(1),
  noteId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const confessionSinSchema = z.object({
  campaignId: z.string().trim().min(1),
  sinType: confessionSinTypeSchema,
  nature: z.string().trim().max(180).optional(),
  rootSin: confessionRootSinSchema,
  frequency: z.union([confessionFrequencySchema, z.literal("")]).optional(),
  details: z.string().trim().max(2_000).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const updateConfessionSinSchema = z.object({
  campaignId: z.string().trim().min(1),
  sinId: z.string().trim().min(1),
  sinType: confessionSinTypeSchema,
  nature: z.string().trim().max(180).optional(),
  rootSin: confessionRootSinSchema,
  frequency: z.union([confessionFrequencySchema, z.literal("")]).optional(),
  details: z.string().trim().max(2_000).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const toggleConfessionSinSchema = z.object({
  campaignId: z.string().trim().min(1),
  sinId: z.string().trim().min(1),
  isConfessed: z.coerce.boolean(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const deleteConfessionSinSchema = z.object({
  campaignId: z.string().trim().min(1),
  sinId: z.string().trim().min(1),
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

async function requireConfessionCampaign(campaignId: string, userId: string) {
  const campaign = await getCampaignOwnedByUser(campaignId, userId);

  if (!campaign) {
    throw new Error("Campanha não encontrada.");
  }

  if (campaign.type !== "confissao") {
    throw new Error("Esta ação é exclusiva para campanhas de confissão.");
  }

  return campaign;
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

  if (campaign.type === "confissao") {
    throw new Error("Campanhas de confissão não possuem check-in diário.");
  }

  const startDate = normalizeStartDate(campaign.startDate);
  const dayIndex = getDayIndexFromStart(startDate, params.dateLocal);
  const endDate = getCampaignEndIsoDate(startDate, campaign.durationDays);

  if (dayIndex < 1 || dayIndex > campaign.durationDays || params.dateLocal > endDate) {
    throw new Error("A data informada está fora da duração da campanha.");
  }

  return {
    mode: "daily" as const,
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
    confessionSinTypes: formData.getAll("confessionSinType"),
    confessionNatures: formData.getAll("confessionNature"),
    confessionRootSins: formData.getAll("confessionRootSin"),
    confessionFrequencies: formData.getAll("confessionFrequency"),
    confessionDetails: formData.getAll("confessionDetails"),
    reminderMinutes: formData.getAll("reminderMinutes"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const [userPreference] = await db
    .select({ timezone: notificationPreferences.timezone })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  const timezone = userPreference?.timezone || parsed.timezone || "America/Sao_Paulo";
  const isConfession = parsed.type === "confissao";
  const todayIso = getTodayIsoForTimezone(timezone);
  const purpose = isConfession
    ? "Preparação para confissão"
    : (parsed.purpose ?? "").trim();

  if (!isConfession && purpose.length < 2) {
    throw new Error("Informe um propósito.");
  }

  const normalizedDurationDays = isConfession
    ? Math.max(1, getDayIndexFromStart(todayIso, parsed.startDate))
    : parsed.durationDays;
  const conditions = isConfession
    ? []
    : normalizeConditions(parsed.conditionNames, parsed.conditionDescriptions);
  const confessionSins = isConfession
    ? normalizeConfessionSins({
        sinTypes: parsed.confessionSinTypes,
        natures: parsed.confessionNatures,
        rootSins: parsed.confessionRootSins,
        frequencies: parsed.confessionFrequencies,
        details: parsed.confessionDetails,
      })
    : [];
  const reminderMinutes = normalizeReminderMinutes(parsed.reminderMinutes);

  const actionKey = createIdempotencyKey("devotion:campaign:create", {
    name: parsed.name,
    purpose,
    type: parsed.type,
    durationDays: normalizedDurationDays,
    conditions,
    confessionSins,
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
  const eventStartIso = isConfession ? todayIso : parsed.startDate;
  const startsAt = new Date(`${eventStartIso}T09:00:00.000Z`);
  const recurrenceUntil = new Date(startsAt);
  recurrenceUntil.setUTCDate(recurrenceUntil.getUTCDate() + Math.max(0, normalizedDurationDays - 1));

  await db.insert(userEvents).values({
    id: linkedEventId,
    userId,
    title: `Minha Devoção · ${parsed.name}`,
    message: parsed.description || `Campanha de ${parsed.type} (${purpose}).`,
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
    purpose,
    type: parsed.type,
    durationDays: normalizedDurationDays,
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

  if (confessionSins.length > 0) {
    await db.insert(devotionConfessionSins).values(
      confessionSins.map((sin) => ({
        id: crypto.randomUUID(),
        campaignId,
        userId,
        sinType: sin.sinType,
        nature: sin.nature,
        rootSin: sin.rootSin,
        frequency: sin.frequency,
        details: sin.details,
        sortOrder: sin.sortOrder,
        updatedAt: new Date(),
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

  const confessionSins = await db
    .select({
      campaignId: devotionConfessionSins.campaignId,
      isConfessed: devotionConfessionSins.isConfessed,
    })
    .from(devotionConfessionSins)
    .where(
      and(
        inArray(devotionConfessionSins.campaignId, campaignIds),
        eq(devotionConfessionSins.userId, userId),
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

  const confessionTotalsMap = new Map<string, number>();
  const confessionDoneMap = new Map<string, number>();
  for (const confessionSin of confessionSins) {
    confessionTotalsMap.set(
      confessionSin.campaignId,
      (confessionTotalsMap.get(confessionSin.campaignId) ?? 0) + 1,
    );

    if (confessionSin.isConfessed) {
      confessionDoneMap.set(
        confessionSin.campaignId,
        (confessionDoneMap.get(confessionSin.campaignId) ?? 0) + 1,
      );
    }
  }

  return campaigns.map((campaign) => {
    const isConfession = campaign.type === "confissao";
    const checkedInDays = checkinsByCampaign.get(campaign.id) ?? 0;
    const confessionItemsTotal = confessionTotalsMap.get(campaign.id) ?? 0;
    const confessionItemsConfessed = confessionDoneMap.get(campaign.id) ?? 0;
    const progressPercent = isConfession
      ? confessionItemsTotal > 0
        ? Math.round((confessionItemsConfessed / confessionItemsTotal) * 100)
        : 0
      : Math.round((checkedInDays / campaign.durationDays) * 100);

    return {
      ...campaign,
      checkedInDays,
      progressPercent,
      reminderMinutes: reminderMap.get(campaign.id) ?? [],
      conditionCount: conditionCountMap.get(campaign.id) ?? 0,
      confessionItemsTotal,
      confessionItemsConfessed,
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

  if (campaign.type === "confissao") {
    const confessionNotes = await db
      .select({
        id: devotionConfessionNotes.id,
        note: devotionConfessionNotes.note,
        sortOrder: devotionConfessionNotes.sortOrder,
        createdAt: devotionConfessionNotes.createdAt,
        updatedAt: devotionConfessionNotes.updatedAt,
      })
      .from(devotionConfessionNotes)
      .where(
        and(
          eq(devotionConfessionNotes.campaignId, campaign.id),
          eq(devotionConfessionNotes.userId, userId),
        ),
      )
      .orderBy(asc(devotionConfessionNotes.sortOrder), asc(devotionConfessionNotes.createdAt));

    const confessionSins = await db
      .select({
        id: devotionConfessionSins.id,
        sinType: devotionConfessionSins.sinType,
        nature: devotionConfessionSins.nature,
        rootSin: devotionConfessionSins.rootSin,
        frequency: devotionConfessionSins.frequency,
        details: devotionConfessionSins.details,
        isConfessed: devotionConfessionSins.isConfessed,
        sortOrder: devotionConfessionSins.sortOrder,
        createdAt: devotionConfessionSins.createdAt,
        updatedAt: devotionConfessionSins.updatedAt,
      })
      .from(devotionConfessionSins)
      .where(
        and(
          eq(devotionConfessionSins.campaignId, campaign.id),
          eq(devotionConfessionSins.userId, userId),
        ),
      )
      .orderBy(asc(devotionConfessionSins.sortOrder), asc(devotionConfessionSins.createdAt));

    const totalItems = confessionSins.length;
    const confessedItems = confessionSins.filter((item) => item.isConfessed).length;

    const verseOfDay = await getDeterministicVerseOfDay({
      purpose: campaign.purpose,
      dayIndex: 1,
      versionId: "ave-maria",
    });

    return {
      mode: "confissao" as const,
      campaign,
      startDate,
      endDate: startDate,
      todayIso,
      currentDayIndex: 1,
      checkedInDays: 0,
      progressPercent: totalItems > 0 ? Math.round((confessedItems / totalItems) * 100) : 0,
      reminders: reminders.filter((item) => item.isEnabled).map((item) => item.remindBeforeMinutes),
      conditions: [],
      days: [],
      confessionDate: startDate,
      confessionNotes,
      confessionSins,
      confessionSummary: {
        totalItems,
        confessedItems,
      },
      verseOfDay,
    };
  }

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

export async function addConfessionNoteAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = confessionNoteSchema.parse({
    campaignId: formData.get("campaignId"),
    note: formData.get("note"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:confession:note:add", {
    campaignId: parsed.campaignId,
    note: parsed.note,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:confession:note:add",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const campaign = await requireConfessionCampaign(parsed.campaignId, userId);

  const [lastNote] = await db
    .select({ sortOrder: devotionConfessionNotes.sortOrder })
    .from(devotionConfessionNotes)
    .where(
      and(
        eq(devotionConfessionNotes.campaignId, campaign.id),
        eq(devotionConfessionNotes.userId, userId),
      ),
    )
    .orderBy(desc(devotionConfessionNotes.sortOrder))
    .limit(1);

  await db.insert(devotionConfessionNotes).values({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    userId,
    note: parsed.note,
    sortOrder: (lastNote?.sortOrder ?? -1) + 1,
    updatedAt: new Date(),
  });

  await db
    .update(devotionCampaigns)
    .set({ updatedAt: new Date() })
    .where(eq(devotionCampaigns.id, campaign.id));

  revalidatePath(`/minha-devocao/${campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function updateConfessionNoteAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = updateConfessionNoteSchema.parse({
    campaignId: formData.get("campaignId"),
    noteId: formData.get("noteId"),
    note: formData.get("note"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:confession:note:update", {
    campaignId: parsed.campaignId,
    noteId: parsed.noteId,
    note: parsed.note,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:confession:note:update",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const campaign = await requireConfessionCampaign(parsed.campaignId, userId);

  await db
    .update(devotionConfessionNotes)
    .set({
      note: parsed.note,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(devotionConfessionNotes.id, parsed.noteId),
        eq(devotionConfessionNotes.campaignId, campaign.id),
        eq(devotionConfessionNotes.userId, userId),
      ),
    );

  await db
    .update(devotionCampaigns)
    .set({ updatedAt: new Date() })
    .where(eq(devotionCampaigns.id, campaign.id));

  revalidatePath(`/minha-devocao/${campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function deleteConfessionNoteAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = deleteConfessionNoteSchema.parse({
    campaignId: formData.get("campaignId"),
    noteId: formData.get("noteId"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:confession:note:delete", {
    campaignId: parsed.campaignId,
    noteId: parsed.noteId,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:confession:note:delete",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const campaign = await requireConfessionCampaign(parsed.campaignId, userId);

  await db
    .delete(devotionConfessionNotes)
    .where(
      and(
        eq(devotionConfessionNotes.id, parsed.noteId),
        eq(devotionConfessionNotes.campaignId, campaign.id),
        eq(devotionConfessionNotes.userId, userId),
      ),
    );

  await db
    .update(devotionCampaigns)
    .set({ updatedAt: new Date() })
    .where(eq(devotionCampaigns.id, campaign.id));

  revalidatePath(`/minha-devocao/${campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function addConfessionSinAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = confessionSinSchema.parse({
    campaignId: formData.get("campaignId"),
    sinType: formData.get("sinType"),
    nature: formData.get("nature"),
    rootSin: formData.get("rootSin"),
    frequency: formData.get("frequency"),
    details: formData.get("details"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:confession:sin:add", {
    campaignId: parsed.campaignId,
    sinType: parsed.sinType,
    nature: normalizeConfessionNature(parsed.sinType, parsed.nature ?? ""),
    rootSin: parsed.rootSin,
    frequency: parsed.frequency ?? null,
    details: parsed.details ?? null,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:confession:sin:add",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const campaign = await requireConfessionCampaign(parsed.campaignId, userId);
  const nature = normalizeConfessionNature(parsed.sinType, parsed.nature ?? "");

  const [lastSin] = await db
    .select({ sortOrder: devotionConfessionSins.sortOrder })
    .from(devotionConfessionSins)
    .where(
      and(
        eq(devotionConfessionSins.campaignId, campaign.id),
        eq(devotionConfessionSins.userId, userId),
      ),
    )
    .orderBy(desc(devotionConfessionSins.sortOrder))
    .limit(1);

  await db.insert(devotionConfessionSins).values({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    userId,
    sinType: parsed.sinType,
    nature,
    rootSin: parsed.rootSin,
    frequency: parsed.frequency || null,
    details: parsed.details || null,
    sortOrder: (lastSin?.sortOrder ?? -1) + 1,
    updatedAt: new Date(),
  });

  await db
    .update(devotionCampaigns)
    .set({ updatedAt: new Date() })
    .where(eq(devotionCampaigns.id, campaign.id));

  revalidatePath(`/minha-devocao/${campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function updateConfessionSinAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = updateConfessionSinSchema.parse({
    campaignId: formData.get("campaignId"),
    sinId: formData.get("sinId"),
    sinType: formData.get("sinType"),
    nature: formData.get("nature"),
    rootSin: formData.get("rootSin"),
    frequency: formData.get("frequency"),
    details: formData.get("details"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:confession:sin:update", {
    campaignId: parsed.campaignId,
    sinId: parsed.sinId,
    sinType: parsed.sinType,
    nature: normalizeConfessionNature(parsed.sinType, parsed.nature ?? ""),
    rootSin: parsed.rootSin,
    frequency: parsed.frequency ?? null,
    details: parsed.details ?? null,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:confession:sin:update",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const campaign = await requireConfessionCampaign(parsed.campaignId, userId);
  const nature = normalizeConfessionNature(parsed.sinType, parsed.nature ?? "");

  await db
    .update(devotionConfessionSins)
    .set({
      sinType: parsed.sinType,
      nature,
      rootSin: parsed.rootSin,
      frequency: parsed.frequency || null,
      details: parsed.details || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(devotionConfessionSins.id, parsed.sinId),
        eq(devotionConfessionSins.campaignId, campaign.id),
        eq(devotionConfessionSins.userId, userId),
      ),
    );

  await db
    .update(devotionCampaigns)
    .set({ updatedAt: new Date() })
    .where(eq(devotionCampaigns.id, campaign.id));

  revalidatePath(`/minha-devocao/${campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function toggleConfessionSinAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = toggleConfessionSinSchema.parse({
    campaignId: formData.get("campaignId"),
    sinId: formData.get("sinId"),
    isConfessed: formData.get("isConfessed") === "true",
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:confession:sin:toggle", {
    campaignId: parsed.campaignId,
    sinId: parsed.sinId,
    isConfessed: parsed.isConfessed,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:confession:sin:toggle",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const campaign = await requireConfessionCampaign(parsed.campaignId, userId);

  await db
    .update(devotionConfessionSins)
    .set({
      isConfessed: parsed.isConfessed,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(devotionConfessionSins.id, parsed.sinId),
        eq(devotionConfessionSins.campaignId, campaign.id),
        eq(devotionConfessionSins.userId, userId),
      ),
    );

  await db
    .update(devotionCampaigns)
    .set({ updatedAt: new Date() })
    .where(eq(devotionCampaigns.id, campaign.id));

  revalidatePath(`/minha-devocao/${campaign.id}`);
  revalidatePath("/minha-devocao");
}

export async function deleteConfessionSinAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = deleteConfessionSinSchema.parse({
    campaignId: formData.get("campaignId"),
    sinId: formData.get("sinId"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("devotion:confession:sin:delete", {
    campaignId: parsed.campaignId,
    sinId: parsed.sinId,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "devotion:confession:sin:delete",
    actionKey,
    ttlSeconds: 120,
  });

  if (!canProcess) {
    return;
  }

  const campaign = await requireConfessionCampaign(parsed.campaignId, userId);

  await db
    .delete(devotionConfessionSins)
    .where(
      and(
        eq(devotionConfessionSins.id, parsed.sinId),
        eq(devotionConfessionSins.campaignId, campaign.id),
        eq(devotionConfessionSins.userId, userId),
      ),
    );

  await db
    .update(devotionCampaigns)
    .set({ updatedAt: new Date() })
    .where(eq(devotionCampaigns.id, campaign.id));

  revalidatePath(`/minha-devocao/${campaign.id}`);
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

  const isConfession = parsed.type === "confissao";
  const normalizedDurationDays = isConfession ? 1 : parsed.durationDays;
  const conditions = isConfession
    ? []
    : normalizeConditions(parsed.conditionNames, parsed.conditionDescriptions);
  const actionKey = createIdempotencyKey("devotion:campaign:update", {
    campaignId: parsed.campaignId,
    name: parsed.name,
    description: parsed.description ?? null,
    purpose: parsed.purpose,
    type: parsed.type,
    durationDays: normalizedDurationDays,
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
  recurrenceUntil.setUTCDate(recurrenceUntil.getUTCDate() + Math.max(0, normalizedDurationDays - 1));
  const now = new Date();
  const newStartDateIso = parsed.startDate;
  const newEndDateIso = getCampaignEndIsoDate(newStartDateIso, normalizedDurationDays);

  await db
    .update(devotionCampaigns)
    .set({
      name: parsed.name,
      description: parsed.description,
      purpose: parsed.purpose,
      type: parsed.type,
      durationDays: normalizedDurationDays,
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

  if (isConfession) {
    await db
      .delete(devotionConditionDailyStatuses)
      .where(
        and(
          eq(devotionConditionDailyStatuses.campaignId, campaign.id),
          eq(devotionConditionDailyStatuses.userId, userId),
        ),
      );

    await db
      .delete(devotionConditions)
      .where(and(eq(devotionConditions.campaignId, campaign.id), eq(devotionConditions.userId, userId)));

    await db
      .delete(devotionDailyLogs)
      .where(and(eq(devotionDailyLogs.campaignId, campaign.id), eq(devotionDailyLogs.userId, userId)));
  } else {
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
      const outsideRange =
        dayIndex < 1 || dayIndex > normalizedDurationDays || log.dateLocal > newEndDateIso;

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
      const outsideRange =
        dayIndex < 1 || dayIndex > normalizedDurationDays || status.dateLocal > newEndDateIso;

      if (outsideRange) {
        await db
          .delete(devotionConditionDailyStatuses)
          .where(eq(devotionConditionDailyStatuses.id, status.id));
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
  }

  if (campaign.type === "confissao" && parsed.type !== "confissao") {
    await db
      .delete(devotionConfessionSins)
      .where(
        and(
          eq(devotionConfessionSins.campaignId, campaign.id),
          eq(devotionConfessionSins.userId, userId),
        ),
      );

    await db
      .delete(devotionConfessionNotes)
      .where(
        and(
          eq(devotionConfessionNotes.campaignId, campaign.id),
          eq(devotionConfessionNotes.userId, userId),
        ),
      );
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

