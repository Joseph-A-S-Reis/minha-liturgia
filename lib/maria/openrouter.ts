import { getAppBaseUrl } from "@/lib/app-url";
import { getMariaModeLabel, getMariaSystemPrompt, type MariaMode } from "@/lib/maria/prompts";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: OpenRouterUsage;
};

export type MariaChatResult = {
  answer: string;
  usage?: OpenRouterUsage;
  model: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim() || "liquid/lfm-2.5-1.2b-thinking:free";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY não está configurada.");
  }

  return { apiKey, model };
}

export async function generateMariaReply(input: {
  mode: MariaMode;
  userMessage: string;
  userId: string;
}) {
  const { apiKey, model } = getOpenRouterConfig();

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: getMariaSystemPrompt(input.mode),
    },
    {
      role: "user",
      content: `Modo escolhido: ${getMariaModeLabel(input.mode)}\n\nPergunta do usuário:\n${input.userMessage}`,
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": getAppBaseUrl(),
        "X-Title": "Minha Liturgia - MarIA",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        user: input.userId,
        temperature: 0.6,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Falha na OpenRouter (${response.status}): ${body.slice(0, 600)}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const answer = data.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("A OpenRouter retornou resposta vazia.");
    }

    return {
      answer,
      usage: data.usage,
      model,
    } satisfies MariaChatResult;
  } finally {
    clearTimeout(timeout);
  }
}
