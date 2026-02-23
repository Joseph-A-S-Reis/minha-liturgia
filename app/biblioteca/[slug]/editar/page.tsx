import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageLibraryResource, getLibraryPublishAccess } from "@/lib/library-access";
import {
  getLibraryCategories,
  getLibraryResourceForManagementBySlug,
} from "@/lib/library-repository";
import { EditResourceForm } from "./edit-resource-form";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EditarBibliotecaResourcePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/entrar");
  }

  const { slug } = await params;
  const [resource, categories, publishAccess] = await Promise.all([
    getLibraryResourceForManagementBySlug(slug),
    getLibraryCategories(),
    getLibraryPublishAccess(session.user.id),
  ]);

  if (!resource) {
    notFound();
  }

  const canManage = canManageLibraryResource({
    userId: session.user.id,
    createdByUserId: resource.createdByUserId,
    access: publishAccess,
  });

  if (!canManage) {
    redirect(`/biblioteca/${resource.slug}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/biblioteca" className="hover:underline">
            Biblioteca
          </Link>{" "}
          / <Link href={`/biblioteca/${resource.slug}`}> {resource.title}</Link> / Editar
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">Editar conteúdo</h1>
        <p className="text-sm text-zinc-600">Atualize os dados e salve para republicar o conteúdo.</p>
      </header>

      <EditResourceForm
        resource={{
          id: resource.id,
          slug: resource.slug,
          title: resource.title,
          summary: resource.summary,
          contentMarkdown: resource.contentMarkdown,
          sourceName: resource.sourceName,
          sourceUrl: resource.sourceUrl,
          resourceType: resource.resourceType as "article" | "book" | "document",
          isOfficialChurchSource: resource.isOfficialChurchSource,
          categoryIds: resource.categoryIds,
        }}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
      />
    </main>
  );
}
