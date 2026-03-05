import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createJournalMemoryAction } from "../actions";
import { RecordacaoForm, type RecordacaoFormState } from "../recordacao-form";

async function createAndRedirectAction(
  _previousState: RecordacaoFormState,
  formData: FormData,
): Promise<RecordacaoFormState> {
  "use server";

  try {
    await createJournalMemoryAction(formData);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível salvar a recordação.",
    };
  }

  redirect("/diario/recordacoes");
}

export default async function NovaRecordacaoPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/entrar");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/diario" className="hover:underline">
            Diário
          </Link>{" "}
          / <Link href="/diario/recordacoes" className="hover:underline">Recordações</Link> / Nova
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">Nova recordação</h1>
        <p className="text-sm text-zinc-600">
          Guarde momentos especiais com privacidade e segurança diretamente no seu diário.
        </p>
      </header>

      <RecordacaoForm mode="create" submitAction={createAndRedirectAction} />
    </main>
  );
}
