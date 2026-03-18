"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAndPublishLibraryResourceAction } from "@/app/biblioteca/actions";
import { ArticleRichEditor } from "@/app/biblioteca/article-rich-editor";

type ResourceType = "article" | "book" | "document";
type AssetKind = "pdf" | "docx" | "epub";
type CategoryItem = {
  id: string;
  name: string;
};

type Props = {
  categories: CategoryItem[];
};

type UploadedAsset = {
  kind: AssetKind;
  title: string;
  mimeType: string;
  storageObjectKey: string;
  externalUrl?: string;
  byteSize?: number;
};

type PrepublishUploadResponse = {
  ok: boolean;
  alreadyExists?: boolean;
  warningCode?: string;
  warnings?: string[];
  asset?: UploadedAsset;
};

const TYPE_CONFIG: Record<
  ResourceType,
  {
    label: string;
    uploadHint: string;
    allowedLabel: string;
    requiresUpload: boolean;
    requiresSourceUrl: boolean;
    usesHtmlEditor: boolean;
  }
> = {
  article: {
    label: "Artigo",
    uploadHint: "Artigo usa editor HTML integrado e não exige upload de arquivo.",
    allowedLabel: "Sem upload",
    requiresUpload: false,
    requiresSourceUrl: false,
    usesHtmlEditor: true,
  },
  book: {
    label: "Livro",
    uploadHint: "Livro exige upload de arquivo editorial.",
    allowedLabel: "PDF, DOCX e EPUB",
    requiresUpload: true,
    requiresSourceUrl: true,
    usesHtmlEditor: false,
  },
  document: {
    label: "Documento",
    uploadHint: "Documento exige upload de arquivo editorial.",
    allowedLabel: "PDF, DOCX e EPUB",
    requiresUpload: true,
    requiresSourceUrl: true,
    usesHtmlEditor: false,
  },
};

