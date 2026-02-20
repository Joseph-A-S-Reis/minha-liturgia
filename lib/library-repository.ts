import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  libraryAssets,
  libraryCategories,
  libraryResourceCategories,
  libraryResourceChunks,
  libraryResources,
} from "@/db/schema";

export type LibraryCategory = {
  id: string;
  slug: string;
  name: string;
  section: string;
};

export type LibraryResourceCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  resourceType: string;
  level: string;
  coverImageUrl: string | null;
  isOfficialChurchSource: boolean;
  sourceName: string | null;
  publishedAt: Date | null;
  categories: LibraryCategory[];
};

export type LibraryResourceDetail = LibraryResourceCard & {
  contentMarkdown: string | null;
  sourceUrl: string | null;
  assets: Array<{
    id: string;
    kind: string;
    title: string | null;
    mimeType: string | null;
    externalUrl: string | null;
    driveFileId: string | null;
    status: string;
  }>;
};

type ListResourcesInput = {
  query?: string;
  type?: string;
  section?: string;
  officialOnly?: boolean;
  limit?: number;
};

export type LibraryContextSnippet = {
  resourceId: string;
  resourceSlug: string;
  resourceTitle: string;
  resourceSourceUrl: string | null;
  chunkId: string;
  chunkIndex: number;
  content: string;
  score: number;
};

export async function getLibraryCategories(section?: string): Promise<LibraryCategory[]> {
  const where = section
    ? and(eq(libraryCategories.isActive, true), eq(libraryCategories.section, section))
    : eq(libraryCategories.isActive, true);

  return db
    .select({
      id: libraryCategories.id,
      slug: libraryCategories.slug,
      name: libraryCategories.name,
      section: libraryCategories.section,
    })
    .from(libraryCategories)
    .where(where)
    .orderBy(libraryCategories.sortOrder, libraryCategories.name);
}

export async function listPublishedLibraryResources(
  input: ListResourcesInput,
): Promise<LibraryResourceCard[]> {
  const query = input.query?.trim();
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 120);

  const whereClauses = [eq(libraryResources.status, "published")];

  if (input.type) {
    whereClauses.push(eq(libraryResources.resourceType, input.type));
  }

  if (input.officialOnly) {
    whereClauses.push(eq(libraryResources.isOfficialChurchSource, true));
  }

  if (query) {
    whereClauses.push(
      or(
        ilike(libraryResources.title, `%${query}%`),
        ilike(libraryResources.summary, `%${query}%`),
        ilike(libraryResources.contentMarkdown, `%${query}%`),
      )!,
    );
  }

  const resources = await db
    .select({
      id: libraryResources.id,
      slug: libraryResources.slug,
      title: libraryResources.title,
      summary: libraryResources.summary,
      resourceType: libraryResources.resourceType,
      level: libraryResources.level,
      coverImageUrl: libraryResources.coverImageUrl,
      isOfficialChurchSource: libraryResources.isOfficialChurchSource,
      sourceName: libraryResources.sourceName,
      publishedAt: libraryResources.publishedAt,
    })
    .from(libraryResources)
    .where(and(...whereClauses))
    .orderBy(desc(libraryResources.publishedAt), desc(libraryResources.createdAt))
    .limit(limit);

  if (resources.length === 0) {
    return [];
  }

  const resourceIds = resources.map((item) => item.id);

  const categoryRows = await db
    .select({
      resourceId: libraryResourceCategories.resourceId,
      id: libraryCategories.id,
      slug: libraryCategories.slug,
      name: libraryCategories.name,
      section: libraryCategories.section,
    })
    .from(libraryResourceCategories)
    .innerJoin(libraryCategories, eq(libraryCategories.id, libraryResourceCategories.categoryId))
    .where(inArray(libraryResourceCategories.resourceId, resourceIds));

  const categoryMap = new Map<string, LibraryCategory[]>();

  for (const row of categoryRows) {
    const previous = categoryMap.get(row.resourceId) ?? [];
    previous.push({
      id: row.id,
      slug: row.slug,
      name: row.name,
      section: row.section,
    });
    categoryMap.set(row.resourceId, previous);
  }

  const filteredBySection = input.section?.trim();

  const normalized = resources
    .map<LibraryResourceCard>((resource) => ({
      ...resource,
      categories: categoryMap.get(resource.id) ?? [],
    }))
    .filter((resource) => {
      if (!filteredBySection) return true;
      return resource.categories.some((category) => category.section === filteredBySection);
    });

  return normalized;
}

export async function getPublishedLibraryResourceBySlug(
  slug: string,
): Promise<LibraryResourceDetail | null> {
  const [resource] = await db
    .select({
      id: libraryResources.id,
      slug: libraryResources.slug,
      title: libraryResources.title,
      summary: libraryResources.summary,
      resourceType: libraryResources.resourceType,
      level: libraryResources.level,
      coverImageUrl: libraryResources.coverImageUrl,
      isOfficialChurchSource: libraryResources.isOfficialChurchSource,
      sourceName: libraryResources.sourceName,
      sourceUrl: libraryResources.sourceUrl,
      contentMarkdown: libraryResources.contentMarkdown,
      publishedAt: libraryResources.publishedAt,
    })
    .from(libraryResources)
    .where(and(eq(libraryResources.slug, slug), eq(libraryResources.status, "published")))
    .limit(1);

  if (!resource) {
    return null;
  }

  const [categories, assets] = await Promise.all([
    db
      .select({
        id: libraryCategories.id,
        slug: libraryCategories.slug,
        name: libraryCategories.name,
        section: libraryCategories.section,
      })
      .from(libraryResourceCategories)
      .innerJoin(libraryCategories, eq(libraryCategories.id, libraryResourceCategories.categoryId))
      .where(eq(libraryResourceCategories.resourceId, resource.id)),
    db
      .select({
        id: libraryAssets.id,
        kind: libraryAssets.kind,
        title: libraryAssets.title,
        mimeType: libraryAssets.mimeType,
        externalUrl: libraryAssets.externalUrl,
        driveFileId: libraryAssets.driveFileId,
        status: libraryAssets.status,
      })
      .from(libraryAssets)
      .where(eq(libraryAssets.resourceId, resource.id))
      .orderBy(libraryAssets.createdAt),
  ]);

  return {
    ...resource,
    categories,
    assets,
  };
}

