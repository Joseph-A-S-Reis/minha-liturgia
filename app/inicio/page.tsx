import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { LogoutButton } from "@/app/components/logout-button";
import {
  BookIcon,
  CalendarIcon,
  LoginIcon,
  PenIcon,
  SparkIcon,
} from "@/app/components/icons";
import {
  formatDatePtBr,
  getLocalIsoDate,
  getUpcomingCatholicEvents,
  getTodayCatholicEvent,
} from "@/lib/liturgical-calendar";
import { MariaAssistant } from "@/app/components/maria-assistant";
import { getDailyChurchHighlight } from "@/lib/maria/highlight";

export default async function InicioPage() {
  const session = await auth();
  const today = new Date();
  const todayEvent = getTodayCatholicEvent(today);
  const upcomingEvents = getUpcomingCatholicEvents(3);
  const churchHighlight = await getDailyChurchHighlight();
  const publishedLabel = churchHighlight?.publishedAt
    ? new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(churchHighlight.publishedAt))
    : null;

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-emerald-700">
            Bem-vindo(a){session?.user?.name ? `, ${session.user.name}` : ""} 👋
          </p>
          {session?.user ? (
            <LogoutButton />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/entrar"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                <LoginIcon className="size-4" />
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white! shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
              >
                Criar conta
              </Link>
            </div>
          )}
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">Início</h1>
        <p className="text-zinc-600">
          Hoje é {formatDatePtBr(getLocalIsoDate(today))}.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 via-teal-50 to-white shadow-sm">
        <div className="grid gap-0 md:grid-cols-[1.7fr,1fr]">
          <div className="p-5 sm:p-7">
            <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
              <SparkIcon className="size-5" /> Destaque do dia
            </h2>

            {churchHighlight ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                    {churchHighlight.sourceName}
                  </span>
                  {churchHighlight.category ? (
                    <span className="rounded-full border border-teal-300 bg-teal-100 px-2.5 py-1 font-semibold text-teal-800">
                      {churchHighlight.category}
                    </span>
                  ) : null}
                  {publishedLabel ? (
                    <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 font-medium text-zinc-600">
                      {publishedLabel}
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-4 text-lg font-bold leading-snug text-zinc-900 sm:text-xl">
                  {churchHighlight.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-zinc-700">
                  {churchHighlight.summary}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a
                    href={churchHighlight.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white! shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                  >
                    Ler notícia completa ↗
                  </a>
                  <span className="text-xs font-medium text-zinc-700">Fonte oficial da Igreja</span>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-emerald-900">
                {todayEvent
                  ? `${todayEvent.title} · ${todayEvent.type}`
                  : "Hoje não há solenidade fixa cadastrada. Confira o calendário completo."}
              </p>
            )}
          </div>

          {churchHighlight?.imageUrl ? (
            <a
              href={churchHighlight.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Abrir matéria completa: ${churchHighlight.title}`}
              title="Abrir matéria completa"
              className="group relative block min-h-56 border-t border-emerald-200 md:min-h-72 md:border-l md:border-t-0"
            >
              <Image
                src={churchHighlight.imageUrl}
                alt={`Imagem do destaque: ${churchHighlight.title}`}
                fill
                className="object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/45 to-transparent" />
            </a>
          ) : (
            <div className="hidden min-h-56 border-l border-emerald-200 bg-emerald-100/50 p-4 md:flex md:min-h-72 md:items-center md:justify-center">
              <p className="text-center text-xs font-medium text-emerald-800">
                Imagem indisponível para este destaque.
              </p>
            </div>
          )}
        </div>
      </section>

      {session?.user ? <MariaAssistant /> : null}

      <section className="xl:hidden rounded-2xl border border-sky-200 bg-white/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Próximos dias</h2>
        <ul className="mt-3 space-y-2">
          {upcomingEvents.map((event) => (
            <li
              key={`${event.date}-${event.title}`}
              className="flex items-start justify-between gap-4 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2"
            >
              <span className="text-sm font-medium text-zinc-800">{event.title}</span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-sky-700">
                {formatDatePtBr(event.date)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/biblia"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow"
        >
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><BookIcon className="size-4" /> Bíblia</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Acesse versões, livros e capítulos.
          </p>
        </Link>

        <Link
          href="/diario"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow"
        >
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><PenIcon className="size-4" /> Diário pessoal</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Escreva suas intenções e reflexões.
          </p>
        </Link>

        <Link
          href="/calendario"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow"
        >
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><CalendarIcon className="size-4" /> Calendário católico</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Veja as datas litúrgicas do ano e seus lembretes pessoais.
          </p>
        </Link>
      </section>
    </main>
  );
}
