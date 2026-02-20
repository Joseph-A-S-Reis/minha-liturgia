"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLibraryResourceDraftAction } from "@/app/biblioteca/actions";

type ResourceType = "article" | "book" | "video" | "audio" | "document" | "html";

type CategoryItem = {
  id: string;
  name: string;
};

type Props = {
  categories: CategoryItem[];
};

const TYPE_CONFIG: Record<
  ResourceType,
  {
    label: string;
    uploadHint: string;
    allowedLabel: string;
    supportsMarkdown: boolean;
  }
> = {
  article: {
    label: "Artigo",
    uploadHint: "Aceita mídias complementares (HTML, PDF, imagem, vídeo e áudio).",
    allowedLabel: "HTML, PDF, imagem, vídeo e áudio",
    supportsMarkdown: true,
  },
  book: {
    label: "Livro",
    uploadHint: "Aceita principal em PDF/HTML e mídias complementares.",
    allowedLabel: "PDF, HTML, imagem, vídeo e áudio",
    supportsMarkdown: true,
  },
  html: {
    label: "Página HTML",
    uploadHint: "Conteúdo principal deve ser uma página HTML baixada (.html/.htm).",
    allowedLabel: "HTML (.html/.htm)",
    supportsMarkdown: false,
  },
  document: {
    label: "Documento (PDF)",
    uploadHint: "Conteúdo principal deve ser um arquivo PDF.",
    allowedLabel: "PDF",
    supportsMarkdown: false,
  },
  audio: {
    label: "Áudio",
    uploadHint: "Conteúdo principal deve ser um arquivo de áudio compatível.",
    allowedLabel: "Áudio",
    supportsMarkdown: false,
  },
  video: {
    label: "Vídeo",
    uploadHint: "Conteúdo principal deve ser um arquivo de vídeo compatível.",
    allowedLabel: "Vídeo",
    supportsMarkdown: false,
  },
};

export function NewResourceForm({ categories }: Props) {
  const router = useRouter();
  const [resourceType, setResourceType] = useState<ResourceType>("article");
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const typeConfig = useMemo(() => TYPE_CONFIG[resourceType], [resourceType]);

  return (
    <form
      className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setStatus("");

        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
          try {
            const title = String(formData.get("title") ?? "").trim();
            const summary = String(formData.get("summary") ?? "").trim();
            const contentMarkdown = String(formData.get("contentMarkdown") ?? "").trim();
            const level = String(formData.get("level") ?? "basic").trim();
            const sourceName = String(formData.get("sourceName") ?? "").trim();
            const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
            const isOfficialChurchSource =
              String(formData.get("isOfficialChurchSource") ?? "") === "on";
            const categoryIds = formData
              .getAll("categoryIds")
              .map((value) => String(value).trim())
              .filter(Boolean);

            const result = await createLibraryResourceDraftAction({
              title,
              summary: summary || undefined,
              contentMarkdown: TYPE_CONFIG[resourceType].supportsMarkdown
                ? contentMarkdown || undefined
                : undefined,
              resourceType,
              level,
              sourceName: sourceName || undefined,
              sourceUrl: sourceUrl || undefined,
              isOfficialChurchSource,
              categoryIds,
              idempotencyKey: crypto.randomUUID(),
            });

            if (!result.ok || !result.id) {
              throw new Error("Não foi possível criar o conteúdo.");
            }

            router.push(`/biblioteca/upload?resourceId=${result.id}`);
            router.refresh();
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Falha ao criar conteúdo.");
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-zinc-700">
          Título *
          <input
            name="title"
            required
            minLength={4}
            maxLength={220}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
            placeholder="Ex.: O que é a Eucaristia"
          />
        </label>

        <label className="space-y-1 text-sm font-medium text-zinc-700">
          Tipo
          <select
            name="resourceType"
            value={resourceType}
            onChange={(event) => setResourceType(event.target.value as ResourceType)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
          >
            <option value="article">Artigo</option>
            <option value="book">Livro</option>
            <option value="video">Vídeo</option>
            <option value="audio">Áudio</option>
            <option value="document">Documento</option>
            <option value="html">Página HTML</option>
          </select>
        </label>

        <label className="space-y-1 text-sm font-medium text-zinc-700">
          Nível
          <select
            name="level"
            defaultValue="basic"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
          >
            <option value="basic">Básico</option>
            <option value="intermediate">Intermediário</option>
            <option value="advanced">Avançado</option>
          </select>
        </label>

        <label className="space-y-1 text-sm font-medium text-zinc-700">
          Fonte
          <input
            name="sourceName"
            maxLength={140}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
            placeholder="Ex.: Vatican News"
          />
        </label>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        <p className="font-semibold">Configuração do tipo: {typeConfig.label}</p>
        <p className="mt-1">{typeConfig.uploadHint}</p>
        <p className="mt-1">
          <span className="font-semibold">Upload principal esperado:</span> {typeConfig.allowedLabel}
        </p>
      </div>

      <label className="space-y-1 text-sm font-medium text-zinc-700">
        URL da fonte
        <input
          name="sourceUrl"
          type="url"
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
          placeholder="https://..."
        />
      </label>

      <label className="space-y-1 text-sm font-medium text-zinc-700">
        Resumo
        <textarea
          name="summary"
          maxLength={2000}
          rows={3}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
          placeholder="Resumo rápido para card/listagem"
        />
      </label>

      {typeConfig.supportsMarkdown ? (
        <label className="space-y-1 text-sm font-medium text-zinc-700">
          Conteúdo (markdown)
          <textarea
            name="contentMarkdown"
            maxLength={120000}
            rows={10}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
            placeholder="Escreva aqui o conteúdo principal..."
          />
        </label>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Este tipo de conteúdo não utiliza campo de markdown. O conteúdo principal virá do arquivo enviado na etapa de upload.
        </div>
      )}

      <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input type="checkbox" name="isOfficialChurchSource" className="size-4 rounded border-zinc-300" />
        É conteúdo oficial da Igreja
      </label>

      {categories.length > 0 ? (
        <fieldset className="rounded-xl border border-zinc-200 p-3">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Categorias
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <label key={category.id} className="inline-flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  className="size-4 rounded border-zinc-300"
                />
                {category.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {status ? <p className="text-sm font-medium text-red-600">{status}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Criando..." : "Publicar conteúdo e ir para upload"}
        </button>
        <Link
          href="/biblioteca"
          className="inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
