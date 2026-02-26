export const DEVOTION_TYPES = ["penitencia", "jejum", "oracao", "abstinencia"] as const;

export type DevotionType = (typeof DEVOTION_TYPES)[number];

export const DEVOTION_TYPE_LABELS: Record<DevotionType, string> = {
  penitencia: "Penitência",
  jejum: "Jejum",
  oracao: "Oração",
  abstinencia: "Abstinência",
};

export const MAX_RETROACTIVE_CHECKIN_DAYS = 3;

export const REMINDER_TIME_OPTIONS = [
  { minute: 15, label: "15 min antes" },
  { minute: 60, label: "1 hora antes" },
  { minute: 180, label: "3 horas antes" },
  { minute: 720, label: "12 horas antes" },
  { minute: 1440, label: "1 dia antes" },
] as const;

function isoFromParts(parts: Intl.DateTimeFormatPart[]) {
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

export function getLocalIsoDateForTimezone(date: Date, timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const maybeIso = isoFromParts(formatter.formatToParts(date));
    if (maybeIso) {
      return maybeIso;
    }
  } catch {
    // fallback para timezone inválido
  }

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayIsoForTimezone(timeZone: string): string {
  return getLocalIsoDateForTimezone(new Date(), timeZone);
}

export function isoDateToUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const base = isoDateToUtcDate(isoDate);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function diffInDaysIsoDates(fromIso: string, toIso: string): number {
  const from = isoDateToUtcDate(fromIso);
  const to = isoDateToUtcDate(toIso);
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function getDayIndexFromStart(startIsoDate: string, targetIsoDate: string): number {
  return diffInDaysIsoDates(startIsoDate, targetIsoDate) + 1;
}

export function getCampaignEndIsoDate(startIsoDate: string, durationDays: number): string {
  return addDaysToIsoDate(startIsoDate, Math.max(0, durationDays - 1));
}

export function canCheckInDate(params: {
  targetIsoDate: string;
  todayIsoDate: string;
  maxRetroDays?: number;
}) {
  const maxRetroDays = params.maxRetroDays ?? MAX_RETROACTIVE_CHECKIN_DAYS;
  const diff = diffInDaysIsoDates(params.targetIsoDate, params.todayIsoDate);

  return {
    isFuture: diff < 0,
    tooOld: diff > maxRetroDays,
    withinWindow: diff >= 0 && diff <= maxRetroDays,
    diff,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeReminderMinutes(values: number[]): number[] {
  const normalized = values
    .map((value) => Math.trunc(value))
    .filter((value) => value >= 0 && value <= 20_160);

  return [...new Set(normalized)].sort((a, b) => a - b);
}
