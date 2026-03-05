import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { deleteJournalMemoryAction, getJournalMemoryForEdit } from "../actions";
import { AttachmentGallery } from "../attachment-gallery";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(date: string | Date) {
  const parsed = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;
  if (Number.isNaN(parsed.getTime())) return "Data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
  }).format(parsed);
}

export default async function RecordacaoDetalhePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/entrar");
  }

  const { id } = await params;
  const memory = await getJournalMemoryForEdit(id);

  if (!memory) {
    notFound();
  }

  async function deleteAndRedirectAction(formData: FormData) {
    "use server";

    await deleteJournalMemoryAction(formData);
    redirect("/diario/recordacoes");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/diario" className="hover:underline">
            Diário
          </Link>{" "}
          / <Link href="/diario/recordacoes" className="hover:underline">Recordações</Link> / {memory.title}
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">{memory.title}</h1>
        <p className="text-sm text-zinc-600">Data da recordação: {formatDate(memory.memoryDate)}</p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-linear-to-br from-white to-zinc-50 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Descrição</h2>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">Resumo do momento</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-700">{memory.description}</p>
        </div>

        <div className="mt-4 grid gap-3 text-xs text-zinc-600 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="font-semibold text-zinc-700">Criada em</p>
            <p className="mt-0.5">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(memory.createdAt)}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="font-semibold text-zinc-700">Atualizada em</p>
            <p className="mt-0.5">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(memory.updatedAt)}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4">
          <Link
            href="/diario/recordacoes"
            className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Voltar às Recordações
          </Link>
          <Link
            href={`/diario/recordacoes/${memory.id}/editar`}
            className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Editar
          </Link>
          <form action={deleteAndRedirectAction}>
            <input type="hidden" name="memoryId" value={memory.id} />
            <ConfirmSubmitButton
              label="Excluir"
              confirmMessage="Deseja realmente excluir esta recordação? Esta ação não pode ser desfeita."
              className="inline-flex rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            />
          </form>
        </div>
      </section>

      <AttachmentGallery attachments={memory.attachments} />

      <section>
        <Link
          href="/diario/recordacoes"
          className="inline-flex items-center text-sm font-medium text-zinc-600 hover:text-zinc-800"
        >
          Voltar para Minhas recordações
        </Link>
      </section>
    </main>
  );
}
