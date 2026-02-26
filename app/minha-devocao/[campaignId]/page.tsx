import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { MariaAssistant } from "@/app/components/maria-assistant";
import { InteractiveSubmitButton } from "@/app/components/interactive-submit-button";
import { BookIcon, CalendarIcon, CheckCircleIcon, SparkIcon } from "@/app/components/icons";
import { CampaignDangerZone, CampaignManagementPanel } from "./campaign-management-panel";
import {
  checkInDevotionDayAction,
  completeDevotionConditionDayAction,
  getDevotionCampaignDetailAction,
  saveDevotionDailyNoteAction,
  updateCampaignReminderTimesAction,
} from "../actions";
import {
  DEVOTION_TYPE_LABELS,
  MAX_RETROACTIVE_CHECKIN_DAYS,
  REMINDER_TIME_OPTIONS,
} from "@/lib/devotion/planner";

type PageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

function formatDatePtBr(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatReminderLabel(minute: number) {
  if (minute < 60) {
    return `${minute} min antes`;
  }

  if (minute % 60 === 0) {
    const hours = minute / 60;
    return `${hours}h antes`;
  }

  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${hours}h ${minutes}min antes`;
}

export default async function DevotionCampaignDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/entrar");
  }

  const { campaignId } = await params;
  const detail = await getDevotionCampaignDetailAction(campaignId);

  if (!detail) {
    notFound();
  }

  const selectedReminderSet = new Set(detail.reminders);

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/minha-devocao" className="hover:underline">
            Minha Devoção
          </Link>{" "}
          / {detail.campaign.name}
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2">
          <SparkIcon className="size-8" /> {detail.campaign.name}
        </h1>
        <p className="text-zinc-600">
          {DEVOTION_TYPE_LABELS[detail.campaign.type as keyof typeof DEVOTION_TYPE_LABELS]} · {detail.campaign.purpose}
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Período</p>
            <p className="text-sm font-semibold text-zinc-900">
              {formatDatePtBr(detail.startDate)} → {formatDatePtBr(detail.endDate)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Progresso</p>
            <p className="text-sm font-semibold text-zinc-900">
              {detail.checkedInDays}/{detail.campaign.durationDays} ({detail.progressPercent}%)
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Dia atual da campanha</p>
            <p className="text-sm font-semibold text-zinc-900">Dia {detail.currentDayIndex}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Timezone</p>
            <p className="text-sm font-semibold text-zinc-900">{detail.campaign.timezone}</p>
          </div>
        </div>

        {detail.campaign.description ? (
          <p className="mt-4 text-sm text-zinc-700">{detail.campaign.description}</p>
        ) : null}

        {detail.campaign.priestName ? (
          <p className="mt-2 text-sm text-zinc-600">Padre orientador: {detail.campaign.priestName}</p>
        ) : null}

        {detail.conditions.length > 0 ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Condições / compromissos da campanha
            </p>
            <ul className="mt-2 space-y-1.5">
              {detail.conditions.map((condition) => (
                <li key={condition.id} className="text-sm text-zinc-700">
                  <span className="font-semibold text-zinc-900">• {condition.name}</span>
                  {condition.description ? ` — ${condition.description}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <CampaignManagementPanel
        campaign={{
          id: detail.campaign.id,
          name: detail.campaign.name,
          description: detail.campaign.description,
          purpose: detail.campaign.purpose,
          type: detail.campaign.type,
          durationDays: detail.campaign.durationDays,
          timezone: detail.campaign.timezone,
          priestName: detail.campaign.priestName,
        }}
        startDate={detail.startDate}
        conditions={detail.conditions}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
          <CalendarIcon className="size-5 text-emerald-700" /> Lembretes diários
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Selecione uma ou mais antecedências para receber notificações push desta campanha.
        </p>

        <form action={updateCampaignReminderTimesAction} className="mt-3 space-y-3">
          <input type="hidden" name="campaignId" value={detail.campaign.id} />
          <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />

          <div className="flex flex-wrap gap-2">
            {REMINDER_TIME_OPTIONS.map((option) => (
              <label
                key={option.minute}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700"
              >
                <input
                  type="checkbox"
                  name="reminderMinutes"
                  value={option.minute}
                  defaultChecked={selectedReminderSet.has(option.minute)}
                  className="size-3.5"
                />
                {option.label}
              </label>
            ))}
          </div>

          <InteractiveSubmitButton
            idleLabel="Salvar horários"
            pendingLabel="Salvando..."
            className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </form>

        {detail.reminders.length > 0 ? (
          <p className="mt-2 text-xs text-zinc-600">
            Ativos: {detail.reminders.map(formatReminderLabel).join(", ")}
          </p>
        ) : (
          <p className="mt-2 text-xs text-zinc-600">Nenhum lembrete ativo.</p>
        )}
      </section>

      {detail.verseOfDay ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
            <BookIcon className="size-5" /> Versículo do dia
          </h2>
          <p className="mt-1 text-xs font-medium text-emerald-700">
            Selecionado com base no propósito da campanha e no seu progresso diário.
          </p>
          <blockquote className="mt-3 rounded-xl border border-emerald-200 bg-white p-4 text-sm text-zinc-800">
            “{detail.verseOfDay.text}”
            <footer className="mt-2 text-xs font-semibold text-emerald-800">
              {detail.verseOfDay.bookName} {detail.verseOfDay.chapter}:{detail.verseOfDay.verse}
            </footer>
          </blockquote>
          <Link
            href={`/biblia/${detail.verseOfDay.versionId}/${detail.verseOfDay.bookId}/${detail.verseOfDay.chapter}`}
            className="mt-3 inline-flex rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            Abrir na Bíblia
          </Link>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
          <CheckCircleIcon className="size-5 text-emerald-700" /> Calendário de progresso
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Check-in disponível para hoje e até {MAX_RETROACTIVE_CHECKIN_DAYS} dia(s) anteriores.
        </p>

        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {detail.days.map((day) => (
            <li
              key={day.dateLocal}
              className={`rounded-xl border p-4 ${
                day.checkedInAt
                  ? "border-emerald-200 bg-emerald-50"
                  : day.canCheckIn
                    ? "border-sky-200 bg-sky-50"
                    : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">Dia {day.dayIndex}</p>
                <span className="text-xs text-zinc-600">{formatDatePtBr(day.dateLocal)}</span>
              </div>

              <p className="mt-1 text-xs font-medium text-zinc-600">
                {day.checkedInAt
                  ? "Check-in concluído"
                  : day.canCheckIn
                    ? day.conditions.length > 0 && !day.allConditionsCompleted
                      ? "Condições pendentes"
                      : "Check-in disponível"
                    : "Fora da janela de check-in"}
              </p>

              {day.conditions.length > 0 ? (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    Condições do dia
                  </p>
                  <ul className="mt-2 space-y-2">
                    {day.conditions.map((condition) => (
                      <li key={`${day.dateLocal}-${condition.id}`} className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-zinc-900">{condition.name}</p>
                          {condition.description ? (
                            <p className="text-[11px] text-zinc-600">{condition.description}</p>
                          ) : null}
                        </div>

                        <form action={completeDevotionConditionDayAction}>
                          <input type="hidden" name="campaignId" value={detail.campaign.id} />
                          <input type="hidden" name="conditionId" value={condition.id} />
                          <input type="hidden" name="dateLocal" value={day.dateLocal} />
                          <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                          <InteractiveSubmitButton
                            idleLabel={condition.completed ? "Concluída" : "Concluir"}
                            pendingLabel="Concluindo..."
                            disabled={!day.canCheckIn || condition.completed}
                            className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </form>
                      </li>
                    ))}
                  </ul>
                  {!day.allConditionsCompleted && day.canCheckIn ? (
                    <p className="mt-2 text-[11px] text-amber-700">
                      Conclua todas as condições para liberar o check-in deste dia.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <form action={saveDevotionDailyNoteAction} className="mt-3 space-y-2">
                <input type="hidden" name="campaignId" value={detail.campaign.id} />
                <input type="hidden" name="dateLocal" value={day.dateLocal} />
                <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />

                <textarea
                  name="note"
                  rows={3}
                  defaultValue={day.note}
                  placeholder="Anotações deste dia"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-emerald-500 focus:ring-2"
                />

                <InteractiveSubmitButton
                  idleLabel="Salvar nota"
                  pendingLabel="Salvando..."
                  className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </form>

              <form action={checkInDevotionDayAction} className="mt-2">
                <input type="hidden" name="campaignId" value={detail.campaign.id} />
                <input type="hidden" name="dateLocal" value={day.dateLocal} />
                <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />

                <InteractiveSubmitButton
                  idleLabel={day.checkedInAt ? "Dia concluído" : "Confirmar check-in"}
                  pendingLabel="Confirmando..."
                  disabled={
                    !day.canCheckIn ||
                    Boolean(day.checkedInAt) ||
                    (day.conditions.length > 0 && !day.allConditionsCompleted)
                  }
                  className="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </form>
            </li>
          ))}
        </ul>
      </section>

      <MariaAssistant
        title="MarIA · Apoio para esta campanha"
        description="Pergunte sobre dúvidas espirituais, estratégias práticas e acompanhamento da sua devoção atual."
        contextText={`Campanha: ${detail.campaign.name}; Tipo: ${detail.campaign.type}; Propósito: ${detail.campaign.purpose}; Dia atual: ${detail.currentDayIndex}/${detail.campaign.durationDays}; Progresso: ${detail.progressPercent}%; Condições: ${detail.conditions.map((condition) => condition.name).join(", ") || "nenhuma"}.`}
      />

      <CampaignDangerZone campaignId={detail.campaign.id} />
    </main>
  );
}
