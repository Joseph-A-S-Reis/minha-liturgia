import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { verseNotes } from "@/db/schema";
import {
  NOTE_COLORS,
  type NoteColor,
  type VerseNoteRecord,
} from "@/lib/verse-notes-shared";

function isMissingVerseNotesTableError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const asRecord = error as { message?: string; cause?: { code?: string; message?: string } };
  const code = asRecord.cause?.code;
  const message = asRecord.message ?? "";
  const causeMessage = asRecord.cause?.message ?? "";

  return (
    code === "42P01" ||
    /relation\s+"?verse_notes"?\s+does\s+not\s+exist/i.test(message) ||
    /relation\s+"?verse_notes"?\s+does\s+not\s+exist/i.test(causeMessage)
  );
}

function throwSchemaUpdateRequiredError() {
  throw new Error(
    "A tabela de notas ainda não existe no banco. Execute a migração (npm run db:push) para habilitar o recurso de notas.",
  );
}

export { NOTE_COLORS };
export type { NoteColor, VerseNoteRecord };

type ChapterRef = {
  userId: string;
  versionId: string;
  bookId: string;
  chapter: number;
};

type VerseRef = ChapterRef & {
  verse: number;
};

export async function getVerseNotesForChapter(ref: ChapterRef) {
  try {
    const rows = await db
      .select({
        id: verseNotes.id,
        userId: verseNotes.userId,
        versionId: verseNotes.versionId,
        bookId: verseNotes.bookId,
        chapter: verseNotes.chapter,
        verse: verseNotes.verse,
        contentHtml: verseNotes.contentHtml,
        color: verseNotes.color,
        isPinned: verseNotes.isPinned,
        createdAt: verseNotes.createdAt,
        updatedAt: verseNotes.updatedAt,
      })
      .from(verseNotes)
      .where(
        and(
          eq(verseNotes.userId, ref.userId),
          eq(verseNotes.versionId, ref.versionId),
          eq(verseNotes.bookId, ref.bookId),
          eq(verseNotes.chapter, ref.chapter),
        ),
      )
      .orderBy(desc(verseNotes.isPinned), desc(verseNotes.updatedAt));

    return rows as VerseNoteRecord[];
  } catch (error) {
    if (isMissingVerseNotesTableError(error)) {
      return [];
    }

    throw error;
  }
}

export async function createVerseNote(
  ref: VerseRef,
  input: {
    contentHtml: string;
    color: NoteColor;
  },
) {
  try {
    const [created] = await db
      .insert(verseNotes)
      .values({
        id: crypto.randomUUID(),
        userId: ref.userId,
        versionId: ref.versionId,
        bookId: ref.bookId,
        chapter: ref.chapter,
        verse: ref.verse,
        contentHtml: input.contentHtml,
        color: input.color,
        updatedAt: new Date(),
      })
      .returning();

    return created as VerseNoteRecord;
  } catch (error) {
    if (isMissingVerseNotesTableError(error)) {
      throwSchemaUpdateRequiredError();
    }

    throw error;
  }
}

export async function updateVerseNote(
  userId: string,
  id: string,
  input: {
    contentHtml?: string;
    color?: NoteColor;
    isPinned?: boolean;
  },
) {
  try {
    const [updated] = await db
      .update(verseNotes)
      .set({
        ...(input.contentHtml !== undefined ? { contentHtml: input.contentHtml } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(verseNotes.id, id), eq(verseNotes.userId, userId)))
      .returning();

    return (updated ?? null) as VerseNoteRecord | null;
  } catch (error) {
    if (isMissingVerseNotesTableError(error)) {
      throwSchemaUpdateRequiredError();
    }

    throw error;
  }
}

export async function deleteVerseNote(userId: string, id: string) {
  try {
    const [deleted] = await db
      .delete(verseNotes)
      .where(and(eq(verseNotes.id, id), eq(verseNotes.userId, userId)))
      .returning({ id: verseNotes.id });

    return Boolean(deleted?.id);
  } catch (error) {
    if (isMissingVerseNotesTableError(error)) {
      throwSchemaUpdateRequiredError();
    }

    throw error;
  }
}
