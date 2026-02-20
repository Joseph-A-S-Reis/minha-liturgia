import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export type LibraryPublishAccess = {
  isAdmin: boolean;
  isCurator: boolean;
  canPublish: boolean;
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
