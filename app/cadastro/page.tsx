"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/app/auth-actions";

const initialState = { success: false, message: "" };

export default function CadastroPage() {
  const [state, action, isPending] = useActionState(registerAction, initialState);

  return (
    <main className="flex min-h-screen w-full flex-col justify-center gap-6 px-6 py-10">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Criar conta</h1>
        <p className="mt-2 text-sm text-zinc-600">Crie seu acesso para sincronizar o diário no banco.</p>
      </header>

      <form action={action} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-700">Nome</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          />
        </div>

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

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700">Senha</label>
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
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700">Confirmar senha</label>
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
          {isPending ? "Criando conta..." : "Criar conta"}
        </button>
      </form>

      <p className="text-sm text-zinc-600">
        Já possui conta?{" "}
        <Link href="/entrar" className="font-semibold text-emerald-700 hover:text-emerald-800">
          Entrar
        </Link>
      </p>
    </main>
  );
}
