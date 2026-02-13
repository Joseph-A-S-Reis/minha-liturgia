export type CatholicEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  type: "solenidade" | "festa" | "memoria" | "tempo-liturgico";
};

const catholicFixedEvents: Array<{
  month: number;
  day: number;
  title: string;
  type: CatholicEvent["type"];
}> = [
  { month: 1, day: 1, title: "Santa Maria, Mãe de Deus", type: "solenidade" },
  { month: 2, day: 2, title: "Apresentação do Senhor", type: "festa" },
  { month: 3, day: 19, title: "São José", type: "solenidade" },
  { month: 3, day: 25, title: "Anunciação do Senhor", type: "solenidade" },
  { month: 6, day: 24, title: "Nascimento de São João Batista", type: "solenidade" },
  { month: 6, day: 29, title: "São Pedro e São Paulo", type: "solenidade" },
  { month: 8, day: 15, title: "Assunção de Nossa Senhora", type: "solenidade" },
  { month: 11, day: 1, title: "Todos os Santos", type: "solenidade" },
  { month: 12, day: 8, title: "Imaculada Conceição", type: "solenidade" },
  { month: 12, day: 25, title: "Natal do Senhor", type: "solenidade" },
];

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

  return catholicFixedEvents
    .filter((event) => event.month === month)
    .map((event) => ({
      title: event.title,
      type: event.type,
      date: toIsoDate(year, event.month, event.day),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
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
           type: "memoria" // Generic
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
