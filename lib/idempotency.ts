import { and, eq, lt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db/client";
import { mutationIdempotency } from "@/db/schema";

type StableValue =
  | null
  | string
  | number
  | boolean
  | StableValue[]
  | { [key: string]: StableValue };

function toStableValue(input: unknown): StableValue {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return input;
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  if (Array.isArray(input)) {
    return input.map((item) => toStableValue(item));
  }

  if (typeof input === "object") {
    const entries = Object.entries(input as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, toStableValue(value)] as const);

    return Object.fromEntries(entries);
  }

  return String(input);
}

export function createIdempotencyKey(namespace: string, payload: unknown): string {
  const normalized = JSON.stringify({ namespace, payload: toStableValue(payload) });
  return createHash("sha256").update(normalized).digest("hex");
}

export async function acquireIdempotencyLock(params: {
  userId: string;
  actionType: string;
  actionKey: string;
  ttlSeconds?: number;
}) {
  const ttlSeconds = Math.max(30, params.ttlSeconds ?? 120);
  const now = new Date();

  await db
    .delete(mutationIdempotency)
    .where(
      and(
        eq(mutationIdempotency.userId, params.userId),
        eq(mutationIdempotency.actionType, params.actionType),
        lt(mutationIdempotency.expiresAt, now),
      ),
    );

  const [inserted] = await db
    .insert(mutationIdempotency)
    .values({
      id: crypto.randomUUID(),
      userId: params.userId,
      actionType: params.actionType,
      actionKey: params.actionKey,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
    })
    .onConflictDoNothing({
      target: [
        mutationIdempotency.userId,
        mutationIdempotency.actionType,
        mutationIdempotency.actionKey,
      ],
    })
    .returning({ id: mutationIdempotency.id });

  return Boolean(inserted?.id);
}
