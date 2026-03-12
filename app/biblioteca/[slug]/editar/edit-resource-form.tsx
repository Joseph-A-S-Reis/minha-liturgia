"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { updatePublishedLibraryResourceAction } from "@/app/biblioteca/actions";
import { buildLocalHtmlPreviewDocument } from "@/app/biblioteca/article-preview";

type ResourceType = "article" | "book" | "document";
type ArticleEditorMode = "html" | "rtf";

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
  const [articleEditorMode, setArticleEditorMode] = useState<ArticleEditorMode>(
    resource.resourceType === "article" ? "rtf" : "html",
  );
  const [sourceName, setSourceName] = useState(resource.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(resource.sourceUrl ?? "");
  const [isOfficialChurchSource, setIsOfficialChurchSource] = useState(resource.isOfficialChurchSource);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(resource.categoryIds);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const previousEditorModeRef = useRef<ArticleEditorMode>(
    resource.resourceType === "article" ? "rtf" : "html",
  );

  const articleEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Highlight,
      LinkExtension.configure({
        autolink: true,
        openOnClick: false,
        protocols: ["https", "http", "mailto"],
      }),
      Placeholder.configure({
        placeholder:
          "Edite o artigo com formatação rica (títulos, listas, links, citações, etc.)...",
      }),
    ],
    content: resource.contentMarkdown ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[340px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 text-zinc-800 outline-none ring-sky-500 focus:ring",
      },
    },
    onUpdate: ({ editor }) => {
      setArticleHtml(editor.getHTML());
    },
  });

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

  useEffect(() => {
    if (!articleEditor) {
      return;
    }

    const previousMode = previousEditorModeRef.current;
    const switchedToRtf = previousMode !== "rtf" && articleEditorMode === "rtf";

    if (switchedToRtf) {
      const normalized = articleHtml.trim() ? articleHtml : "<p></p>";
      articleEditor.commands.setContent(normalized, { emitUpdate: false });
    }

    previousEditorModeRef.current = articleEditorMode;
  }, [articleEditor, articleEditorMode, articleHtml]);

  function promptAndApplyLink() {
    if (!articleEditor) return;

    const previousHref = articleEditor.getAttributes("link").href as string | undefined;
    const nextHref = window.prompt("Informe a URL do link", previousHref ?? "https://");

    if (nextHref === null) {
      return;
    }

    const normalized = nextHref.trim();

    if (!normalized) {
      articleEditor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    articleEditor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
  }

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
          <div className="space-y-1 text-sm font-medium text-zinc-700">
            <p>Conteúdo do Artigo</p>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Editor</span>
              <button
                type="button"
                onClick={() => setArticleEditorMode("rtf")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  articleEditorMode === "rtf"
                    ? "bg-sky-700 text-white"
                    : "bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                RTF (Tiptap)
              </button>
              <button
                type="button"
                onClick={() => setArticleEditorMode("html")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  articleEditorMode === "html"
                    ? "bg-sky-700 text-white"
                    : "bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                HTML
              </button>
            </div>

            {articleEditorMode === "rtf" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                  <EditorToolbarButton
                    onClick={() => articleEditor?.chain().focus().toggleHeading({ level: 1 }).run()}
                    active={Boolean(articleEditor?.isActive("heading", { level: 1 }))}
                  >
                    H1
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={() => articleEditor?.chain().focus().toggleHeading({ level: 2 }).run()}
                    active={Boolean(articleEditor?.isActive("heading", { level: 2 }))}
                  >
                    H2
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={() => articleEditor?.chain().focus().toggleBold().run()}
                    active={Boolean(articleEditor?.isActive("bold"))}
                  >
                    Negrito
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={() => articleEditor?.chain().focus().toggleItalic().run()}
                    active={Boolean(articleEditor?.isActive("italic"))}
                  >
                    Itálico
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={() => articleEditor?.chain().focus().toggleStrike().run()}
                    active={Boolean(articleEditor?.isActive("strike"))}
                  >
                    Riscado
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={() => articleEditor?.chain().focus().toggleHighlight().run()}
                    active={Boolean(articleEditor?.isActive("highlight"))}
                  >
                    Marca-texto
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={() => articleEditor?.chain().focus().toggleBulletList().run()}
                    active={Boolean(articleEditor?.isActive("bulletList"))}
                  >
                    Lista
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={() => articleEditor?.chain().focus().toggleOrderedList().run()}
                    active={Boolean(articleEditor?.isActive("orderedList"))}
                  >
                    Lista num.
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={() => articleEditor?.chain().focus().toggleBlockquote().run()}
                    active={Boolean(articleEditor?.isActive("blockquote"))}
                  >
                    Citação
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={() => articleEditor?.chain().focus().toggleCodeBlock().run()}
                    active={Boolean(articleEditor?.isActive("codeBlock"))}
                  >
                    Código
                  </EditorToolbarButton>
                  <EditorToolbarButton onClick={() => articleEditor?.chain().focus().setHorizontalRule().run()}>
                    Linha
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={promptAndApplyLink}
                    active={Boolean(articleEditor?.isActive("link"))}
                  >
                    Link
                  </EditorToolbarButton>
                  <EditorToolbarButton onClick={() => articleEditor?.chain().focus().unsetLink().run()}>
                    Remover link
                  </EditorToolbarButton>
                  <EditorToolbarButton onClick={() => articleEditor?.chain().focus().undo().run()}>
                    Desfazer
                  </EditorToolbarButton>
                  <EditorToolbarButton onClick={() => articleEditor?.chain().focus().redo().run()}>
                    Refazer
                  </EditorToolbarButton>
                </div>

                <input type="hidden" name="articleHtml" value={articleHtml} />
                <EditorContent editor={articleEditor} />
              </div>
            ) : (
              <textarea
                name="articleHtml"
                maxLength={120000}
                rows={14}
                required
                value={articleHtml}
                onChange={(event) => setArticleHtml(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 font-mono text-sm outline-none ring-sky-500 focus:ring"
                placeholder="<article><h1>Título</h1><p>Edite o artigo em HTML puro...</p></article>"
              />
            )}

            <p className="text-xs text-zinc-500">
              Você pode alternar entre RTF e HTML. Scripts, estilos e atributos visuais serão
              removidos automaticamente por segurança.
            </p>
          </div>
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

      {typeConfig.usesHtmlEditor && articleHtml.trim() ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Pré-visualização do artigo (HTML)</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Prévia sanitizada para revisão antes de salvar as alterações.
          </p>

          <div className="mt-3 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <iframe
              title="Pré-visualização do artigo"
              srcDoc={buildLocalHtmlPreviewDocument(articleHtml)}
              className="h-[70vh] w-full"
              sandbox="allow-same-origin"
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

type EditorToolbarButtonProps = {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
};

function EditorToolbarButton({ children, onClick, active = false }: EditorToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-sky-300 bg-sky-100 text-sky-900"
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
