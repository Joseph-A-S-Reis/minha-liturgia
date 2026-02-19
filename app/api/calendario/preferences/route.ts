import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { notificationPreferences } from "@/db/schema";

const updatePreferencesSchema = z.object({
  timezone: z.string().trim().min(3).max(80).default("America/Sao_Paulo"),
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(true),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const [existing] = await db
    .select({
      timezone: notificationPreferences.timezone,
      emailEnabled: notificationPreferences.emailEnabled,
      pushEnabled: notificationPreferences.pushEnabled,
      quietHoursStart: notificationPreferences.quietHoursStart,
      quietHoursEnd: notificationPreferences.quietHoursEnd,
      updatedAt: notificationPreferences.updatedAt,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, session.user.id))
    .limit(1);

  if (!existing) {
    return Response.json({
      timezone: "America/Sao_Paulo",
      emailEnabled: true,
      pushEnabled: true,
      quietHoursStart: null,
      quietHoursEnd: null,
      updatedAt: null,
    });
  }

  return Response.json(existing);
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = updatePreferencesSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: "Payload inválido.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const quietStart = parsed.data.quietHoursStart ?? null;
  const quietEnd = parsed.data.quietHoursEnd ?? null;

  if ((quietStart === null) !== (quietEnd === null)) {
    return Response.json(
      { error: "Para horário silencioso, preencha início e fim (ou deixe ambos vazios)." },
      { status: 400 },
    );
  }

  await db
    .insert(notificationPreferences)
    .values({
      userId: session.user.id,
      timezone: parsed.data.timezone,
      emailEnabled: parsed.data.emailEnabled,
      pushEnabled: parsed.data.pushEnabled,
      quietHoursStart: quietStart,
      quietHoursEnd: quietEnd,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        timezone: parsed.data.timezone,
        emailEnabled: parsed.data.emailEnabled,
        pushEnabled: parsed.data.pushEnabled,
        quietHoursStart: quietStart,
        quietHoursEnd: quietEnd,
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}
