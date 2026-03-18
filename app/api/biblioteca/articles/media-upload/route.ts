import { auth } from "@/auth";
import { requireLibraryPublishAccess } from "@/lib/library-access";
import {
  getGoogleCloudStorageFolderByKind,
  getGoogleCloudStorageResourcesPrefix,
  isGoogleCloudStorageConfigured,
  uploadBinaryToGoogleCloudStorage,
} from "@/lib/storage/google-cloud-storage";

export const runtime = "nodejs";

type UploadableMediaKind = "image" | "video";

function detectMediaKindFromFile(file: File): UploadableMediaKind | null {
  const mimeType = (file.type || "").toLowerCase();

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  return null;
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
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return Response.json({ error: "Arquivo inválido.", code: "INVALID_FILE" }, { status: 400 });
    }

    if (fileEntry.size <= 0 || fileEntry.size > 300 * 1024 * 1024) {
      return Response.json(
        { error: "Arquivo fora do limite permitido (até 300MB).", code: "FILE_SIZE_NOT_ALLOWED" },
        { status: 400 },
      );
    }

    const detectedKind = detectMediaKindFromFile(fileEntry);

    if (!detectedKind) {
      return Response.json(
        {
          error: "Formato não suportado. Use arquivos de imagem ou vídeo.",
          code: "UNSUPPORTED_FILE_FORMAT",
        },
        { status: 400 },
      );
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
    const objectKey = `${resourcesRoot}/${resourcesFolder}/editor/${session.user.id}/${Date.now()}-${objectName}`;
    const buffer = Buffer.from(await fileEntry.arrayBuffer());

    const uploaded = await uploadBinaryToGoogleCloudStorage({
      data: buffer,
      objectKey,
      contentType: fileEntry.type || "application/octet-stream",
      metadata: {
        uploaderUserId: sanitizeAppPropertyValue(session.user.id),
        kind: sanitizeAppPropertyValue(detectedKind),
        objectKey: sanitizeAppPropertyValue(objectKey),
        source: "library-article-editor",
      },
    });

    const warnings = [...(uploaded.permissionError ? [uploaded.permissionError] : [])];

    return Response.json({
      ok: true,
      media: {
        kind: detectedKind,
        title: fileEntry.name,
        mimeType: fileEntry.type || "application/octet-stream",
        storageObjectKey: uploaded.objectKey,
        externalUrl: uploaded.publicUrl,
        byteSize: fileEntry.size,
      },
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
        error: "Não foi possível enviar a mídia para o editor.",
        code: storageFailure ? "STORAGE_UPLOAD_FAILED" : "UPLOAD_INTERNAL_ERROR",
        details: message,
      },
      { status: 500 },
    );
  }
}
