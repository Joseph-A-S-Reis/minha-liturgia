export type ArticleInlineMediaKind = "image" | "video" | "embed";

export type ArticleInlineMediaDescriptor = {
  kind: ArticleInlineMediaKind;
  src: string;
  title?: string;
};

const IMAGE_URL_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:$|[?#])/i;
const VIDEO_URL_PATTERN = /\.(m3u8|m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;
const SIMPLE_HTTP_URL_PATTERN = /^https?:\/\//i;

function normalizeUrl(input: string) {
  return input.trim();
}

export function parseHttpUrl(input: string) {
  const normalized = normalizeUrl(input);

  if (!SIMPLE_HTTP_URL_PATTERN.test(normalized)) {
    return null;
  }

  try {
    const parsed = new URL(normalized);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function extractYoutubeVideoId(parsed: URL) {
  const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();

  if (hostname === "youtu.be") {
    return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    if (parsed.pathname === "/watch") {
      return parsed.searchParams.get("v");
    }

    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.split("/").filter(Boolean)[1] ?? null;
    }

    if (parsed.pathname.startsWith("/embed/")) {
      return parsed.pathname.split("/").filter(Boolean)[1] ?? null;
    }
  }

  return null;
}

function extractVimeoVideoId(parsed: URL) {
  const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();

  if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") {
    return null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const numericSegment = segments.find((segment) => /^\d+$/.test(segment));

  return numericSegment ?? null;
}

export function resolveEmbeddedVideoUrl(input: string) {
  const parsed = parseHttpUrl(input);
  if (!parsed) return null;

  const youtubeId = extractYoutubeVideoId(parsed);
  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}`;
  }

  const vimeoId = extractVimeoVideoId(parsed);
  if (vimeoId) {
    return `https://player.vimeo.com/video/${vimeoId}`;
  }

  return null;
}

export function inferArticleInlineMediaFromUrl(input: string): ArticleInlineMediaDescriptor | null {
  const normalized = normalizeUrl(input);
  const parsed = parseHttpUrl(normalized);

  if (!parsed) {
    return null;
  }

  const embeddedVideoUrl = resolveEmbeddedVideoUrl(normalized);
  if (embeddedVideoUrl) {
    return {
      kind: "embed",
      src: embeddedVideoUrl,
      title: "Vídeo incorporado",
    };
  }

  if (IMAGE_URL_PATTERN.test(parsed.pathname)) {
    return {
      kind: "image",
      src: parsed.toString(),
    };
  }

  if (VIDEO_URL_PATTERN.test(parsed.pathname)) {
    return {
      kind: "video",
      src: parsed.toString(),
      title: parsed.pathname.split("/").filter(Boolean).at(-1) ?? "Vídeo",
    };
  }

  return null;
}

export function isArticleMediaFile(file: File) {
  const mimeType = (file.type || "").toLowerCase();
  return mimeType.startsWith("image/") || mimeType.startsWith("video/");
}

export function detectArticleMediaKindFromFile(file: File): Exclude<ArticleInlineMediaKind, "embed"> | null {
  const mimeType = (file.type || "").toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}
