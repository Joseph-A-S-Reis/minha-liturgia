export type LibraryAssetLike = {
  kind: string;
  mimeType: string | null;
  externalUrl: string | null;
  storageObjectKey: string | null;
};

export type LibraryViewerKind = "html" | "video" | "audio" | "pdf" | "image" | "fallback";

const EMBED_ALLOWED_HOSTS = new Set([
  "storage.googleapis.com",
]);

function hostIsAllowed(hostname: string) {
  if (EMBED_ALLOWED_HOSTS.has(hostname)) {
    return true;
  }

  if (hostname.endsWith(".storage.googleapis.com")) {
    return true;
  }

  return false;
}

export function parseHttpUrl(url: string | null | undefined): URL | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isEmbeddableExternalUrl(url: string | null | undefined) {
  const parsed = parseHttpUrl(url);
  if (!parsed) return false;
  return hostIsAllowed(parsed.hostname);
}

function inferKindFromMimeType(mimeType: string | null | undefined): LibraryViewerKind | null {
  if (!mimeType) return null;

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("html")) return "html";
  return null;
}

export function resolveLibraryViewerKind(asset: LibraryAssetLike): LibraryViewerKind {
  const byKind = asset.kind.toLowerCase();
  if (byKind === "image") return "image";
  if (byKind === "video") return "video";
  if (byKind === "audio") return "audio";
  if (byKind === "pdf") return "pdf";
  if (byKind === "html") return "html";

  return inferKindFromMimeType(asset.mimeType) ?? "fallback";
}

export function resolveAssetOpenUrl(asset: LibraryAssetLike) {
  return asset.externalUrl;
}

export function resolveAssetEmbedUrl(asset: LibraryAssetLike) {
  if (isEmbeddableExternalUrl(asset.externalUrl)) {
    return asset.externalUrl;
  }

  return null;
}
