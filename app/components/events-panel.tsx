import Link from "next/link";
import { getUpcomingPanelDays } from "@/lib/calendar/upcoming-panel";
import { formatDatePtBr, getUpcomingConfirmedCatholicEvents } from "@/lib/liturgical-calendar";
import { CalendarIcon, CheckCircleIcon } from "./icons";

const liturgicalTypeLabel: Record<string, string> = {
  solenidade: "SOLENIDADE",
  festa: "FESTA",
  memoria: "MEMÓRIA",
  observancia: "OBSERVÂNCIA",
};

export async function EventsPanel({ userId }: { userId?: string | null }) {
  const upcomingDays = await getUpcomingPanelDays({
    days: 5,
    userId,
  });
  const upcomingConfirmedEvents = getUpcomingConfirmedCatholicEvents(5);

  return (
    <div className="w-72 bg-white/50 backdrop-blur-sm border-l border-sky-200 h-screen fixed right-0 top-0 p-6 overflow-y-auto hidden xl:block z-30 shadow-lg">
      <h3 className="text-xl font-serif font-bold mb-8 text-[#003366] border-b border-sky-200 pb-2 flex items-center gap-2">
        <CalendarIcon className="size-5" />
        Próximos Dias
      </h3>
      <div className="space-y-8">
        {upcomingDays.map((day) => {
           const event = day.liturgicalEvent;
           const [year, month, dayNumber] = day.date.split("-").map(Number);
           const dateObj = new Date(year, month - 1, dayNumber);
           const liturgicalLabel = liturgicalTypeLabel[event.type];

           return (
          <div key={day.date} className="group relative pl-4 border-l-2 border-sky-300 hover:border-[#003366] transition-colors">
                <div className="text-sm text-sky-700 font-bold mb-1 uppercase tracking-wider">
              {dateObj.toLocaleDateString("pt-BR", { day: "numeric", month: "long", weekday: "short" })}
                </div>
                {liturgicalLabel && (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 mb-2 border border-sky-200">
                        {liturgicalLabel}
                    </span>
                )}
                <div className="text-gray-900 font-serif text-lg leading-tight">
                  <CheckCircleIcon className="mr-1 inline size-4 text-sky-700" />
                    {event.title}
                </div>

                {day.userEvents.length > 0 ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800">
                      Seus eventos
                    </p>
                    <ul className="space-y-2">
                      {day.userEvents.map((userEvent) => (
                        <li key={userEvent.id} className="rounded-lg border border-emerald-100 bg-white/80 px-2.5 py-2 text-sm text-emerald-950 shadow-sm">
                          <p className="font-semibold leading-tight">{userEvent.title}</p>
                          {userEvent.message ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-emerald-900/80">
                              {userEvent.message}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
            </div>
          );
        })}
      </div>

      <section className="mt-8 border-t border-sky-200 pt-5">
        <h4 className="flex items-center gap-2 text-base font-serif font-bold text-[#003366]">
          <CheckCircleIcon className="size-4 text-sky-700" />
          Próximos eventos
        </h4>

        <ul className="mt-4 space-y-3">
          {upcomingConfirmedEvents.map((event) => (
            <li
              key={`${event.date}-${event.title}`}
              className="rounded-xl border border-sky-200 bg-white/80 px-3 py-3 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700">
                {formatDatePtBr(event.date)}
              </p>
              <p className="mt-1 text-sm font-semibold leading-tight text-[#003366]">
                {event.title}
              </p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                {liturgicalTypeLabel[event.type] ?? event.type}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 border-t border-sky-200 pt-4">
        <Link
          href="/calendario"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-4 py-3 text-sm font-semibold text-[#003366] transition hover:border-sky-400 hover:bg-sky-50"
        >
          <CalendarIcon className="size-4" />
          Abrir calendário completo
        </Link>
      </div>
    </div>
  );
}
