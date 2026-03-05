"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { journalMemories, journalMemoryAttachments } from "@/db/schema";
import { acquireIdempotencyLock, createIdempotencyKey } from "@/lib/idempotency";

const MAX_IMAGE_ATTACHMENTS = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const createJournalMemorySchema = z.object({
  title: z.string().trim().min(1, "Informe o nome da recordação.").max(120),
  memoryDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida."),
  description: z
    .string()
    .trim()
    .min(1, "Adicione uma descrição para a recordação.")
    .max(8_000, "A descrição deve ter no máximo 8000 caracteres."),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const updateJournalMemorySchema = createJournalMemorySchema.extend({
  memoryId: z.string().trim().min(1, "Recordação inválida."),
});

const deleteJournalMemorySchema = z.object({
  memoryId: z.string().trim().min(1, "Recordação inválida."),
});

const deleteJournalMemoryAttachmentSchema = z.object({
  memoryId: z.string().trim().min(1, "Recordação inválida."),
  attachmentId: z.string().trim().min(1, "Anexo inválido."),
});

type PreparedAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  data: Buffer;
};

export type JournalMemoryAttachmentView = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
};

export type JournalMemoryView = {
  id: string;
  title: string;
  memoryDate: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  attachments: JournalMemoryAttachmentView[];
};

async function requireUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  return session.user.id;
}

function normalizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 240);
}

