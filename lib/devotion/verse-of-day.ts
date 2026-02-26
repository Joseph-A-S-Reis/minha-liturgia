import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bibleBooks, bibleVerses } from "@/db/schema";

type VerseOfDayParams = {
  purpose: string;
  dayIndex: number;
  versionId?: string;
};

export type VerseOfDayResult = {
  versionId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function hashSeed(seed: string): number {
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function getBookFocusByPurpose(purpose: string): string[] {
  const normalized = normalize(purpose);

  if (normalized.includes("peniten") || normalized.includes("arrepend")) {
    return ["salmos", "isaias", "lucas", "mateus", "romanos"];
  }

  if (normalized.includes("jejum")) {
    return ["mateus", "isaias", "joel", "salmos", "tiago"];
  }

  if (normalized.includes("oracao") || normalized.includes("oração")) {
    return ["salmos", "lucas", "joao", "filipenses", "efesios"];
  }

  if (normalized.includes("abstin")) {
    return ["romanos", "1-corintios", "galatas", "tiago", "1-pedro"];
  }

  return [];
}

async function getVerseCount(versionId: string, preferredBooks: string[]): Promise<number> {
  if (preferredBooks.length > 0) {
    const [focused] = await db
      .select({ total: sql<number>`count(*)` })
      .from(bibleVerses)
      .where(
        and(eq(bibleVerses.versionId, versionId), inArray(bibleVerses.bookId, preferredBooks)),
      );

    const focusedTotal = Number(focused?.total ?? 0);
    if (focusedTotal > 0) {
      return focusedTotal;
    }
  }

  const [fallback] = await db
    .select({ total: sql<number>`count(*)` })
    .from(bibleVerses)
    .where(eq(bibleVerses.versionId, versionId));

  return Number(fallback?.total ?? 0);
}

export async function getDeterministicVerseOfDay(
  params: VerseOfDayParams,
): Promise<VerseOfDayResult | null> {
  const versionId = params.versionId ?? "ave-maria";
  const preferredBooks = getBookFocusByPurpose(params.purpose);
  const total = await getVerseCount(versionId, preferredBooks);

  if (total <= 0) {
    return null;
  }

  const seed = hashSeed(`${versionId}|${normalize(params.purpose)}|${params.dayIndex}`);
  const offset = seed % total;

  const baseQuery = db
    .select({
      versionId: bibleVerses.versionId,
      bookId: bibleVerses.bookId,
      bookName: bibleBooks.name,
      chapter: bibleVerses.chapter,
      verse: bibleVerses.verse,
      text: bibleVerses.text,
    })
    .from(bibleVerses)
    .innerJoin(bibleBooks, eq(bibleBooks.id, bibleVerses.bookId))
    .orderBy(asc(bibleBooks.order), asc(bibleVerses.chapter), asc(bibleVerses.verse))
    .limit(1)
    .offset(offset);

  const rows =
    preferredBooks.length > 0
      ? await baseQuery.where(
          and(eq(bibleVerses.versionId, versionId), inArray(bibleVerses.bookId, preferredBooks)),
        )
      : await baseQuery.where(eq(bibleVerses.versionId, versionId));

  const picked = rows[0];

  if (picked) {
    return picked;
  }

  const fallback = await db
    .select({
      versionId: bibleVerses.versionId,
      bookId: bibleVerses.bookId,
      bookName: bibleBooks.name,
      chapter: bibleVerses.chapter,
      verse: bibleVerses.verse,
      text: bibleVerses.text,
    })
    .from(bibleVerses)
    .innerJoin(bibleBooks, eq(bibleBooks.id, bibleVerses.bookId))
    .where(eq(bibleVerses.versionId, versionId))
    .orderBy(asc(bibleBooks.order), asc(bibleVerses.chapter), asc(bibleVerses.verse))
    .limit(1);

  return fallback[0] ?? null;
}
