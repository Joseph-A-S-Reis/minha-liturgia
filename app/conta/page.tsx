import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AccountSettingsForms } from "./account-settings-forms";

export default async function ContaPage() {
  const session = await auth();
  const accountProfile = session?.user?.id
    ? await db
        .select({
          name: users.name,
          email: users.email,
          image: users.image,
          emailVerified: users.emailVerified,
          devotionSaint: users.devotionSaint,
          communityName: users.communityName,
          hasPassword: users.passwordHash,
        })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Conta</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Gerencie seu acesso e continue sua jornada espiritual.
        </p>
      </header>

      {session?.user && accountProfile ? (
        <>
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
            <p className="text-sm text-emerald-900">
              Você está conectado como <strong>{accountProfile.name ?? accountProfile.email}</strong>.
            </p>
            <p className="mt-2 text-sm text-emerald-800/80">
              Personalize suas informações públicas, sua devoção e sua comunidade em um único lugar.
            </p>
          </section>

          <AccountSettingsForms
            key={`${accountProfile.image ?? "sem-foto"}:${accountProfile.name ?? "sem-nome"}:${accountProfile.devotionSaint ?? "sem-devocao"}:${accountProfile.communityName ?? "sem-comunidade"}`}
            user={{
              name: accountProfile.name,
              email: accountProfile.email,
              image: accountProfile.image,
              emailVerified: accountProfile.emailVerified,
              hasPassword: Boolean(accountProfile.hasPassword),
              devotionSaint: accountProfile.devotionSaint,
              communityName: accountProfile.communityName,
            }}
          />
        </>
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
