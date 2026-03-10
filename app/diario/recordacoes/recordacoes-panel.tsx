import Link from "next/link";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { PlusCircleIcon } from "@/app/components/icons";
import { deleteJournalMemoryAction, type JournalMemoryView } from "./actions";

type RecordacoesPanelProps = {
  memories: JournalMemoryView[];
  showBackLink?: boolean;
  backHref?: string;
  backLabel?: string;
};

function formatDate(date: string | Date) {
  const parsed = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;

  if (Number.isNaN(parsed.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(parsed);
}

export function RecordacoesPanel({
  memories,
  showBackLink = false,
  backHref = "/diario#recordacoes",
  backLabel = "Voltar ao Diário",
}: RecordacoesPanelProps) {
  return (
    <>
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
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
            <div className="min-w-190">
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
          </div>
        )}
      </section>

      {showBackLink ? (
        <section>
          <Link href={backHref} className="inline-flex items-center text-sm font-medium text-zinc-600 hover:text-zinc-800">
            {backLabel}
          </Link>
        </section>
      ) : null}
    </>
  );
}