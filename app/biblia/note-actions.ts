"use server";

import DOMPurify from "isomorphic-dompurify";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { linkBibleReferencesInHtml } from "@/lib/bible-reference";
import { acquireIdempotencyLock, createIdempotencyKey } from "@/lib/idempotency";
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
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const updateNoteSchema = baseRefSchema.extend({
  id: z.string().min(1),
  contentHtml: z.string().min(1).max(50_000).optional(),
  color: noteColorSchema.optional(),
  isPinned: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const deleteNoteSchema = baseRefSchema.extend({
  id: z.string().min(1),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
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
  idempotencyKey?: string;
}) {
  const userId = await requireUserId();
  const parsed = createNoteSchema.parse(input);
  const sanitizedContent = sanitizeEditorHtml(parsed.contentHtml, parsed.versionId);

  const actionKey = createIdempotencyKey("verse-note:create", {
    versionId: parsed.versionId,
    bookId: parsed.bookId,
    chapter: parsed.chapter,
    verse: parsed.verse,
    color: parsed.color,
    contentHtml: sanitizedContent,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "verse-note:create",
    actionKey,
    ttlSeconds: 180,
  });

  if (!canProcess) {
    const existingNotes = await getVerseNotesForChapter({
      userId,
      versionId: parsed.versionId,
      bookId: parsed.bookId,
      chapter: parsed.chapter,
    });

    const existing = existingNotes.find(
      (note) =>
        note.verse === parsed.verse &&
        note.color === parsed.color &&
        note.contentHtml === sanitizedContent,
    );

    if (existing) {
      return existing;
    }

    throw new Error("Ação duplicada detectada. Aguarde alguns segundos e tente novamente.");
  }

  const created = await createVerseNote(
    {
      userId,
      versionId: parsed.versionId,
      bookId: parsed.bookId,
      chapter: parsed.chapter,
      verse: parsed.verse,
    },
    {
      contentHtml: sanitizedContent,
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
  idempotencyKey?: string;
}) {
  const userId = await requireUserId();
  const parsed = updateNoteSchema.parse(input);

  const sanitizedContent =
    parsed.contentHtml !== undefined
      ? sanitizeEditorHtml(parsed.contentHtml, parsed.versionId)
      : undefined;

  const actionKey = createIdempotencyKey("verse-note:update", {
    id: parsed.id,
    versionId: parsed.versionId,
    bookId: parsed.bookId,
    chapter: parsed.chapter,
    contentHtml: sanitizedContent ?? null,
    color: parsed.color ?? null,
    isPinned: parsed.isPinned ?? null,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "verse-note:update",
    actionKey,
    ttlSeconds: 180,
  });

  if (!canProcess) {
    const existingNotes = await getVerseNotesForChapter({
      userId,
      versionId: parsed.versionId,
      bookId: parsed.bookId,
      chapter: parsed.chapter,
    });

    return existingNotes.find((note) => note.id === parsed.id) ?? null;
  }

  const updated = await updateVerseNote(userId, parsed.id, {
    contentHtml: sanitizedContent,
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
  idempotencyKey?: string;
}) {
  const userId = await requireUserId();
  const parsed = deleteNoteSchema.parse(input);

  const actionKey = createIdempotencyKey("verse-note:delete", {
    id: parsed.id,
    versionId: parsed.versionId,
    bookId: parsed.bookId,
    chapter: parsed.chapter,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "verse-note:delete",
    actionKey,
    ttlSeconds: 180,
  });

  if (!canProcess) {
    return { ok: true };
  }

  const ok = await deleteVerseNote(userId, parsed.id);
  revalidatePath(chapterPath(parsed.versionId, parsed.bookId, parsed.chapter));

  return { ok };
}
