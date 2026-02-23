"use server";

import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { load } from "cheerio";
import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  libraryAssets,
  libraryResourceCategories,
  libraryResources,
} from "@/db/schema";
import { acquireIdempotencyLock, createIdempotencyKey } from "@/lib/idempotency";
import { requireLibraryPublishAccess } from "@/lib/library-access";

const ARTICLE_ALLOWED_TAGS = [
  "a",
  "audio",
  "article",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "iframe",
  "img",
  "i",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "source",
  "span",
  "strong",
  "u",
  "ul",
  "video",
] as const;

const ARTICLE_ALLOWED_ATTR = [
  "allow",
  "allowfullscreen",
  "alt",
  "controls",
  "frameborder",
  "height",
  "href",
  "loading",
  "loop",
  "muted",
  "playsinline",
  "poster",
  "preload",
  "referrerpolicy",
  "rel",
  "sandbox",
  "src",
  "srcset",
  "target",
  "title",
  "type",
  "width",
] as const;

const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|\/|#)/i;

function isSafeResourceUrl(value: string) {
  const normalized = value.trim();
  if (!normalized) return true;
  return SAFE_URL_PATTERN.test(normalized);
}

function normalizeActionError(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return issue?.message ?? "Dados inválidos para publicação.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const dbCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: string }).code)
      : "";

  if (dbCode === "42P01") {
    return "As tabelas necessárias não existem neste banco de produção. Rode as migrações com o DATABASE_URL atual (npm run db:push).";
  }

  return "Falha inesperada ao publicar conteúdo.";
}

function sanitizeArticleHtml(rawHtml: string) {
  const $ = load(rawHtml);

  $(
    "script,style,noscript,object,embed,link,meta,base,head,form,input,button,textarea,select,nav,menu,aside,header,footer,area",
  ).remove();

  const allowedTags = new Set<string>(ARTICLE_ALLOWED_TAGS);
  const allowedAttrs = new Set<string>(ARTICLE_ALLOWED_ATTR);

  $("*").each((_, element) => {
    const tag = element.tagName?.toLowerCase();

    if (!tag) {
      return;
    }

    if (!allowedTags.has(tag)) {
      $(element).replaceWith($(element).contents());
      return;
    }

    const attributes = { ...(element.attribs ?? {}) };

    for (const [attrName, attrValue] of Object.entries(attributes)) {
      const key = attrName.toLowerCase();
      const value = String(attrValue ?? "").trim();

      if (
        key === "style" ||
        key === "class" ||
        key === "id" ||
        key.startsWith("on") ||
        !allowedAttrs.has(key)
      ) {
        $(element).removeAttr(attrName);
        continue;
      }

      if (["href", "src", "poster"].includes(key) && !isSafeResourceUrl(value)) {
        $(element).removeAttr(attrName);
        continue;
      }

      if (key === "target" && value === "_blank") {
        const rel = ($(element).attr("rel") ?? "")
          .split(/\s+/)
          .map((token) => token.trim().toLowerCase())
          .filter(Boolean);

        const relSet = new Set(rel);
        relSet.add("noopener");
        relSet.add("noreferrer");
        $(element).attr("rel", Array.from(relSet).join(" "));
      }
    }
  });

  const htmlBody = $("body").html() ?? $.root().html() ?? rawHtml;

  return htmlBody.trim();
}

const createResourceSchema = z
  .object({
    title: z.string().trim().min(4).max(220),
    summary: z.string().trim().max(2000).optional(),
    contentMarkdown: z.string().trim().max(120_000).optional(),
    resourceType: z.enum(["article", "book", "document"]).default("article"),
    sourceName: z.string().trim().max(140).optional(),
    sourceUrl: z.url().optional(),
    isOfficialChurchSource: z.coerce.boolean().default(false),
    categoryIds: z.array(z.string().trim().min(1)).default([]),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.resourceType === "article") {
      if (!data.contentMarkdown?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["contentMarkdown"],
          message: "Artigos exigem conteúdo HTML no editor integrado.",
        });
      }

      if (data.sourceUrl?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceUrl"],
          message: "URL da fonte só deve ser informada para Livro ou Documento.",
        });
      }

      return;
    }

    if (data.contentMarkdown?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["contentMarkdown"],
        message: `Conteúdo HTML no editor é exclusivo de Artigo. Para ${data.resourceType}, use upload de arquivo.`,
      });
    }
  });

