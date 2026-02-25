import { and, desc, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { libraryAssets, libraryResources } from "@/db/schema";
import { canManageLibraryResource, requireLibraryPublishAccess } from "@/lib/library-access";
import {
  ensureGoogleCloudStorageObjectExists,
  getGoogleCloudStorageFolderByKind,
  getGoogleCloudStorageResourcesPrefix,
  isGoogleCloudStorageConfigured,
  uploadBinaryToGoogleCloudStorage,
} from "@/lib/storage/google-cloud-storage";

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
        storageObjectKey: libraryAssets.storageObjectKey,
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
          isNotNull(libraryAssets.storageObjectKey),
        ),
      )
      .orderBy(desc(libraryAssets.createdAt))
      .limit(1);

    if (existingAsset?.storageObjectKey) {
      const stillExistsInStorage = await ensureGoogleCloudStorageObjectExists(existingAsset.storageObjectKey).catch(
        () => false,
      );

      if (stillExistsInStorage) {
        return Response.json({
          ok: true,
          assetId: existingAsset.id,
          resourceId,
          storageObjectKey: existingAsset.storageObjectKey,
          publicUrl: existingAsset.externalUrl,
          processingScheduled: false,
          alreadyExists: true,
        });
      }
    }

    if (!isGoogleCloudStorageConfigured()) {
      return Response.json(
        {
          error: "Configuração do Google Cloud Storage incompleta.",
          code: "STORAGE_CONFIG_MISSING",
          details:
            "Defina GCS_BUCKET_NAME e credenciais de Service Account (GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ou credenciais padrão da aplicação.",
        },
        { status: 503 },
      );
    }

    const objectName = sanitizeFileName(fileEntry.name) || `${Date.now()}.bin`;
    const resourcesRoot = getGoogleCloudStorageResourcesPrefix();
    const resourcesFolder = getGoogleCloudStorageFolderByKind(detectedKind);
    const objectKey = `${resourcesRoot}/${resourcesFolder}/${resourceId}/${Date.now()}-${objectName}`;
    const buffer = Buffer.from(await fileEntry.arrayBuffer());

    const uploaded = await uploadBinaryToGoogleCloudStorage({
      data: buffer,
      objectKey,
      contentType: fileEntry.type || "application/octet-stream",
      metadata: {
        resourceId: sanitizeAppPropertyValue(resourceId),
        kind: sanitizeAppPropertyValue(detectedKind),
        objectKey: sanitizeAppPropertyValue(objectKey),
      },
    });

    const assetId = crypto.randomUUID();

    await db.insert(libraryAssets).values({
      id: assetId,
      resourceId,
      kind: detectedKind,
      title: fileEntry.name,
      mimeType: fileEntry.type || "application/octet-stream",
      storageObjectKey: uploaded.objectKey,
      externalUrl: uploaded.publicUrl,
      byteSize: fileEntry.size,
      status: "ready",
    });

    const warnings = [...(uploaded.permissionError ? [uploaded.permissionError] : [])];

    return Response.json({
      ok: true,
      assetId,
      resourceId,
      storageObjectKey: uploaded.objectKey,
      publicUrl: uploaded.publicUrl,
      processingScheduled: false,
      warningCode: uploaded.permissionError ? "UPLOAD_COMPLETED_WITH_WARNINGS" : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha inesperada no upload.";

    if (message.includes("Apenas curadores e administradores")) {
      return Response.json({ error: message, code: "FORBIDDEN_LIBRARY_PUBLISH_ACCESS" }, { status: 403 });
    }

    const storageFailure =
      message.includes("Cloud Storage") ||
      message.includes("GCS_BUCKET_NAME") ||
      message.includes("Service Account") ||
      message.includes("não definido para upload de mídia");

    return Response.json(
      {
        error: "Não foi possível enviar o arquivo.",
        code: storageFailure ? "STORAGE_UPLOAD_FAILED" : "UPLOAD_INTERNAL_ERROR",
        details: message,
      },
      { status: 500 },
    );
  }
}
