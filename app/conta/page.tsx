import Link from "next/link";
import { auth } from "@/auth";
import { LogoutButton } from "@/app/components/logout-button";

export default async function ContaPage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Conta</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Gerencie seu acesso e continue sua jornada espiritual.
        </p>
      </header>

      {session?.user ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-700">
            Você está conectado como <strong>{session.user.name ?? session.user.email}</strong>.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/inicio"
              className="inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              Voltar ao início
            </Link>
            <LogoutButton />
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-700">
            Entre para sincronizar diário, calendário e anotações da Bíblia.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/entrar"
              className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white! transition hover:bg-emerald-800"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="inline-flex items-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              Criar conta
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
