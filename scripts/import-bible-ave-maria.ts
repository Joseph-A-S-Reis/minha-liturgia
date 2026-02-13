import "dotenv/config";
import { access } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { bibleVerses } from "../db/schema";
import { catholicCanon } from "../lib/bible-canon";
import { seedBibleMetadata } from "./seed-bible-metadata";

type RawVerse = {
  versionId?: string;
  bookId?: string;
  book?: string;
  abbreviation?: string;
  chapter: number | string;
  verse: number | string;
  text: string;
};

type StructuredVerse = {
  versiculo: number | string;
  texto: string;
};

type StructuredChapter = {
  capitulo: number | string;
  versiculos: StructuredVerse[];
};

type StructuredBook = {
  nome: string;
  capitulos: StructuredChapter[];
};

type StructuredBible = {
  antigoTestamento?: StructuredBook[];
  novoTestamento?: StructuredBook[];
};

type NormalizedVerse = {
  id: string;
  versionId: string;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
};

const VERSION_ID = "ave-maria";
const DEFAULT_FILE = "data/bible/bibliaAveMaria.json";
const BATCH_SIZE = 500;

const explicitBookAliases: Record<string, string> = {
  abdias: "obadias",
  "atos-dos-apostolos": "atos",
  "sao-mateus": "mateus",
  "sao-marcos": "marcos",
  "sao-lucas": "lucas",
  "sao-joao": "joao",
  "sao-tiago": "tiago",
  "sao-judas": "judas",
  "i-sao-pedro": "1-pedro",
  "ii-sao-pedro": "2-pedro",
  "i-sao-joao": "1-joao",
  "ii-sao-joao": "2-joao",
  "iii-sao-joao": "3-joao",
};

