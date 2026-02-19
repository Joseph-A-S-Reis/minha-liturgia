import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  contentEncoding: z.string().trim().min(3).max(24).optional(),
});

const deleteSchema = z.object({
  endpoint: z.string().url(),
});

export const runtime = "nodejs";

export async function GET() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";

  if (!publicKey) {
    return Response.json(
      {
        enabled: false,
        error: "WEB_PUSH_VAPID_PUBLIC_KEY não configurada.",
      },
      { status: 200 },
    );
  }

  return Response.json({
    enabled: true,
    publicKey,
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = subscriptionSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Payload inválido para subscription push.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? null;

  await db
    .insert(pushSubscriptions)
    .values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      contentEncoding: parsed.data.contentEncoding ?? "aes128gcm",
      userAgent,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: session.user.id,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        contentEncoding: parsed.data.contentEncoding ?? "aes128gcm",
        userAgent,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = deleteSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json({ error: "Endpoint inválido." }, { status: 400 });
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, session.user.id),
        eq(pushSubscriptions.endpoint, parsed.data.endpoint),
      ),
    );

  return Response.json({ ok: true });
}
