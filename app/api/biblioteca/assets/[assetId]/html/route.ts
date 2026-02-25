import { eq } from "drizzle-orm";
import DOMPurify from "isomorphic-dompurify";
import { load } from "cheerio";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { libraryAssets, libraryResources } from "@/db/schema";
import { canManageLibraryResource, getLibraryPublishAccess } from "@/lib/library-access";
import { parseHttpUrl } from "@/lib/library/media";
import { downloadGoogleCloudStorageObject } from "@/lib/storage/google-cloud-storage";

export const runtime = "nodejs";

const READABLE_ALLOWED_TAGS = [
  "article",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "span",
  "strong",
  "u",
  "ul",
];

function sanitizeReadableHtml(rawHtml: string) {
  const $ = load(rawHtml);

  $(
    "script,style,noscript,iframe,object,embed,link,meta,base,head,form,input,button,textarea,select,nav,menu,aside,header,footer,a",
  ).remove();

  $("a").each((_index, element) => {
    const text = $(element).text();
    $(element).replaceWith(text);
  });

  const htmlBody = $("body").html() ?? $.root().html() ?? rawHtml;

  return DOMPurify.sanitize(htmlBody, {
    ALLOWED_TAGS: READABLE_ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    FORBID_ATTR: ["style", "class", "id"],
  }).trim();
}

async function resolveRawHtml(asset: {
  storageObjectKey: string | null;
  externalUrl: string | null;
}) {
  if (asset.storageObjectKey) {
    const buffer = await downloadGoogleCloudStorageObject(asset.storageObjectKey);
    return buffer.toString("utf-8");
  }

  const parsed = parseHttpUrl(asset.externalUrl);
  if (!parsed) {
    return null;
  }

  const response = await fetch(parsed.toString(), {
    method: "GET",
    headers: {
      Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar HTML externo (HTTP ${response.status}).`);
  }

  return response.text();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  try {
    const { assetId } = await context.params;

    const [row] = await db
      .select({
        assetId: libraryAssets.id,
        kind: libraryAssets.kind,
        mimeType: libraryAssets.mimeType,
        storageObjectKey: libraryAssets.storageObjectKey,
        externalUrl: libraryAssets.externalUrl,
        resourceStatus: libraryResources.status,
        resourceCreatorId: libraryResources.createdByUserId,
      })
      .from(libraryAssets)
      .innerJoin(libraryResources, eq(libraryResources.id, libraryAssets.resourceId))
      .where(eq(libraryAssets.id, assetId))
      .limit(1);

    if (!row) {
      return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }

    const isHtmlByKind = row.kind === "html";
    const isHtmlByMime = (row.mimeType ?? "").toLowerCase().includes("html");
    if (!isHtmlByKind && !isHtmlByMime) {
      return Response.json({ error: "Arquivo não é HTML." }, { status: 400 });
    }

    if (row.resourceStatus !== "published") {
      const session = await auth();
      const userId = session?.user?.id ?? null;

      if (!userId) {
        return Response.json({ error: "Acesso não autorizado para conteúdo em rascunho." }, { status: 401 });
      }

      const isCreator = row.resourceCreatorId === userId;
      const publishAccess = await getLibraryPublishAccess(userId);
      const canAccessDraft =
        isCreator ||
        canManageLibraryResource({
          userId,
          createdByUserId: row.resourceCreatorId,
          access: publishAccess,
        });

      if (!canAccessDraft) {
        return Response.json({ error: "Sem permissão para visualizar este rascunho." }, { status: 403 });
      }
    }

    const rawHtml = await resolveRawHtml({
      storageObjectKey: row.storageObjectKey,
      externalUrl: row.externalUrl,
    });

    if (!rawHtml || !rawHtml.trim()) {
      return Response.json({ error: "HTML vazio ou indisponível." }, { status: 422 });
    }

    const html = sanitizeReadableHtml(rawHtml);

    if (!html) {
      return Response.json({ error: "Nenhum conteúdo legível foi extraído deste HTML." }, { status: 422 });
    }

    const cacheControl = row.resourceStatus === "published" ? "public, max-age=300" : "private, no-store";

    return Response.json(
      { html },
      {
        status: 200,
        headers: {
          "Cache-Control": cacheControl,
        },
      },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha ao processar HTML.";
    return Response.json({ error: message }, { status: 500 });
  }
}