export function NewResourceForm({ categories }: Props) {
  const router = useRouter();
  const [resourceType, setResourceType] = useState<ResourceType>("article");
  const [title, setTitle] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [articleHtml, setArticleHtml] = useState("");
  const [status, setStatus] = useState<string>("");
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadedAsset, setUploadedAsset] = useState<UploadedAsset | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localPreviewKind, setLocalPreviewKind] = useState<AssetKind | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const [isPending, startTransition] = useTransition();

  const typeConfig = useMemo(() => TYPE_CONFIG[resourceType], [resourceType]);

  function getAllowedKindsByResourceType(value: ResourceType): AssetKind[] {
    if (value === "article") {
      return [];
    }

    return ["pdf", "docx", "epub"];
  }

  function acceptFromKinds(kinds: AssetKind[]) {
    const map: Record<AssetKind, string[]> = {
      pdf: ["application/pdf", ".pdf"],
      docx: [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".docx",
      ],
      epub: ["application/epub+zip", ".epub"],
    };

    return kinds.flatMap((kind) => map[kind]).join(",");
  }

  function detectKindFromFile(file: File): AssetKind | null {
    const fileName = file.name.toLowerCase();
    const mimeType = (file.type || "").toLowerCase();

    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      return "pdf";
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      return "docx";
    }

    if (mimeType === "application/epub+zip" || fileName.endsWith(".epub")) {
      return "epub";
    }

    return null;
  }

  const allowedKinds = getAllowedKindsByResourceType(resourceType);
  const uploadAccept = acceptFromKinds(allowedKinds);

  const isFormComplete = useMemo(() => {
    const hasTitle = title.trim().length >= 4;
    const hasSourceName = typeConfig.usesHtmlEditor || sourceName.trim().length > 0;
    const hasSummary = summary.trim().length > 0;

    let hasValidSourceUrl = true;
    if (typeConfig.requiresSourceUrl) {
      const value = sourceUrl.trim();
      if (!value) {
        hasValidSourceUrl = false;
      } else {
        try {
          new URL(value);
        } catch {
          hasValidSourceUrl = false;
        }
      }
    }

    const hasArticleHtml = !typeConfig.usesHtmlEditor || articleHtml.trim().length > 0;
    const hasUpload = !typeConfig.requiresUpload || Boolean(uploadedAsset);

    return hasTitle && hasSourceName && hasSummary && hasValidSourceUrl && hasArticleHtml && hasUpload;
  }, [articleHtml, sourceName, sourceUrl, summary, title, typeConfig, uploadedAsset]);

  useEffect(() => {
    if (!selectedFile || !typeConfig.requiresUpload) {
      setLocalPreviewUrl(null);
      setLocalPreviewKind(null);
      return;
    }

    const detectedKind = detectKindFromFile(selectedFile);
    if (!detectedKind) {
      setLocalPreviewUrl(null);
      setLocalPreviewKind(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);

    setLocalPreviewKind(detectedKind);
    setLocalPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile, typeConfig.requiresUpload]);

  return (
    <div className="space-y-5">
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
              const articleHtml = String(formData.get("articleHtml") ?? "").trim();
              const sourceName = String(formData.get("sourceName") ?? "").trim();
              const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
              const isOfficialChurchSource =
                String(formData.get("isOfficialChurchSource") ?? "") === "on";
              const categoryIds = formData
                .getAll("categoryIds")
                .map((value) => String(value).trim())
                .filter(Boolean);

              if (typeConfig.requiresUpload && !uploadedAsset) {
                throw new Error("Faça o upload do arquivo para o Cloud Storage antes de publicar.");
              }

              if (!isFormComplete) {
                throw new Error("Preencha todos os campos obrigatórios antes de publicar.");
              }

              const result = await createAndPublishLibraryResourceAction({
                title,
                summary: summary || undefined,
                contentMarkdown: typeConfig.usesHtmlEditor ? articleHtml || undefined : undefined,
                resourceType,
                sourceName: sourceName || undefined,
                sourceUrl: typeConfig.requiresSourceUrl ? sourceUrl || undefined : undefined,
                isOfficialChurchSource,
                categoryIds,
                uploadedAsset: typeConfig.requiresUpload ? uploadedAsset ?? undefined : undefined,
                idempotencyKey: crypto.randomUUID(),
              });

              if (!result.ok) {
                throw new Error(result.error || "Não foi possível publicar o conteúdo.");
              }

              if (result.deduped) {
                setStatus("Requisição duplicada detectada. Aguarde e verifique a Biblioteca.");
                return;
              }

              if (!result.slug) {
                throw new Error("Publicação concluída sem slug de retorno. Tente novamente.");
              }

              router.push(`/biblioteca/${result.slug}`);
              router.refresh();
            } catch (error) {
              setStatus(error instanceof Error ? error.message : "Falha ao publicar conteúdo.");
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
              placeholder="Ex.: O que é a Eucaristia"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-zinc-700">
            Tipo de conteúdo
            <select
              name="resourceType"
              value={resourceType}
              onChange={(event) => {
                const nextType = event.target.value as ResourceType;
                setResourceType(nextType);
                setUploadedAsset(null);
                setSelectedFile(null);

                if (TYPE_CONFIG[nextType].requiresUpload) {
                  setUploadStatus("Tipo alterado. Selecione e envie um arquivo compatível.");
                } else {
                  setUploadStatus("");
                }
              }}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
            >
              <option value="article">Artigo</option>
              <option value="book">Livro</option>
              <option value="document">Documento</option>
            </select>
          </label>

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
                placeholder="Ex.: Vatican News"
              />
            </label>
          ) : null}
        </div>

        <div className="text-xs text-zinc-600">
          <p>
            Tipo selecionado: <span className="font-semibold text-zinc-700">{typeConfig.label}</span>
          </p>
          <p className="mt-1">Upload esperado: {typeConfig.allowedLabel}</p>
        </div>

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
              placeholder="https://..."
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
            placeholder="Resumo rápido para card/listagem"
          />
        </label>

        {typeConfig.usesHtmlEditor ? (
          <ArticleRichEditor value={articleHtml} onChange={setArticleHtml} initialMode="rtf" />
        ) : (
          <div className="text-xs text-zinc-600">{typeConfig.uploadHint}</div>
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

        {typeConfig.requiresUpload ? (
          <section id="upload" className="space-y-3 rounded-xl border border-zinc-200 p-4">
            <h2 className="text-base font-semibold text-zinc-900">Upload do arquivo (obrigatório)</h2>
            <p className="text-xs text-zinc-600">
              Publicação liberada após upload confirmado no Cloud Storage. Formatos aceitos: {typeConfig.allowedLabel}.
            </p>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="space-y-1 text-sm font-medium text-zinc-700" htmlFor="library-file-prepublish">
                Arquivo do conteúdo
                <input
                  id="library-file-prepublish"
                  name="file"
                  type="file"
                  accept={uploadAccept}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                  onChange={(event) => {
                    const nextFile = event.currentTarget.files?.[0] ?? null;
                    setSelectedFile(nextFile);
                    setUploadedAsset(null);
                    setUploadStatus(
                      nextFile ? "Arquivo carregado da máquina. Confira a pré-visualização abaixo." : "",
                    );
                  }}
                />
              </label>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  const file = selectedFile;

                  if (!file) {
                    setUploadStatus("Selecione um arquivo antes de enviar.");
                    return;
                  }

                  const payload = new FormData();
                  payload.append("resourceType", resourceType);
                  payload.append("file", file);

                  startUploadTransition(async () => {
                    try {
                      setUploadStatus("Enviando arquivo para o Cloud Storage...");
                      const response = await fetch("/api/biblioteca/assets/prepublish-upload", {
                        method: "POST",
                        body: payload,
                      });

                      if (!response.ok) {
                        const err = await response.json().catch(() => ({}));
                        throw new Error(String(err?.error || "Falha no upload."));
                      }

                      const result = (await response.json()) as PrepublishUploadResponse;

                      if (!result.ok || !result.asset) {
                        throw new Error("Não foi possível confirmar o upload.");
                      }

                      setUploadedAsset(result.asset);

                      if (result.warningCode && result.warnings?.length) {
                        setUploadStatus(
                          `Upload concluído com avisos (${result.warningCode}): ${result.warnings.join(" | ")}`,
                        );
                        return;
                      }

                      setUploadStatus(
                        result.alreadyExists
                          ? "Arquivo já existente no Cloud Storage encontrado e reutilizado. Publicação liberada."
                          : "Upload concluído com sucesso. Publicação liberada.",
                      );
                    } catch (cause) {
                      setUploadedAsset(null);
                      setUploadStatus(
                        cause instanceof Error ? cause.message : "Falha inesperada ao enviar arquivo.",
                      );
                    }
                  });
                }}
                className="inline-flex rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUploading ? "Enviando..." : "Enviar para o Cloud Storage"}
              </button>
            </div>

            {uploadedAsset ? (
              <p className="text-xs font-medium text-zinc-700">
                Upload confirmado: {uploadedAsset.title} ({uploadedAsset.kind})
              </p>
            ) : (
              <p className="text-xs text-zinc-600">Publicação bloqueada até o upload ser concluído.</p>
            )}

            {uploadStatus ? <p className="text-xs font-medium text-zinc-700">{uploadStatus}</p> : null}
          </section>
        ) : null}

        {status ? (
          <p
            className={`text-sm font-medium ${
              status.toLowerCase().includes("sucesso") ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {status}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !isFormComplete}
            className="inline-flex rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Publicando..." : "Publicar conteúdo"}
          </button>
          <Link
            href="/biblioteca"
            className="inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Cancelar
          </Link>
        </div>
      </form>

      {typeConfig.requiresUpload && localPreviewUrl && localPreviewKind ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Pré-visualização do arquivo</h2>
          <p className="mt-1 text-xs text-zinc-600">Prévia do arquivo carregado da sua máquina.</p>

          {localPreviewKind === "pdf" ? (
            <div className="mt-3 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <iframe title="Pré-visualização PDF local" src={localPreviewUrl} className="h-[70vh] w-full" />
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">
              Pré-visualização não disponível para {localPreviewKind.toUpperCase()} no navegador.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
