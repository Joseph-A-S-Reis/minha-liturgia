"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  saveMariaResponseToDiaryAction,
  saveMariaResponseToVerseAction,
} from "@/app/inicio/maria-actions";

type MariaMode = "conselheira" | "teologa" | "educadora";

type ChatResponse = {
  answer: string;
  model?: string;
  usage?: {
    total_tokens?: number;
  };
};

const MODE_OPTIONS: Array<{
  id: MariaMode;
  label: string;
  helper: string;
}> = [
  {
    id: "conselheira",
    label: "Conselheira",
    helper: "Conselhos acolhedores com base bíblica.",
  },
  {
    id: "teologa",
    label: "Teóloga",
    helper: "Doutrina católica com contexto histórico.",
  },
  {
    id: "educadora",
    label: "Educadora",
    helper: "Planos e guias de estudo catequético.",
  },
];

function getModeLabel(mode: MariaMode) {
  return MODE_OPTIONS.find((option) => option.id === mode)?.label ?? "MarIA";
}

export function MariaAssistant() {
  const [mode, setMode] = useState<MariaMode>("conselheira");
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [reference, setReference] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [usageTokens, setUsageTokens] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveInfo, setSaveInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSavingDiary, startSavingDiary] = useTransition();
  const [isSavingVerse, startSavingVerse] = useTransition();

  const canAsk = useMemo(() => message.trim().length >= 2 && !isPending, [isPending, message]);

  const askMaria = () => {
    startTransition(async () => {
      try {
        setError(null);
        setSaveInfo(null);

        const response = await fetch("/api/maria/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            message,
          }),
        });

        const data = (await response.json()) as Partial<ChatResponse> & {
          error?: string;
          details?: string;
        };

        if (!response.ok || !data.answer) {
          throw new Error(data.error ?? data.details ?? "Falha ao consultar a MarIA.");
        }

        setAnswer(data.answer);
        setModel(data.model ?? null);
        setUsageTokens(data.usage?.total_tokens ?? null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Erro inesperado ao consultar a MarIA.");
      }
    });
  };

  const saveToDiary = () => {
    if (!answer.trim()) return;

    startSavingDiary(async () => {
      try {
        setError(null);

        await saveMariaResponseToDiaryAction({
          modeLabel: getModeLabel(mode),
          question: message,
          answer,
        });

        setSaveInfo("Resposta salva no seu Diário com sucesso.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao salvar no Diário.");
      }
    });
  };

  const saveToVerse = () => {
    if (!answer.trim()) return;

    startSavingVerse(async () => {
      try {
        setError(null);

        const result = await saveMariaResponseToVerseAction({
          answer,
          versionId: "ave-maria",
          explicitReference: reference || undefined,
        });

        setSaveInfo(
          `Nota criada em ${result.label}. Abra em: ${result.href}`,
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao salvar como nota de versículo.");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-violet-900">MarIA · Assistente IA</h2>
        <p className="text-sm text-violet-800">
          Escolha um modo, faça sua pergunta e, se quiser, salve a resposta no Diário ou em nota de versículo.
        </p>
      </header>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setMode(option.id)}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              mode === option.id
                ? "border-violet-400 bg-white text-violet-900 shadow-sm"
                : "border-violet-200 bg-violet-100 text-violet-800 hover:bg-white"
            }`}
          >
            <p className="text-sm font-semibold">{option.label}</p>
            <p className="text-xs opacity-90">{option.helper}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          placeholder="Ex.: Me ajude com um plano de estudo do Catecismo para 4 semanas"
          className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-violet-400"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canAsk}
            onClick={askMaria}
            className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Consultando..." : "Perguntar à MarIA"}
          </button>

          {model ? (
            <span className="text-xs text-violet-900">
              Modelo: <strong>{model}</strong>
              {usageTokens !== null ? ` · ${usageTokens} tokens` : ""}
            </span>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}

      {answer ? (
        <div className="mt-4 space-y-3 rounded-xl border border-violet-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Resposta da MarIA</p>
          <p className="whitespace-pre-wrap text-sm text-zinc-800">{answer}</p>

          <div className="space-y-2 rounded-lg border border-violet-100 bg-violet-50 p-3">
            <p className="text-xs font-semibold text-violet-900">Salvar como nota de versículo (opcional)</p>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Ex.: João 3:16 (se vazio, MarIA tenta detectar na resposta)"
              className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-violet-400"
            />
            <p className="text-[11px] text-violet-700">
              A nota será criada na versão <strong>Ave Maria</strong>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveToDiary}
              disabled={isSavingDiary}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingDiary ? "Salvando no Diário..." : "Salvar no Diário"}
            </button>
            <button
              type="button"
              onClick={saveToVerse}
              disabled={isSavingVerse}
              className="rounded-lg border border-violet-300 bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingVerse ? "Salvando nota..." : "Salvar como nota de versículo"}
            </button>
            <Link
              href="/diario"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Abrir Diário
            </Link>
          </div>

          {saveInfo ? <p className="text-sm font-medium text-emerald-700">{saveInfo}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
