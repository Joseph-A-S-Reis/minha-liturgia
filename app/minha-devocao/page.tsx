import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CalendarIcon, CheckCircleIcon, SparkIcon } from "@/app/components/icons";
import { DEVOTION_TYPE_LABELS, DEVOTION_TYPES } from "@/lib/devotion/planner";
import { CampaignForm } from "./campaign-form";
import { getUserDevotionCampaignsAction } from "./actions";

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

export default async function MinhaDevocaoPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/entrar");
  }

  const campaigns = await getUserDevotionCampaignsAction();

  const grouped = new Map<string, typeof campaigns>();
  for (const type of DEVOTION_TYPES) {
    grouped.set(type, campaigns.filter((campaign) => campaign.type === type));
  }

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2">
          <SparkIcon className="size-8" /> Minha Devoção
        </h1>
        <p className="text-zinc-600">
          Organize campanhas de penitência, jejum, oração, abstinência e confissão, com lembretes,
          versículo diário e acompanhamento espiritual.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">Adicionar campanha</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Defina o tipo, propósito, duração e antecedências de lembrete para começar.
        </p>

        <div className="mt-4">
          <CampaignForm />
        </div>
      </section>

      {DEVOTION_TYPES.map((type) => {
        const typeCampaigns = grouped.get(type) ?? [];

        return (
          <section key={type} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
                <CalendarIcon className="size-5 text-emerald-700" /> {DEVOTION_TYPE_LABELS[type]}
              </h2>
              <span className="text-xs font-medium text-zinc-600">{typeCampaigns.length} campanha(s)</span>
            </div>

            {typeCampaigns.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600">Nenhuma campanha deste tipo ainda.</p>
            ) : (
              <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                {typeCampaigns.map((campaign) => (
                  <li key={campaign.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{campaign.name}</p>
                        <p className="mt-1 text-xs text-zinc-600">{campaign.purpose}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        {campaign.progressPercent}%
                      </span>
                    </div>

                    {campaign.description ? (
                      <p className="mt-2 text-sm text-zinc-700 line-clamp-2">{campaign.description}</p>
                    ) : null}

                    {campaign.priestName ? (
                      <p className="mt-2 text-xs text-zinc-600">Padre: {campaign.priestName}</p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                      {campaign.type === "confissao" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-0.5">
                          <CheckCircleIcon className="size-3.5 text-emerald-700" />
                          {campaign.confessionItemsConfessed}/{campaign.confessionItemsTotal} confessados
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-0.5">
                          <CheckCircleIcon className="size-3.5 text-emerald-700" /> {campaign.checkedInDays}/
                          {campaign.durationDays}
                        </span>
                      )}

                      {campaign.type !== "confissao" && campaign.conditionCount > 0 ? (
                        <span className="rounded-full border border-zinc-300 bg-white px-2 py-0.5">
                          {campaign.conditionCount} condição(ões)
                        </span>
                      ) : null}

                      {campaign.reminderMinutes.length > 0 ? (
                        <span className="rounded-full border border-zinc-300 bg-white px-2 py-0.5">
                          Lembretes: {campaign.reminderMinutes.map(formatReminderLabel).join(", ")}
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-300 bg-white px-2 py-0.5">
                          Sem lembretes
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <Link
                        href={`/minha-devocao/${campaign.id}`}
                        className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                      >
                        Abrir campanha
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
