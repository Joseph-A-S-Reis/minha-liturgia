import { createSign } from "node:crypto";

type GoogleServiceCredentials = {
  clientEmail: string;
  privateKey: string;
};

type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type GoogleDriveUploadResult = {
  fileId: string;
  webViewUrl: string;
  webDownloadUrl: string | null;
  permissionError?: string;
};

export type GoogleDriveAssetKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "html"
  | "docx"
  | "epub";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

const tokenCache = new Map<string, { accessToken: string; expiresAtMs: number }>();

function toBase64Url(input: Buffer | string) {
  const value = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getGoogleServiceCredentials(): GoogleServiceCredentials | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    clientEmail,
    privateKey,
  };
}

function getGoogleOAuthCredentials(): GoogleOAuthCredentials | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
  };
}

function getGoogleDriveAuthMode() {
  if (getGoogleOAuthCredentials()) {
    return "oauth-refresh-token" as const;
  }

  if (getGoogleServiceCredentials()) {
    return "service-account" as const;
  }

  return null;
}

function buildSignedJwt(scope: string): string {
  const credentials = getGoogleServiceCredentials();

  if (!credentials) {
    throw new Error(
      "Credenciais da Service Account ausentes. Defina GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: credentials.clientEmail,
    scope,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(credentials.privateKey);

  return `${unsignedToken}.${toBase64Url(signature)}`;
}

async function getGoogleAccessToken(scope = GOOGLE_DRIVE_SCOPE): Promise<string> {
  const now = Date.now();

  const authMode = getGoogleDriveAuthMode();
  if (!authMode) {
    throw new Error(
      "Credenciais Google ausentes. Configure OAuth2 (GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN) ou Service Account (GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY).",
    );
  }

  const oauthCredentials = authMode === "oauth-refresh-token" ? getGoogleOAuthCredentials() : null;
  const cacheKey =
    authMode === "oauth-refresh-token" && oauthCredentials
      ? `oauth:${oauthCredentials.clientId}:${scope}`
      : `service-account:${scope}`;

  const cachedToken = tokenCache.get(cacheKey);
  if (cachedToken && cachedToken.expiresAtMs - 30_000 > now) {
    return cachedToken.accessToken;
  }

  let body: URLSearchParams;
  if (authMode === "oauth-refresh-token") {
    if (!oauthCredentials) {
      throw new Error("Credenciais OAuth inválidas para Google Drive.");
    }

    body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: oauthCredentials.clientId,
      client_secret: oauthCredentials.clientSecret,
      refresh_token: oauthCredentials.refreshToken,
    });
  } else {
    const assertion = buildSignedJwt(scope);
    body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        access_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      }
    | null;

  if (!response.ok || !payload?.access_token) {
    const reason = payload?.error_description || payload?.error || `HTTP ${response.status}`;
    throw new Error(
      `Falha ao obter token OAuth do Google (${authMode === "oauth-refresh-token" ? "refresh_token" : "service_account"}): ${reason}`,
    );
  }

  tokenCache.set(cacheKey, {
    accessToken: payload.access_token,
    expiresAtMs: now + (payload.expires_in ?? 3600) * 1000,
  });

  return payload.access_token;
}

async function ensurePublicReadPermission(fileId: string, accessToken: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "anyone",
        role: "reader",
      }),
    },
  );

  if (!response.ok && response.status !== 409) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Não foi possível tornar o arquivo público no Google Drive. ${text || `HTTP ${response.status}`}`,
    );
  }
}

export function isGoogleDriveConfigured() {
  const authMode = getGoogleDriveAuthMode();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

  return Boolean(authMode && folderId);
}

export function getGoogleDriveDefaultFolderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || null;
}

export function getGoogleDrivePublicUrl(fileId: string) {
  const trimmed = fileId.trim();
  if (!trimmed) return null;
  return `https://drive.google.com/file/d/${encodeURIComponent(trimmed)}/view`;
}

