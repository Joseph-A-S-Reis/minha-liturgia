import { z } from "zod";
import { auth } from "@/auth";
import { MARIA_MODES } from "@/lib/maria/prompts";
import { generateMariaReply } from "@/lib/maria/openrouter";
import { checkMariaRateLimit } from "@/lib/maria/rate-limit";
import { evaluateMariaPolicy } from "@/lib/maria/policy";

const chatSchema = z.object({
  mode: z.enum(MARIA_MODES),
  message: z.string().trim().min(2).max(4_000),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Não autenticado." }, { status: 401 });
    }

    const limit = checkMariaRateLimit(session.user.id, 20, 60 * 60 * 1000);
    if (!limit.allowed) {
      return Response.json(
        {
          error: "Limite de uso da MarIA atingido nesta hora. Tente novamente em alguns minutos.",
        },
        { status: 429 },
      );
    }

    const payload = await request.json();
    const parsed = chatSchema.safeParse(payload);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Dados inválidos.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const policy = evaluateMariaPolicy(parsed.data.message);
    if (!policy.allowed) {
      return Response.json(
        {
          error: policy.message ?? "Solicitação fora da política de uso da MarIA.",
          reason: policy.reason,
        },
        { status: 400 },
      );
    }

    const result = await generateMariaReply({
      mode: parsed.data.mode,
      userMessage: parsed.data.message,
      userId: session.user.id,
    });

    return Response.json({
      answer: result.answer,
      model: result.model,
      usage: result.usage,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha inesperada na MarIA.";

    return Response.json(
      {
        error: "Não foi possível obter a resposta da MarIA agora.",
        details: message,
      },
      { status: 500 },
    );
  }
}
