"use server";

import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  libraryAssets,
  libraryResourceCategories,
  libraryResources,
} from "@/db/schema";
import { acquireIdempotencyLock, createIdempotencyKey } from "@/lib/idempotency";
import { requireLibraryPublishAccess } from "@/lib/library-access";

const createResourceSchema = z
  .object({
    title: z.string().trim().min(4).max(220),
    summary: z.string().trim().max(2000).optional(),
    contentMarkdown: z.string().trim().max(120_000).optional(),
    resourceType: z
      .enum(["article", "book", "video", "audio", "document", "html"])
      .default("article"),
    level: z.enum(["basic", "intermediate", "advanced"]).default("basic"),
    sourceName: z.string().trim().max(140).optional(),
    sourceUrl: z.url().optional(),
    isOfficialChurchSource: z.coerce.boolean().default(false),
    categoryIds: z.array(z.string().trim().min(1)).default([]),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .superRefine((data, ctx) => {
    const markdownForbiddenTypes = new Set(["html", "document", "audio", "video"]);

    if (markdownForbiddenTypes.has(data.resourceType) && data.contentMarkdown?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["contentMarkdown"],
        message: `Conteúdo markdown não é utilizado para o tipo ${data.resourceType}.`,
      });
    }
  });

const attachAssetSchema = z.object({
  resourceId: z.string().trim().min(1),
  kind: z.enum(["pdf", "image", "video", "audio", "html"]),
  title: z.string().trim().max(180).optional(),
  mimeType: z.string().trim().max(120).optional(),
  externalUrl: z.url().optional(),
  driveFileId: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

async function requireUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  return session.user.id;
}

export async function createLibraryResourceDraftAction(input: unknown) {
  const userId = await requireUserId();
  await requireLibraryPublishAccess(userId);
  const parsed = createResourceSchema.parse(input);

  const actionKey = createIdempotencyKey("library:resource:create", {
    ...parsed,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "library:resource:create",
    actionKey,
    ttlSeconds: 180,
  });

  if (!canProcess) {
    return { ok: true as const, deduped: true as const };
  }

  const baseSlug = slugify(parsed.title) || crypto.randomUUID();
  let slug = baseSlug;

  for (let attempt = 1; attempt < 6; attempt += 1) {
    const [existing] = await db
      .select({ id: libraryResources.id })
      .from(libraryResources)
      .where(eq(libraryResources.slug, slug))
      .limit(1);

    if (!existing) {
      break;
    }

    slug = `${baseSlug}-${attempt + 1}`;
  }

  const resourceId = crypto.randomUUID();

  await db.insert(libraryResources).values({
    id: resourceId,
    slug,
    title: parsed.title,
    summary: parsed.summary,
    contentMarkdown: parsed.contentMarkdown,
    resourceType: parsed.resourceType,
    level: parsed.level,
    status: "published",
    publishedAt: new Date(),
    sourceName: parsed.sourceName,
    sourceUrl: parsed.sourceUrl,
    isOfficialChurchSource: parsed.isOfficialChurchSource,
    createdByUserId: userId,
    reviewedByUserId: userId,
    reviewedAt: new Date(),
  });

  if (parsed.categoryIds.length > 0) {
    await db.insert(libraryResourceCategories).values(
      parsed.categoryIds.map((categoryId) => ({
        id: crypto.randomUUID(),
        resourceId,
        categoryId,
      })),
    );
  }

  revalidatePath("/biblioteca");

  return {
    ok: true as const,
    id: resourceId,
    slug,
  };
}

export async function attachAssetToLibraryResourceAction(input: unknown) {
  const userId = await requireUserId();
  await requireLibraryPublishAccess(userId);
  const parsed = attachAssetSchema.parse(input);

  const [resource] = await db
    .select({
      id: libraryResources.id,
      slug: libraryResources.slug,
      createdByUserId: libraryResources.createdByUserId,
    })
    .from(libraryResources)
    .where(eq(libraryResources.id, parsed.resourceId))
    .limit(1);

  if (!resource) {
    throw new Error("Publicação não encontrada.");
  }

  if (resource.createdByUserId && resource.createdByUserId !== userId) {
    throw new Error("Você não tem permissão para anexar mídia nesta publicação.");
  }

  const actionKey = createIdempotencyKey("library:asset:attach", {
    ...parsed,
    request: parsed.idempotencyKey ?? null,
  });

  const canProcess = await acquireIdempotencyLock({
    userId,
    actionType: "library:asset:attach",
    actionKey,
    ttlSeconds: 180,
  });

  if (!canProcess) {
    return { ok: true as const, deduped: true as const };
  }

  if (!parsed.externalUrl && !parsed.driveFileId) {
    throw new Error("Informe uma URL externa ou um ID de arquivo do Google Drive.");
  }

  const assetId = crypto.randomUUID();

  await db.insert(libraryAssets).values({
    id: assetId,
    resourceId: parsed.resourceId,
    kind: parsed.kind,
    title: parsed.title,
    mimeType: parsed.mimeType,
    externalUrl: parsed.externalUrl,
    driveFileId: parsed.driveFileId,
    status: "ready",
  });

  revalidatePath("/biblioteca");
  revalidatePath(`/biblioteca/${resource.slug}`);

  return {
    ok: true as const,
    id: assetId,
  };
}

export async function publishLibraryResourceAction(resourceId: string) {
  const userId = await requireUserId();
  await requireLibraryPublishAccess(userId);

  const [resource] = await db
    .select({
      id: libraryResources.id,
      resourceType: libraryResources.resourceType,
    })
    .from(libraryResources)
    .where(and(eq(libraryResources.id, resourceId), eq(libraryResources.createdByUserId, userId)))
    .limit(1);

  if (!resource) {
    throw new Error("Publicação não encontrada ou sem permissão de edição.");
  }

  const requiredKindsByType: Partial<Record<string, Array<"html" | "pdf" | "audio" | "video">>> = {
    html: ["html"],
    document: ["pdf"],
    audio: ["audio"],
    video: ["video"],
  };

  const requiredKinds = requiredKindsByType[resource.resourceType];

  if (requiredKinds && requiredKinds.length > 0) {
    const [confirmedAsset] = await db
      .select({ id: libraryAssets.id })
      .from(libraryAssets)
      .where(
        and(
          eq(libraryAssets.resourceId, resource.id),
          inArray(libraryAssets.kind, requiredKinds),
          or(isNotNull(libraryAssets.externalUrl), isNotNull(libraryAssets.driveFileId)),
        ),
      )
      .limit(1);

    if (!confirmedAsset) {
      throw new Error(
        "Este tipo de conteúdo exige ao menos um arquivo compatível enviado antes da publicação.",
      );
    }
  }

  await db
    .update(libraryResources)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    })
    .where(eq(libraryResources.id, resourceId));

  revalidatePath("/biblioteca");
}
