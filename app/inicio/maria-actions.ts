"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { journalEntries } from "@/db/schema";
import { createVerseNoteAction } from "@/app/biblia/note-actions";
import { extractBibleReferences } from "@/lib/bible-reference";

type SaveToDiaryInput = {
  modeLabel: string;
  question: string;
  answer: string;
};

const saveDiarySchema = z.object({
  modeLabel: z.string().trim().min(2).max(40),
  question: z.string().trim().min(2).max(4_000),
  answer: z.string().trim().min(2).max(12_000),
});

const saveVerseSchema = z.object({
  answer: z.string().trim().min(2).max(12_000),
  versionId: z.string().trim().min(1).default("ave-maria"),
  explicitReference: z.string().trim().max(120).optional(),
});

async function requireUserId() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  return session.user.id;
}

export async function saveMariaResponseToDiaryAction(input: SaveToDiaryInput) {
  const parsed = saveDiarySchema.parse(input);
  const userId = await requireUserId();

  const content = [
    `# MarIA · ${parsed.modeLabel}`,
    "",
    `**Pergunta:** ${parsed.question}`,
    "",
    "**Resposta:**",
    parsed.answer,
  ].join("\n");

  await db.insert(journalEntries).values({
    id: crypto.randomUUID(),
    userId,
    content,
  });

  return { ok: true as const };
}

export async function saveMariaResponseToVerseAction(input: {
  answer: string;
  versionId?: string;
  explicitReference?: string;
}) {
  const parsed = saveVerseSchema.parse(input);

  const searchText = [parsed.explicitReference, parsed.answer].filter(Boolean).join(" ");
  const references = extractBibleReferences(searchText, parsed.versionId);
  const first = references.find((item) => item.verse !== undefined);

  if (!first || !first.verse) {
    throw new Error(
      "Não encontrei uma referência com versículo (ex.: João 3:16). Informe uma referência explícita.",
    );
  }

  const created = await createVerseNoteAction({
    versionId: parsed.versionId,
    bookId: first.bookId,
    chapter: first.chapter,
    verse: first.verse,
    color: "amber",
    contentHtml: `<p>${parsed.answer}</p>`,
  });

  return {
    ok: true as const,
    href: first.href,
    label: first.label,
    noteId: created.id,
  };
}
