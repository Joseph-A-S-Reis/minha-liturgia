"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { journalEntries } from "@/db/schema";

type ImportEntry = {
  text: string;
  createdAt?: string;
};

async function requireUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  return session.user.id;
}

export async function createDiaryEntryAction(formData: FormData) {
  const userId = await requireUserId();
  const content = String(formData.get("content") ?? "").trim();

  if (!content) return;

  await db.insert(journalEntries).values({
    id: crypto.randomUUID(),
    userId,
    content,
  });

  revalidatePath("/diario");
}

export async function deleteDiaryEntryAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  if (!id) return;

  await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));

  revalidatePath("/diario");
}

export async function importLocalDiaryEntriesAction(entries: ImportEntry[]) {
  const userId = await requireUserId();

  const sanitized = entries
    .map((entry) => ({
      content: entry.text?.trim() ?? "",
      createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
    }))
    .filter((entry) => entry.content.length > 0)
    .slice(0, 300);

  if (sanitized.length === 0) {
    return { imported: 0 };
  }

  await db.insert(journalEntries).values(
    sanitized.map((entry) => ({
      id: crypto.randomUUID(),
      userId,
      content: entry.content,
      createdAt: entry.createdAt,
      updatedAt: entry.createdAt,
    })),
  );

  revalidatePath("/diario");
  return { imported: sanitized.length };
}

export async function getUserDiaryEntries() {
  const userId = await requireUserId();

  return db
    .select({
      id: journalEntries.id,
      content: journalEntries.content,
      createdAt: journalEntries.createdAt,
    })
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.createdAt));
}