function compactSnippet(text: string, maxLength = 700) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}

function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(value: string) {
  const normalized = normalizeForSearch(value);
  if (!normalized) return [];

  const stopwords = new Set([
    "a",
    "o",
    "os",
    "as",
    "de",
    "do",
    "da",
    "dos",
    "das",
    "e",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "para",
    "por",
    "com",
    "sem",
    "que",
    "se",
    "um",
    "uma",
    "ao",
    "aos",
  ]);

  return Array.from(
    new Set(
      normalized
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !stopwords.has(token)),
    ),
  );
}

export async function searchPublishedLibraryContextByChunks(input: {
  query: string;
  limit?: number;
  minScore?: number;
}): Promise<LibraryContextSnippet[]> {
  const query = input.query.trim();
  if (!query) {
    return [];
  }

  const limit = Math.min(Math.max(input.limit ?? 6, 1), 12);
  const minScore = Math.max(1, input.minScore ?? 1);
  const queryTokens = tokenizeQuery(query);

  const whereChunkMatch =
    queryTokens.length > 0
      ? or(
          ilike(libraryResourceChunks.content, `%${query}%`),
          ilike(libraryResources.title, `%${query}%`),
          ...queryTokens.map((token) => ilike(libraryResourceChunks.content, `%${token}%`)),
          ...queryTokens.map((token) => ilike(libraryResources.title, `%${token}%`)),
        )
      : or(
          ilike(libraryResourceChunks.content, `%${query}%`),
          ilike(libraryResources.title, `%${query}%`),
        );

  const rows = await db
    .select({
      resourceId: libraryResources.id,
      resourceSlug: libraryResources.slug,
      resourceTitle: libraryResources.title,
      resourceSourceUrl: libraryResources.sourceUrl,
      chunkId: libraryResourceChunks.id,
      chunkIndex: libraryResourceChunks.chunkIndex,
      content: libraryResourceChunks.content,
      publishedAt: libraryResources.publishedAt,
    })
    .from(libraryResourceChunks)
    .innerJoin(libraryResources, eq(libraryResources.id, libraryResourceChunks.resourceId))
    .where(
      and(
        eq(libraryResources.status, "published"),
        whereChunkMatch!,
      ),
    )
    .orderBy(desc(libraryResources.publishedAt), desc(libraryResources.updatedAt))
    .limit(100);

  const normalizedQuery = normalizeForSearch(query);

  const ranked = rows
    .map((row) => {
      const normalizedTitle = normalizeForSearch(row.resourceTitle);
      const normalizedContent = normalizeForSearch(row.content);

      let score = 0;

      if (normalizedTitle.includes(normalizedQuery)) {
        score += 8;
      }

      if (normalizedContent.includes(normalizedQuery)) {
        score += 6;
      }

      for (const token of queryTokens) {
        if (normalizedTitle.includes(token)) {
          score += 5;
        }
        if (normalizedContent.includes(token)) {
          score += 2;
        }
      }

      const recencyBoost = row.publishedAt ? 1 : 0;
      score += recencyBoost;

      return {
        row,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const maxPerResource = 2;
  const firstPassTarget = Math.max(1, Math.ceil(limit * 0.7));
  const perResourceCount = new Map<string, number>();
  const diversified: Array<{ row: (typeof ranked)[number]["row"]; score: number }> = [];

  for (const item of ranked) {
    const current = perResourceCount.get(item.row.resourceId) ?? 0;
    if (current >= 1) {
      continue;
    }

    diversified.push({ row: item.row, score: item.score });
    perResourceCount.set(item.row.resourceId, current + 1);

    if (diversified.length >= firstPassTarget) {
      break;
    }
  }

  for (const item of ranked) {
    if (diversified.length >= limit) {
      break;
    }

    if (diversified.some((selected) => selected.row.chunkId === item.row.chunkId)) {
      continue;
    }

    const current = perResourceCount.get(item.row.resourceId) ?? 0;
    if (current >= maxPerResource) {
      continue;
    }

    diversified.push({ row: item.row, score: item.score });
    perResourceCount.set(item.row.resourceId, current + 1);
  }

  const finalRows = diversified
    .filter((item) => item.score >= minScore)
    .slice(0, limit);

  return finalRows.map((item) => ({
    resourceId: item.row.resourceId,
    resourceSlug: item.row.resourceSlug,
    resourceTitle: item.row.resourceTitle,
    resourceSourceUrl: item.row.resourceSourceUrl,
    chunkId: item.row.chunkId,
    chunkIndex: item.row.chunkIndex,
    content: compactSnippet(item.row.content),
    score: item.score,
  }));
}
