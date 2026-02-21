import DOMPurify from "isomorphic-dompurify";
import { load } from "cheerio";
import { auth } from "@/auth";
import { requireLibraryPublishAccess } from "@/lib/library-access";
import { parseHttpUrl } from "@/lib/library/media";
import { downloadGoogleDriveFile } from "@/lib/storage/google-drive";

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

async function resolveRawHtml(input: {
  driveFileId: string | null;
  externalUrl: string | null;
}) {
  if (input.driveFileId) {
    const buffer = await downloadGoogleDriveFile(input.driveFileId);
    return buffer.toString("utf-8");
  }

  const parsed = parseHttpUrl(input.externalUrl);
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

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Não autenticado." }, { status: 401 });
    }

    await requireLibraryPublishAccess(session.user.id);

    const { searchParams } = new URL(request.url);
    const driveFileId = searchParams.get("driveFileId")?.trim() || null;
    const externalUrl = searchParams.get("externalUrl")?.trim() || null;

    if (!driveFileId && !externalUrl) {
      return Response.json({ error: "driveFileId ou externalUrl é obrigatório." }, { status: 400 });
    }

    const rawHtml = await resolveRawHtml({ driveFileId, externalUrl });

    if (!rawHtml || !rawHtml.trim()) {
      return Response.json({ error: "HTML vazio ou indisponível." }, { status: 422 });
    }

    const html = sanitizeReadableHtml(rawHtml);

    if (!html) {
      return Response.json({ error: "Nenhum conteúdo legível foi extraído deste HTML." }, { status: 422 });
    }

    return Response.json(
      { html },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha ao processar HTML.";
    return Response.json({ error: message }, { status: 500 });
  }
}
