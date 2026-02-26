"use client";

import { useMemo, useState } from "react";
import { createDevotionCampaignAction } from "./actions";
import {
  DEVOTION_TYPE_LABELS,
  DEVOTION_TYPES,
  REMINDER_TIME_OPTIONS,
  type DevotionType,
} from "@/lib/devotion/planner";
import { InteractiveSubmitButton } from "@/app/components/interactive-submit-button";

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CampaignForm() {
  const [campaignType, setCampaignType] = useState<DevotionType>("penitencia");
  const [conditionCount, setConditionCount] = useState(0);

  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const startDate = useMemo(() => getTodayIsoDate(), []);

  return (
    <form
      action={createDevotionCampaignAction}
      className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2"
    >
      <div className="space-y-1">
        <label htmlFor="campaign-name" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Nome da campanha
        </label>
        <input
          id="campaign-name"
          type="text"
          name="name"
          required
          maxLength={160}
          placeholder="Nome da campanha"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="campaign-type" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Tipo da campanha
        </label>
        <select
          id="campaign-type"
          name="type"
          value={campaignType}
          onChange={(event) => setCampaignType(event.target.value as DevotionType)}
          title="Tipo da campanha"
          aria-label="Tipo da campanha"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        >
          {DEVOTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {DEVOTION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2 space-y-1">
        <label htmlFor="campaign-purpose" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Propósito
        </label>
        <input
          id="campaign-purpose"
          type="text"
          name="purpose"
          required
          maxLength={140}
          placeholder="Propósito (ex.: fortalecimento espiritual)"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />
      </div>

      <div className="sm:col-span-2 space-y-1">
        <label
          htmlFor="campaign-description"
          className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
        >
          Descrição (opcional)
        </label>
        <textarea
          id="campaign-description"
          name="description"
          placeholder="Descrição da campanha (opcional)"
          rows={3}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />
      </div>

      {campaignType === "penitencia" ? (
        <div className="sm:col-span-2 space-y-1">
          <label
            htmlFor="campaign-priest"
            className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
          >
            Padre orientador (opcional)
          </label>
          <input
            id="campaign-priest"
            type="text"
            name="priestName"
            maxLength={140}
            placeholder="Padre que orientou a penitência"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
          />
        </div>
      ) : (
        <input type="hidden" name="priestName" value="" />
      )}

      <div className="space-y-1">
        <label
          htmlFor="campaign-duration"
          className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
        >
          Duração (dias)
        </label>
        <input
          id="campaign-duration"
          type="number"
          name="durationDays"
          min={1}
          max={730}
          defaultValue={30}
          required
          title="Duração em dias"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="campaign-start-date"
          className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
        >
          Data de início
        </label>
        <input
          id="campaign-start-date"
          type="date"
          name="startDate"
          defaultValue={startDate}
          required
          title="Data de início da campanha"
          aria-label="Data de início da campanha"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />
      </div>

      <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Condições / compromissos da campanha (opcional)
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConditionCount((count) => Math.max(0, count - 1))}
              disabled={conditionCount === 0}
              className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              − Remover
            </button>
            <button
              type="button"
              onClick={() => setConditionCount((count) => Math.min(12, count + 1))}
              className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              + Adicionar
            </button>
          </div>
        </div>

        {conditionCount === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            Ex.: “Rezar 1 terço”, “Leitura de 1 salmo”, “Evitar redes sociais após 22h”.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {Array.from({ length: conditionCount }, (_, index) => (
              <div key={`condition-${index}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    Condição {index + 1}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    name="conditionName"
                    maxLength={140}
                    placeholder="Nome da condição"
                    title={`Nome da condição ${index + 1}`}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
                  />
                  <input
                    type="text"
                    name="conditionDescription"
                    maxLength={500}
                    placeholder="Descrição (opcional)"
                    title={`Descrição da condição ${index + 1}`}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Lembretes diários por antecedência (push)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REMINDER_TIME_OPTIONS.map((option) => (
            <label
              key={option.minute}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700"
            >
              <input type="checkbox" name="reminderMinutes" value={option.minute} className="size-3.5" />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <input type="hidden" name="timezone" value="America/Sao_Paulo" />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="sm:col-span-2 flex justify-end">
        <InteractiveSubmitButton
          idleLabel="Criar campanha"
          pendingLabel="Criando campanha..."
          className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </form>
  );
}
