"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importLocalDiaryEntriesAction } from "./actions";

type LocalEntry = {
  id: string;
  text: string;
  createdAt: string;
};

const STORAGE_KEY = "minha-liturgia:diario";
const PENDING_STORAGE_KEY = "minha-liturgia:diario:pending-writes";

function readLocalDiarySnapshot() {
  if (typeof window === "undefined") {
    return { canMigrate: false, count: 0 };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { canMigrate: false, count: 0 };
  }

  try {
    const parsed = JSON.parse(raw) as LocalEntry[];
    return { canMigrate: parsed.length > 0, count: parsed.length };
  } catch {
    return { canMigrate: false, count: 0 };
  }
}

function readPendingSnapshot() {
  if (typeof window === "undefined") {
    return { canSync: false, count: 0 };
  }

  const raw = window.localStorage.getItem(PENDING_STORAGE_KEY);
  if (!raw) {
    return { canSync: false, count: 0 };
  }

  try {
    const parsed = JSON.parse(raw) as LocalEntry[];
    return { canSync: parsed.length > 0, count: parsed.length };
  } catch {
    return { canSync: false, count: 0 };
  }
}

export function LocalDiaryMigration() {
  const [snapshot, setSnapshot] = useState(readLocalDiarySnapshot);
  const [pendingSnapshot, setPendingSnapshot] = useState(readPendingSnapshot);
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!snapshot.canMigrate && !pendingSnapshot.canSync) return null;

  function handleMigrate() {
    startTransition(async () => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setStatus("Nenhuma entrada local encontrada.");
        return;
      }

      try {
        const parsed = JSON.parse(raw) as LocalEntry[];
        const result = await importLocalDiaryEntriesAction(
          parsed.map((entry) => ({ text: entry.text, createdAt: entry.createdAt })),
        );

        window.localStorage.removeItem(STORAGE_KEY);
        setSnapshot({ canMigrate: false, count: 0 });
        setStatus(`${result.imported} entrada(s) migrada(s) para sua conta.`);
        router.refresh();
      } catch {
        setStatus("Não foi possível migrar agora. Tente novamente.");
      }
    });
  }

  function handleSyncPending() {
    startTransition(async () => {
      const raw = window.localStorage.getItem(PENDING_STORAGE_KEY);
      if (!raw) {
        setStatus("Nenhuma pendência local encontrada.");
        return;
      }

      try {
        const parsed = JSON.parse(raw) as LocalEntry[];
        const result = await importLocalDiaryEntriesAction(
          parsed.map((entry) => ({ text: entry.text, createdAt: entry.createdAt })),
        );

        window.localStorage.removeItem(PENDING_STORAGE_KEY);
        setPendingSnapshot({ canSync: false, count: 0 });
        setStatus(`${result.imported} pendência(s) sincronizada(s) com sua conta.`);
        router.refresh();
      } catch {
        setStatus("Não foi possível sincronizar as pendências locais agora.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-semibold text-amber-900">Migração do diário local</h2>
      {snapshot.canMigrate ? (
        <p className="mt-2 text-sm text-amber-800">
          Encontramos {snapshot.count} anotação(ões) no navegador. Você pode
          migrar tudo para seu diário sincronizado no Neon.
        </p>
      ) : null}

      {pendingSnapshot.canSync ? (
        <p className="mt-2 text-sm text-amber-800">
          Há {pendingSnapshot.count} pendência(s) salva(s) localmente por falha temporária
          de escrita no banco. Você pode reenviar agora.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {snapshot.canMigrate ? (
          <button
            type="button"
            onClick={handleMigrate}
            disabled={isPending}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Migrando..." : "Migrar entradas locais"}
          </button>
        ) : null}

        {pendingSnapshot.canSync ? (
          <button
            type="button"
            onClick={handleSyncPending}
            disabled={isPending}
            className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Sincronizando..." : "Sincronizar pendências"}
          </button>
        ) : null}

        {status ? <p className="text-sm text-amber-800">{status}</p> : null}
      </div>
    </section>
  );
}
