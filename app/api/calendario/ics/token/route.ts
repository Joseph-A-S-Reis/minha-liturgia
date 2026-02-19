import { auth } from "@/auth";
import { createIcsTokenForUser } from "@/lib/calendar/ics";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const tokenData = await createIcsTokenForUser(session.user.id);

  return Response.json({
    subscriptionUrl: tokenData.url,
    token: tokenData.rawToken,
    warning: "Guarde este token em local seguro. Ele concede acesso de leitura ao seu calendário.",
  });
}
