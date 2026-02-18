import { and, eq, gt, like } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { users, verificationTokens } from "@/db/schema";

const EMAIL_VERIFY_TTL_MINUTES = 24 * 60;
const PASSWORD_RESET_TTL_MINUTES = 30;

function getExpiry(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function getUserLockInfo(failedAttempts: number) {
  if (failedAttempts < 5) {
    return { locked: false, lockMinutes: 0 };
  }

  const step = failedAttempts - 5;
  const lockMinutes = Math.min(30, 2 ** step);
  return { locked: true, lockMinutes };
}

export async function createEmailVerificationToken(params: {
  userId: string;
  email: string;
}) {
  const token = randomToken();
  const identifierPrefix = `verify:${params.userId}:`;

  await db.transaction(async (tx) => {
    await tx
      .delete(verificationTokens)
      .where(like(verificationTokens.identifier, `${identifierPrefix}%`));

    await tx.insert(verificationTokens).values({
      identifier: `${identifierPrefix}${params.email}`,
      token,
      expires: getExpiry(EMAIL_VERIFY_TTL_MINUTES),
    });
  });

  return token;
}

export async function consumeEmailVerificationToken(token: string) {
  return db.transaction(async (tx) => {
    const [record] = await tx
      .delete(verificationTokens)
      .where(and(eq(verificationTokens.token, token), gt(verificationTokens.expires, new Date())))
      .returning({ identifier: verificationTokens.identifier });

    if (!record || !record.identifier.startsWith("verify:")) {
      return { success: false as const };
    }

    const [, userId] = record.identifier.split(":");
    if (!userId) {
      return { success: false as const };
    }

    await tx
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, userId));

    return { success: true as const };
  });
}

export async function createPasswordResetToken(params: {
  userId: string;
  email: string;
}) {
  const token = randomToken();
  const identifierPrefix = `reset:${params.userId}:`;

  await db.transaction(async (tx) => {
    await tx
      .delete(verificationTokens)
      .where(like(verificationTokens.identifier, `${identifierPrefix}%`));

    await tx.insert(verificationTokens).values({
      identifier: `${identifierPrefix}${params.email}`,
      token,
      expires: getExpiry(PASSWORD_RESET_TTL_MINUTES),
    });
  });

  return token;
}

export async function consumePasswordResetToken(params: {
  token: string;
  newPasswordHash: string;
}) {
  return db.transaction(async (tx) => {
    const [record] = await tx
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.token, params.token),
          gt(verificationTokens.expires, new Date()),
        ),
      )
      .returning({ identifier: verificationTokens.identifier });

    if (!record || !record.identifier.startsWith("reset:")) {
      return { success: false as const };
    }

    const [, userId] = record.identifier.split(":");
    if (!userId) {
      return { success: false as const };
    }

    await tx
      .update(users)
      .set({
        passwordHash: params.newPasswordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, userId));

    return { success: true as const };
  });
}
