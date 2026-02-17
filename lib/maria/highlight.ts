import { unstable_cache } from "next/cache";

export type DailyHighlight = {
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
  imageUrl: string | null;
  category: string | null;
};

type HighlightCandidate = DailyHighlight;

const OFFICIAL_FEEDS = [
  {
    name: "Vatican News (PT)",
    url: "https://www.vaticannews.va/pt.rss.xml",
  },
  {
    name: "CNBB",
    url: "https://www.cnbb.org.br/feed/",
  },
] as const;

function stripHtml(input: string) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlEntities(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .trim();
}

function pickTagRaw(xml: string, tag: string) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = regex.exec(xml);
  if (!match?.[1]) return "";

  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function pickTagContent(xml: string, tag: string) {
  const raw = pickTagRaw(xml, tag);
  if (!raw) return "";
  return decodeXmlEntities(stripHtml(raw));
}

function normalizeUrl(input: string) {
  const value = input.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function truncateSummary(input: string, maxChars = 280) {
  if (input.length <= maxChars) {
    return input;
  }

  return `${input.slice(0, maxChars).trimEnd()}…`;
}

function extractImageUrl(chunk: string) {
  const patterns = [
    /<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i,
    /<media:content[^>]*url=["']([^"']+)["'][^>]*>/i,
    /<media:thumbnail[^>]*url=["']([^"']+)["'][^>]*>/i,
    /<img[^>]*src=["']([^"']+)["'][^>]*>/i,
  ];

  const contentEncoded = pickTagRaw(chunk, "content:encoded");
  const description = pickTagRaw(chunk, "description");
  const searchable = `${chunk}\n${contentEncoded}\n${description}`;

  for (const pattern of patterns) {
    const match = pattern.exec(searchable);
    if (!match?.[1]) continue;

    const normalized = normalizeUrl(decodeXmlEntities(match[1]));
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function parseRssItems(xml: string, sourceName: string) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const parsed: HighlightCandidate[] = [];

  for (const item of items) {
    const chunk = item[1] ?? "";
    const title = pickTagContent(chunk, "title");
    const rawLink = pickTagContent(chunk, "link") || pickTagContent(chunk, "guid");
    const description = pickTagContent(chunk, "description") || pickTagContent(chunk, "content:encoded");
    const pubDate = pickTagContent(chunk, "pubDate");
    const category = pickTagContent(chunk, "category");
    const link = normalizeUrl(rawLink);
    const imageUrl = extractImageUrl(chunk);

    if (!title || !link) {
      continue;
    }

    parsed.push({
      title,
      summary: truncateSummary(
        description || "Veja a publicação completa para mais detalhes.",
      ),
      sourceName,
      sourceUrl: link,
      publishedAt: pubDate || null,
      imageUrl,
      category: category || null,
    });
  }

  return parsed;
}

async function fetchFeedCandidates(feed: (typeof OFFICIAL_FEEDS)[number]) {
  try {
    const response = await fetch(feed.url, {
      next: { revalidate: 60 * 60 * 6 },
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseRssItems(xml, feed.name);
  } catch {
    return [];
  }
}

async function buildDailyHighlight(): Promise<DailyHighlight | null> {
  const results = await Promise.all(OFFICIAL_FEEDS.map((feed) => fetchFeedCandidates(feed)));
  const candidates: HighlightCandidate[] = results.flat();

  if (candidates.length === 0) {
    return null;
  }

  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const sorted = candidates.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

    const aIsToday = aTime >= dayStart;
    const bIsToday = bTime >= dayStart;

    if (aIsToday !== bIsToday) {
      return aIsToday ? -1 : 1;
    }

    return bTime - aTime;
  });

  return sorted[0] ?? null;
}

const getCachedHighlight = unstable_cache(async () => {
  return buildDailyHighlight();
}, ["maria-daily-highlight"], {
  revalidate: 60 * 60 * 6,
  tags: ["maria-highlight"],
});

export async function getDailyChurchHighlight() {
  return getCachedHighlight();
}
