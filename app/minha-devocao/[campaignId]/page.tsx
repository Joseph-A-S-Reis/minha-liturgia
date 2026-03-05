import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { MariaAssistant } from "@/app/components/maria-assistant";
import { InteractiveSubmitButton } from "@/app/components/interactive-submit-button";
import { BookIcon, CalendarIcon, CheckCircleIcon, SparkIcon } from "@/app/components/icons";
import { CampaignDangerZone, CampaignManagementPanel } from "./campaign-management-panel";
import {
  addConfessionNoteAction,
  addConfessionSinAction,
  checkInDevotionDayAction,
  completeDevotionConditionDayAction,
  deleteConfessionNoteAction,
  deleteConfessionSinAction,
  getDevotionCampaignDetailAction,
  saveDevotionDailyNoteAction,
  toggleConfessionSinAction,
  updateConfessionNoteAction,
  updateConfessionSinAction,
  updateCampaignReminderTimesAction,
} from "../actions";
import {
  CONFESSION_FREQUENCY_OPTIONS,
  CONFESSION_NATURE_OPTIONS,
  CONFESSION_ROOT_SINS,
  CONFESSION_SIN_TYPE_LABELS,
  CONFESSION_SIN_TYPES,
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

const CONFESSION_SELECT_WIDTH = {
  type: "w-56 min-w-56",
  nature: "w-72 min-w-72",
  root: "w-52 min-w-52",
  frequency: "w-56 min-w-56",
} as const;

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
  const campaignConditions = "conditions" in detail ? detail.conditions : [];
  const mariaContext =
    detail.mode === "confissao"
      ? `Campanha: ${detail.campaign.name}; Tipo: ${detail.campaign.type}; Propósito: ${detail.campaign.purpose}; Data da confissão: ${detail.confessionDate}; Itens confessados: ${detail.confessionSummary.confessedItems}/${detail.confessionSummary.totalItems}; Observação: campanha sem check-in diário, com anotações sequenciais e tabela de pecados confessados.`
      : `Campanha: ${detail.campaign.name}; Tipo: ${detail.campaign.type}; Propósito: ${detail.campaign.purpose}; Dia atual: ${detail.currentDayIndex}/${detail.campaign.durationDays}; Progresso: ${detail.progressPercent}%; Condições: ${detail.conditions.map((condition) => condition.name).join(", ") || "nenhuma"}.`;

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
              {detail.mode === "confissao"
                ? `${detail.confessionSummary.confessedItems}/${detail.confessionSummary.totalItems} itens confessados (${detail.progressPercent}%)`
                : `${detail.checkedInDays}/${detail.campaign.durationDays} (${detail.progressPercent}%)`}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {detail.mode === "confissao" ? "Data da confissão" : "Dia atual da campanha"}
            </p>
            <p className="text-sm font-semibold text-zinc-900">
              {detail.mode === "confissao" ? formatDatePtBr(detail.confessionDate) : `Dia ${detail.currentDayIndex}`}
            </p>
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

        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          Tudo que você registra nesta campanha é privado e tratado com sigilo.
        </div>

        {campaignConditions.length > 0 ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Condições / compromissos da campanha
            </p>
            <ul className="mt-2 space-y-1.5">
              {campaignConditions.map((condition) => (
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

      {detail.mode === "confissao" ? (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-zinc-900">Exame de consciência · anotações em sequência</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Registre suas reflexões em ordem cronológica, com edição e exclusão.
            </p>

            <form action={addConfessionNoteAction} className="mt-4 space-y-2">
              <input type="hidden" name="campaignId" value={detail.campaign.id} />
              <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
              <textarea
                name="note"
                rows={3}
                required
                placeholder="Escreva uma nova anotação do exame de consciência"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-emerald-500 focus:ring-2"
              />
              <InteractiveSubmitButton
                idleLabel="Adicionar anotação"
                pendingLabel="Adicionando..."
                className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </form>

            {detail.confessionNotes.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {detail.confessionNotes.map((note, index) => (
                  <li key={note.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Anotação {index + 1}
                    </p>
                    <form action={updateConfessionNoteAction} className="space-y-2">
                      <input type="hidden" name="campaignId" value={detail.campaign.id} />
                      <input type="hidden" name="noteId" value={note.id} />
                      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                      <textarea
                        name="note"
                        rows={3}
                        defaultValue={note.note}
                        title={`Anotação ${index + 1}`}
                        placeholder="Descreva sua anotação"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-emerald-500 focus:ring-2"
                      />
                      <div className="flex flex-wrap gap-2">
                        <InteractiveSubmitButton
                          idleLabel="Salvar anotação"
                          pendingLabel="Salvando..."
                          className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    </form>
                    <form action={deleteConfessionNoteAction} className="mt-2">
                      <input type="hidden" name="campaignId" value={detail.campaign.id} />
                      <input type="hidden" name="noteId" value={note.id} />
                      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                      <InteractiveSubmitButton
                        idleLabel="Excluir anotação"
                        pendingLabel="Excluindo..."
                        confirmMessage="Deseja excluir esta anotação?"
                        className="inline-flex items-center rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-zinc-600">Nenhuma anotação registrada ainda.</p>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-zinc-900">Lista editável de pecados confessados</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Cadastre os itens em formato de tabela e marque manualmente quando forem confessados.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse table-fixed text-xs">
                  <colgroup>
                    <col className="w-56" />
                    <col className="w-72" />
                    <col className="w-52" />
                    <col className="w-56" />
                    <col />
                    <col className="w-28" />
                    <col className="w-48" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-zinc-600">
                      <th className="px-2 py-2 whitespace-nowrap">Tipo</th>
                      <th className="px-2 py-2 whitespace-nowrap">Natureza</th>
                      <th className="px-2 py-2 whitespace-nowrap">Raiz</th>
                      <th className="px-2 py-2 whitespace-nowrap">Frequência</th>
                      <th className="px-2 py-2 w-full">Detalhes</th>
                      <th className="px-2 py-2 whitespace-nowrap text-right">Confessado</th>
                      <th className="px-2 py-2 whitespace-nowrap text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.confessionSins.map((sin) => {
                      const updateFormId = `confession-sin-update-${sin.id}`;

                      return (
                      <tr key={sin.id} className="border-b border-zinc-100 align-top">
                        <td className="px-2 py-2">
                          <form id={updateFormId} action={updateConfessionSinAction}>
                            <input type="hidden" name="campaignId" value={detail.campaign.id} />
                            <input type="hidden" name="sinId" value={sin.id} />
                            <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                          </form>
                          <select
                            form={updateFormId}
                            name="sinType"
                            defaultValue={sin.sinType}
                            title="Tipo do pecado"
                            className={`${CONFESSION_SELECT_WIDTH.type} rounded-lg border border-zinc-300 bg-white px-2 py-1`}
                          >
                            {CONFESSION_SIN_TYPES.map((sinType) => (
                              <option key={sinType} value={sinType}>
                                {CONFESSION_SIN_TYPE_LABELS[sinType]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            form={updateFormId}
                            name="nature"
                            defaultValue={String(sin.nature ?? "")}
                            title="Natureza do pecado"
                            className={`${CONFESSION_SELECT_WIDTH.nature} rounded-lg border border-zinc-300 bg-white px-2 py-1`}
                          >
                            {CONFESSION_NATURE_OPTIONS.map((nature) => (
                              <option key={nature} value={nature}>
                                {nature}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            form={updateFormId}
                            name="rootSin"
                            defaultValue={sin.rootSin}
                            title="Raiz do pecado"
                            className={`${CONFESSION_SELECT_WIDTH.root} rounded-lg border border-zinc-300 bg-white px-2 py-1`}
                          >
                            {CONFESSION_ROOT_SINS.map((rootSin) => (
                              <option key={rootSin} value={rootSin}>
                                {rootSin}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            form={updateFormId}
                            name="frequency"
                            defaultValue={String(sin.frequency ?? "")}
                            title="Frequência"
                            className={`${CONFESSION_SELECT_WIDTH.frequency} rounded-lg border border-zinc-300 bg-white px-2 py-1`}
                          >
                            <option value="">Frequência (opcional)</option>
                            {CONFESSION_FREQUENCY_OPTIONS.map((frequency) => (
                              <option key={frequency} value={frequency}>
                                {frequency}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            form={updateFormId}
                            type="text"
                            name="details"
                            defaultValue={String(sin.details ?? "")}
                            maxLength={2000}
                            title="Detalhes"
                            placeholder="Detalhes (opcional)"
                            className="w-full min-w-70 rounded-lg border border-zinc-300 bg-white px-2 py-1"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <form action={toggleConfessionSinAction} className="flex justify-end">
                            <input type="hidden" name="campaignId" value={detail.campaign.id} />
                            <input type="hidden" name="sinId" value={sin.id} />
                            <input
                              type="hidden"
                              name="isConfessed"
                              value={sin.isConfessed ? "false" : "true"}
                            />
                            <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                            <InteractiveSubmitButton
                              idleLabel={sin.isConfessed ? "Sim" : "Não"}
                              pendingLabel="..."
                              className={`inline-flex items-center rounded-md px-2 py-1 font-semibold ${
                                sin.isConfessed
                                  ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                                  : "border border-zinc-300 bg-white text-zinc-700"
                              }`}
                            />
                          </form>
                        </td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            <InteractiveSubmitButton
                              idleLabel="Salvar"
                              pendingLabel="Salvando..."
                              form={updateFormId}
                              optimisticPendingOnClick
                              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-zinc-100"
                            />
                            <form action={deleteConfessionSinAction} className="inline-flex">
                              <input type="hidden" name="campaignId" value={detail.campaign.id} />
                              <input type="hidden" name="sinId" value={sin.id} />
                              <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                              <InteractiveSubmitButton
                                idleLabel="Excluir"
                                pendingLabel="..."
                                confirmMessage="Deseja excluir este item da lista?"
                                className="inline-flex items-center rounded-lg border border-red-300 bg-red-50 px-2 py-1 font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </form>
                          </div>
                        </td>
                      </tr>
                      );
                    })}

                    <tr>
                      <td colSpan={7} className="px-2 py-3">
                        <form action={addConfessionSinAction} className="inline-flex">
                          <input type="hidden" name="campaignId" value={detail.campaign.id} />
                          <input type="hidden" name="sinType" value={CONFESSION_SIN_TYPES[0]} />
                          <input type="hidden" name="nature" value={CONFESSION_NATURE_OPTIONS[0]} />
                          <input type="hidden" name="rootSin" value={CONFESSION_ROOT_SINS[0]} />
                          <input type="hidden" name="frequency" value="" />
                          <input type="hidden" name="details" value="" />
                          <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />

                          <InteractiveSubmitButton
                            idleLabel="Adicionar item"
                            pendingLabel="Adicionando..."
                            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </form>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
          </section>
        </>
      ) : (
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
      )}

      <MariaAssistant
        title="MarIA · Apoio para esta campanha"
        description="Pergunte sobre dúvidas espirituais, estratégias práticas e acompanhamento da sua devoção atual."
        contextText={mariaContext}
      />

      <CampaignDangerZone campaignId={detail.campaign.id} />
    </main>
  );
}
