import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { PenIcon, PlusCircleIcon } from "@/app/components/icons";
import { deleteJournalMemoryAction, getUserJournalMemories } from "./actions";

function formatDate(date: string | Date) {
  const parsed = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;

  if (Number.isNaN(parsed.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(parsed);
}

export default async function RecordacoesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/entrar");
  }

  const memories = await getUserJournalMemories();

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/diario" className="hover:underline">
            Diário
          </Link>{" "}
          / Recordações
        </p>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-zinc-900 sm:text-4xl">
          <PenIcon className="size-8" />
          Recordações
        </h1>
        <p className="text-sm text-zinc-600">
          Guarde lembranças importantes com anexos privados e acesso somente da sua conta.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <Link
          href="/diario/recordacoes/nova"
          className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <PlusCircleIcon className="mr-2 size-4" />
          Nova recordação
        </Link>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">Minhas recordações ({memories.length})</h2>

        {memories.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Você ainda não cadastrou recordações. Comece salvando um momento especial.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
            <div className="grid grid-cols-[180px_minmax(0,1fr)_110px_220px] gap-3 border-b border-zinc-200 bg-zinc-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <p>Data</p>
              <p>Recordação</p>
              <p>Anexos</p>
              <p className="text-right">Ações</p>
            </div>

            <ul className="divide-y divide-zinc-200 bg-white">
              {memories.map((memory) => (
                <li key={memory.id} className="grid grid-cols-[180px_minmax(0,1fr)_110px_220px] gap-3 px-4 py-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {formatDate(memory.memoryDate)}
                  </p>

                  <div className="min-w-0">
                    <Link href={`/diario/recordacoes/${memory.id}`} className="font-semibold text-zinc-900 hover:underline">
                      {memory.title}
                    </Link>
                    <p className="mt-1 truncate text-xs text-zinc-600">{memory.description}</p>
                  </div>

                  <p className="text-xs font-medium text-zinc-600">{memory.attachments.length}</p>

                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/diario/recordacoes/${memory.id}`}
                      className="inline-flex rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Abrir
                    </Link>
                    <Link
                      href={`/diario/recordacoes/${memory.id}/editar`}
                      className="inline-flex rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                    >
                      Editar
                    </Link>

                    <form action={deleteJournalMemoryAction}>
                      <input type="hidden" name="memoryId" value={memory.id} />
                      <ConfirmSubmitButton
                        label="Excluir"
                        confirmMessage="Deseja realmente excluir esta recordação? Esta ação não pode ser desfeita."
                        className="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      />
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <Link href="/diario" className="inline-flex items-center text-sm font-medium text-zinc-600 hover:text-zinc-800">
          Voltar ao Diário
        </Link>
      </section>
    </main>
  );
}
