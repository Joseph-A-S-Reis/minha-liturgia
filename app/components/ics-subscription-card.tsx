"use client";

import { useState } from "react";

type TokenResponse = {
  subscriptionUrl: string;
  token: string;
  warning: string;
};

export function IcsSubscriptionCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateToken() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/calendario/ics/token", {
        method: "POST",
      });

      const payload = (await response.json()) as Partial<TokenResponse> & { error?: string };

      if (!response.ok || !payload.subscriptionUrl || !payload.token || !payload.warning) {
        throw new Error(payload.error || "Não foi possível gerar o token ICS.");
      }

      setData({
        subscriptionUrl: payload.subscriptionUrl,
        token: payload.token,
        warning: payload.warning,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha inesperada ao gerar token ICS.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value);
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Assinatura de calendário (ICS)</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Use o link ICS em Google Calendar, Apple Calendar ou Outlook para sincronizar eventos.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href="/api/calendario/ics"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          Baixar .ics
        </a>
        <button
          type="button"
          onClick={handleGenerateToken}
          disabled={isLoading}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white! transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Gerando..." : "Gerar link de assinatura"}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}

      {data ? (
        <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
          <p className="font-semibold text-amber-900">Link de assinatura</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full overflow-x-auto rounded bg-white px-2 py-1 text-[11px] text-zinc-800">
              {data.subscriptionUrl}
            </code>
            <button
              type="button"
              onClick={() => copyValue(data.subscriptionUrl)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Copiar URL
            </button>
          </div>
          <p className="text-amber-900">{data.warning}</p>
        </div>
      ) : null}
    </section>
  );
}
