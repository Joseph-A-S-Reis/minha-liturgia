"use client";

import { useMemo, useState } from "react";
import { createDevotionCampaignAction } from "./actions";
import {
  CONFESSION_FREQUENCY_OPTIONS,
  CONFESSION_NATURE_OPTIONS_BY_TYPE,
  CONFESSION_ROOT_SINS,
  CONFESSION_SIN_TYPE_LABELS,
  CONFESSION_SIN_TYPES,
  DEVOTION_TYPE_LABELS,
  DEVOTION_TYPES,
  REMINDER_TIME_OPTIONS,
  type ConfessionFrequency,
  type ConfessionNature,
  type ConfessionRootSin,
  type ConfessionSinType,
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

function diffDaysInclusive(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T00:00:00.000Z`);
  const to = new Date(`${toIso}T00:00:00.000Z`);
  const diffMs = to.getTime() - from.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return diffDays + 1;
}

type DraftConfessionRow = {
  sinType: ConfessionSinType;
  nature: "" | ConfessionNature;
  rootSin: ConfessionRootSin;
  frequency: "" | ConfessionFrequency;
  details: string;
};

const CONFESSION_SELECT_WIDTH = {
  type: "w-56 min-w-56",
  nature: "w-72 min-w-72",
  root: "w-52 min-w-52",
  frequency: "w-56 min-w-56",
} as const;

function getConfessionNatureOptionsByType(sinType: ConfessionSinType): readonly ConfessionNature[] {
  if (sinType === "mandamento_de_deus") {
    return CONFESSION_NATURE_OPTIONS_BY_TYPE.mandamento_de_deus;
  }

  if (sinType === "mandamento_da_igreja") {
    return CONFESSION_NATURE_OPTIONS_BY_TYPE.mandamento_da_igreja;
  }

  return [];
}

export function CampaignForm() {
  const [campaignType, setCampaignType] = useState<DevotionType>("penitencia");
  const isConfession = campaignType === "confissao";
  const [conditionCount, setConditionCount] = useState(0);

  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const todayIso = useMemo(() => getTodayIsoDate(), []);
  const [startDateValue, setStartDateValue] = useState(todayIso);
  const [confessionRows, setConfessionRows] = useState<DraftConfessionRow[]>([
    {
      sinType: "mandamento_de_deus",
      nature: CONFESSION_NATURE_OPTIONS_BY_TYPE.mandamento_de_deus[0],
      rootSin: CONFESSION_ROOT_SINS[0],
      frequency: "",
      details: "",
    },
  ]);

  const confessionDurationDays = useMemo(
    () => Math.max(1, diffDaysInclusive(todayIso, startDateValue)),
    [todayIso, startDateValue],
  );

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

      {isConfession ? (
        <input type="hidden" name="purpose" value="Preparação para confissão" />
      ) : (
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
      )}

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
        {isConfession ? (
          <input
            id="campaign-duration"
            type="number"
            name="durationDays"
            value={confessionDurationDays}
            readOnly
            title="Duração calculada automaticamente entre hoje e a data da confissão"
            aria-label="Duração calculada automaticamente"
            className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-600"
          />
        ) : (
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
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="campaign-start-date"
          className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
        >
          {isConfession ? "Data da confissão" : "Data de início"}
        </label>
        <input
          id="campaign-start-date"
          type="date"
          name="startDate"
          value={startDateValue}
          onChange={(event) => setStartDateValue(event.target.value)}
          required
          title={isConfession ? "Data da confissão" : "Data de início da campanha"}
          aria-label={isConfession ? "Data da confissão" : "Data de início da campanha"}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2"
        />
      </div>

      {isConfession ? (
        <>
          <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Na campanha de confissão não há check-in diário. A duração é calculada de hoje até a data da
            confissão, e você pode começar o exame de consciência já no cadastro.
          </div>

          <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Exame de consciência · tabela editável
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setConfessionRows((current) =>
                      current.length > 0 ? current.slice(0, -1) : current,
                    )
                  }
                  disabled={confessionRows.length === 0}
                  className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  − Remover
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfessionRows((current) =>
                      current.length >= 60
                        ? current
                        : [
                            ...current,
                            {
                              sinType: "mandamento_de_deus",
                              nature: CONFESSION_NATURE_OPTIONS_BY_TYPE.mandamento_de_deus[0],
                              rootSin: CONFESSION_ROOT_SINS[0],
                              frequency: "",
                              details: "",
                            },
                          ],
                    )
                  }
                  className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-100"
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {confessionRows.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Nenhum item adicionado ainda.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-zinc-600">
                      <th className="px-2 py-2 whitespace-nowrap">Tipo</th>
                      <th className="px-2 py-2 whitespace-nowrap">Natureza</th>
                      <th className="px-2 py-2 whitespace-nowrap">Raiz</th>
                      <th className="px-2 py-2 whitespace-nowrap">Frequência</th>
                      <th className="px-2 py-2 w-full">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confessionRows.map((row, index) => (
                      <tr key={`confession-row-${index}`} className="border-b border-zinc-100 align-top">
                        <td className="px-2 py-2">
                          <select
                            name="confessionSinType"
                            value={row.sinType}
                            title={`Tipo do pecado ${index + 1}`}
                            onChange={(event) => {
                              const value = event.target.value as ConfessionSinType;
                              setConfessionRows((current) => {
                                const next = [...current];
                                const options = getConfessionNatureOptionsByType(value);
                                const currentNature = next[index].nature;
                                const nextNature =
                                  value === "outro"
                                    ? ""
                                    : currentNature !== "" && options.includes(currentNature)
                                      ? currentNature
                                      : options[0];

                                next[index] = {
                                  ...next[index],
                                  sinType: value,
                                  nature: nextNature,
                                };
                                return next;
                              });
                            }}
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
                          {row.sinType === "outro" ? (
                            <>
                              <input type="hidden" name="confessionNature" value="" />
                              <span
                                className={`${CONFESSION_SELECT_WIDTH.nature} inline-flex whitespace-nowrap rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-1 text-zinc-500`}
                              >
                                Não se aplica
                              </span>
                            </>
                          ) : (
                            <select
                              name="confessionNature"
                              value={row.nature}
                              title={`Natureza do pecado ${index + 1}`}
                              onChange={(event) => {
                                const value = event.target.value as ConfessionNature;
                                setConfessionRows((current) => {
                                  const next = [...current];
                                  next[index] = { ...next[index], nature: value };
                                  return next;
                                });
                              }}
                              className={`${CONFESSION_SELECT_WIDTH.nature} rounded-lg border border-zinc-300 bg-white px-2 py-1`}
                            >
                              {getConfessionNatureOptionsByType(row.sinType).map((nature) => (
                                <option key={nature} value={nature}>
                                  {nature}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <select
                            name="confessionRootSin"
                            value={row.rootSin}
                            title={`Raiz do pecado ${index + 1}`}
                            onChange={(event) => {
                              const value = event.target.value as ConfessionRootSin;
                              setConfessionRows((current) => {
                                const next = [...current];
                                next[index] = { ...next[index], rootSin: value };
                                return next;
                              });
                            }}
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
                            name="confessionFrequency"
                            value={row.frequency}
                            title={`Frequência ${index + 1}`}
                            onChange={(event) => {
                              const value = event.target.value as "" | ConfessionFrequency;
                              setConfessionRows((current) => {
                                const next = [...current];
                                next[index] = { ...next[index], frequency: value };
                                return next;
                              });
                            }}
                            className={`${CONFESSION_SELECT_WIDTH.frequency} rounded-lg border border-zinc-300 bg-white px-2 py-1`}
                          >
                            <option value="">Opcional</option>
                            {CONFESSION_FREQUENCY_OPTIONS.map((frequency) => (
                              <option key={frequency} value={frequency}>
                                {frequency}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 w-full">
                          <input
                            type="text"
                            name="confessionDetails"
                            value={row.details}
                            maxLength={2000}
                            title={`Detalhes ${index + 1}`}
                            placeholder="Opcional"
                            onChange={(event) => {
                              const value = event.target.value;
                              setConfessionRows((current) => {
                                const next = [...current];
                                next[index] = { ...next[index], details: value };
                                return next;
                              });
                            }}
                            className="w-full min-w-70 rounded-lg border border-zinc-300 bg-white px-2 py-1"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
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
      )}

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
