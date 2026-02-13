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

export function LocalDiaryMigration() {
  const [snapshot, setSnapshot] = useState(readLocalDiarySnapshot);
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!snapshot.canMigrate) return null;

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

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-semibold text-amber-900">Migração do diário local</h2>
      <p className="mt-2 text-sm text-amber-800">
        Encontramos {snapshot.count} anotação(ões) no navegador. Você pode
        migrar tudo para seu diário sincronizado no Neon.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleMigrate}
          disabled={isPending}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Migrando..." : "Migrar entradas locais"}
        </button>
        {status ? <p className="text-sm text-amber-800">{status}</p> : null}
      </div>
    </section>
  );
}
