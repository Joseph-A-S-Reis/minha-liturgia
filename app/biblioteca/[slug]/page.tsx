import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AssetViewer } from "@/app/components/library-asset-viewer";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { deleteLibraryResourceAction } from "@/app/biblioteca/actions";
import { canManageLibraryResource, getLibraryPublishAccess } from "@/lib/library-access";
import { resolveAssetOpenUrl } from "@/lib/library/media";
import { getPublishedLibraryResourceBySlug } from "@/lib/library-repository";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatDate(value: Date | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function BibliotecaResourcePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const publishAccess = session?.user?.id
    ? await getLibraryPublishAccess(session.user.id)
    : { canPublish: false, isAdmin: false, isCurator: false };
  const resource = await getPublishedLibraryResourceBySlug(slug);

  if (!resource) {
    notFound();
  }

  const publishedLabel = formatDate(resource.publishedAt);
  const isArticle = resource.resourceType === "article";
  const canManage =
    session?.user?.id &&
    canManageLibraryResource({
      userId: session.user.id,
      createdByUserId: resource.createdByUserId,
      access: publishAccess,
    });

  async function handleDeleteResource() {
    "use server";

    const result = await deleteLibraryResourceAction({
      resourceId: resource.id,
      idempotencyKey: crypto.randomUUID(),
    });

    if (!result.ok) {
      throw new Error("Não foi possível excluir este conteúdo.");
    }

    redirect("/biblioteca");
  }

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/biblioteca" className="hover:underline">
            Biblioteca
          </Link>{" "}
          / {resource.title}
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">{resource.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-800">
            {resource.resourceType}
          </span>
          {resource.isOfficialChurchSource ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
              Fonte oficial da Igreja
            </span>
          ) : null}
          {publishedLabel ? (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600">
              {publishedLabel}
            </span>
          ) : null}
        </div>

        {resource.summary ? <p className="text-zinc-600">{resource.summary}</p> : null}

        {canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={`/biblioteca/${resource.slug}/editar`}
              className="inline-flex rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
            >
              Editar conteúdo
            </Link>

            <form action={handleDeleteResource}>
              <ConfirmSubmitButton
                label="Excluir conteúdo"
                confirmMessage="Tem certeza que deseja excluir este conteúdo? Esta ação arquiva os arquivos no Drive e remove a publicação da Biblioteca."
                className="inline-flex rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
              />
            </form>
          </div>
        ) : null}
      </header>

      {resource.categories.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">Categorias</h2>
          <p className="mt-2 text-sm text-zinc-700">
            {resource.categories.map((item) => item.name).join(" · ")}
          </p>
        </section>
      ) : null}

      <article
        className={
          isArticle
            ? "bg-transparent pt-5"
            : "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        }
      >
        {!isArticle ? <h2 className="text-lg font-semibold text-zinc-900">Conteúdo</h2> : null}
        {resource.contentMarkdown ? (
          <div
            className={`library-html-content text-sm leading-7 text-zinc-800 ${
              isArticle
                ? "library-html-content--full border-t border-zinc-200 pt-5 m-0 w-full max-w-none"
                : "mt-3"
            }`}
            dangerouslySetInnerHTML={{ __html: resource.contentMarkdown }}
          />
        ) : (
          <p className={`text-sm text-zinc-600 ${isArticle ? "" : "mt-3"}`}>
            Este conteúdo ainda não possui texto interno.
          </p>
        )}
      </article>

      {resource.assets.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Mídias relacionadas</h2>
          <ul className="mt-3 grid gap-3">
            {resource.assets.map((asset) => {
              const href = resolveAssetOpenUrl(asset);

              return (
                <li key={asset.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-semibold text-zinc-900">
                    {asset.title ?? `Arquivo ${asset.kind}`}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    tipo: {asset.kind}
                    {asset.mimeType ? ` · ${asset.mimeType}` : ""}
                  </p>

                  <AssetViewer asset={asset} />

                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-900"
                    >
                      Abrir em nova aba ↗
                    </a>
                  ) : (
                    <p className="mt-3 text-xs text-amber-700">Mídia sem URL pública no momento.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {resource.sourceUrl ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">Fonte</h2>
          <a
            href={resource.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-900"
          >
            {resource.sourceName ?? "Acessar fonte original"} ↗
          </a>
        </section>
      ) : null}
    </main>
  );
}
