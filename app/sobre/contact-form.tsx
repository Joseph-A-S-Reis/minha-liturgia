"use client";

import { useActionState } from "react";
import { InteractiveSubmitButton } from "@/app/components/interactive-submit-button";
import { submitAboutContactAction, type AboutContactActionState } from "./actions";

const initialState: AboutContactActionState = {
  success: false,
  message: "",
};

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(
    submitAboutContactAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="about-contact-name" className="block text-sm font-medium text-zinc-700">
            Nome
          </label>
          <input
            id="about-contact-name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={120}
            disabled={isPending}
            className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
            placeholder="Seu nome"
          />
        </div>

        <div>
          <label htmlFor="about-contact-email" className="block text-sm font-medium text-zinc-700">
            E-mail
          </label>
          <input
            id="about-contact-email"
            name="email"
            type="email"
            required
            maxLength={255}
            disabled={isPending}
            className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
            placeholder="voce@exemplo.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="about-contact-message" className="block text-sm font-medium text-zinc-700">
          Mensagem
        </label>
        <textarea
          id="about-contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          disabled={isPending}
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder="Escreva sua mensagem, sugestão ou pedido de contato."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <InteractiveSubmitButton
          idleLabel="Enviar mensagem"
          pendingLabel="Enviando..."
          disabled={isPending}
          className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
          pendingClassName="bg-emerald-600"
        />
        <p className="text-xs text-zinc-500">
          As mensagens são enviadas diretamente ao destinatário, sem armazenamento dos seus dados e com total anonimato.
        </p>
      </div>

      {state.message ? (
        <p className={`text-sm ${state.success ? "text-emerald-700" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
