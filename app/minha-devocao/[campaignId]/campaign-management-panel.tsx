"use client";

import { useMemo, useState } from "react";
import { InteractiveSubmitButton } from "@/app/components/interactive-submit-button";
import {
  DEVOTION_TYPE_LABELS,
  DEVOTION_TYPES,
  type DevotionType,
} from "@/lib/devotion/planner";
import { deleteDevotionCampaignAction, updateDevotionCampaignAction } from "../actions";

type CampaignCondition = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

type CampaignData = {
  id: string;
  name: string;
  description: string | null;
  purpose: string;
  type: string;
  durationDays: number;
  timezone: string;
  priestName: string | null;
};

type CampaignManagementPanelProps = {
  campaign: CampaignData;
  startDate: string;
  conditions: CampaignCondition[];
};

type CampaignDangerZoneProps = {
  campaignId: string;
};

export function CampaignManagementPanel({
  campaign,
  startDate,
  conditions,
}: CampaignManagementPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [campaignType, setCampaignType] = useState<DevotionType>(campaign.type as DevotionType);
  const [conditionRows, setConditionRows] = useState(() =>
    [...conditions]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        name: item.name,
        description: item.description ?? "",
      })),
  );

  const updateIdempotencyKey = useMemo(() => crypto.randomUUID(), []);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zinc-900">Gerenciar campanha</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Edite os dados principais da campanha e seus compromissos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          {isExpanded ? "Ocultar edição" : "Editar campanha"}
        </button>
      </div>

      {isExpanded ? (
        <form
          action={updateDevotionCampaignAction}
          className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2"
        >
        <input type="hidden" name="campaignId" value={campaign.id} />
        <input type="hidden" name="idempotencyKey" value={updateIdempotencyKey} />

        <input
          type="text"
          name="name"
          required
          maxLength={160}
          defaultValue={campaign.name}
          placeholder="Nome da campanha"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />

        <select
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

        <input
          type="text"
          name="purpose"
          required
          maxLength={140}
          defaultValue={campaign.purpose}
          placeholder="Propósito"
          className="w-full sm:col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />

        <textarea
          name="description"
          rows={3}
          defaultValue={campaign.description ?? ""}
          placeholder="Descrição da campanha"
          className="w-full sm:col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />

        {campaignType === "penitencia" ? (
          <input
            type="text"
            name="priestName"
            maxLength={140}
            defaultValue={campaign.priestName ?? ""}
            placeholder="Padre que orientou a penitência (opcional)"
            className="w-full sm:col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
          />
        ) : (
          <input type="hidden" name="priestName" value="" />
        )}

        <input
          type="number"
          name="durationDays"
          min={1}
          max={730}
          defaultValue={campaign.durationDays}
          required
          title="Duração em dias"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />

        <input
          type="date"
          name="startDate"
          defaultValue={startDate}
          required
          title="Data de início da campanha"
          aria-label="Data de início da campanha"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />

        <input
          type="text"
          name="timezone"
          defaultValue={campaign.timezone}
          required
          maxLength={80}
          placeholder="Timezone (ex.: America/Sao_Paulo)"
          className="w-full sm:col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />

        <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Condições / compromissos da campanha
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setConditionRows((current) => (current.length > 0 ? current.slice(0, -1) : current))
                }
                disabled={conditionRows.length === 0}
                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                − Remover
              </button>
              <button
                type="button"
                onClick={() =>
                  setConditionRows((current) =>
                    current.length >= 12
                      ? current
                      : [...current, { name: "", description: "" }],
                  )
                }
                className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                + Adicionar
              </button>
            </div>
          </div>

          {conditionRows.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">Nenhuma condição definida para esta campanha.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {conditionRows.map((condition, index) => (
                <div key={`condition-edit-${index}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    Condição {index + 1}
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      name="conditionName"
                      maxLength={140}
                      value={condition.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        setConditionRows((current) => {
                          const next = [...current];
                          next[index] = {
                            ...next[index],
                            name: value,
                          };
                          return next;
                        });
                      }}
                      placeholder="Nome da condição"
                      title={`Nome da condição ${index + 1}`}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
                    />

                    <input
                      type="text"
                      name="conditionDescription"
                      maxLength={500}
                      value={condition.description}
                      onChange={(event) => {
                        const value = event.target.value;
                        setConditionRows((current) => {
                          const next = [...current];
                          next[index] = {
                            ...next[index],
                            description: value,
                          };
                          return next;
                        });
                      }}
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

        <div className="sm:col-span-2 flex justify-end">
          <InteractiveSubmitButton
            idleLabel="Salvar alterações"
            pendingLabel="Salvando alterações..."
            className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        </form>
      ) : null}
    </section>
  );
}

export function CampaignDangerZone({ campaignId }: CampaignDangerZoneProps) {
  const deleteIdempotencyKey = useMemo(() => crypto.randomUUID(), []);

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-red-800">Zona de risco</h3>
      <p className="mt-1 text-xs text-red-700">
        Ao remover a campanha, os registros, condições e lembretes vinculados serão excluídos.
      </p>

      <form action={deleteDevotionCampaignAction} className="mt-3">
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="idempotencyKey" value={deleteIdempotencyKey} />
        <InteractiveSubmitButton
          idleLabel="Remover campanha"
          pendingLabel="Removendo campanha..."
          confirmMessage="Tem certeza que deseja remover esta campanha? Esta ação não pode ser desfeita."
          className="inline-flex items-center rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </form>
    </section>
  );
}
