import Link from "next/link";
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
  getTodayCatholicEvent,
} from "@/lib/liturgical-calendar";

export default async function InicioPage() {
  const session = await auth();
  const today = new Date();
  const todayEvent = getTodayCatholicEvent(today);

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-emerald-700">
            Bem-vindo(a){session?.user?.name ? `, ${session.user.name}` : ""} 👋
          </p>
          {session?.user ? (
            <LogoutButton />
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/entrar"
                className="inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                <LoginIcon className="mr-2 size-4" />
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
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

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
          <SparkIcon className="size-5" /> Destaque do dia
        </h2>
        <p className="mt-2 text-sm text-emerald-800">
          {todayEvent
            ? `${todayEvent.title} · ${todayEvent.type}`
            : "Hoje não há solenidade fixa cadastrada. Confira o calendário completo."}
        </p>
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
            Veja as datas litúrgicas importantes do mês.
          </p>
        </Link>
      </section>
    </main>
  );
}
