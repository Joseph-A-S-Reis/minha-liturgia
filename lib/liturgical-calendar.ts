export type CatholicEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  type: "solenidade" | "festa" | "memoria" | "tempo-liturgico" | "observancia";
  categories?: Array<"igreja" | "penitencia" | "jejum" | "caridade">;
  source?: "fixed" | "movable" | "generated";
  description?: string;
};

const catholicFixedEvents: Array<{
  month: number;
  day: number;
  title: string;
  type: CatholicEvent["type"];
  categories: NonNullable<CatholicEvent["categories"]>;
}> = [
  { month: 1, day: 1, title: "Santa Maria, Mãe de Deus", type: "solenidade", categories: ["igreja"] },
  { month: 2, day: 2, title: "Apresentação do Senhor", type: "festa", categories: ["igreja"] },
  { month: 3, day: 19, title: "São José", type: "solenidade", categories: ["igreja"] },
  { month: 3, day: 25, title: "Anunciação do Senhor", type: "solenidade", categories: ["igreja"] },
  { month: 6, day: 24, title: "Nascimento de São João Batista", type: "solenidade", categories: ["igreja"] },
  { month: 6, day: 29, title: "São Pedro e São Paulo", type: "solenidade", categories: ["igreja"] },
  { month: 8, day: 15, title: "Assunção de Nossa Senhora", type: "solenidade", categories: ["igreja"] },
  { month: 11, day: 1, title: "Todos os Santos", type: "solenidade", categories: ["igreja"] },
  { month: 12, day: 8, title: "Imaculada Conceição", type: "solenidade", categories: ["igreja"] },
  { month: 12, day: 25, title: "Natal do Senhor", type: "solenidade", categories: ["igreja"] },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(base.getDate() + days);
  return d;
}

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getMovableCatholicEvents(year: number): CatholicEvent[] {
  const easter = getEasterSunday(year);

  const movable = [
    {
      date: addDays(easter, -46),
      title: "Quarta-feira de Cinzas",
      type: "observancia" as const,
      categories: ["penitencia", "jejum"] as const,
      description: "Início da Quaresma, dia de jejum e abstinência.",
    },
    {
      date: addDays(easter, -7),
      title: "Domingo de Ramos",
      type: "festa" as const,
      categories: ["igreja"] as const,
    },
    {
      date: addDays(easter, -2),
      title: "Sexta-feira da Paixão",
      type: "observancia" as const,
      categories: ["penitencia", "jejum", "caridade"] as const,
      description: "Dia de jejum, abstinência e caridade.",
    },
    {
      date: easter,
      title: "Domingo da Páscoa",
      type: "solenidade" as const,
      categories: ["igreja"] as const,
    },
    {
      date: addDays(easter, 39),
      title: "Ascensão do Senhor",
      type: "solenidade" as const,
      categories: ["igreja"] as const,
    },
    {
      date: addDays(easter, 49),
      title: "Pentecostes",
      type: "solenidade" as const,
      categories: ["igreja"] as const,
    },
    {
      date: addDays(easter, 60),
      title: "Corpus Christi",
      type: "solenidade" as const,
      categories: ["igreja", "caridade"] as const,
    },
    {
      date: addDays(easter, 68),
      title: "Sagrado Coração de Jesus",
      type: "solenidade" as const,
      categories: ["igreja"] as const,
    },
  ];

  return movable
    .filter((event) => event.date.getFullYear() === year)
    .map((event) => ({
      title: event.title,
      type: event.type,
      date: toIsoDate(
        event.date.getFullYear(),
        event.date.getMonth() + 1,
        event.date.getDate(),
      ),
      categories: [...event.categories],
      source: "movable",
      description: event.description,
    }));
}

function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function getLocalIsoDate(date = new Date()): string {
  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function getMonthCatholicEvents(date = new Date()): CatholicEvent[] {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return getYearCatholicEvents(year).filter((event) => {
    const [, mm] = event.date.split("-");
    return Number(mm) === month;
  });
}

export function getYearCatholicEvents(
  year: number,
  options?: {
    categories?: NonNullable<CatholicEvent["categories"]>;
  },
): CatholicEvent[] {
  const fixed = catholicFixedEvents.map((event) => ({
    title: event.title,
    type: event.type,
    date: toIsoDate(year, event.month, event.day),
    categories: event.categories,
    source: "fixed" as const,
  }));

  const movable = getMovableCatholicEvents(year);
  const events = [...fixed, ...movable].sort((a, b) => a.date.localeCompare(b.date));

  const byKey = new Map<string, CatholicEvent>();
  for (const event of events) {
    byKey.set(`${event.date}-${event.title}`, event);
  }

  const merged = Array.from(byKey.values());

  if (!options?.categories?.length) {
    return merged;
  }

  const required = new Set(options.categories);
  return merged.filter((event) =>
    event.categories?.some((category) => required.has(category)),
  );
}

export function getTodayCatholicEvent(date = new Date()): CatholicEvent | null {
  const todayIso = getLocalIsoDate(date);
  const events = getMonthCatholicEvents(date);
  return events.find((e) => e.date === todayIso) || null;
}

export function getUpcomingCatholicEvents(days = 5): CatholicEvent[] {
  const events: CatholicEvent[] = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
     const d = new Date(today);
     d.setDate(today.getDate() + i);
     // Simplified gathering - mainly for the fixed events present in the file
     // In a real scenario, this would check romcal or a DB
     const dayEvents = getMonthCatholicEvents(d);
     const iso = getLocalIsoDate(d);
     const event = dayEvents.find(e => e.date === iso);
     
     if (event) {
        events.push(event);
     } else {
        // Add a placeholder generic day if no special event
        events.push({
           title: "Dia Ferial", // Or specific liturgical logic
           date: iso,
          type: "tempo-liturgico", // Generic
          categories: ["igreja"],
          source: "generated",
        });
     }
  }
  return events;
}


export function formatDatePtBr(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  }).format(date);
}