export function getGoogleDrivePreviewUrl(fileId: string) {
  const trimmed = fileId.trim();
  if (!trimmed) return null;
  return `https://drive.google.com/file/d/${encodeURIComponent(trimmed)}/preview`;
}

function escapeDriveQueryLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getFolderNamesByKind(kind: GoogleDriveAssetKind) {
  switch (kind) {
    case "video":
      return ["videos", "vídeos"];
    case "audio":
      return ["audios", "áudios"];
    case "pdf":
      return ["pdfs", "documentos"];
    case "html":
      return ["htmls", "paginas", "páginas"];
    case "image":
      return ["imagens", "images"];
    case "docx":
      return ["documentos", "docx", "word"];
    case "epub":
      return ["ebooks", "epub"];
    default:
      return ["midias", "mídias"];
  }
}

function getGoogleDriveFolderIdByKindFromEnv(kind: GoogleDriveAssetKind) {
  const map: Record<GoogleDriveAssetKind, string | undefined> = {
    html: process.env.GOOGLE_DRIVE_HTMLS_FOLDER_ID,
    video: process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID,
    audio: process.env.GOOGLE_DRIVE_AUDIOS_FOLDER_ID,
    image: process.env.GOOGLE_DRIVE_IMAGENS_FOLDER_ID,
    pdf: process.env.GOOGLE_DRIVE_PDFS_FOLDER_ID,
    docx: process.env.GOOGLE_DRIVE_DOCX_FOLDER_ID,
    epub: process.env.GOOGLE_DRIVE_EPUBS_FOLDER_ID,
  };

  return map[kind]?.trim() || null;
}

async function findGoogleDriveChildFolderIdByName(input: {
  parentFolderId: string;
  childFolderName: string;
  accessToken: string;
}) {
  const q = [
    `'${escapeDriveQueryLiteral(input.parentFolderId)}' in parents`,
    "mimeType='application/vnd.google-apps.folder'",
    `name='${escapeDriveQueryLiteral(input.childFolderName)}'`,
    "trashed=false",
  ].join(" and ");

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=1&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Falha ao localizar subpasta no Google Drive (${input.childFolderName}). ${text || `HTTP ${response.status}`}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { files?: Array<{ id?: string; name?: string }> }
    | null;

  const folderId = payload?.files?.[0]?.id?.trim();
  return folderId || null;
}

export async function resolveGoogleDriveParentFolderByKind(kind: GoogleDriveAssetKind) {
  const explicitFolderId = getGoogleDriveFolderIdByKindFromEnv(kind);
  if (explicitFolderId) {
    return explicitFolderId;
  }

  const rootFolderId = getGoogleDriveDefaultFolderId();
  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID não definido para upload de mídia.");
  }

  const accessToken = await getGoogleAccessToken();
  const candidateNames = getFolderNamesByKind(kind);

  for (const name of candidateNames) {
    const folderId = await findGoogleDriveChildFolderIdByName({
      parentFolderId: rootFolderId,
      childFolderName: name,
      accessToken,
    });

    if (folderId) {
      return folderId;
    }
  }

  throw new Error(
    `Pasta do Drive para tipo '${kind}' não encontrada dentro da pasta raiz. Crie uma pasta com um destes nomes: ${candidateNames.join(", ")}.`,
  );
}

