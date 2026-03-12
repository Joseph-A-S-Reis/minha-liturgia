import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export type LibraryPublishAccess = {
  isAdmin: boolean;
  isCurator: boolean;
  canPublish: boolean;
};

type LibraryResourceAccessInput = {
  userId: string;
  createdByUserId: string | null;
  access: LibraryPublishAccess;
};

type LibraryCommentAccessInput = {
  userId: string;
  commentUserId: string;
  access: LibraryPublishAccess;
};

export async function getLibraryPublishAccess(userId: string): Promise<LibraryPublishAccess> {
  const [user] = await db
    .select({
      isAdmin: users.isAdmin,
      isCurator: users.isCurator,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const isAdmin = Boolean(user?.isAdmin);
  const isCurator = Boolean(user?.isCurator);

  return {
    isAdmin,
    isCurator,
    canPublish: isAdmin || isCurator,
  };
}

export async function requireLibraryPublishAccess(userId: string) {
  const access = await getLibraryPublishAccess(userId);

  if (!access.canPublish) {
    throw new Error("Apenas curadores e administradores podem publicar conteúdo na biblioteca.");
  }

  return access;
}

export function canManageLibraryResource(input: LibraryResourceAccessInput): boolean {
  if (input.access.isAdmin) {
    return true;
  }

  if (!input.access.isCurator) {
    return false;
  }

  if (!input.createdByUserId) {
    return false;
  }

  return input.createdByUserId === input.userId;
}

export function assertCanManageLibraryResource(input: LibraryResourceAccessInput) {
  if (!canManageLibraryResource(input)) {
    throw new Error(
      "Sem permissão para editar/excluir este conteúdo. Administradores podem gerenciar qualquer publicação; curadores apenas conteúdos próprios.",
    );
  }
}

export function canInteractWithLibraryResource(input: LibraryResourceAccessInput): boolean {
  if (!input.createdByUserId) {
    return true;
  }

  if (input.createdByUserId !== input.userId) {
    return true;
  }

  return !input.access.isAdmin && !input.access.isCurator;
}

export function assertCanInteractWithLibraryResource(input: LibraryResourceAccessInput) {
  if (!canInteractWithLibraryResource(input)) {
    throw new Error(
      "Administradores e curadores não podem interagir com conteúdos da própria autoria na Biblioteca.",
    );
  }
}

export function canEditOwnLibraryComment(input: LibraryCommentAccessInput): boolean {
  if (input.commentUserId === input.userId) {
    return true;
  }

  return input.access.isAdmin || input.access.isCurator;
}

export function assertCanEditOwnLibraryComment(input: LibraryCommentAccessInput) {
  if (!canEditOwnLibraryComment(input)) {
    throw new Error("Sem permissão para editar este comentário.");
  }
}

export function canDeleteOwnLibraryComment(input: LibraryCommentAccessInput): boolean {
  if (input.commentUserId === input.userId) {
    return true;
  }

  return input.access.isAdmin || input.access.isCurator;
}

export function assertCanDeleteOwnLibraryComment(input: LibraryCommentAccessInput) {
  if (!canDeleteOwnLibraryComment(input)) {
    throw new Error("Sem permissão para excluir este comentário.");
  }
}
