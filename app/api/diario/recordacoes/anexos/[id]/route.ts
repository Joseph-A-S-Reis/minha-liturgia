import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { journalMemoryAttachments } from "@/db/schema";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function toBodyBytes(data: unknown): ArrayBuffer | null {
  if (data instanceof Uint8Array) {
    return Uint8Array.from(data).buffer;
  }

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    return Uint8Array.from(data).buffer;
  }

  if (data instanceof ArrayBuffer) {
    return data;
  }

  return null;
}

function buildDisposition(fileName: string, mimeType: string) {
  const inlineMime = mimeType.startsWith("image/") || mimeType === "application/pdf";
  const normalizedName = fileName.replace(/[\r\n"]/g, "");

  if (inlineMime) {
    return `inline; filename="${normalizedName}"`;
  }

  return `attachment; filename="${normalizedName}"`;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;

  const [attachment] = await db
    .select({
      id: journalMemoryAttachments.id,
      fileName: journalMemoryAttachments.fileName,
      mimeType: journalMemoryAttachments.mimeType,
      fileSize: journalMemoryAttachments.fileSize,
      data: journalMemoryAttachments.data,
    })
    .from(journalMemoryAttachments)
    .where(
      and(
        eq(journalMemoryAttachments.id, id),
        eq(journalMemoryAttachments.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!attachment) {
    return Response.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const bytes = toBodyBytes(attachment.data);
  if (!bytes) {
    return Response.json({ error: "Falha ao carregar o anexo." }, { status: 500 });
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.fileSize),
      "Content-Disposition": buildDisposition(attachment.fileName, attachment.mimeType),
      "Cache-Control": "private, max-age=300",
      Vary: "Cookie",
    },
  });
}
