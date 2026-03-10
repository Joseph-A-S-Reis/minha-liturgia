import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteDiaryEntryAction, getUserDiaryEntries } from "./actions";
import { LocalDiaryMigration } from "./local-migration";
import { DiaryEntryForm } from "./diary-entry-form";
import { PenIcon, TrashIcon } from "@/app/components/icons";
import { getUserJournalMemories } from "./recordacoes/actions";
import { RecordacoesPanel } from "./recordacoes/recordacoes-panel";

function formatEntryDate(date: string | Date | null | undefined) {
  if (!date) {
    return "Data indisponível";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export default async function DiarioPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/entrar");
  }

  const [entries, memories] = await Promise.all([getUserDiaryEntries(), getUserJournalMemories()]);

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2"><PenIcon className="size-8" /> Diário Pessoal</h1>
        <p className="text-zinc-600">
          Suas anotações agora ficam seguras e sincronizadas no banco de dados.
        </p>
      </header>

      <LocalDiaryMigration />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-zinc-900">Anotações</h2>
          <p className="text-sm text-zinc-600">
            Registre reflexões, acompanhe suas entradas e gerencie tudo no mesmo fluxo do Diário.
          </p>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <DiaryEntryForm />
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-zinc-900">Minhas anotações ({entries.length})</h2>

          {entries.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">Você ainda não cadastrou anotações. Comece registrando uma reflexão.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
              <div className="min-w-190">
                <div className="grid grid-cols-[220px_minmax(0,1fr)_140px] gap-3 border-b border-zinc-200 bg-zinc-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <p>Data</p>
                  <p>Anotação</p>
                  <p className="text-right">Ações</p>
                </div>

                <ul className="divide-y divide-zinc-200 bg-white">
                  {entries.map((entry) => (
                    <li key={entry.id} className="grid grid-cols-[220px_minmax(0,1fr)_140px] gap-3 px-4 py-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        {formatEntryDate(entry.createdAt)}
                      </p>

                      <p className="line-clamp-2 text-sm text-zinc-800">{entry.content}</p>

                      <div className="flex items-center justify-end gap-2">
                        <form action={deleteDiaryEntryAction}>
                          <input type="hidden" name="id" value={entry.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <TrashIcon className="mr-1 size-3.5" />
                            Excluir
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </section>

      <section id="recordacoes" className="space-y-4 scroll-mt-6">
        <div className="space-y-1">
          <h2 className="font-semibold text-zinc-900">Recordações</h2>
          <p className="text-sm text-zinc-600">
            Guarde memórias especiais, consulte anexos e gerencie suas recordações sem sair do Diário.
          </p>
        </div>

        <RecordacoesPanel memories={memories} />
      </section>
    </main>
  );
}