const nameToBookId = new Map<string, string>();
for (const book of catholicCanon) {
  nameToBookId.set(normalizeKey(book.name), book.id);
  nameToBookId.set(normalizeKey(book.abbreviation), book.id);
  nameToBookId.set(normalizeKey(book.id), book.id);
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeBookCandidates(value: string): string[] {
  const base = normalizeKey(value);
  const candidates = new Set<string>([base]);

  const romanConverted = base
    .replace(/^iii-/, "3-")
    .replace(/^ii-/, "2-")
    .replace(/^i-/, "1-");
  candidates.add(romanConverted);

  const withoutSao = romanConverted
    .replace(/^sao-/, "")
    .replace(/^1-sao-/, "1-")
    .replace(/^2-sao-/, "2-")
    .replace(/^3-sao-/, "3-");
  candidates.add(withoutSao);

  if (explicitBookAliases[base]) {
    candidates.add(explicitBookAliases[base]);
  }

  if (explicitBookAliases[romanConverted]) {
    candidates.add(explicitBookAliases[romanConverted]);
  }

  if (explicitBookAliases[withoutSao]) {
    candidates.add(explicitBookAliases[withoutSao]);
  }

  return [...candidates];
}

function parseNumber(value: string | number, label: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Valor inválido para ${label}: ${String(value)}`);
  }
  return n;
}

function resolveBookId(row: RawVerse): string {
  if (row.bookId) {
    for (const candidate of normalizeBookCandidates(row.bookId)) {
      if (nameToBookId.has(candidate)) {
        return nameToBookId.get(candidate)!;
      }
    }
  }

  if (row.book) {
    for (const candidate of normalizeBookCandidates(row.book)) {
      if (nameToBookId.has(candidate)) {
        return nameToBookId.get(candidate)!;
      }
    }
  }

  if (row.abbreviation) {
    for (const candidate of normalizeBookCandidates(row.abbreviation)) {
      if (nameToBookId.has(candidate)) {
        return nameToBookId.get(candidate)!;
      }
    }
  }

  throw new Error(
    `Não foi possível identificar o livro para o versículo: ${JSON.stringify(row)}`,
  );
}

function toVerseId(versionId: string, bookId: string, chapter: number, verse: number): string {
  return `${versionId}:${bookId}:${chapter}:${verse}`;
}

function normalizeRow(row: RawVerse): NormalizedVerse {
  const versionId = row.versionId ?? VERSION_ID;
  const bookId = resolveBookId(row);
  const chapter = parseNumber(row.chapter, "chapter");
  const verse = parseNumber(row.verse, "verse");
  const text = row.text?.trim();

  if (!text) {
    throw new Error(`Texto vazio para ${bookId} ${chapter},${verse}`);
  }

  return {
    id: toVerseId(versionId, bookId, chapter, verse),
    versionId,
    bookId,
    chapter,
    verse,
    text,
  };
}

function parseJsonLines(content: string): RawVerse[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as RawVerse;
      } catch {
        throw new Error(`Linha JSONL inválida na linha ${index + 1}`);
      }
    });
}

function parseInput(content: string, filePath: string): RawVerse[] {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".jsonl" || ext === ".ndjson") {
    return parseJsonLines(content);
  }

  const parsed = JSON.parse(content) as unknown;

  if (Array.isArray(parsed)) {
    return parsed as RawVerse[];
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "verses" in parsed &&
    Array.isArray((parsed as { verses: unknown[] }).verses)
  ) {
    return (parsed as { verses: RawVerse[] }).verses;
  }

  if (typeof parsed === "object" && parsed !== null) {
    const structured = parsed as StructuredBible;
    const oldTestament = Array.isArray(structured.antigoTestamento)
      ? structured.antigoTestamento
      : [];
    const newTestament = Array.isArray(structured.novoTestamento)
      ? structured.novoTestamento
      : [];

    if (oldTestament.length > 0 || newTestament.length > 0) {
      const flattened: RawVerse[] = [];

      for (const book of [...oldTestament, ...newTestament]) {
        if (!book?.nome || !Array.isArray(book.capitulos)) {
          continue;
        }

        for (const chapter of book.capitulos) {
          if (!chapter || !Array.isArray(chapter.versiculos)) {
            continue;
          }

          for (const verse of chapter.versiculos) {
            flattened.push({
              book: book.nome,
              chapter: chapter.capitulo,
              verse: verse.versiculo,
              text: verse.texto,
              versionId: VERSION_ID,
            });
          }
        }
      }

      return flattened;
    }
  }

  throw new Error(
    "Formato de arquivo inválido. Use array JSON, objeto com 'verses' ou estrutura por testamento/livro/capítulo/versículo.",
  );
}

async function insertBatch(batch: NormalizedVerse[]) {
  if (batch.length === 0) {
    return;
  }

  await db
    .insert(bibleVerses)
    .values(batch)
    .onConflictDoUpdate({
      target: bibleVerses.id,
      set: {
        text: sql`excluded.text`,
      },
    });
}

async function main() {
  const inputArg = process.argv[2] || process.env.BIBLE_IMPORT_FILE || DEFAULT_FILE;
  const filePath = path.resolve(process.cwd(), inputArg);

  await seedBibleMetadata();

  console.log(`[bible] Importando versículos de: ${filePath}`);

  try {
    await access(filePath);
  } catch {
    throw new Error(
      [
        `Arquivo de importação não encontrado: ${filePath}`,
        "",
        "Como resolver:",
        `1) Coloque o arquivo em: ${DEFAULT_FILE}`,
        "   OU",
        "2) Rode com caminho customizado:",
        "   npm run bible:import:ave-maria -- ./caminho/para/arquivo.json",
        "",
        "Veja formatos aceitos em: data/bible/README.md",
      ].join("\n"),
    );
  }

  const content = await readFile(filePath, "utf-8");
  const rawRows = parseInput(content, filePath);
  const verses = rawRows.map(normalizeRow);

  if (verses.length === 0) {
    throw new Error(
      "O arquivo foi lido, mas nenhum versículo foi encontrado. Verifique o formato em data/bible/README.md.",
    );
  }

  console.log(`[bible] ${verses.length} versículos carregados para processamento.`);

  for (let i = 0; i < verses.length; i += BATCH_SIZE) {
    const batch = verses.slice(i, i + BATCH_SIZE);
    await insertBatch(batch);
    console.log(`[bible] Lote ${Math.floor(i / BATCH_SIZE) + 1} importado (${batch.length}).`);
  }

  console.log("[bible] Importação concluída com sucesso.");
}

main().catch((error) => {
  console.error("[bible] Erro na importação:", error);
  process.exit(1);
});