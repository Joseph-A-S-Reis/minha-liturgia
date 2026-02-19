import { buildUserCalendarIcs, resolveUserIdByIcsToken } from "@/lib/calendar/ics";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const userId = await resolveUserIdByIcsToken(token);

  if (!userId) {
    return Response.json({ error: "Token ICS inválido ou expirado." }, { status: 401 });
  }

  const ics = await buildUserCalendarIcs({
    userId,
    includeLiturgical: true,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": 'inline; filename="minha-liturgia-feed.ics"',
    },
  });
}
