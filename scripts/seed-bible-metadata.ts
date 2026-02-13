import "dotenv/config";
import { pathToFileURL } from "node:url";
import { db } from "../db/client";
import { bibleBooks, bibleVersions } from "../db/schema";
import { catholicCanon } from "../lib/bible-canon";

const defaultVersions = [
  {
    id: "ave-maria",
    name: "Ave Maria",
    language: "pt-BR",
    isDefault: true,
  },
  {
    id: "douay-rheims",
    name: "Douay-Rheims",
    language: "en",
    isDefault: false,
  },
] as const;

async function seedVersions() {
  for (const version of defaultVersions) {
    await db
      .insert(bibleVersions)
      .values(version)
      .onConflictDoUpdate({
        target: bibleVersions.id,
        set: {
          name: version.name,
          language: version.language,
          isDefault: version.isDefault,
        },
      });
  }
}

async function seedBooks() {
  for (const book of catholicCanon) {
    await db
      .insert(bibleBooks)
      .values({
        id: book.id,
        order: book.order,
        testament: book.testament,
        name: book.name,
        abbreviation: book.abbreviation,
      })
      .onConflictDoUpdate({
        target: bibleBooks.id,
        set: {
          order: book.order,
          testament: book.testament,
          name: book.name,
          abbreviation: book.abbreviation,
        },
      });
  }
}

export async function seedBibleMetadata() {
  console.log("[bible] Iniciando seed de metadados...");
  await seedVersions();
  await seedBooks();
  console.log("[bible] Seed finalizado com sucesso.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedBibleMetadata().catch((error) => {
    console.error("[bible] Erro no seed de metadados:", error);
    process.exit(1);
  });
}