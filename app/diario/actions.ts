"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { journalEntries } from "@/db/schema";
import { acquireIdempotencyLock, createIdempotencyKey } from "@/lib/idempotency";

type ImportEntry = {
  text: string;
  createdAt?: string;
};

const createDiaryEntrySchema = z.object({
  content: z.string().trim().min(1, "A anotação não pode ficar vazia.").max(12_000),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const deleteDiaryEntrySchema = z.object({
  id: z.string().trim().min(1),
});

const importEntrySchema = z.object({
  text: z.string().trim().min(1).max(12_000),
  createdAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return undefined;

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return undefined;
      }

      return parsed;
    }),
});

async function requireUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  return session.user.id;
}

export async function createDiaryEntryAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = createDiaryEntrySchema.parse({
    content: formData.get("content"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  const actionKey = createIdempotencyKey("diary:create", {
    content: parsed.content,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "diary:create",
    actionKey,
    ttlSeconds: 180,
  });

  if (!canProcess) {
    return;
  }

  await db.insert(journalEntries).values({
    id: crypto.randomUUID(),
    userId,
    content: parsed.content,
  });

  revalidatePath("/diario");
}

export async function deleteDiaryEntryAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = deleteDiaryEntrySchema.parse({
    id: formData.get("id"),
  });

  await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.id, parsed.id), eq(journalEntries.userId, userId)));

  revalidatePath("/diario");
}

export async function importLocalDiaryEntriesAction(entries: ImportEntry[]) {
  const userId = await requireUserId();

  const limited = entries.slice(0, 300);
  const validated = limited
    .map((entry) => importEntrySchema.safeParse(entry))
    .filter((result): result is { success: true; data: z.infer<typeof importEntrySchema> } =>
      result.success,
    )
    .map((result) => ({
      content: result.data.text,
      createdAt: result.data.createdAt ?? new Date(),
    }));

  const sanitizedMap = new Map<string, { content: string; createdAt: Date }>();
  for (const entry of validated) {
    const key = `${entry.createdAt.toISOString()}::${entry.content}`;
    sanitizedMap.set(key, entry);
  }

  const sanitized = [...sanitizedMap.values()];

  const actionKey = createIdempotencyKey("diary:import", {
    entries: sanitized.map((entry) => ({
      content: entry.content,
      createdAt: entry.createdAt.toISOString(),
    })),
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "diary:import",
    actionKey,
    ttlSeconds: 300,
  });

  if (!canProcess) {
    return { imported: 0 };
  }

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
