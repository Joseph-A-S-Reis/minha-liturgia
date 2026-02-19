const webpush: any = require("web-push");
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationDeliveries, pushSubscriptions } from "@/db/schema";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type PushSendSummary = {
  total: number;
  sent: number;
  failed: number;
  staleRemoved: number;
};

let vapidConfigured = false;

function ensureWebPushConfigured() {
  if (vapidConfigured) return;

  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    throw new Error("Configuração Web Push incompleta (WEB_PUSH_VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT).");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

function isStaleSubscriptionError(cause: unknown): boolean {
  if (!cause || typeof cause !== "object") {
    return false;
  }

  const maybeStatus = (cause as { statusCode?: number }).statusCode;
  return maybeStatus === 404 || maybeStatus === 410;
}

export async function sendPushToUser(params: {
  userId: string;
  payload: PushPayload;
  recordDeliveryLog?: boolean;
}): Promise<PushSendSummary> {
  ensureWebPushConfigured();

  const recordDeliveryLog = params.recordDeliveryLog ?? true;

  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      authKey: pushSubscriptions.auth,
      contentEncoding: pushSubscriptions.contentEncoding,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, params.userId));

  if (subscriptions.length === 0) {
    return {
      total: 0,
      sent: 0,
      failed: 0,
      staleRemoved: 0,
    };
  }

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  const serializedPayload = JSON.stringify({
    title: params.payload.title,
    body: params.payload.body,
    url: params.payload.url ?? "/calendario",
    tag: params.payload.tag ?? "calendar-reminder",
  });

  for (const subscription of subscriptions) {
    const now = new Date();

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.authKey,
          },
        },
        serializedPayload,
        {
          contentEncoding:
            subscription.contentEncoding === "aesgcm" ? "aesgcm" : "aes128gcm",
          TTL: 60,
          urgency: "normal",
        },
      );

      sent += 1;

      if (recordDeliveryLog) {
        await db.insert(notificationDeliveries).values({
          id: crypto.randomUUID(),
          userId: params.userId,
          channel: "push",
          status: "sent",
          scheduledFor: now,
          sentAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (cause) {
      failed += 1;

      if (recordDeliveryLog) {
        await db.insert(notificationDeliveries).values({
          id: crypto.randomUUID(),
          userId: params.userId,
          channel: "push",
          status: "failed",
          scheduledFor: now,
          errorMessage: cause instanceof Error ? cause.message.slice(0, 4000) : "Erro desconhecido",
          createdAt: now,
          updatedAt: now,
        });
      }

      if (isStaleSubscriptionError(cause)) {
        staleIds.push(subscription.id);
      }
    }
  }

  if (staleIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, staleIds));
  }

  return {
    total: subscriptions.length,
    sent,
    failed,
    staleRemoved: staleIds.length,
  };
}
