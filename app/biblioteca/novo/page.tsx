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
    <main className="mx-auto flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/biblioteca" className="hover:underline">
            Biblioteca
          </Link>{" "}
          / Criar conteúdo
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">Criar e publicar conteúdo</h1>
        <p className="text-sm text-zinc-600">Preencha os campos, envie o arquivo e publique.</p>
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
