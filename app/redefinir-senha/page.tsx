"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { resetPasswordAction } from "@/app/auth-actions";

const initialState = { success: false, message: "" };

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<RedefinirSenhaFallback />}>
      <RedefinirSenhaContent />
    </Suspense>
  );
}

function RedefinirSenhaFallback() {
  return (
    <main className="flex min-h-screen w-full flex-col justify-center gap-6 px-6 py-10">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Redefinir senha</h1>
      </header>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        Carregando...
      </section>
    </main>
  );
}

function RedefinirSenhaContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, action, isPending] = useActionState(resetPasswordAction, initialState);

  return (
    <main className="flex min-h-screen w-full flex-col justify-center gap-6 px-6 py-10">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Redefinir senha</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Escolha sua nova senha para acessar a conta novamente.
        </p>
      </header>

      {!token ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Link inválido. Solicite uma nova redefinição de senha.
        </section>
      ) : (
        <form action={action} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="token" value={token} />

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700">Nova senha</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700">Confirmar nova senha</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
            />
          </div>

          {state.message ? (
            <p className={`text-sm ${state.success ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Redefinindo..." : "Redefinir senha"}
          </button>
        </form>
      )}

      <p className="text-sm text-zinc-600">
        Voltar para{" "}
        <Link href="/entrar" className="font-semibold text-emerald-700 hover:text-emerald-800">
          login
        </Link>
      </p>
    </main>
  );
}
