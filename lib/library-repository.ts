import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  libraryAssets,
  libraryCategories,
  libraryResourceCategories,
  libraryResourceChunks,
  libraryResources,
  users,
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
  coverImageUrl: string | null;
  isOfficialChurchSource: boolean;
  sourceName: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  authorName: string | null;
  authorEmail: string | null;
  categories: LibraryCategory[];
};

export type LibraryResourceDetail = LibraryResourceCard & {
  createdByUserId: string | null;
  contentMarkdown: string | null;
  sourceUrl: string | null;
  assets: Array<{
    id: string;
    kind: string;
    title: string | null;
    mimeType: string | null;
    externalUrl: string | null;
    storageObjectKey: string | null;
    status: string;
  }>;
};

type ListResourcesInput = {
  query?: string;
  type?: string;
  section?: string;
  officialOnly?: boolean;
  limit?: number;
  page?: number;
};

export type PaginatedLibraryResources = {
  items: LibraryResourceCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

export type LibraryManageResource = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  contentMarkdown: string | null;
  resourceType: string;
  status: string;
  sourceName: string | null;
  sourceUrl: string | null;
  isOfficialChurchSource: boolean;
  createdByUserId: string | null;
  categoryIds: string[];
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
): Promise<PaginatedLibraryResources> {
  const query = input.query?.trim();
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 120);
  const requestedPage = Math.max(1, Math.trunc(input.page ?? 1));
  const filteredBySection = input.section?.trim();

  const whereClauses = [eq(libraryResources.status, "published")];

  if (filteredBySection) {
    const sectionMatches = await db
      .select({ resourceId: libraryResourceCategories.resourceId })
      .from(libraryResourceCategories)
      .innerJoin(libraryCategories, eq(libraryCategories.id, libraryResourceCategories.categoryId))
      .where(
        and(
          eq(libraryCategories.isActive, true),
          eq(libraryCategories.section, filteredBySection),
        ),
      );

    const sectionResourceIds = Array.from(new Set(sectionMatches.map((item) => item.resourceId)));

    if (sectionResourceIds.length === 0) {
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: limit,
        totalPages: 0,
      };
    }

    whereClauses.push(inArray(libraryResources.id, sectionResourceIds));
  }

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

  const [countResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(libraryResources)
    .where(and(...whereClauses));

  const total = Number(countResult?.total ?? 0);

  if (total === 0) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: limit,
      totalPages: 0,
    };
  }

  const totalPages = Math.ceil(total / limit);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * limit;

  const resources = await db
    .select({
      id: libraryResources.id,
      slug: libraryResources.slug,
      title: libraryResources.title,
      summary: libraryResources.summary,
      createdByUserId: libraryResources.createdByUserId,
      resourceType: libraryResources.resourceType,
      coverImageUrl: libraryResources.coverImageUrl,
      isOfficialChurchSource: libraryResources.isOfficialChurchSource,
      sourceName: libraryResources.sourceName,
      publishedAt: libraryResources.publishedAt,
      createdAt: libraryResources.createdAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(libraryResources)
    .leftJoin(users, eq(users.id, libraryResources.createdByUserId))
    .where(and(...whereClauses))
    .orderBy(desc(libraryResources.publishedAt), desc(libraryResources.createdAt))
    .offset(offset)
    .limit(limit);

  if (resources.length === 0) {
    return {
      items: [],
      total,
      page,
      pageSize: limit,
      totalPages,
    };
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

  const items = resources
    .map<LibraryResourceCard>((resource) => ({
      ...resource,
      categories: categoryMap.get(resource.id) ?? [],
    }));

  return {
    items,
    total,
    page,
    pageSize: limit,
    totalPages,
  };
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
      createdByUserId: libraryResources.createdByUserId,
      resourceType: libraryResources.resourceType,
      coverImageUrl: libraryResources.coverImageUrl,
      isOfficialChurchSource: libraryResources.isOfficialChurchSource,
      sourceName: libraryResources.sourceName,
      sourceUrl: libraryResources.sourceUrl,
      contentMarkdown: libraryResources.contentMarkdown,
      publishedAt: libraryResources.publishedAt,
      createdAt: libraryResources.createdAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(libraryResources)
    .leftJoin(users, eq(users.id, libraryResources.createdByUserId))
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
        storageObjectKey: libraryAssets.storageObjectKey,
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

export async function getLibraryResourceForManagementBySlug(
  slug: string,
): Promise<LibraryManageResource | null> {
  const [resource] = await db
    .select({
      id: libraryResources.id,
      slug: libraryResources.slug,
      title: libraryResources.title,
      summary: libraryResources.summary,
      contentMarkdown: libraryResources.contentMarkdown,
      resourceType: libraryResources.resourceType,
      status: libraryResources.status,
      sourceName: libraryResources.sourceName,
      sourceUrl: libraryResources.sourceUrl,
      isOfficialChurchSource: libraryResources.isOfficialChurchSource,
      createdByUserId: libraryResources.createdByUserId,
    })
    .from(libraryResources)
    .where(eq(libraryResources.slug, slug))
    .limit(1);

  if (!resource) {
    return null;
  }

  const categories = await db
    .select({
      categoryId: libraryResourceCategories.categoryId,
    })
    .from(libraryResourceCategories)
    .where(eq(libraryResourceCategories.resourceId, resource.id));

  return {
    ...resource,
    categoryIds: categories.map((item) => item.categoryId),
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
