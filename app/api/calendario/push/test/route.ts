import { z } from "zod";
import { auth } from "@/auth";
import { sendPushToUser } from "@/lib/calendar/push";

const testPushSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  body: z.string().trim().min(2).max(240).optional(),
  url: z.string().trim().min(1).max(300).optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  let payload: unknown = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = testPushSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  try {
    const summary = await sendPushToUser({
      userId: session.user.id,
      payload: {
        title: parsed.data.title ?? "Minha Liturgia",
        body: parsed.data.body ?? "Seu teste de notificação push foi enviado com sucesso.",
        url: parsed.data.url ?? "/calendario",
        tag: "calendar-push-test",
      },
    });

    return Response.json({
      ok: true,
      summary,
    });
  } catch (cause) {
    return Response.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Falha ao enviar push de teste.",
      },
      { status: 500 },
    );
  }
}
