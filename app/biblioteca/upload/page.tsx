import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { publishLibraryResourceAction } from "@/app/biblioteca/actions";
import { db } from "@/db/client";
import { libraryAssets, libraryResources } from "@/db/schema";
import { getLibraryPublishAccess } from "@/lib/library-access";
import { getGoogleDrivePreviewUrl, getGoogleDrivePublicUrl } from "@/lib/storage/google-drive";
import { UploadAssetClient } from "./upload-asset-client";

type PageProps = {
  searchParams: Promise<{ resourceId?: string; error?: string }>;
};

export default async function BibliotecaUploadPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/entrar");
  }

  const publishAccess = await getLibraryPublishAccess(session.user.id);
  if (!publishAccess.canPublish) {
    redirect("/biblioteca");
  }

  const { resourceId, error } = await searchParams;
  if (!resourceId) {
    redirect("/biblioteca/novo");
  }

  const [resource] = await db
    .select({
      id: libraryResources.id,
      slug: libraryResources.slug,
      title: libraryResources.title,
      resourceType: libraryResources.resourceType,
      status: libraryResources.status,
      createdByUserId: libraryResources.createdByUserId,
    })
    .from(libraryResources)
    .where(
      and(eq(libraryResources.id, resourceId), eq(libraryResources.createdByUserId, session.user.id)),
    )
    .limit(1);

  if (!resource) {
    redirect("/biblioteca");
  }

  const assets = await db
    .select({
      id: libraryAssets.id,
      kind: libraryAssets.kind,
      title: libraryAssets.title,
      mimeType: libraryAssets.mimeType,
      status: libraryAssets.status,
      externalUrl: libraryAssets.externalUrl,
      driveFileId: libraryAssets.driveFileId,
      createdAt: libraryAssets.createdAt,
    })
    .from(libraryAssets)
    .where(eq(libraryAssets.resourceId, resource.id))
    .orderBy(libraryAssets.createdAt);

  async function publishAction() {
    "use server";

    try {
      await publishLibraryResourceAction(resource.id);
      redirect(`/biblioteca/${resource.slug}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Falha ao publicar conteúdo.";
      redirect(`/biblioteca/upload?resourceId=${resource.id}&error=${encodeURIComponent(message)}`);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/biblioteca" className="hover:underline">
            Biblioteca
          </Link>{" "}
          / Upload de mídias
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">{resource.title}</h1>
        <p className="text-zinc-600">
          Envie os arquivos para o Google Drive. Depois você pode publicar o conteúdo quando estiver pronto.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Enviar novo arquivo</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Este conteúdo é do tipo <strong>{resource.resourceType}</strong>. O upload aceita somente
          arquivos compatíveis com este tipo.
        </p>
        {error ? (
          <p className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
            {error}
          </p>
        ) : null}
        <div className="mt-4">
          <UploadAssetClient resourceId={resource.id} resourceType={resource.resourceType} />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Arquivos já enviados ({assets.length})</h2>
        {assets.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">Nenhum arquivo enviado ainda.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {assets.map((asset) => (
              <li key={asset.id} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                {(() => {
                  const isConfirmed = Boolean(asset.externalUrl || asset.driveFileId);
                  const openUrl =
                    asset.externalUrl ??
                    (asset.driveFileId ? getGoogleDrivePublicUrl(asset.driveFileId) : null);
                  const previewUrl = asset.driveFileId
                    ? getGoogleDrivePreviewUrl(asset.driveFileId)
                    : null;

                  return (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-800">{asset.title ?? `Arquivo ${asset.kind}`}</span>
                        <span className="text-xs text-zinc-500">{asset.kind}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isConfirmed
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isConfirmed ? "confirmado" : asset.status}
                        </span>
                      </div>

                      {asset.mimeType ? <p className="mt-1 text-xs text-zinc-500">{asset.mimeType}</p> : null}

                      {openUrl ? (
                        <a
                          href={openUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-xs font-semibold text-sky-700 hover:text-sky-900"
                        >
                          Abrir no Google Drive ↗
                        </a>
                      ) : null}

                      {previewUrl ? (
                        <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                          <iframe
                            title={`Prévia de ${asset.title ?? asset.kind}`}
                            src={previewUrl}
                            className="h-56 w-full"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-zinc-500">
                          Pré-visualização indisponível para este arquivo.
                        </p>
                      )}
                    </>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <form action={publishAction}>
          <button
            type="submit"
            className="inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Publicar conteúdo
          </button>
        </form>

        <Link
          href="/biblioteca"
          className="inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          Voltar para Biblioteca
        </Link>
      </section>
    </main>
  );
}
