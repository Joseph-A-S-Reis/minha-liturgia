import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { libraryAssets, libraryResources } from "@/db/schema";
import { requireLibraryPublishAccess } from "@/lib/library-access";
import {
  isGoogleDriveConfigured,
  resolveGoogleDriveParentFolderByKind,
  uploadBinaryToGoogleDrive,
} from "@/lib/storage/google-drive";

export const runtime = "nodejs";

type AssetKind = "pdf" | "image" | "video" | "audio" | "html";

function detectKindFromFile(file: File): AssetKind | null {
  const fileName = file.name.toLowerCase();
  const contentType = (file.type || "").toLowerCase();

  if (contentType === "text/html" || fileName.endsWith(".html") || fileName.endsWith(".htm")) {
    return "html";
  }

  if (contentType === "application/pdf" || fileName.endsWith(".pdf")) {
    return "pdf";
  }

  if (contentType.startsWith("image/")) {
    return "image";
  }

  if (contentType.startsWith("video/")) {
    return "video";
  }

  if (contentType.startsWith("audio/")) {
    return "audio";
  }

  return null;
}

function getAllowedKindsByResourceType(resourceType: string): AssetKind[] {
  switch (resourceType) {
    case "html":
      return ["html"];
    case "document":
      return ["pdf"];
    case "audio":
      return ["audio"];
    case "video":
      return ["video"];
    case "book":
      return ["pdf", "html", "image", "audio", "video"];
    case "article":
      return ["html", "pdf", "image", "video", "audio"];
    default:
      return ["html", "pdf", "image", "video", "audio"];
  }
}

function getResourcesFolderByKind(kind: AssetKind): string {
  switch (kind) {
    case "html":
      return "paginas";
    case "pdf":
      return "documentos";
    case "audio":
      return "audios";
    case "video":
      return "videos";
    case "image":
      return "imagens";
    default:
      return "midias";
  }
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function sanitizeAppPropertyValue(value: string, max = 120) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Não autenticado.", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    await requireLibraryPublishAccess(session.user.id);

    const formData = await request.formData();
    const resourceId = String(formData.get("resourceId") ?? "").trim();
    const fileEntry = formData.get("file");

    if (!resourceId) {
      return Response.json({ error: "resourceId é obrigatório.", code: "RESOURCE_ID_REQUIRED" }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      return Response.json({ error: "Arquivo inválido.", code: "INVALID_FILE" }, { status: 400 });
    }

    if (fileEntry.size <= 0 || fileEntry.size > 300 * 1024 * 1024) {
      return Response.json(
        { error: "Arquivo fora do limite permitido (até 300MB).", code: "FILE_SIZE_NOT_ALLOWED" },
        { status: 400 },
      );
    }

    const detectedKind = detectKindFromFile(fileEntry);
    if (!detectedKind) {
      return Response.json(
        {
          error: "Formato não suportado. Use HTML, PDF, imagem, vídeo ou áudio.",
          code: "UNSUPPORTED_FILE_FORMAT",
        },
        { status: 400 },
      );
    }

    const [resource] = await db
      .select({
        id: libraryResources.id,
        resourceType: libraryResources.resourceType,
        createdByUserId: libraryResources.createdByUserId,
      })
      .from(libraryResources)
      .where(
        and(
          eq(libraryResources.id, resourceId),
          eq(libraryResources.createdByUserId, session.user.id),
        ),
      )
      .limit(1);

    if (!resource) {
      return Response.json(
        { error: "Publicação não encontrada ou sem permissão.", code: "RESOURCE_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 },
      );
    }

    const allowedKinds = getAllowedKindsByResourceType(resource.resourceType);
    if (!allowedKinds.includes(detectedKind)) {
      return Response.json(
        {
          error: `Este conteúdo (${resource.resourceType}) aceita apenas: ${allowedKinds.join(", ")}.`,
          code: "KIND_NOT_ALLOWED_FOR_RESOURCE_TYPE",
        },
        { status: 400 },
      );
    }

    if (!isGoogleDriveConfigured()) {
      return Response.json(
        {
          error: "Configuração do Google Drive incompleta.",
          code: "DRIVE_CONFIG_MISSING",
          details:
            "Defina GOOGLE_DRIVE_FOLDER_ID e credenciais Google (OAuth2: GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN ou Service Account).",
        },
        { status: 503 },
      );
    }

    const objectName = sanitizeFileName(fileEntry.name) || `${Date.now()}.bin`;
    const resourcesRoot = (process.env.GOOGLE_DRIVE_RESOURCES_PREFIX?.trim() || "recursos").replace(
      /^\/+|\/+$/g,
      "",
    );
    const resourcesFolder = getResourcesFolderByKind(detectedKind);
    const storagePath = `${resourcesRoot}/${resourcesFolder}/${resourceId}/${Date.now()}-${objectName}`;
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const kindFolderId = await resolveGoogleDriveParentFolderByKind(detectedKind);

    const uploaded = await uploadBinaryToGoogleDrive({
      data: buffer,
      fileName: `${Date.now()}-${objectName}`,
      contentType: fileEntry.type || "application/octet-stream",
      parentFolderId: kindFolderId,
      appProperties: {
        resourceId: sanitizeAppPropertyValue(resourceId),
        kind: sanitizeAppPropertyValue(detectedKind),
        storagePath: sanitizeAppPropertyValue(storagePath),
      },
    });

    const assetId = crypto.randomUUID();

    await db.insert(libraryAssets).values({
      id: assetId,
      resourceId,
      kind: detectedKind,
      title: fileEntry.name,
      mimeType: fileEntry.type || "application/octet-stream",
      driveFileId: uploaded.fileId,
      externalUrl: uploaded.webViewUrl,
      byteSize: fileEntry.size,
      status: "ready",
    });

    const warnings = [...(uploaded.permissionError ? [uploaded.permissionError] : [])];

    return Response.json({
      ok: true,
      assetId,
      resourceId,
      driveFileId: uploaded.fileId,
      publicUrl: uploaded.webViewUrl,
      processingScheduled: false,
      warningCode: uploaded.permissionError ? "UPLOAD_COMPLETED_WITH_WARNINGS" : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha inesperada no upload.";

    if (message.includes("Apenas curadores e administradores")) {
      return Response.json({ error: message, code: "FORBIDDEN_LIBRARY_PUBLISH_ACCESS" }, { status: 403 });
    }

    const driveFailure =
      message.includes("Google Drive") ||
      message.includes("OAuth") ||
      message.includes("Service Account") ||
      message.includes("refresh_token") ||
      message.includes("não definido para upload de mídia");

    return Response.json(
      {
        error: "Não foi possível enviar o arquivo.",
        code: driveFailure ? "DRIVE_UPLOAD_FAILED" : "UPLOAD_INTERNAL_ERROR",
        details: message,
      },
      { status: 500 },
    );
  }
}
