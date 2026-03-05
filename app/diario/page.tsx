import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Link from "next/link";
import { deleteDiaryEntryAction, getUserDiaryEntries } from "./actions";
import { LocalDiaryMigration } from "./local-migration";
import { DiaryEntryForm } from "./diary-entry-form";
import { PenIcon, PlusCircleIcon, TrashIcon } from "@/app/components/icons";

export default async function DiarioPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/entrar");
  }

  const entries = await getUserDiaryEntries();

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2"><PenIcon className="size-8" /> Diário Pessoal</h1>
        <p className="text-zinc-600">
          Suas anotações agora ficam seguras e sincronizadas no banco de dados.
        </p>
      </header>

      <LocalDiaryMigration />

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-zinc-900">Anotações</h2>
        <DiaryEntryForm />

        <div className="mt-5 border-t border-zinc-200 pt-4">
          <h3 className="font-semibold text-zinc-900">Entradas ({entries.length})</h3>
          {entries.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">Ainda não há anotações.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-800">{entry.content}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {entry.createdAt
                        ? new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(entry.createdAt))
                        : "Data indisponível"}
                    </span>
                    <form action={deleteDiaryEntryAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="mr-1 size-3.5" />
                        Excluir
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-zinc-900">Recordações</h2>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <h3 className="text-sm font-semibold text-emerald-800">Novo recurso: Recordações</h3>
          <p className="mt-1 text-sm text-emerald-700">
            Guarde memórias especiais (como Batismo e Crisma) com anexos privados dentro do Diário.
          </p>
          <Link
            href="/diario/recordacoes"
            className="mt-3 inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <PlusCircleIcon className="mr-1 size-4" />
            Abrir Recordações
          </Link>
        </div>
      </section>
    </main>
  );
}
