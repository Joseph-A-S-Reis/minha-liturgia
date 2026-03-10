import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getJournalMemoryForEdit, updateJournalMemoryAction } from "../../actions";
import { RecordacaoForm, type RecordacaoFormState } from "../../recordacao-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarRecordacaoPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/entrar");
  }

  const { id } = await params;
  const memory = await getJournalMemoryForEdit(id);

  if (!memory) {
    notFound();
  }

  async function updateAndRedirectAction(
    _previousState: RecordacaoFormState,
    formData: FormData,
  ): Promise<RecordacaoFormState> {
    "use server";

    try {
      await updateJournalMemoryAction(formData);
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Não foi possível salvar as alterações.",
      };
    }

    redirect("/diario#recordacoes");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/diario" className="hover:underline">
            Diário
          </Link>{" "}
          / <Link href="/diario#recordacoes" className="hover:underline">Recordações</Link> / Editar
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">Editar recordação</h1>
        <p className="text-sm text-zinc-600">Atualize informações e anexos desta recordação.</p>
      </header>

      <RecordacaoForm mode="edit" submitAction={updateAndRedirectAction} memory={memory} />
    </main>
  );
}
