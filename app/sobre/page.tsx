import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  HeartIcon,
  InfoIcon,
  MessageSquareIcon,
  ShareIcon,
} from "@/app/components/icons";
import { ContactForm } from "./contact-form";
import {
  creatorSection,
  donationIntro,
  donationMethods,
  purposeSection,
} from "./content";
import { DonationMethods } from "./donation-methods";

export const metadata: Metadata = {
  title: "Sobre | Minha Liturgia",
  description:
    "Conheça a história do Minha Liturgia, seu propósito, as formas de doação voluntária e um canal de contato direto.",
};

function SectionCard({
  icon,
  eyebrow,
  title,
  paragraphs,
  highlights,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  highlights?: string[];
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-sky-100 p-3 text-[#003366]">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900">{title}</h2>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm leading-6 text-zinc-600 sm:text-base">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {highlights?.length ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {highlights.map((highlight) => (
            <li key={highlight} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              {highlight}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function SobrePage() {
  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <section className="space-y-5">
        <p className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          <InfoIcon className="mr-1 inline size-3.5" />
          Página Sobre
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Transparência, propósito e um canal simples de contato.
        </h1>
        <p className="max-w-3xl text-pretty text-zinc-600 sm:text-lg">
          Esta página reúne a apresentação do criador da aplicação, a visão que sustenta o projeto,
          as formas de doação voluntária e um espaço para você enviar uma mensagem ou sugestão.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          icon={<InfoIcon className="size-6" />}
          eyebrow="Identidade"
          title={creatorSection.title}
          paragraphs={creatorSection.paragraphs}
          highlights={creatorSection.highlights}
        />
        <SectionCard
          icon={<ShareIcon className="size-6" />}
          eyebrow="Missão"
          title={purposeSection.title}
          paragraphs={purposeSection.paragraphs}
        />
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Generosidade
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <HeartIcon className="size-5 text-emerald-700" />
              {donationIntro.title}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-600 sm:text-base">
              {donationIntro.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          <Link
            href="/doacoes"
            className="inline-flex h-fit items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            <HeartIcon className="size-4" />
            Ver página de doações
          </Link>
        </div>

        <div className="mt-6">
          <DonationMethods methods={donationMethods} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Contato
          </p>
          <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <MessageSquareIcon className="size-5 text-emerald-700" />
            Envie sua mensagem
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600 sm:text-base">
            Use este espaço para sugestões, dúvidas, correções ou uma palavra fraterna. As mensagens
            seguem diretamente por e-mail para o responsável pela aplicação.
          </p>
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Não há arquivamento dos emails no envio, garantindo privacidade e segurança para os usuários enviarem suas mensagens.
          </div>
        </div>

        <ContactForm />
      </section>
    </main>
  );
}
