import { db } from "@/db/client";
import { mariaCitationEvents } from "@/db/schema";

type CitationItem = {
  index: number;
  title: string;
  slug: string;
  chunkIndex: number;
  internalUrl: string;
  externalSourceUrl?: string | null;
  score: number;
  resourceId: string;
};

function extractCitationIndices(answer: string): number[] {
  const regex = /\[(\d+)\]/g;
  const out: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(answer)) !== null) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) {
      out.push(value);
    }
  }

  return Array.from(new Set(out));
}

function toAnswerExcerpt(answer: string, max = 450) {
  const normalized = answer.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max)}…`;
}

export async function logMariaCitationTelemetry(input: {
  userId: string;
  mode: string;
  queryText: string;
  answer: string;
  citations: CitationItem[];
}) {
  const citationIndices = extractCitationIndices(input.answer);
  if (citationIndices.length === 0 || input.citations.length === 0) {
    return { inserted: 0 };
  }

  const citationMap = new Map<number, CitationItem>();
  for (const citation of input.citations) {
    citationMap.set(citation.index, citation);
  }

  const answerExcerpt = toAnswerExcerpt(input.answer);

  const rows = citationIndices
    .map((index) => {
      const citation = citationMap.get(index);
      if (!citation) {
        return null;
      }

      return {
        id: crypto.randomUUID(),
        userId: input.userId,
        mode: input.mode,
        queryText: input.queryText,
        answerExcerpt,
        citationIndex: citation.index,
        citationScore: citation.score,
        resourceId: citation.resourceId,
        resourceSlug: citation.slug,
        resourceTitle: citation.title,
        sourceUrl: citation.externalSourceUrl ?? null,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    userId: string;
    mode: string;
    queryText: string;
    answerExcerpt: string;
    citationIndex: number;
    citationScore: number;
    resourceId: string;
    resourceSlug: string;
    resourceTitle: string;
    sourceUrl: string | null;
  }>;

  if (rows.length === 0) {
    return { inserted: 0 };
  }

  await db.insert(mariaCitationEvents).values(rows);

  return { inserted: rows.length };
}
