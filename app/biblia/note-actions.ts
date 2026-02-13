"use server";

import DOMPurify from "isomorphic-dompurify";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { linkBibleReferencesInHtml } from "@/lib/bible-reference";
import { NOTE_COLORS, type NoteColor } from "@/lib/verse-notes-shared";
import {
  createVerseNote,
  deleteVerseNote,
  getVerseNotesForChapter,
  updateVerseNote,
} from "@/lib/verse-notes";

const baseRefSchema = z.object({
  versionId: z.string().min(1),
  bookId: z.string().min(1),
  chapter: z.number().int().positive(),
});

const noteColorSchema = z.enum(NOTE_COLORS);

const createNoteSchema = baseRefSchema.extend({
  verse: z.number().int().positive(),
  contentHtml: z.string().min(1).max(50_000),
  color: noteColorSchema.default("amber"),
});

const updateNoteSchema = baseRefSchema.extend({
  id: z.string().min(1),
  contentHtml: z.string().min(1).max(50_000).optional(),
  color: noteColorSchema.optional(),
  isPinned: z.boolean().optional(),
});

const deleteNoteSchema = baseRefSchema.extend({
  id: z.string().min(1),
});

function chapterPath(versionId: string, bookId: string, chapter: number) {
  return `/biblia/${versionId}/${bookId}/${chapter}`;
}

async function requireUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  return session.user.id;
}

function sanitizeEditorHtml(value: string, versionId: string) {
  const sanitized = DOMPurify.sanitize(value, {
    USE_PROFILES: { html: true },
  }).trim();

  if (!sanitized) {
    throw new Error("A nota não pode ficar vazia.");
  }

  const withReferences = linkBibleReferencesInHtml(sanitized, versionId);

  return DOMPurify.sanitize(withReferences, {
    USE_PROFILES: { html: true },
  }).trim();
}

export async function getVerseNotesForChapterAction(input: {
  versionId: string;
  bookId: string;
  chapter: number;
}) {
  const userId = await requireUserId();
  const parsed = baseRefSchema.parse(input);

  return getVerseNotesForChapter({
    userId,
    versionId: parsed.versionId,
    bookId: parsed.bookId,
    chapter: parsed.chapter,
  });
}

export async function createVerseNoteAction(input: {
  versionId: string;
  bookId: string;
  chapter: number;
  verse: number;
  contentHtml: string;
  color: NoteColor;
}) {
  const userId = await requireUserId();
  const parsed = createNoteSchema.parse(input);

  const created = await createVerseNote(
    {
      userId,
      versionId: parsed.versionId,
      bookId: parsed.bookId,
      chapter: parsed.chapter,
      verse: parsed.verse,
    },
    {
      contentHtml: sanitizeEditorHtml(parsed.contentHtml, parsed.versionId),
      color: parsed.color,
    },
  );

  revalidatePath(chapterPath(parsed.versionId, parsed.bookId, parsed.chapter));
  return created;
}

export async function updateVerseNoteAction(input: {
  id: string;
  versionId: string;
  bookId: string;
  chapter: number;
  contentHtml?: string;
  color?: NoteColor;
  isPinned?: boolean;
}) {
  const userId = await requireUserId();
  const parsed = updateNoteSchema.parse(input);

  const updated = await updateVerseNote(userId, parsed.id, {
    contentHtml:
      parsed.contentHtml !== undefined
        ? sanitizeEditorHtml(parsed.contentHtml, parsed.versionId)
        : undefined,
    color: parsed.color,
    isPinned: parsed.isPinned,
  });

  revalidatePath(chapterPath(parsed.versionId, parsed.bookId, parsed.chapter));
  return updated;
}

export async function deleteVerseNoteAction(input: {
  id: string;
  versionId: string;
  bookId: string;
  chapter: number;
}) {
  const userId = await requireUserId();
  const parsed = deleteNoteSchema.parse(input);

  const ok = await deleteVerseNote(userId, parsed.id);
  revalidatePath(chapterPath(parsed.versionId, parsed.bookId, parsed.chapter));

  return { ok };
}
