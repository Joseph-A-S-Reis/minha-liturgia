import { and, desc, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { libraryAssets, libraryResources } from "@/db/schema";
import { requireLibraryPublishAccess } from "@/lib/library-access";
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

function getResourcesFolderByKind(kind: AssetKind): string {
  return getGoogleCloudStorageFolderByKind(kind);
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Não autenticado.", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    await requireLibraryPublishAccess(session.user.id);

    const formData = await request.formData();
    const resourceType = String(formData.get("resourceType") ?? "").trim();
    const fileEntry = formData.get("file");

    if (!resourceType) {
      return Response.json(
        { error: "resourceType é obrigatório.", code: "RESOURCE_TYPE_REQUIRED" },
        { status: 400 },
      );
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

    const allowedKinds = getAllowedKindsByResourceType(resourceType);
    if (allowedKinds.length === 0) {
      return Response.json(
        {
          error: `O tipo ${resourceType} não aceita upload de arquivo.`,
          code: "UPLOAD_NOT_ALLOWED_FOR_RESOURCE_TYPE",
        },
        { status: 400 },
      );
    }

    if (!allowedKinds.includes(detectedKind)) {
      return Response.json(
        {
          error: `Este conteúdo (${resourceType}) aceita apenas: ${allowedKinds.join(", ")}.`,
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
        kind: libraryAssets.kind,
        title: libraryAssets.title,
        mimeType: libraryAssets.mimeType,
        byteSize: libraryAssets.byteSize,
      })
      .from(libraryAssets)
      .innerJoin(libraryResources, eq(libraryResources.id, libraryAssets.resourceId))
      .where(
        and(
          eq(libraryResources.createdByUserId, session.user.id),
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
          alreadyExists: true,
          asset: {
            kind: existingAsset.kind,
            title: existingAsset.title,
            mimeType: existingAsset.mimeType,
            storageObjectKey: existingAsset.storageObjectKey,
            externalUrl: existingAsset.externalUrl,
            byteSize: existingAsset.byteSize,
          },
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
    const resourcesFolder = getResourcesFolderByKind(detectedKind);
    const tempKey = crypto.randomUUID();
    const objectKey = `${resourcesRoot}/${resourcesFolder}/prepublish/${session.user.id}/${Date.now()}-${objectName}`;
    const buffer = Buffer.from(await fileEntry.arrayBuffer());

    const uploaded = await uploadBinaryToGoogleCloudStorage({
      data: buffer,
      objectKey,
      contentType: fileEntry.type || "application/octet-stream",
      metadata: {
        tempUploadKey: sanitizeAppPropertyValue(tempKey),
        userId: sanitizeAppPropertyValue(session.user.id),
        kind: sanitizeAppPropertyValue(detectedKind),
        objectKey: sanitizeAppPropertyValue(objectKey),
      },
    });

    const warnings = [...(uploaded.permissionError ? [uploaded.permissionError] : [])];

    return Response.json({
      ok: true,
      alreadyExists: false,
      warningCode: uploaded.permissionError ? "UPLOAD_COMPLETED_WITH_WARNINGS" : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      asset: {
        kind: detectedKind,
        title: fileEntry.name,
        mimeType: fileEntry.type || "application/octet-stream",
        storageObjectKey: uploaded.objectKey,
        externalUrl: uploaded.publicUrl,
        byteSize: fileEntry.size,
      },
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
