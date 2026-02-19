"use client";

import { FormEvent, useEffect, useState } from "react";

type PreferencesPayload = {
  timezone: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
};

const hourOptions = Array.from({ length: 24 }, (_, h) => h);

export function NotificationPreferencesCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState(22);
  const [quietEnd, setQuietEnd] = useState(7);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const response = await fetch("/api/calendario/preferences", { cache: "no-store" });
        const payload = (await response.json()) as Partial<PreferencesPayload> & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Falha ao carregar preferências.");
        }

        if (!mounted) return;

        setTimezone(payload.timezone ?? "America/Sao_Paulo");
        setEmailEnabled(payload.emailEnabled ?? true);
        setPushEnabled(payload.pushEnabled ?? true);

        if (typeof payload.quietHoursStart === "number" && typeof payload.quietHoursEnd === "number") {
          setQuietEnabled(true);
          setQuietStart(payload.quietHoursStart);
          setQuietEnd(payload.quietHoursEnd);
        }
      } catch (cause) {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : "Falha ao carregar preferências.");
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch("/api/calendario/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timezone,
          emailEnabled,
          pushEnabled,
          quietHoursStart: quietEnabled ? quietStart : null,
          quietHoursEnd: quietEnabled ? quietEnd : null,
        } satisfies PreferencesPayload),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível salvar preferências.");
      }

      setStatus("Preferências de notificação salvas.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar preferências.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Preferências de lembrete</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Escolha canais e horário silencioso para o scheduler respeitar seus hábitos.
      </p>

      <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
        <label className="block text-xs font-medium text-zinc-700">
          Fuso horário
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/Sao_Paulo"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
          />
        </label>

        <div className="flex flex-wrap gap-3 text-xs">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={pushEnabled} onChange={(e) => setPushEnabled(e.target.checked)} />
            Push habilitado
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
            E-mail habilitado
          </label>
        </div>

        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={quietEnabled} onChange={(e) => setQuietEnabled(e.target.checked)} />
          Ativar horário silencioso
        </label>

        {quietEnabled ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="block font-medium text-zinc-700">
              Início
              <select
                value={quietStart}
                onChange={(e) => setQuietStart(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2"
              >
                {hourOptions.map((hour) => (
                  <option key={`start-${hour}`} value={hour}>{`${String(hour).padStart(2, "0")}:00`}</option>
                ))}
              </select>
            </label>
            <label className="block font-medium text-zinc-700">
              Fim
              <select
                value={quietEnd}
                onChange={(e) => setQuietEnd(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2"
              >
                {hourOptions.map((hour) => (
                  <option key={`end-${hour}`} value={hour}>{`${String(hour).padStart(2, "0")}:00`}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white! transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Salvando..." : "Salvar preferências"}
        </button>
      </form>

      {status ? <p className="mt-2 text-xs font-medium text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
    </section>
  );
}
