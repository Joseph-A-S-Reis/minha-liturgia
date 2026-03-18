"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePublishedLibraryResourceAction } from "@/app/biblioteca/actions";
import { ArticleRichEditor } from "@/app/biblioteca/article-rich-editor";

type ResourceType = "article" | "book" | "document";
type CategoryItem = {
  id: string;
  name: string;
};

type Props = {
  resource: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    contentMarkdown: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    resourceType: ResourceType;
    isOfficialChurchSource: boolean;
    categoryIds: string[];
  };
  categories: CategoryItem[];
};

const TYPE_CONFIG: Record<
  ResourceType,
  {
    label: string;
    requiresSourceUrl: boolean;
    usesHtmlEditor: boolean;
  }
> = {
  article: {
    label: "Artigo",
    requiresSourceUrl: false,
    usesHtmlEditor: true,
  },
  book: {
    label: "Livro",
    requiresSourceUrl: true,
    usesHtmlEditor: false,
  },
  document: {
    label: "Documento",
    requiresSourceUrl: true,
    usesHtmlEditor: false,
  },
};

export function EditResourceForm({ resource, categories }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(resource.title);
  const [summary, setSummary] = useState(resource.summary ?? "");
  const [articleHtml, setArticleHtml] = useState(resource.contentMarkdown ?? "");
  const [sourceName, setSourceName] = useState(resource.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(resource.sourceUrl ?? "");
  const [isOfficialChurchSource, setIsOfficialChurchSource] = useState(resource.isOfficialChurchSource);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(resource.categoryIds);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const typeConfig = TYPE_CONFIG[resource.resourceType];

  const isFormComplete = (() => {
    const hasTitle = title.trim().length >= 4;
    const hasSummary = summary.trim().length > 0;

    if (typeConfig.usesHtmlEditor && articleHtml.trim().length === 0) {
      return false;
    }

    if (!typeConfig.usesHtmlEditor && sourceName.trim().length === 0) {
      return false;
    }

    if (typeConfig.requiresSourceUrl) {
      try {
        const normalized = sourceUrl.trim();
        if (!normalized) return false;
        new URL(normalized);
      } catch {
        return false;
      }
    }

    return hasTitle && hasSummary;
  })();

  return (
    <div className="space-y-5">
      <form
        className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          setStatus("");

          if (!isFormComplete) {
            setStatus("Preencha os campos obrigatórios antes de salvar.");
            return;
          }

          startTransition(async () => {
            try {
              const result = await updatePublishedLibraryResourceAction({
                resourceId: resource.id,
                title,
                summary,
                contentMarkdown: typeConfig.usesHtmlEditor ? articleHtml : undefined,
                resourceType: resource.resourceType,
                sourceName: typeConfig.usesHtmlEditor ? undefined : sourceName,
                sourceUrl: typeConfig.requiresSourceUrl ? sourceUrl : undefined,
                isOfficialChurchSource,
                categoryIds: selectedCategoryIds,
                idempotencyKey: crypto.randomUUID(),
              });

              if (!result.ok) {
                throw new Error("Não foi possível salvar as alterações.");
              }

              if (result.deduped) {
                setStatus("Requisição duplicada detectada. Recarregue a página para confirmar o estado atual.");
                return;
              }

              if (!result.slug) {
                throw new Error("Edição concluída sem slug de retorno.");
              }

              router.push(`/biblioteca/${result.slug}`);
              router.refresh();
            } catch (error) {
              setStatus(error instanceof Error ? error.message : "Falha ao salvar alterações.");
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
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={4}
              maxLength={220}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-zinc-700">
            Tipo de conteúdo
            <input
              value={typeConfig.label}
              disabled
              className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-600"
            />
          </label>
        </div>

        {!typeConfig.usesHtmlEditor ? (
          <label className="space-y-1 text-sm font-medium text-zinc-700">
            Fonte *
            <input
              name="sourceName"
              required
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              maxLength={140}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
            />
          </label>
        ) : null}

        {typeConfig.requiresSourceUrl ? (
          <label className="space-y-1 text-sm font-medium text-zinc-700">
            URL da fonte *
            <input
              name="sourceUrl"
              type="url"
              required
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
            />
          </label>
        ) : null}

        <label className="space-y-1 text-sm font-medium text-zinc-700">
          Resumo *
          <textarea
            name="summary"
            required
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
          />
        </label>

        {typeConfig.usesHtmlEditor ? (
          <ArticleRichEditor value={articleHtml} onChange={setArticleHtml} initialMode="rtf" />
        ) : null}

        <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            className="size-4 rounded border-zinc-300"
            checked={isOfficialChurchSource}
            onChange={(event) => setIsOfficialChurchSource(event.target.checked)}
          />
          É conteúdo oficial da Igreja
        </label>

        {categories.length > 0 ? (
          <fieldset className="rounded-xl border border-zinc-200 p-3">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Categorias
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {categories.map((category) => {
                const checked = selectedCategoryIds.includes(category.id);

                return (
                  <label key={category.id} className="inline-flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-zinc-300"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedCategoryIds((current) => Array.from(new Set([...current, category.id])));
                          return;
                        }

                        setSelectedCategoryIds((current) => current.filter((item) => item !== category.id));
                      }}
                    />
                    {category.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {status ? <p className="text-sm font-medium text-red-600">{status}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !isFormComplete}
            className="inline-flex rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Salvando..." : "Salvar alterações"}
          </button>

          <Link
            href={`/biblioteca/${resource.slug}`}
            className="inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Cancelar
          </Link>
        </div>
      </form>

    </div>
  );
}
