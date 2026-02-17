const ADULT_OR_EXPLICIT_PATTERNS = [
  /\b(porn[oô]|pornografia|conte[uú]do adulto|adulto\s*\+18)\b/i,
  /\b(er[oó]tico|erotismo|sexual expl[ií]cito|sexo expl[ií]cito)\b/i,
  /\b(nudes?|nu\s+expl[ií]cito|fetiche)\b/i,
  /\b(acompanhante\s+sexual|programa\s+sexual)\b/i,
];

const OUT_OF_SCOPE_PATTERNS = [
  /\b(c[oó]digo|programa[cç][aã]o|javascript|typescript|python|debug|bug|api|sql)\b/i,
  /\b(day\s*trade|criptomoeda|bitcoin|aposta|cassino|roleta)\b/i,
  /\b(estrat[eé]gia\s+de\s+marketing|copywriting|vendas\s+b2b|tr[aá]fego\s+pago)\b/i,
  /\b(dieta\s+extrema|prescri[cç][aã]o\s+m[eé]dica|dosagem\s+de\s+rem[eé]dio)\b/i,
];

export type MariaPolicyDecision = {
  allowed: boolean;
  reason?: "adult" | "out_of_scope";
  message?: string;
};

export function evaluateMariaPolicy(input: string): MariaPolicyDecision {
  const text = input.trim();

  if (!text) {
    return {
      allowed: false,
      reason: "out_of_scope",
      message: "Envie uma pergunta para que a MarIA possa ajudar dentro do contexto católico.",
    };
  }

  if (ADULT_OR_EXPLICIT_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      reason: "adult",
      message:
        "A MarIA não responde conteúdo adulto ou sexual explícito. Posso ajudar com orientação espiritual, Bíblia, teologia católica e catequese.",
    };
  }

  if (OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      reason: "out_of_scope",
      message:
        "A MarIA é uma assistente católica e atua apenas em temas de espiritualidade, Bíblia, teologia católica e catequese nos modos Conselheira, Teóloga e Educadora.",
    };
  }

  return { allowed: true };
}
