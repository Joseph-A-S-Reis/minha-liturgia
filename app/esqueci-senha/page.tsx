"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/app/auth-actions";

const initialState = { success: false, message: "" };

export default function EsqueciSenhaPage() {
  const [state, action, isPending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <main className="flex min-h-screen w-full flex-col justify-center gap-6 px-6 py-10">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Esqueci minha senha</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Enviaremos um link para redefinir sua senha.
        </p>
      </header>

      <form action={action} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            required
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
          {isPending ? "Enviando..." : "Enviar link"}
        </button>
      </form>

      <p className="text-sm text-zinc-600">
        Lembrou da senha?{" "}
        <Link href="/entrar" className="font-semibold text-emerald-700 hover:text-emerald-800">
          Voltar ao login
        </Link>
      </p>
    </main>
  );
}
