"use client";

import { useMemo, useState } from "react";
import type { DonationMethod } from "./content";

type DonationMethodsProps = {
  methods: DonationMethod[];
};

export function DonationMethods({ methods }: DonationMethodsProps) {
  const initialMethodId = useMemo(() => methods[0]?.id ?? null, [methods]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(initialMethodId);

  if (methods.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
        Nenhuma forma de doação foi cadastrada ainda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {methods.map((method) => {
          const isActive = selectedMethodId === method.id;
          const panelId = `donation-panel-${method.id}`;

          return (
            <button
              key={method.id}
              type="button"
              aria-controls={panelId}
              data-active={isActive ? "true" : "false"}
              onClick={() => setSelectedMethodId(method.id)}
              className={`inline-flex items-center rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003366]/30 ${
                isActive
                  ? "border-[#003366] bg-[#003366] text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {method.label}
            </button>
          );
        })}
      </div>

      {methods.map((method) => {
        const isActive = selectedMethodId === method.id;
        const panelId = `donation-panel-${method.id}`;

        return (
          <section
            key={method.id}
            id={panelId}
            hidden={!isActive}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-zinc-900">{method.label}</h3>
              <p className="text-sm text-zinc-600">{method.summary}</p>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {method.details.map((detail) => (
                <div key={`${method.id}-${detail.label}`} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    {detail.label}
                  </dt>
                  <dd className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
