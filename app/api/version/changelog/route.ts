import { z } from "zod";
import { getLatestRelease, getReleaseByVersion } from "@/lib/release-notes";

export const runtime = "nodejs";

const querySchema = z.object({
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    version: searchParams.get("version") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      {
        error: "Parâmetro de versão inválido. Use formato SemVer (x.y.z).",
      },
      { status: 400 },
    );
  }

  const version = parsed.data.version;
  const release = version ? getReleaseByVersion(version) : getLatestRelease();

  if (!release) {
    return Response.json(
      {
        error: "Versão não encontrada no changelog.",
      },
      { status: 404 },
    );
  }

  return Response.json(
    {
      release,
    },
    {
      headers: {
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