const attachAssetSchema = z.object({
  resourceId: z.string().trim().min(1),
  kind: z.enum(["pdf", "docx", "epub"]),
  title: z.string().trim().max(180).optional(),
  mimeType: z.string().trim().max(120).optional(),
  externalUrl: z.url().optional(),
  driveFileId: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const uploadedAssetSchema = z.object({
  kind: z.enum(["pdf", "docx", "epub"]),
  title: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(1).max(120),
  externalUrl: z.url().optional(),
  driveFileId: z.string().trim().min(1).max(200),
  byteSize: z.number().int().positive().max(300 * 1024 * 1024).optional(),
});

const createAndPublishSchema = createResourceSchema
  .extend({
    uploadedAsset: uploadedAssetSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.resourceType === "article" && data.uploadedAsset) {
      ctx.addIssue({
        code: "custom",
        path: ["uploadedAsset"],
        message: "Artigo não deve receber upload de arquivo. Use apenas o editor HTML.",
      });
    }

    if (data.resourceType !== "article" && !data.uploadedAsset) {
      ctx.addIssue({
        code: "custom",
        path: ["uploadedAsset"],
        message: "Livro e Documento exigem upload de arquivo antes da publicação.",
      });
    }

    if (
      data.resourceType !== "article" &&
      data.uploadedAsset &&
      !["pdf", "docx", "epub"].includes(data.uploadedAsset.kind)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["uploadedAsset", "kind"],
        message: "Livro e Documento aceitam apenas PDF, DOCX ou EPUB.",
      });
    }
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
    contentMarkdown:
      parsed.resourceType === "article" && parsed.contentMarkdown
        ? sanitizeArticleHtml(parsed.contentMarkdown)
        : null,
    resourceType: parsed.resourceType,
    status: "draft",
    sourceName: parsed.sourceName,
    sourceUrl: parsed.resourceType === "article" ? null : parsed.sourceUrl,
    isOfficialChurchSource: parsed.isOfficialChurchSource,
    createdByUserId: userId,
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

export async function createAndPublishLibraryResourceAction(input: unknown) {
  try {
    const userId = await requireUserId();
    await requireLibraryPublishAccess(userId);
    const parsed = createAndPublishSchema.parse(input);

    const actionKey = createIdempotencyKey("library:resource:create-publish", {
      ...parsed,
      request: parsed.idempotencyKey ?? null,
    });

    const canProcess = await acquireIdempotencyLock({
      userId,
      actionType: "library:resource:create-publish",
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
    const isArticle = parsed.resourceType === "article";
    const now = new Date();

    await db.insert(libraryResources).values({
      id: resourceId,
      slug,
      title: parsed.title,
      summary: parsed.summary,
      contentMarkdown:
        isArticle && parsed.contentMarkdown ? sanitizeArticleHtml(parsed.contentMarkdown) : null,
      resourceType: parsed.resourceType,
      status: "published",
      publishedAt: isArticle ? now : null,
      sourceName: parsed.sourceName,
      sourceUrl: isArticle ? null : parsed.sourceUrl,
      isOfficialChurchSource: parsed.isOfficialChurchSource,
      createdByUserId: isArticle ? userId : null,
      reviewedByUserId: isArticle ? userId : null,
      reviewedAt: isArticle ? now : null,
    });

    if (parsed.uploadedAsset) {
      await db.insert(libraryAssets).values({
        id: crypto.randomUUID(),
        resourceId,
        kind: parsed.uploadedAsset.kind,
        title: parsed.uploadedAsset.title,
        mimeType: parsed.uploadedAsset.mimeType,
        externalUrl: parsed.uploadedAsset.externalUrl,
        driveFileId: parsed.uploadedAsset.driveFileId,
        byteSize: parsed.uploadedAsset.byteSize,
        status: "ready",
      });
    }

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
    revalidatePath(`/biblioteca/${slug}`);

    return {
      ok: true as const,
      id: resourceId,
      slug,
    };
  } catch (error) {
    console.error("[library:createAndPublish] erro ao publicar", error);

    return {
      ok: false as const,
      error: normalizeActionError(error),
    };
  }
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

  const requiredKindsByType: Partial<Record<string, Array<"pdf" | "docx" | "epub">>> = {
    book: ["pdf", "docx", "epub"],
    document: ["pdf", "docx", "epub"],
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

  const isArticle = resource.resourceType === "article";
  const now = new Date();

  await db
    .update(libraryResources)
    .set({
      status: "published",
      publishedAt: isArticle ? now : null,
      updatedAt: now,
      reviewedByUserId: isArticle ? userId : null,
      reviewedAt: isArticle ? now : null,
      createdByUserId: isArticle ? userId : null,
    })
    .where(eq(libraryResources.id, resourceId));

  revalidatePath("/biblioteca");
}