export async function uploadBinaryToGoogleDrive(input: {
  data: Buffer;
  fileName: string;
  contentType: string;
  parentFolderId?: string | null;
  appProperties?: Record<string, string>;
  makePublic?: boolean;
}): Promise<GoogleDriveUploadResult> {
  const accessToken = await getGoogleAccessToken();

  const parentFolderId = input.parentFolderId?.trim() || getGoogleDriveDefaultFolderId();
  if (!parentFolderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID não definido para upload de mídia.");
  }

  const metadata = {
    name: input.fileName,
    parents: [parentFolderId],
    ...(input.appProperties ? { appProperties: input.appProperties } : {}),
  };

  const boundary = `drive_upload_${crypto.randomUUID().replace(/-/g, "")}`;

  const head = Buffer.from(
    `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${input.contentType || "application/octet-stream"}\r\n\r\n`,
    "utf8",
  );

  const tail = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const body = Buffer.concat([head, input.data, tail]);

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  const uploadPayload = (await uploadResponse.json().catch(() => null)) as
    | {
        id?: string;
        webViewLink?: string;
        webContentLink?: string;
        error?: { message?: string };
      }
    | null;

  if (!uploadResponse.ok || !uploadPayload?.id) {
    const reason = uploadPayload?.error?.message || `HTTP ${uploadResponse.status}`;
    throw new Error(`Falha ao enviar arquivo para Google Drive: ${reason}`);
  }

  let permissionError: string | undefined;

  if (input.makePublic ?? true) {
    try {
      await ensurePublicReadPermission(uploadPayload.id, accessToken);
    } catch (cause) {
      permissionError = cause instanceof Error ? cause.message : "Falha ao tornar arquivo público.";
    }
  }

  return {
    fileId: uploadPayload.id,
    webViewUrl: uploadPayload.webViewLink || getGoogleDrivePublicUrl(uploadPayload.id) || "",
    webDownloadUrl: uploadPayload.webContentLink || null,
    ...(permissionError ? { permissionError } : {}),
  };
}

export async function ensureGoogleDriveFileExists(fileId: string) {
  const accessToken = await getGoogleAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Falha ao validar arquivo no Google Drive. ${text || `HTTP ${response.status}`}`);
  }

  return true;
}

export async function downloadGoogleDriveFile(fileId: string): Promise<Buffer> {
  const accessToken = await getGoogleAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Falha ao baixar arquivo do Google Drive. ${text || `HTTP ${response.status}`}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export type GoogleDriveHealthResult = {
  ok: boolean;
  code:
    | "DRIVE_HEALTH_OK"
    | "DRIVE_CONFIG_MISSING"
    | "DRIVE_AUTH_FAILED"
    | "DRIVE_FOLDER_NOT_FOUND"
    | "DRIVE_FOLDER_FORBIDDEN"
    | "DRIVE_API_ERROR";
  details?: string;
};

export async function verifyGoogleDriveHealth(): Promise<GoogleDriveHealthResult> {
  if (!isGoogleDriveConfigured()) {
    return {
      ok: false,
      code: "DRIVE_CONFIG_MISSING",
      details:
        "Defina GOOGLE_DRIVE_FOLDER_ID e credenciais Google (OAuth2 ou Service Account).",
    };
  }

  const folderId = getGoogleDriveDefaultFolderId();
  if (!folderId) {
    return {
      ok: false,
      code: "DRIVE_CONFIG_MISSING",
      details: "GOOGLE_DRIVE_FOLDER_ID ausente.",
    };
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (cause) {
    return {
      ok: false,
      code: "DRIVE_AUTH_FAILED",
      details: cause instanceof Error ? cause.message : "Falha ao autenticar no Google OAuth.",
    };
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (response.ok) {
    return { ok: true, code: "DRIVE_HEALTH_OK" };
  }

  if (response.status === 404) {
    return {
      ok: false,
      code: "DRIVE_FOLDER_NOT_FOUND",
      details: "Pasta do Drive não encontrada. Verifique GOOGLE_DRIVE_FOLDER_ID.",
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      code: "DRIVE_FOLDER_FORBIDDEN",
      details: "Credenciais sem acesso à pasta do Drive. Garanta permissão de Editor para a identidade usada.",
    };
  }

  const text = await response.text().catch(() => "");
  return {
    ok: false,
    code: "DRIVE_API_ERROR",
    details: text || `Falha inesperada ao validar pasta do Drive (HTTP ${response.status}).`,
  };
}