function resolveMimeType(file: File) {
  const fileType = file.type?.trim().toLowerCase();
  if (fileType && allowedMimeTypes.has(fileType)) {
    return fileType;
  }

  const normalizedName = file.name.toLowerCase();
  if (normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (normalizedName.endsWith(".png")) {
    return "image/png";
  }

  if (normalizedName.endsWith(".webp")) {
    return "image/webp";
  }

  if (normalizedName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (normalizedName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return null;
}

async function parseAttachments(rawEntries: FormDataEntryValue[]) {
  const files = rawEntries.filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const imageCount = files.filter((file) => {
    const mimeType = resolveMimeType(file);
    return mimeType?.startsWith("image/");
  }).length;

  if (imageCount > MAX_IMAGE_ATTACHMENTS) {
    throw new Error(`Você pode enviar no máximo ${MAX_IMAGE_ATTACHMENTS} imagens por recordação.`);
  }

  const prepared: PreparedAttachment[] = [];

  for (const file of files) {
    const mimeType = resolveMimeType(file);

    if (!mimeType || !allowedMimeTypes.has(mimeType)) {
      throw new Error(`Arquivo não suportado: ${file.name}. Use JPG, PNG, WEBP, PDF ou DOCX.`);
    }

    if (mimeType.startsWith("image/") && file.size > MAX_IMAGE_BYTES) {
      throw new Error(`A imagem ${file.name} excede o limite de 5MB.`);
    }

    if (!mimeType.startsWith("image/") && file.size > MAX_DOCUMENT_BYTES) {
      throw new Error(`O arquivo ${file.name} excede o limite de 5MB.`);
    }

    const fileName = normalizeFileName(file.name) || `${Date.now()}-${crypto.randomUUID()}`;

    prepared.push({
      id: crypto.randomUUID(),
      fileName,
      mimeType,
      fileSize: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    });
  }

  return prepared;
}

function isImageMimeType(mimeType: string) {
  return mimeType.startsWith("image/");
}

function normalizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Dados inválidos para salvar a recordação.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Não foi possível processar a recordação.";
}

export async function createJournalMemoryAction(formData: FormData): Promise<void> {
  try {
    const userId = await requireUserId();
    const parsed = createJournalMemorySchema.parse({
      title: formData.get("title"),
      memoryDate: formData.get("memoryDate"),
      description: formData.get("description"),
      idempotencyKey: formData.get("idempotencyKey") ?? undefined,
    });

    const attachments = await parseAttachments(formData.getAll("attachments"));

    const requestKey = parsed.idempotencyKey?.trim() || crypto.randomUUID();

    const actionKey = createIdempotencyKey("diary:memory:create", {
      title: parsed.title,
      memoryDate: parsed.memoryDate,
      description: parsed.description,
      attachments: attachments.map((file) => ({
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
      })),
      request: requestKey,
    });

    const canProcess = await acquireIdempotencyLock({
      userId,
      actionType: "diary:memory:create",
      actionKey,
      ttlSeconds: 180,
    });

    if (!canProcess) {
      throw new Error(
        "Requisição duplicada detectada. Aguarde alguns segundos e tente novamente.",
      );
    }

    const memoryId = crypto.randomUUID();

    await db.insert(journalMemories).values({
      id: memoryId,
      userId,
      title: parsed.title,
      memoryDate: parsed.memoryDate,
      description: parsed.description,
    });

    try {
      if (attachments.length > 0) {
        await db.insert(journalMemoryAttachments).values(
          attachments.map((attachment) => ({
            id: attachment.id,
            memoryId,
            userId,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            fileSize: attachment.fileSize,
            data: attachment.data,
          })),
        );
      }
    } catch (attachmentError) {
      await db
        .delete(journalMemories)
        .where(and(eq(journalMemories.id, memoryId), eq(journalMemories.userId, userId)));

      throw attachmentError;
    }

    revalidatePath("/diario");
    revalidatePath("/diario/recordacoes");

  } catch (error) {
    throw new Error(normalizeError(error));
  }
}

export async function updateJournalMemoryAction(formData: FormData): Promise<void> {
  try {
    const userId = await requireUserId();
    const parsed = updateJournalMemorySchema.parse({
      memoryId: formData.get("memoryId"),
      title: formData.get("title"),
      memoryDate: formData.get("memoryDate"),
      description: formData.get("description"),
      idempotencyKey: formData.get("idempotencyKey") ?? undefined,
    });

    const removeAttachmentIds = formData
      .getAll("removeAttachmentIds")
      .map((value) => String(value).trim())
      .filter(Boolean);

    const attachments = await parseAttachments(formData.getAll("attachments"));

    const [memory] = await db
      .select({ id: journalMemories.id })
      .from(journalMemories)
      .where(and(eq(journalMemories.id, parsed.memoryId), eq(journalMemories.userId, userId)))
      .limit(1);

    if (!memory) {
      throw new Error("Recordação não encontrada.");
    }

    const existingAttachments = await db
      .select({
        id: journalMemoryAttachments.id,
        mimeType: journalMemoryAttachments.mimeType,
      })
      .from(journalMemoryAttachments)
      .where(
        and(
          eq(journalMemoryAttachments.memoryId, parsed.memoryId),
          eq(journalMemoryAttachments.userId, userId),
        ),
      );

    const removeSet = new Set(removeAttachmentIds);
    const remainingImageCount = existingAttachments.filter(
      (attachment) => isImageMimeType(attachment.mimeType) && !removeSet.has(attachment.id),
    ).length;
    const incomingImageCount = attachments.filter((attachment) =>
      isImageMimeType(attachment.mimeType),
    ).length;

    if (remainingImageCount + incomingImageCount > MAX_IMAGE_ATTACHMENTS) {
      throw new Error(
        `O total de imagens desta recordação não pode ultrapassar ${MAX_IMAGE_ATTACHMENTS}.`,
      );
    }

    const requestKey = parsed.idempotencyKey?.trim() || crypto.randomUUID();

    const actionKey = createIdempotencyKey("diary:memory:update", {
      id: parsed.memoryId,
      title: parsed.title,
      memoryDate: parsed.memoryDate,
      description: parsed.description,
      removeAttachmentIds,
      attachments: attachments.map((file) => ({
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
      })),
      request: requestKey,
    });

    const canProcess = await acquireIdempotencyLock({
      userId,
      actionType: "diary:memory:update",
      actionKey,
      ttlSeconds: 180,
    });

    if (!canProcess) {
      throw new Error(
        "Requisição duplicada detectada. Aguarde alguns segundos e tente novamente.",
      );
    }

    await db
      .update(journalMemories)
      .set({
        title: parsed.title,
        memoryDate: parsed.memoryDate,
        description: parsed.description,
        updatedAt: new Date(),
      })
      .where(and(eq(journalMemories.id, parsed.memoryId), eq(journalMemories.userId, userId)));

    if (removeAttachmentIds.length > 0) {
      await db
        .delete(journalMemoryAttachments)
        .where(
          and(
            eq(journalMemoryAttachments.memoryId, parsed.memoryId),
            eq(journalMemoryAttachments.userId, userId),
            inArray(journalMemoryAttachments.id, removeAttachmentIds),
          ),
        );
    }

    if (attachments.length > 0) {
      await db.insert(journalMemoryAttachments).values(
        attachments.map((attachment) => ({
          id: attachment.id,
          memoryId: parsed.memoryId,
          userId,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSize: attachment.fileSize,
          data: attachment.data,
        })),
      );
    }

    revalidatePath("/diario");
    revalidatePath("/diario/recordacoes");
    revalidatePath(`/diario/recordacoes/${parsed.memoryId}/editar`);

  } catch (error) {
    throw new Error(normalizeError(error));
  }
}

export async function deleteJournalMemoryAction(formData: FormData): Promise<void> {
  try {
    const userId = await requireUserId();
    const parsed = deleteJournalMemorySchema.parse({
      memoryId: formData.get("memoryId"),
    });

    await db
      .delete(journalMemories)
      .where(and(eq(journalMemories.id, parsed.memoryId), eq(journalMemories.userId, userId)));

    revalidatePath("/diario");
    revalidatePath("/diario/recordacoes");

  } catch (error) {
    throw new Error(normalizeError(error));
  }
}

export async function deleteJournalMemoryAttachmentAction(formData: FormData): Promise<void> {
  try {
    const userId = await requireUserId();
    const parsed = deleteJournalMemoryAttachmentSchema.parse({
      memoryId: formData.get("memoryId"),
      attachmentId: formData.get("attachmentId"),
    });

    const [memory] = await db
      .select({ id: journalMemories.id })
      .from(journalMemories)
      .where(and(eq(journalMemories.id, parsed.memoryId), eq(journalMemories.userId, userId)))
      .limit(1);

    if (!memory) {
      throw new Error("Recordação não encontrada.");
    }

    await db
      .delete(journalMemoryAttachments)
      .where(
        and(
          eq(journalMemoryAttachments.id, parsed.attachmentId),
          eq(journalMemoryAttachments.memoryId, parsed.memoryId),
          eq(journalMemoryAttachments.userId, userId),
        ),
      );

    await db
      .update(journalMemories)
      .set({ updatedAt: new Date() })
      .where(and(eq(journalMemories.id, parsed.memoryId), eq(journalMemories.userId, userId)));

    revalidatePath("/diario/recordacoes");
    revalidatePath(`/diario/recordacoes/${parsed.memoryId}`);
    revalidatePath(`/diario/recordacoes/${parsed.memoryId}/editar`);
  } catch (error) {
    throw new Error(normalizeError(error));
  }
}

export async function getUserJournalMemories(): Promise<JournalMemoryView[]> {
  const userId = await requireUserId();

  const memories = await db
    .select({
      id: journalMemories.id,
      title: journalMemories.title,
      memoryDate: journalMemories.memoryDate,
      description: journalMemories.description,
      createdAt: journalMemories.createdAt,
      updatedAt: journalMemories.updatedAt,
    })
    .from(journalMemories)
    .where(eq(journalMemories.userId, userId))
    .orderBy(desc(journalMemories.memoryDate), desc(journalMemories.createdAt));

  if (memories.length === 0) {
    return [];
  }

  const memoryIds = memories.map((memory) => memory.id);

  const attachments = await db
    .select({
      id: journalMemoryAttachments.id,
      memoryId: journalMemoryAttachments.memoryId,
      fileName: journalMemoryAttachments.fileName,
      mimeType: journalMemoryAttachments.mimeType,
      fileSize: journalMemoryAttachments.fileSize,
      createdAt: journalMemoryAttachments.createdAt,
    })
    .from(journalMemoryAttachments)
    .where(
      and(
        eq(journalMemoryAttachments.userId, userId),
        inArray(journalMemoryAttachments.memoryId, memoryIds),
      ),
    )
    .orderBy(desc(journalMemoryAttachments.createdAt));

  const attachmentsByMemory = new Map<string, JournalMemoryAttachmentView[]>();

  for (const attachment of attachments) {
    const list = attachmentsByMemory.get(attachment.memoryId) ?? [];
    list.push({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      createdAt: attachment.createdAt,
    });
    attachmentsByMemory.set(attachment.memoryId, list);
  }

  return memories.map((memory) => ({
    id: memory.id,
    title: memory.title,
    memoryDate: memory.memoryDate,
    description: memory.description,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    attachments: attachmentsByMemory.get(memory.id) ?? [],
  }));
}

export async function getJournalMemoryForEdit(memoryId: string): Promise<JournalMemoryView | null> {
  const userId = await requireUserId();

  const [memory] = await db
    .select({
      id: journalMemories.id,
      title: journalMemories.title,
      memoryDate: journalMemories.memoryDate,
      description: journalMemories.description,
      createdAt: journalMemories.createdAt,
      updatedAt: journalMemories.updatedAt,
    })
    .from(journalMemories)
    .where(and(eq(journalMemories.id, memoryId), eq(journalMemories.userId, userId)))
    .limit(1);

  if (!memory) {
    return null;
  }

  const attachments = await db
    .select({
      id: journalMemoryAttachments.id,
      fileName: journalMemoryAttachments.fileName,
      mimeType: journalMemoryAttachments.mimeType,
      fileSize: journalMemoryAttachments.fileSize,
      createdAt: journalMemoryAttachments.createdAt,
    })
    .from(journalMemoryAttachments)
    .where(
      and(
        eq(journalMemoryAttachments.memoryId, memory.id),
        eq(journalMemoryAttachments.userId, userId),
      ),
    )
    .orderBy(desc(journalMemoryAttachments.createdAt));

  return {
    ...memory,
    attachments,
  };
}
