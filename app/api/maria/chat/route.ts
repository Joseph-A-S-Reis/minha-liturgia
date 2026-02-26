import { z } from "zod";
import { auth } from "@/auth";
import { MARIA_MODES } from "@/lib/maria/prompts";
import { generateMariaReply } from "@/lib/maria/openrouter";
import { checkMariaRateLimit } from "@/lib/maria/rate-limit";
import { evaluateMariaPolicy } from "@/lib/maria/policy";
import { searchPublishedLibraryContextByChunks } from "@/lib/library-repository";
import { logMariaCitationTelemetry } from "@/lib/maria/citation-telemetry";

const chatSchema = z.object({
  mode: z.enum(MARIA_MODES),
  message: z.string().trim().min(2).max(4_000),
  context: z.string().trim().max(1_500).optional(),
});

export const runtime = "nodejs";

function getMariaCitationMinScore() {
  const raw = Number(process.env.MARIA_CITATION_MIN_SCORE ?? "8");
  if (!Number.isFinite(raw)) return 8;
  return Math.max(1, Math.min(40, Math.floor(raw)));
}

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

    const minCitationScore = getMariaCitationMinScore();

    const effectiveMessage = parsed.data.context
      ? `Contexto da campanha:\n${parsed.data.context}\n\nPergunta do usuário:\n${parsed.data.message}`
      : parsed.data.message;

    const libraryContext = await searchPublishedLibraryContextByChunks({
      query: effectiveMessage,
      limit: 8,
      minScore: minCitationScore,
    });

    const result = await generateMariaReply({
      mode: parsed.data.mode,
      userMessage: effectiveMessage,
      userId: session.user.id,
      libraryContext: libraryContext.map((item) => ({
        resourceTitle: item.resourceTitle,
        resourceSlug: item.resourceSlug,
        resourceSourceUrl: item.resourceSourceUrl,
        chunkIndex: item.chunkIndex,
        content: item.content,
      })),
    });

    const citations = libraryContext.slice(0, 6).map((item, index) => ({
      index: index + 1,
      title: item.resourceTitle,
      slug: item.resourceSlug,
      score: item.score,
      resourceId: item.resourceId,
      chunkIndex: item.chunkIndex,
      internalUrl: `/biblioteca/${item.resourceSlug}`,
      externalSourceUrl: item.resourceSourceUrl,
    }));

    const sourceMap = new Map<string, {
      title: string;
      slug: string;
      internalUrl: string;
      externalSourceUrl: string | null;
    }>();

    for (const item of libraryContext) {
      if (!sourceMap.has(item.resourceSlug)) {
        sourceMap.set(item.resourceSlug, {
          title: item.resourceTitle,
          slug: item.resourceSlug,
          internalUrl: `/biblioteca/${item.resourceSlug}`,
          externalSourceUrl: item.resourceSourceUrl,
        });
      }
    }

    try {
      await logMariaCitationTelemetry({
        userId: session.user.id,
        mode: parsed.data.mode,
        queryText: parsed.data.message,
        answer: result.answer,
        citations,
      });
    } catch (telemetryError) {
      const message = telemetryError instanceof Error ? telemetryError.message : "Erro desconhecido";
      console.warn(`[maria] falha ao registrar telemetria de citações: ${message}`);
    }

    return Response.json({
      answer: result.answer,
      model: result.model,
      usage: result.usage,
      minCitationScore,
      citations,
      sources: Array.from(sourceMap.values()).slice(0, 6),
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
