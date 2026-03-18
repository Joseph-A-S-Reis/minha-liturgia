import type { Metadata } from "next";
import Link from "next/link";
import { HeartIcon } from "@/app/components/icons";
import { publicDonations } from "@/app/sobre/content";

export const metadata: Metadata = {
  title: "Doações | Minha Liturgia",
  description:
    "Acompanhe a listagem pública das doações registradas manualmente para o projeto Minha Liturgia.",
};

export default function DoacoesPage() {
  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <section className="space-y-4">
        <p className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          <HeartIcon className="mr-1 inline size-3.5" />
          Doações
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Registro público das contribuições voluntárias.
        </h1>
        <p className="max-w-3xl text-pretty text-zinc-600 sm:text-lg">
          Esta página foi preparada para listar todos os doadores que deixaram suas contribuições, a data da doação, o valor registrado e a data em que a oferta foi encaminhada à paróquia.
        </p>
      </section>

      {publicDonations.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600 shadow-sm sm:text-base">
          Nenhuma doação pública foi cadastrada ainda. Quando for recebida a confirmação do valor, a oferta aparecerá aqui.
        </section>
      ) : (
        <section className="grid gap-4 lg:hidden">
          {publicDonations.map((donation) => (
            <article key={`${donation.donorName}-${donation.donationDate}-${donation.amountLabel}`} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="space-y-2 text-sm text-zinc-700">
                <p><span className="font-semibold text-zinc-900">Doador:</span> {donation.donorName}</p>
                <p><span className="font-semibold text-zinc-900">Data da doação:</span> {donation.donationDate}</p>
                <p><span className="font-semibold text-zinc-900">Valor:</span> {donation.amountLabel}</p>
                <p><span className="font-semibold text-zinc-900">Data da oferta:</span> {donation.offeringDate}</p>
                {donation.note ? <p><span className="font-semibold text-zinc-900">Observação:</span> {donation.note}</p> : null}
              </div>
            </article>
          ))}
        </section>
      )}

      {publicDonations.length > 0 ? (
        <section className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm lg:block">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm text-zinc-700">
            <thead className="bg-zinc-50 text-xs uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Doador</th>
                <th className="px-5 py-4 font-semibold">Data da doação</th>
                <th className="px-5 py-4 font-semibold">Valor</th>
                <th className="px-5 py-4 font-semibold">Data da oferta</th>
                <th className="px-5 py-4 font-semibold">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {publicDonations.map((donation) => (
                <tr key={`${donation.donorName}-${donation.donationDate}-${donation.amountLabel}`}>
                  <td className="px-5 py-4 font-medium text-zinc-900">{donation.donorName}</td>
                  <td className="px-5 py-4">{donation.donationDate}</td>
                  <td className="px-5 py-4">{donation.amountLabel}</td>
                  <td className="px-5 py-4">{donation.offeringDate}</td>
                  <td className="px-5 py-4">{donation.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <div>
        <Link
          href="/sobre"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          Voltar para Sobre
        </Link>
      </div>
    </main>
  );
}
