import { auth } from "@/auth";
import {
  formatDatePtBr,
  getLocalIsoDate,
  getMonthCatholicEvents,
  getTodayCatholicEvent,
  getYearCatholicEvents,
} from "@/lib/liturgical-calendar";
import {
  createUserEventAction,
  deleteUserEventAction,
  getUserCalendarEventsAction,
} from "./event-actions";
import { CalendarIcon, CheckCircleIcon, SparkIcon } from "@/app/components/icons";
import { IcsSubscriptionCard } from "@/app/components/ics-subscription-card";
import { NotificationPreferencesCard } from "@/app/components/notification-preferences-card";
import { PushSubscriptionCard } from "@/app/components/push-subscription-card";

const categoryLabel: Record<string, string> = {
  igreja: "Igreja",
  penitencia: "Penitência",
  jejum: "Jejum",
  caridade: "Caridade",
};

const typeLabel: Record<string, string> = {
  solenidade: "Solenidade",
  festa: "Festa",
  memoria: "Memória",
  "tempo-liturgico": "Tempo Litúrgico",
  observancia: "Observância",
};

const recurrenceLabel: Record<string, string> = {
  none: "Sem recorrência",
  daily: "Diariamente",
  weekly: "Semanalmente",
  monthly: "Mensalmente",
  yearly: "Anualmente",
};

export default async function CalendarioPage() {
  const session = await auth();
  const now = new Date();
  const year = now.getFullYear();
  const todayIso = getLocalIsoDate(now);
  const events = getMonthCatholicEvents(now);
  const todayEvent = getTodayCatholicEvent(now);
  const yearEvents = getYearCatholicEvents(year);
  const userEvents = session?.user?.id ? await getUserCalendarEventsAction() : [];

  const eventsByMonth = new Map<number, typeof yearEvents>();
  for (const event of yearEvents) {
    const [, month] = event.date.split("-");
    const key = Number(month);
    const current = eventsByMonth.get(key) ?? [];
    current.push(event);
    eventsByMonth.set(key, current);
  }

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2">
          <CalendarIcon className="size-8" />
          Calendário Católico
        </h1>
        <p className="text-zinc-600">
          Visão anual litúrgica com destaques de Igreja, penitência, jejum e caridade.
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
        <h2 className="font-semibold text-zinc-900">Eventos do mês atual</h2>
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
                    {formatDatePtBr(event.date)} · {typeLabel[event.type] ?? event.type}
                    {isToday ? " · hoje" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-zinc-900">Ano litúrgico {year}</h2>
          <p className="text-xs font-medium text-zinc-600">
            {yearEvents.length} eventos litúrgicos mapeados neste momento
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {Object.entries(categoryLabel).map(([key, label]) => (
            <span key={key} className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700">
              {label}
            </span>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const monthEvents = eventsByMonth.get(month) ?? [];
            const monthLabel = new Intl.DateTimeFormat("pt-BR", {
              month: "long",
            }).format(new Date(year, month - 1, 1));

            return (
              <article key={month} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                <h3 className="text-sm font-semibold capitalize text-zinc-900">{monthLabel}</h3>

                {monthEvents.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">Sem eventos cadastrados para este mês.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {monthEvents.map((event) => (
                      <li
                        key={`${event.date}-${event.title}`}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          event.date === todayIso
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-zinc-200 bg-white"
                        }`}
                      >
                        <p className="font-semibold text-zinc-900">{event.title}</p>
                        <p className="mt-0.5 text-zinc-600">
                          {formatDatePtBr(event.date)} · {typeLabel[event.type] ?? event.type}
                        </p>
                        {event.categories?.length ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {event.categories.map((category) => (
                              <span
                                key={`${event.date}-${event.title}-${category}`}
                                className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700"
                              >
                                {categoryLabel[category] ?? category}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">Agenda pessoal</h2>

        {!session?.user?.id ? (
          <p className="mt-2 text-sm text-zinc-600">
            Entre na sua conta para criar eventos pessoais com lembrete antecipado.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <IcsSubscriptionCard />
              <PushSubscriptionCard />
              <NotificationPreferencesCard />
            </div>

            <form action={createUserEventAction} className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
              <input
                type="text"
                name="title"
                required
                maxLength={160}
                placeholder="Título do evento"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
              />
              <input
                type="date"
                name="eventDate"
                required
                title="Data do evento"
                aria-label="Data do evento"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
              />
              <textarea
                name="message"
                placeholder="Mensagem/intenção (opcional)"
                rows={3}
                className="sm:col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
              />
              <select
                name="recurrence"
                defaultValue="none"
                title="Recorrência do evento"
                aria-label="Recorrência do evento"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
              >
                <option value="none">Sem recorrência</option>
                <option value="daily">Diária</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  name="recurrenceInterval"
                  min={1}
                  max={30}
                  defaultValue={1}
                  title="Intervalo de recorrência"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
                />
                <input
                  type="date"
                  name="recurrenceUntil"
                  title="Repetir até (opcional)"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
                />
              </div>
              <select
                name="remindBeforeMinutes"
                defaultValue="60"
                title="Antecedência do lembrete"
                aria-label="Antecedência do lembrete"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
              >
                <option value="0">Sem lembrete</option>
                <option value="30">30 minutos antes</option>
                <option value="60">1 hora antes</option>
                <option value="180">3 horas antes</option>
                <option value="1440">1 dia antes</option>
                <option value="4320">3 dias antes</option>
                <option value="10080">7 dias antes</option>
              </select>
              <input type="hidden" name="timezone" value="America/Sao_Paulo" />
              <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />

              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white! transition hover:bg-emerald-800"
                >
                  Salvar evento
                </button>
              </div>
            </form>

            {userEvents.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600">Nenhum evento pessoal criado ainda.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {userEvents.map((event) => (
                  <li key={event.id} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-900">{event.title}</p>
                        <p className="text-sm text-zinc-600">{formatDatePtBr(getLocalIsoDate(event.startAt))}</p>
                        <p className="text-xs font-medium text-zinc-600">
                          {recurrenceLabel[event.recurrence] ?? recurrenceLabel.none}
                        </p>
                        {event.message ? (
                          <p className="mt-1 text-sm text-zinc-700">{event.message}</p>
                        ) : null}
                      </div>

                      <form action={deleteUserEventAction}>
                        <input type="hidden" name="id" value={event.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          Excluir
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
