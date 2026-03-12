"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { acquireIdempotencyLock, createIdempotencyKey } from "@/lib/idempotency";
import {
  getGoogleCloudStorageFolderByKind,
  getGoogleCloudStorageResourcesPrefix,
  isGoogleCloudStorageConfigured,
  uploadBinaryToGoogleCloudStorage,
} from "@/lib/storage/google-cloud-storage";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const allowedAvatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type AccountSettingsActionState = {
  success: boolean;
  message: string;
};

const updatePublicProfileSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome público com pelo menos 2 caracteres.").max(120, "O nome público deve ter no máximo 120 caracteres."),
});

const updateDevotionSchema = z.object({
  devotionSaint: z.string().trim().max(120, "O santo de devoção deve ter no máximo 120 caracteres."),
});

const updateCommunitySchema = z.object({
  communityName: z.string().trim().max(160, "A comunidade deve ter no máximo 160 caracteres."),
});

async function requireUserId() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  return session.user.id;
}

function normalizeError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

async function parseAvatar(fileEntry: FormDataEntryValue | null) {
  if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
    return null;
  }

  const mimeType = fileEntry.type.trim().toLowerCase();

  if (!allowedAvatarMimeTypes.has(mimeType)) {
    throw new Error("Envie uma imagem JPG, PNG ou WEBP para a foto de perfil.");
  }

  if (fileEntry.size > MAX_AVATAR_BYTES) {
    throw new Error("A foto de perfil deve ter no máximo 5MB.");
  }

  const fileName = sanitizeFileName(fileEntry.name) || `${Date.now()}-perfil`;

  return {
    fileName,
    mimeType,
    size: fileEntry.size,
    buffer: Buffer.from(await fileEntry.arrayBuffer()),
  };
}

export async function updatePublicProfileAction(
  _previousState: AccountSettingsActionState,
  formData: FormData,
): Promise<AccountSettingsActionState> {
  try {
    const userId = await requireUserId();
    const parsed = updatePublicProfileSchema.parse({
      name: formData.get("name"),
    });
    const avatar = await parseAvatar(formData.get("image"));

    const actionKey = createIdempotencyKey("account:profile:update", {
      name: parsed.name,
      avatar: avatar
        ? {
            fileName: avatar.fileName,
            mimeType: avatar.mimeType,
            size: avatar.size,
          }
        : null,
    });

    const canProcess = await acquireIdempotencyLock({
      userId,
      actionType: "account:profile:update",
      actionKey,
      ttlSeconds: 120,
    });

    if (!canProcess) {
      return {
        success: false,
        message: "Requisição duplicada detectada. Aguarde alguns segundos antes de tentar novamente.",
      };
    }

    const [existingUser] = await db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existingUser) {
      return { success: false, message: "Usuário não encontrado." };
    }

    let nextImage = existingUser.image;
    let uploadWarning: string | null = null;

    if (avatar) {
      if (!isGoogleCloudStorageConfigured()) {
        return {
          success: false,
          message:
            "Upload indisponível no momento. Configure GCS_BUCKET_NAME e as credenciais do Google Cloud Storage.",
        };
      }

      const objectKey = `${getGoogleCloudStorageResourcesPrefix()}/${getGoogleCloudStorageFolderByKind("image")}/perfis/${userId}/${Date.now()}-${avatar.fileName}`;

      const uploaded = await uploadBinaryToGoogleCloudStorage({
        data: avatar.buffer,
        objectKey,
        contentType: avatar.mimeType,
        metadata: {
          scope: "account-profile",
          userId,
        },
      });

      nextImage = uploaded.publicUrl;
      uploadWarning = uploaded.permissionError ?? null;
    }

    await db
      .update(users)
      .set({
        name: parsed.name,
        image: nextImage,
      })
      .where(eq(users.id, userId));

    revalidatePath("/conta");

    return {
      success: true,
      message: uploadWarning
        ? "Perfil atualizado. A imagem foi enviada com aviso de permissão pública no storage."
        : "Dados pessoais atualizados com sucesso.",
    };
  } catch (error) {
    return {
      success: false,
      message: normalizeError(error, "Não foi possível atualizar seus dados pessoais."),
    };
  }
}

export async function updateDevotionProfileAction(
  _previousState: AccountSettingsActionState,
  formData: FormData,
): Promise<AccountSettingsActionState> {
  try {
    const userId = await requireUserId();
    const parsed = updateDevotionSchema.parse({
      devotionSaint: String(formData.get("devotionSaint") ?? ""),
    });

    const devotionSaint = normalizeOptionalText(parsed.devotionSaint);
    const actionKey = createIdempotencyKey("account:devotion:update", { devotionSaint });

    const canProcess = await acquireIdempotencyLock({
      userId,
      actionType: "account:devotion:update",
      actionKey,
      ttlSeconds: 90,
    });

    if (!canProcess) {
      return {
        success: false,
        message: "Requisição duplicada detectada. Aguarde alguns segundos antes de tentar novamente.",
      };
    }

    await db.execute(
      sql`UPDATE "users" SET "devotion_saint" = ${devotionSaint} WHERE "id" = ${userId}`,
    );

    revalidatePath("/conta");

    return { success: true, message: "Preferência de devoção atualizada com sucesso." };
  } catch (error) {
    return {
      success: false,
      message: normalizeError(error, "Não foi possível atualizar a seção de devoção."),
    };
  }
}

export async function updateCommunityProfileAction(
  _previousState: AccountSettingsActionState,
  formData: FormData,
): Promise<AccountSettingsActionState> {
  try {
    const userId = await requireUserId();
    const parsed = updateCommunitySchema.parse({
      communityName: String(formData.get("communityName") ?? ""),
    });

    const communityName = normalizeOptionalText(parsed.communityName);
    const actionKey = createIdempotencyKey("account:community:update", { communityName });

    const canProcess = await acquireIdempotencyLock({
      userId,
      actionType: "account:community:update",
      actionKey,
      ttlSeconds: 90,
    });

    if (!canProcess) {
      return {
        success: false,
        message: "Requisição duplicada detectada. Aguarde alguns segundos antes de tentar novamente.",
      };
    }

    await db.execute(
      sql`UPDATE "users" SET "community_name" = ${communityName} WHERE "id" = ${userId}`,
    );

    revalidatePath("/conta");

    return { success: true, message: "Dados da comunidade atualizados com sucesso." };
  } catch (error) {
    return {
      success: false,
      message: normalizeError(error, "Não foi possível atualizar a seção de comunidade."),
    };
  }
}
