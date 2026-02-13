import { catholicCanon } from "@/lib/bible-canon";

const referenceMatcher =
  /\b((?:[1-3]\s*)?[A-Za-zÀ-ÿ.]+(?:\s+(?:dos|das|de|do|da|e|[A-Za-zÀ-ÿ.]+))*)\s+(\d{1,3})(?:\s*[:.,]\s*(\d{1,3}))?/gu;

const anchoredSegmentMatcher = /(<a\b[^>]*>[\s\S]*?<\/a>)/giu;

type CanonLookup = {
  id: string;
  displayName: string;
};

export type ParsedBibleReference = {
  raw: string;
  label: string;
  bookId: string;
  chapter: number;
  verse?: number;
  href: string;
};

export type BibleReferenceSuggestion = ParsedBibleReference;

const normalizeBookKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const bookLookup = new Map<string, CanonLookup>();

for (const book of catholicCanon) {
  const keys = new Set<string>([
    normalizeBookKey(book.name),
    normalizeBookKey(book.abbreviation),
    normalizeBookKey(book.id.replace(/-/g, " ")),
  ]);

  if (book.name.startsWith("1 ") || book.name.startsWith("2 ") || book.name.startsWith("3 ")) {
    keys.add(normalizeBookKey(book.name.replace(/^([1-3])\s+/, "$1")));
  }

  if (book.abbreviation.startsWith("1") || book.abbreviation.startsWith("2") || book.abbreviation.startsWith("3")) {
    keys.add(normalizeBookKey(book.abbreviation.replace(/^([1-3])/, "$1 ")));
  }

  for (const key of keys) {
    if (!key) continue;
    bookLookup.set(key, { id: book.id, displayName: book.name });
  }
}

const extraAliases: Record<string, string> = {
  "sao mateus": "mateus",
  "sao marcos": "marcos",
  "sao lucas": "lucas",
  "sao joao": "joao",
  "atos dos apostolos": "atos",
  abdias: "obadias",
};

for (const [alias, target] of Object.entries(extraAliases)) {
  const canonBook = catholicCanon.find((book) => book.id === target);
  if (!canonBook) continue;

  bookLookup.set(normalizeBookKey(alias), {
    id: canonBook.id,
    displayName: canonBook.name,
  });
}

function resolveBook(rawBook: string) {
  const normalized = normalizeBookKey(rawBook).replace(/\.+$/g, "");
  return bookLookup.get(normalized) ?? null;
}

export function toVerseHref(versionId: string, bookId: string, chapter: number, verse?: number) {
  if (verse && Number.isInteger(verse) && verse > 0) {
    return `/biblia/${versionId}/${bookId}/${chapter}#v${verse}`;
  }

  return `/biblia/${versionId}/${bookId}/${chapter}`;
}

function toReferenceLabel(bookDisplayName: string, chapter: number, verse?: number) {
  if (verse && Number.isInteger(verse) && verse > 0) {
    return `${bookDisplayName} ${chapter}:${verse}`;
  }

  return `${bookDisplayName} ${chapter}`;
}

function parseSingleReference(rawText: string, versionId: string): ParsedBibleReference | null {
  const match =
    /\b((?:[1-3]\s*)?[A-Za-zÀ-ÿ.]+(?:\s+(?:dos|das|de|do|da|e|[A-Za-zÀ-ÿ.]+))*)\s+(\d{1,3})(?:\s*[:.,]\s*(\d{1,3}))?\b/u.exec(
      rawText,
    );

  if (!match) return null;

  const [, rawBook, rawChapter, rawVerse] = match;
  const resolvedBook = resolveBook(String(rawBook));
  if (!resolvedBook) return null;

  const chapter = Number(rawChapter);
  const verse = rawVerse ? Number(rawVerse) : undefined;

  if (!Number.isInteger(chapter) || chapter <= 0) return null;
  if (verse !== undefined && (!Number.isInteger(verse) || verse <= 0)) return null;

  return {
    raw: rawText,
    label: toReferenceLabel(resolvedBook.displayName, chapter, verse),
    bookId: resolvedBook.id,
    chapter,
    verse,
    href: toVerseHref(versionId, resolvedBook.id, chapter, verse),
  };
}

export function extractBibleReferences(text: string, versionId: string) {
  const references: ParsedBibleReference[] = [];

  for (const match of text.matchAll(referenceMatcher)) {
    const raw = match[0];
    const parsed = parseSingleReference(raw, versionId);
    if (!parsed) continue;

    references.push(parsed);
  }

  return references;
}

function linkReferencesInTextSegment(text: string, versionId: string) {
  return text.replace(referenceMatcher, (match) => {
    const parsed = parseSingleReference(match, versionId);
    if (!parsed) return match;

    return `<a href="${parsed.href}">${match}</a>`;
  });
}

export function linkBibleReferencesInHtml(html: string, versionId: string) {
  const segments = html.split(anchoredSegmentMatcher);

  return segments
    .map((segment, index) => {
      if (index % 2 === 1) {
        return segment;
      }

      return linkReferencesInTextSegment(segment, versionId);
    })
    .join("");
}

export function suggestBibleReferences(query: string, versionId: string, limit = 8) {
  const cleaned = query.trim();
  if (!cleaned) return [];

  const matches = extractBibleReferences(cleaned, versionId);
  if (matches.length > 0) {
    return matches.slice(0, limit);
  }

  const prefixMatch =
    /((?:[1-3]\s*)?[A-Za-zÀ-ÿ.]+(?:\s+(?:dos|das|de|do|da|e|[A-Za-zÀ-ÿ.]+))*)\s*(\d{0,3})(?:\s*[:.,]\s*(\d{0,3}))?$/u.exec(
      cleaned,
    );

  if (!prefixMatch) return [];

  const [, rawBook, rawChapter, rawVerse] = prefixMatch;
  const resolvedBook = resolveBook(String(rawBook));
  if (!resolvedBook) return [];

  const chapterValue = rawChapter ? Number(rawChapter) : 1;
  if (!Number.isInteger(chapterValue) || chapterValue <= 0) return [];

  const verseValue = rawVerse ? Number(rawVerse) : undefined;
  if (verseValue !== undefined && (!Number.isInteger(verseValue) || verseValue <= 0)) {
    return [];
  }

  return [
    {
      raw: cleaned,
      label: toReferenceLabel(resolvedBook.displayName, chapterValue, verseValue),
      bookId: resolvedBook.id,
      chapter: chapterValue,
      verse: verseValue,
      href: toVerseHref(versionId, resolvedBook.id, chapterValue, verseValue),
    },
  ].slice(0, limit);
}