import {
  processReminderDeliveryQueue,
  scheduleReminderDeliveriesBackfill,
} from "@/lib/calendar/reminder-scheduler";

export const runtime = "nodejs";

function checkCronAuthorization(request: Request): boolean {
  const configured = process.env.REMINDER_CRON_SECRET?.trim();

  if (!configured) {
    throw new Error("REMINDER_CRON_SECRET não configurado.");
  }

  const provided = request.headers.get("x-reminder-secret")?.trim();
  return provided === configured;
}

export async function POST(request: Request) {
  try {
    if (!checkCronAuthorization(request)) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    const [backfill, processed] = await Promise.all([
      scheduleReminderDeliveriesBackfill({ limitEvents: 160 }),
      processReminderDeliveryQueue({ batchSize: 30, maxBatches: 8 }),
    ]);

    return Response.json({
      ok: true,
      backfill,
      processed,
    });
  } catch (cause) {
    return Response.json(
      {
        error: cause instanceof Error ? cause.message : "Falha ao executar tick de lembretes.",
      },
      { status: 500 },
    );
  }
}
