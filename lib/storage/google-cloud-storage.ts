import { Storage } from "@google-cloud/storage";

type GoogleServiceCredentials = {
  clientEmail: string;
  privateKey: string;
  projectId: string | null;
};

export type CloudStorageAssetKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "html"
  | "docx"
  | "epub";

type UploadResult = {
  objectKey: string;
  publicUrl: string;
  bucketName: string;
  permissionError?: string;
};

let cachedStorage: Storage | null = null;

function getGoogleServiceCredentials(): GoogleServiceCredentials | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() || process.env.GCP_PROJECT_ID?.trim() || null;

  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    clientEmail,
    privateKey,
    projectId,
  };
}

function getStorage() {
  if (cachedStorage) {
    return cachedStorage;
  }

  const credentials = getGoogleServiceCredentials();

  cachedStorage = credentials
    ? new Storage({
        projectId: credentials.projectId ?? undefined,
        credentials: {
          client_email: credentials.clientEmail,
          private_key: credentials.privateKey,
        },
      })
    : new Storage();

  return cachedStorage;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/%2F/g, "/");
}

function getBucketName() {
  return process.env.GCS_BUCKET_NAME?.trim() || null;
}

function shouldSetObjectAcl() {
  const raw = process.env.GCS_SET_OBJECT_PUBLIC_ACL?.trim().toLowerCase();
  return raw !== "false";
}

function isUniformBucketLevelAccessAclError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("uniform bucket-level access") ||
    normalized.includes("cannot update access control") ||
    normalized.includes("object acl")
  );
}

function getPublicBaseUrl() {
  const explicit = process.env.GCS_PUBLIC_BASE_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/+$/g, "");
  }

  const bucketName = getBucketName();
  if (!bucketName) return null;

  return `https://storage.googleapis.com/${encodeURIComponent(bucketName)}`;
}

export function getGoogleCloudStorageResourcesPrefix() {
  return (process.env.GCS_RESOURCES_PREFIX?.trim() || "recursos").replace(/^\/+|\/+$/g, "");
}

export function getGoogleCloudStorageFolderByKind(kind: CloudStorageAssetKind) {
  switch (kind) {
    case "video":
      return "videos";
    case "audio":
      return "audios";
    case "pdf":
      return "pdfs";
    case "html":
      return "htmls";
    case "image":
      return "imagens";
    case "docx":
      return "documentos";
    case "epub":
      return "ebooks";
    default:
      return "documentos";
  }
}

export function isGoogleCloudStorageConfigured() {
  return Boolean(getBucketName());
}

export function getGoogleCloudStoragePublicUrl(objectKey: string) {
  const trimmed = objectKey.trim();
  if (!trimmed) return null;

  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) return null;

  return `${baseUrl}/${encodePathSegment(trimmed)}`;
}

export async function uploadBinaryToGoogleCloudStorage(input: {
  data: Buffer;
  objectKey: string;
  contentType: string;
  metadata?: Record<string, string>;
  makePublic?: boolean;
}): Promise<UploadResult> {
  const bucketName = getBucketName();
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME não definido para upload de mídia.");
  }

  const objectKey = input.objectKey.trim();
  if (!objectKey) {
    throw new Error("Caminho (objectKey) inválido para upload no Cloud Storage.");
  }

  const bucket = getStorage().bucket(bucketName);
  const file = bucket.file(objectKey);

  await file.save(input.data, {
    resumable: false,
    contentType: input.contentType || "application/octet-stream",
    metadata: input.metadata ? { metadata: input.metadata } : undefined,
  });

  let permissionError: string | undefined;

  if ((input.makePublic ?? true) && shouldSetObjectAcl()) {
    try {
      await file.makePublic();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Falha ao tornar objeto público no Cloud Storage.";

      if (!isUniformBucketLevelAccessAclError(message)) {
        permissionError = message;
      }
    }
  }

  const publicUrl = getGoogleCloudStoragePublicUrl(objectKey);

  if (!publicUrl) {
    throw new Error("Não foi possível construir URL pública para o objeto no Cloud Storage.");
  }

  return {
    objectKey,
    publicUrl,
    bucketName,
    ...(permissionError ? { permissionError } : {}),
  };
}

