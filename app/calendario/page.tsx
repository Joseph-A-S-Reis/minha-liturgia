import {
  formatDatePtBr,
  getLocalIsoDate,
  getMonthCatholicEvents,
  getTodayCatholicEvent,
} from "@/lib/liturgical-calendar";
import { CalendarIcon, CheckCircleIcon, SparkIcon } from "@/app/components/icons";

export default function CalendarioPage() {
  const now = new Date();
  const todayIso = getLocalIsoDate(now);
  const events = getMonthCatholicEvents(now);
  const todayEvent = getTodayCatholicEvent(now);

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2">
          <CalendarIcon className="size-8" />
          Calendário Católico
        </h1>
        <p className="text-zinc-600">
          Datas fixas importantes do mês com destaque para hoje.
        </p>
      </header>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2"><SparkIcon className="size-5" /> Hoje</h2>
        <p className="mt-2 text-sm text-emerald-800">
          {todayEvent
            ? `${todayEvent.title} (${todayEvent.type})`
            : "Sem data fixa especial hoje neste calendário inicial."}
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">Eventos do mês</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Nenhum evento fixo cadastrado para este mês.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {events.map((event) => {
              const isToday = event.date === todayIso;

              return (
                <li
                  key={event.date + event.title}
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    isToday
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-zinc-200 bg-zinc-50"
                  }`}
                >
                  <p className="font-medium text-zinc-900 flex items-center gap-2"><CheckCircleIcon className="size-4 text-emerald-700" /> {event.title}</p>
                  <p className="text-zinc-600">
                    {formatDatePtBr(event.date)} · {event.type}
                    {isToday ? " · hoje" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
