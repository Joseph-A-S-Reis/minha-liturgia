"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusCircleIcon } from "@/app/components/icons";
import { createDiaryEntryAction, importLocalDiaryEntriesAction } from "./actions";

type PendingDiaryEntry = {
  id: string;
  text: string;
  createdAt: string;
};

const PENDING_STORAGE_KEY = "minha-liturgia:diario:pending-writes";

function safeReadPendingEntries(): PendingDiaryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(PENDING_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as PendingDiaryEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry) =>
        typeof entry?.id === "string" &&
        typeof entry?.text === "string" &&
        typeof entry?.createdAt === "string",
    );
  } catch {
    return [];
  }
}

function writePendingEntries(entries: PendingDiaryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  if (entries.length === 0) {
    window.localStorage.removeItem(PENDING_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(entries));
}

export function DiaryEntryForm() {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string>("");
  const [pendingCount, setPendingCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const hasPending = useMemo(() => pendingCount > 0, [pendingCount]);

  async function flushPendingEntries() {
    const pending = safeReadPendingEntries();
    setPendingCount(pending.length);

    if (pending.length === 0) {
      return 0;
    }

    const result = await importLocalDiaryEntriesAction(
      pending.map((entry) => ({
        text: entry.text,
        createdAt: entry.createdAt,
      })),
    );

    writePendingEntries([]);
    setPendingCount(0);

    if (result.imported > 0) {
      router.refresh();
    }

    return result.imported;
  }

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const imported = await flushPendingEntries();
        if (!cancelled && imported > 0) {
          setStatus(`${imported} pendência(s) local(is) sincronizada(s) com sucesso.`);
        }
      } catch {
        if (!cancelled) {
          setStatus("Existem pendências locais aguardando reconexão com o banco.");
        }
      }
    };

    void boot();

    const onFocus = () => {
      void flushPendingEntries().catch(() => {
        setStatus("Pendências locais ainda não puderam ser sincronizadas.");
      });
    };

    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setStatus("Escreva uma anotação antes de salvar.");
      return;
    }

    const requestId = crypto.randomUUID();

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("content", trimmed);
        formData.set("idempotencyKey", requestId);

        await createDiaryEntryAction(formData);
        setContent("");
        setStatus("Anotação salva no banco de dados.");
        router.refresh();
      } catch {
        const pending = safeReadPendingEntries();
        const fallbackEntry = {
          id: requestId,
          text: trimmed,
          createdAt: new Date().toISOString(),
        } satisfies PendingDiaryEntry;

        const deduped = [fallbackEntry, ...pending.filter((item) => item.id !== requestId)].slice(
          0,
          300,
        );

        writePendingEntries(deduped);
        setPendingCount(deduped.length);
        setStatus(
          "Falha ao salvar no banco agora. Guardamos localmente e vamos sincronizar automaticamente quando possível.",
        );
      }
    });
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <label className="block text-sm font-medium text-zinc-700" htmlFor="content">
        Nova anotação
      </label>
      <textarea
        id="content"
        name="content"
        required
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="h-36 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring"
        placeholder="Ex.: Hoje meditei sobre..."
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <PlusCircleIcon className="mr-2 size-4" />
          {isPending ? "Salvando..." : "Salvar no diário"}
        </button>

        {hasPending ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const imported = await flushPendingEntries();
                  if (imported > 0) {
                    setStatus(`${imported} pendência(s) sincronizada(s) com sucesso.`);
                  } else {
                    setStatus("Não havia pendências para sincronizar.");
                  }
                } catch {
                  setStatus("Ainda não foi possível sincronizar as pendências locais.");
                }
              });
            }}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Sincronizar pendências ({pendingCount})
          </button>
        ) : null}
      </div>

      {status ? <p className="text-xs font-medium text-zinc-600">{status}</p> : null}
    </form>
  );
}