export async function ensureGoogleCloudStorageObjectExists(objectKey: string) {
  const bucketName = getBucketName();
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME não definido para validação de objeto.");
  }

  const [exists] = await getStorage().bucket(bucketName).file(objectKey.trim()).exists();
  return exists;
}

export async function downloadGoogleCloudStorageObject(objectKey: string): Promise<Buffer> {
  const bucketName = getBucketName();
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME não definido para leitura de objeto.");
  }

  const [data] = await getStorage().bucket(bucketName).file(objectKey.trim()).download();
  return data;
}

export async function deleteGoogleCloudStorageObject(objectKey: string) {
  const bucketName = getBucketName();
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME não definido para remoção de objeto.");
  }

  await getStorage()
    .bucket(bucketName)
    .file(objectKey.trim())
    .delete({ ignoreNotFound: true });
}

export async function moveGoogleCloudStorageObject(input: {
  sourceObjectKey: string;
  destinationObjectKey: string;
  makePublic?: boolean;
}): Promise<UploadResult> {
  const bucketName = getBucketName();
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME não definido para mover objeto.");
  }

  const sourceObjectKey = input.sourceObjectKey.trim();
  const destinationObjectKey = input.destinationObjectKey.trim();

  if (!sourceObjectKey || !destinationObjectKey) {
    throw new Error("sourceObjectKey e destinationObjectKey são obrigatórios para mover objeto.");
  }

  if (sourceObjectKey === destinationObjectKey) {
    const publicUrl = getGoogleCloudStoragePublicUrl(destinationObjectKey);
    if (!publicUrl) {
      throw new Error("Não foi possível construir URL pública para o objeto no Cloud Storage.");
    }

    return {
      objectKey: destinationObjectKey,
      publicUrl,
      bucketName,
    };
  }

  const bucket = getStorage().bucket(bucketName);
  const sourceFile = bucket.file(sourceObjectKey);
  const destinationFile = bucket.file(destinationObjectKey);

  await sourceFile.copy(destinationFile);
  await sourceFile.delete({ ignoreNotFound: true });

  let permissionError: string | undefined;

  if ((input.makePublic ?? true) && shouldSetObjectAcl()) {
    try {
      await destinationFile.makePublic();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Falha ao tornar objeto público no Cloud Storage.";

      if (!isUniformBucketLevelAccessAclError(message)) {
        permissionError = message;
      }
    }
  }

  const publicUrl = getGoogleCloudStoragePublicUrl(destinationObjectKey);

  if (!publicUrl) {
    throw new Error("Não foi possível construir URL pública para o objeto no Cloud Storage.");
  }

  return {
    objectKey: destinationObjectKey,
    publicUrl,
    bucketName,
    ...(permissionError ? { permissionError } : {}),
  };
}

export type GoogleCloudStorageHealthResult = {
  ok: boolean;
  code:
    | "STORAGE_HEALTH_OK"
    | "STORAGE_CONFIG_MISSING"
    | "STORAGE_BUCKET_NOT_FOUND"
    | "STORAGE_BUCKET_FORBIDDEN"
    | "STORAGE_API_ERROR";
  details?: string;
};

export async function verifyGoogleCloudStorageHealth(): Promise<GoogleCloudStorageHealthResult> {
  const bucketName = getBucketName();
  if (!bucketName) {
    return {
      ok: false,
      code: "STORAGE_CONFIG_MISSING",
      details: "Defina GCS_BUCKET_NAME.",
    };
  }

  try {
    const [exists] = await getStorage().bucket(bucketName).exists();

    if (!exists) {
      return {
        ok: false,
        code: "STORAGE_BUCKET_NOT_FOUND",
        details: "Bucket não encontrado. Verifique GCS_BUCKET_NAME.",
      };
    }

    return { ok: true, code: "STORAGE_HEALTH_OK" };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha ao validar bucket no Cloud Storage.";

    if (message.includes("403") || message.toLowerCase().includes("forbidden")) {
      return {
        ok: false,
        code: "STORAGE_BUCKET_FORBIDDEN",
        details: "Credenciais sem acesso ao bucket do Cloud Storage.",
      };
    }

    return {
      ok: false,
      code: "STORAGE_API_ERROR",
      details: message,
    };
  }
}
