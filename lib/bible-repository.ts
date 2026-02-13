import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bibleBooks, bibleVerses, bibleVersions } from "@/db/schema";
import { bibleVersions as staticVersions } from "@/lib/bible";
import { catholicCanon, catholicCanonById } from "@/lib/bible-canon";

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type BibleVersionRow = {
  id: string;
  name: string;
  language: string;
  isDefault: boolean;
};

export type BibleBookRow = {
  id: string;
  order: number;
  testament: string;
  name: string;
  abbreviation: string;
  chapterCount: number;
};

export type BibleVerseRow = {
  id: string;
  versionId: string;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
};

export type BibleSearchResult = {
  id: string;
  versionId: string;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
  bookName: string;
};

function fallbackVersions(): BibleVersionRow[] {
  return staticVersions.map((version) => ({
    id: version.id,
    name: version.name,
    language: version.language,
    isDefault: Boolean(version.default),
  }));
}

export async function getBibleVersions(): Promise<BibleVersionRow[]> {
  const fromDb = await db.select().from(bibleVersions).orderBy(asc(bibleVersions.name));
  if (fromDb.length > 0) {
    return fromDb;
  }
  return fallbackVersions();
}

export async function getDefaultBibleVersion(): Promise<BibleVersionRow> {
  const preferred = await db
    .select()
    .from(bibleVersions)
    .where(eq(bibleVersions.isDefault, true))
    .limit(1);

  if (preferred[0]) {
    return preferred[0];
  }

  const versions = await getBibleVersions();
  return versions[0] ?? {
    id: "ave-maria",
    name: "Ave Maria",
    language: "pt-BR",
    isDefault: true,
  };
}

export async function getBibleVersionById(versionId: string): Promise<BibleVersionRow | null> {
  const normalizedId = normalizeLookup(versionId);

  const found = await db
    .select()
    .from(bibleVersions)
    .where(eq(bibleVersions.id, versionId))
    .limit(1);

  if (found[0]) {
    return found[0];
  }

  const allFromDb = await db.select().from(bibleVersions);
  const fromDbByAlias = allFromDb.find(
    (item) =>
      normalizeLookup(item.id) === normalizedId ||
      normalizeLookup(item.name) === normalizedId,
  );

  if (fromDbByAlias) {
    return fromDbByAlias;
  }

  const fallback = fallbackVersions().find(
    (v) =>
      v.id === versionId ||
      normalizeLookup(v.id) === normalizedId ||
      normalizeLookup(v.name) === normalizedId,
  );

  return fallback ?? null;
}

export async function getBooksByVersion(versionId: string): Promise<BibleBookRow[]> {
  const books = await db.select().from(bibleBooks).orderBy(asc(bibleBooks.order));

  if (books.length === 0) {
    return catholicCanon.map((book) => ({
      id: book.id,
      order: book.order,
      testament: book.testament,
      name: book.name,
      abbreviation: book.abbreviation,
      chapterCount: book.chapters,
    }));
  }

  const chapterCounts = await db
    .select({
      bookId: bibleVerses.bookId,
      maxChapter: sql<number>`max(${bibleVerses.chapter})`,
    })
    .from(bibleVerses)
    .where(eq(bibleVerses.versionId, versionId))
    .groupBy(bibleVerses.bookId);

  const chapterMap = new Map(
    chapterCounts.map((row) => [row.bookId, Number(row.maxChapter ?? 0)]),
  );

  return books.map((book) => {
    const canon = catholicCanonById.get(book.id);
    return {
      ...book,
      chapterCount: chapterMap.get(book.id) ?? canon?.chapters ?? 0,
    };
  });
}

export async function getBookById(bookId: string): Promise<BibleBookRow | null> {
  const normalizedId = normalizeLookup(bookId);

  const found = await db.select().from(bibleBooks).where(eq(bibleBooks.id, bookId)).limit(1);
  if (found[0]) {
    const canon = catholicCanonById.get(found[0].id);
    return {
      ...found[0],
      chapterCount: canon?.chapters ?? 0,
    };
  }

  const allFromDb = await db.select().from(bibleBooks);
  const fromDbByAlias = allFromDb.find(
    (item) =>
      normalizeLookup(item.id) === normalizedId ||
      normalizeLookup(item.name) === normalizedId ||
      normalizeLookup(item.abbreviation) === normalizedId,
  );

  if (fromDbByAlias) {
    const canon = catholicCanonById.get(fromDbByAlias.id);
    return {
      ...fromDbByAlias,
      chapterCount: canon?.chapters ?? 0,
    };
  }

  const fallback = catholicCanonById.get(bookId);
  if (!fallback) {
    const fallbackByAlias = catholicCanon.find(
      (item) =>
        normalizeLookup(item.id) === normalizedId ||
        normalizeLookup(item.name) === normalizedId ||
        normalizeLookup(item.abbreviation) === normalizedId,
    );

    if (!fallbackByAlias) {
      return null;
    }

    return {
      id: fallbackByAlias.id,
      order: fallbackByAlias.order,
      testament: fallbackByAlias.testament,
      name: fallbackByAlias.name,
      abbreviation: fallbackByAlias.abbreviation,
      chapterCount: fallbackByAlias.chapters,
    };
  }

  return {
    id: fallback.id,
    order: fallback.order,
    testament: fallback.testament,
    name: fallback.name,
    abbreviation: fallback.abbreviation,
    chapterCount: fallback.chapters,
  };
}

export async function getChapterVerseList(
  versionId: string,
  bookId: string,
  chapter: number,
): Promise<BibleVerseRow[]> {
  return db
    .select()
    .from(bibleVerses)
    .where(
      and(
        eq(bibleVerses.versionId, versionId),
        eq(bibleVerses.bookId, bookId),
        eq(bibleVerses.chapter, chapter),
      ),
    )
    .orderBy(asc(bibleVerses.verse));
}

export async function getBookChapterCount(versionId: string, bookId: string): Promise<number> {
  const rows = await db
    .select({ maxChapter: sql<number>`max(${bibleVerses.chapter})` })
    .from(bibleVerses)
    .where(and(eq(bibleVerses.versionId, versionId), eq(bibleVerses.bookId, bookId)));

  const fromDb = Number(rows[0]?.maxChapter ?? 0);
  if (fromDb > 0) {
    return fromDb;
  }

  return catholicCanonById.get(bookId)?.chapters ?? 0;
}

export async function searchVerses(
  versionId: string,
  query: string,
  limit = 80,
): Promise<BibleSearchResult[]> {
  const cleaned = query.trim();
  if (!cleaned) {
    return [];
  }

  const rows = await db
    .select({
      id: bibleVerses.id,
      versionId: bibleVerses.versionId,
      bookId: bibleVerses.bookId,
      chapter: bibleVerses.chapter,
      verse: bibleVerses.verse,
      text: bibleVerses.text,
      bookName: bibleBooks.name,
    })
    .from(bibleVerses)
    .innerJoin(bibleBooks, eq(bibleBooks.id, bibleVerses.bookId))
    .where(and(eq(bibleVerses.versionId, versionId), ilike(bibleVerses.text, `%${cleaned}%`)))
    .orderBy(asc(bibleBooks.order), asc(bibleVerses.chapter), asc(bibleVerses.verse))
    .limit(limit);

  return rows;
}