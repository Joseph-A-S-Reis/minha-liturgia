const OFFICIAL_APP_URL = "https://minha-liturgia.netlify.app";

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizeBaseUrl(raw: string | undefined): string | null {
  if (!raw) return null;

  try {
    const parsed = new URL(raw);

    if (process.env.NODE_ENV === "production" && isLocalhost(parsed.hostname)) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

export function getAppBaseUrl(): string {
  const candidates = [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }

  if (process.env.NODE_ENV === "production") {
    return OFFICIAL_APP_URL;
  }

  return "http://127.0.0.1:3000";
}

export function buildAbsoluteAppUrl(path: string): string {
  return new URL(path, getAppBaseUrl()).toString();
}
