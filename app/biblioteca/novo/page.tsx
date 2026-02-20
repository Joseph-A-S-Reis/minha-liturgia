import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLibraryPublishAccess } from "@/lib/library-access";
import { getLibraryCategories } from "@/lib/library-repository";
import { NewResourceForm } from "./new-resource-form";

export default async function NovaPublicacaoBibliotecaPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/entrar");
  }

  const publishAccess = await getLibraryPublishAccess(session.user.id);
  if (!publishAccess.canPublish) {
    redirect("/biblioteca");
  }

  const categories = await getLibraryCategories();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/biblioteca" className="hover:underline">
            Biblioteca
          </Link>{" "}
          / Nova publicação
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">Criar rascunho</h1>
        <p className="text-zinc-600">
          Ao criar o conteúdo, ele é publicado publicamente na Biblioteca. Os campos mudam de acordo com
          o tipo selecionado e o upload será validado pela mídia compatível.
        </p>
      </header>

      <NewResourceForm
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
      />
    </main>
  );
}
