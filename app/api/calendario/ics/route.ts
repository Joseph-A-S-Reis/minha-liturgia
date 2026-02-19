import { auth } from "@/auth";
import { buildUserCalendarIcs } from "@/lib/calendar/ics";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const ics = await buildUserCalendarIcs({
    userId: session.user.id,
    includeLiturgical: true,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": 'attachment; filename="minha-liturgia.ics"',
    },
  });
}
