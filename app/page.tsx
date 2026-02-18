import { BookIcon, CalendarIcon, HomeIcon, LoginIcon, PenIcon } from "./components/icons";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col justify-center gap-9 px-6 py-14 sm:gap-10 sm:px-10">
      <section className="space-y-5">
        <p className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          <HomeIcon className="mr-1 inline size-3.5" />
          Minha Liturgia
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Sua rotina católica em um só lugar.
        </h1>
        <p className="text-pretty text-zinc-600 sm:text-lg">
          Um app leve para acompanhar a Bíblia, registrar o diário espiritual e
          visualizar o calendário litúrgico com os destaques do dia.
        </p>
      </section>

      <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-3 sm:p-6">
        <article className="space-y-2">
          <h2 className="font-semibold text-zinc-900 flex items-center gap-2"><BookIcon className="size-4" /> Bíblia</h2>
          <p className="text-sm text-zinc-600">
            Leitura rápida por livro, capítulo e versão.
          </p>
        </article>
        <article className="space-y-2">
          <h2 className="font-semibold text-zinc-900 flex items-center gap-2"><PenIcon className="size-4" /> Diário pessoal</h2>
          <p className="text-sm text-zinc-600">
            Registre intenções, gratidão e reflexões diárias.
          </p>
        </article>
        <article className="space-y-2">
          <h2 className="font-semibold text-zinc-900 flex items-center gap-2"><CalendarIcon className="size-4" /> Calendário católico</h2>
          <p className="text-sm text-zinc-600">
            Datas importantes do mês, com foco no dia atual.
          </p>
        </article>
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <a
          href="/inicio"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white! shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
        >
          <HomeIcon className="size-4" />
          Entrar no aplicativo
        </a>
        <a
          href="/calendario"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-5 py-3 font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          <CalendarIcon className="size-4" />
          Ver calendário de hoje
        </a>
        <a
          href="/entrar"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-5 py-3 font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          <LoginIcon className="size-4" />
          Entrar na conta
        </a>
      </div>
    </main>
  );
}
