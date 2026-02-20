import { verifyGoogleDriveHealth } from "@/lib/storage/google-drive";

export const runtime = "nodejs";

function checkCronAuthorization(request: Request): boolean {
  const configured = process.env.LIBRARY_CRON_SECRET?.trim();

  if (!configured) {
    throw new Error("LIBRARY_CRON_SECRET não configurado.");
  }

  const provided = request.headers.get("x-library-secret")?.trim();
  return provided === configured;
}

export async function GET(request: Request) {
  try {
    if (!checkCronAuthorization(request)) {
      return Response.json({ error: "Não autorizado.", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const health = await verifyGoogleDriveHealth();

    return Response.json(health, {
      status: health.ok ? 200 : 503,
    });
  } catch (cause) {
    return Response.json(
      {
        ok: false,
        code: "HEALTHCHECK_INTERNAL_ERROR",
        error:
          cause instanceof Error
            ? cause.message
            : "Falha ao validar integração do Google Drive.",
      },
      { status: 500 },
    );
  }
}
