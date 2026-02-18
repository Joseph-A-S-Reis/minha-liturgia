import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteDiaryEntryAction, getUserDiaryEntries } from "./actions";
import { LocalDiaryMigration } from "./local-migration";
import { DiaryEntryForm } from "./diary-entry-form";
import { PenIcon, TrashIcon } from "@/app/components/icons";

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
        <DiaryEntryForm />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">Entradas ({entries.length})</h2>
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
      </section>
    </main>
  );
}
