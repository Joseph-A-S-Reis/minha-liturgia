import { and, desc, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { libraryAssets, libraryResources } from "@/db/schema";
import { canManageLibraryResource, requireLibraryPublishAccess } from "@/lib/library-access";
import {
  ensureGoogleDriveFileExists,
  isGoogleDriveConfigured,
  resolveGoogleDriveParentFolderByKind,
  uploadBinaryToGoogleDrive,
} from "@/lib/storage/google-drive";

export const runtime = "nodejs";

type AssetKind = "pdf" | "docx" | "epub";

function detectKindFromFile(file: File): AssetKind | null {
  const fileName = file.name.toLowerCase();
  const contentType = (file.type || "").toLowerCase();

  if (contentType === "application/pdf" || fileName.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    return "docx";
  }

  if (contentType === "application/epub+zip" || fileName.endsWith(".epub")) {
    return "epub";
  }

  return null;
}

function getAllowedKindsByResourceType(resourceType: string): AssetKind[] {
  switch (resourceType) {
    case "article":
      return [];
    case "book":
    case "document":
      return ["pdf", "docx", "epub"];
    default:
      return [];
  }
}

function getResourcesFolderByKind(kind: AssetKind): string {
  switch (kind) {
    case "pdf":
      return "pdfs";
    case "docx":
      return "documentos";
    case "epub":
      return "ebooks";
    default:
      return "documentos";
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

    const publishAccess = await requireLibraryPublishAccess(session.user.id);

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
          error: "Formato não suportado. Use PDF, DOCX ou EPUB.",
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
      .where(eq(libraryResources.id, resourceId))
      .limit(1);

    if (!resource ||
      !canManageLibraryResource({
        userId: session.user.id,
        createdByUserId: resource.createdByUserId,
        access: publishAccess,
      })) {
      return Response.json(
        { error: "Publicação não encontrada ou sem permissão.", code: "RESOURCE_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 },
      );
    }

    const allowedKinds = getAllowedKindsByResourceType(resource.resourceType);
    if (allowedKinds.length === 0) {
      return Response.json(
        {
          error: `O tipo ${resource.resourceType} não aceita upload de arquivo.`,
          code: "UPLOAD_NOT_ALLOWED_FOR_RESOURCE_TYPE",
        },
        { status: 400 },
      );
    }

    if (!allowedKinds.includes(detectedKind)) {
      return Response.json(
        {
          error: `Este conteúdo (${resource.resourceType}) aceita apenas: ${allowedKinds.join(", ")}.`,
          code: "KIND_NOT_ALLOWED_FOR_RESOURCE_TYPE",
        },
        { status: 400 },
      );
    }

    const [existingAsset] = await db
      .select({
        id: libraryAssets.id,
        driveFileId: libraryAssets.driveFileId,
        externalUrl: libraryAssets.externalUrl,
      })
      .from(libraryAssets)
      .where(
        and(
          eq(libraryAssets.resourceId, resourceId),
          eq(libraryAssets.kind, detectedKind),
          eq(libraryAssets.title, fileEntry.name),
          eq(libraryAssets.mimeType, fileEntry.type || "application/octet-stream"),
          eq(libraryAssets.byteSize, fileEntry.size),
          isNotNull(libraryAssets.driveFileId),
        ),
      )
      .orderBy(desc(libraryAssets.createdAt))
      .limit(1);

    if (existingAsset?.driveFileId) {
      const stillExistsInDrive = await ensureGoogleDriveFileExists(existingAsset.driveFileId).catch(
        () => false,
      );

      if (stillExistsInDrive) {
        return Response.json({
          ok: true,
          assetId: existingAsset.id,
          resourceId,
          driveFileId: existingAsset.driveFileId,
          publicUrl: existingAsset.externalUrl,
          processingScheduled: false,
          alreadyExists: true,
        });
      }
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
