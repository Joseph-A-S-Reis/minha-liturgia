"use client";

import { Node, mergeAttributes, type Editor as CoreEditor } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import { buildLocalHtmlPreviewDocument } from "@/app/biblioteca/article-preview";
import {
  detectArticleMediaKindFromFile,
  inferArticleInlineMediaFromUrl,
  isArticleMediaFile,
  parseHttpUrl,
  type ArticleInlineMediaKind,
} from "@/lib/library/article-editor-media";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    articleImage: {
      setArticleImage: (attributes: { src: string; alt?: string; title?: string }) => ReturnType;
    };
    articleMedia: {
      setArticleMedia: (attributes: {
        src: string;
        mediaType: "video" | "embed";
        title?: string;
      }) => ReturnType;
    };
  }
}

const ArticleImageNode = Node.create({
  name: "articleImage",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        loading: "lazy",
        referrerpolicy: "strict-origin-when-cross-origin",
      }),
    ];
  },

  addCommands() {
    return {
      setArticleImage:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
    };
  },
});

const ArticleMediaNode = Node.create({
  name: "articleMedia",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      mediaType: {
        default: "video",
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video[src]",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) {
            return false;
          }

          return {
            src: node.getAttribute("src"),
            mediaType: "video",
            title: node.getAttribute("title"),
          };
        },
      },
      {
        tag: "iframe[src]",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) {
            return false;
          }

          return {
            src: node.getAttribute("src"),
            mediaType: "embed",
            title: node.getAttribute("title"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attributes = HTMLAttributes as Record<string, unknown>;
    const mediaType = attributes.mediaType === "embed" ? "embed" : "video";
    const src = String(attributes.src ?? "");
    const title = String(attributes.title ?? (mediaType === "embed" ? "Vídeo incorporado" : "Vídeo"));
    const allow = String(
      attributes.allow ??
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    );

    if (mediaType === "embed") {
      return [
        "iframe",
        mergeAttributes(attributes, {
          allow,
          allowfullscreen: "true",
          frameborder: "0",
          loading: "lazy",
          referrerpolicy: "strict-origin-when-cross-origin",
          src,
          title,
        }),
      ];
    }

    return [
      "video",
      mergeAttributes(attributes, {
        controls: "true",
        playsinline: "true",
        preload: "metadata",
        src,
        title,
      }),
    ];
  },

  addCommands() {
    return {
      setArticleMedia:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
    };
  },
});

type UploadResponse = {
  ok: boolean;
  error?: string;
  warnings?: string[];
  warningCode?: string;
  media?: {
    kind: "image" | "video";
    title: string;
    mimeType: string;
    storageObjectKey: string;
    externalUrl: string;
    byteSize?: number;
  };
};

type ArticleEditorMode = "html" | "rtf";

type Props = {
  value: string;
  onChange: (value: string) => void;
  inputName?: string;
  initialMode?: ArticleEditorMode;
};

export function ArticleRichEditor({
  value,
  onChange,
  inputName = "articleHtml",
  initialMode = "rtf",
}: Props) {
  const [articleEditorMode, setArticleEditorMode] = useState<ArticleEditorMode>(initialMode);
  const [mediaStatus, setMediaStatus] = useState("");
  const [isUploadingMedia, startUploadTransition] = useTransition();
  const previousEditorModeRef = useRef<ArticleEditorMode>(initialMode);
  const editorRef = useRef<CoreEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editorExtensions = useMemo(
    () => [
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
          "Escreva o artigo com formatação rica (títulos, listas, links, citações, imagens e vídeos)...",
      }),
      ArticleImageNode,
      ArticleMediaNode,
    ],
    [],
  );

  const articleEditor = useEditor({
    extensions: editorExtensions,
    content: value.trim() ? value : "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[340px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 text-zinc-800 outline-none ring-sky-500 focus:ring",
      },
      handlePaste: (_view, event) => {
        const clipboardFiles = Array.from(event.clipboardData?.files ?? []).filter(isArticleMediaFile);
        if (clipboardFiles.length > 0) {
          void uploadFilesAndInsert(clipboardFiles);
          return true;
        }

        const pastedText = event.clipboardData?.getData("text/plain")?.trim();
        if (pastedText) {
          const inserted = insertMediaByUrl(pastedText);
          if (inserted) {
            return true;
          }
        }

        return false;
      },
      handleDrop: (_view, event) => {
        const droppedFiles = Array.from(event.dataTransfer?.files ?? []).filter(isArticleMediaFile);
        if (droppedFiles.length > 0) {
          void uploadFilesAndInsert(droppedFiles);
          return true;
        }

        const droppedUrl = event.dataTransfer?.getData("text/uri-list")?.trim();
        if (droppedUrl) {
          const inserted = insertMediaByUrl(droppedUrl);
          if (inserted) {
            return true;
          }
        }

        return false;
      },
    },
    onCreate: ({ editor }) => {
      editorRef.current = editor;
    },
    onDestroy: () => {
      editorRef.current = null;
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!articleEditor) {
      return;
    }

    const previousMode = previousEditorModeRef.current;
    const switchedToRtf = previousMode !== "rtf" && articleEditorMode === "rtf";

    if (switchedToRtf) {
      const normalized = value.trim() ? value : "<p></p>";
      articleEditor.commands.setContent(normalized, { emitUpdate: false });
    }

    previousEditorModeRef.current = articleEditorMode;
  }, [articleEditor, articleEditorMode, value]);

  function insertImage(src: string, alt?: string) {
    const activeEditor = editorRef.current;
    if (!activeEditor) return false;

    return activeEditor.chain().focus().setArticleImage({ src, alt }).run();
  }

  function insertVideo(src: string, mode: "video" | "embed", title?: string) {
    const activeEditor = editorRef.current;
    if (!activeEditor) return false;

    return activeEditor.chain().focus().setArticleMedia({ src, mediaType: mode, title }).run();
  }

  function insertMediaByUrl(rawUrl: string, preferredKind?: ArticleInlineMediaKind) {
    const normalized = rawUrl.trim();
    if (!normalized) {
      return false;
    }

    const inferred = inferArticleInlineMediaFromUrl(normalized);

    if (preferredKind === "image") {
      const parsed = parseHttpUrl(normalized);
      if (!parsed) {
        setMediaStatus("Informe uma URL válida para a imagem.");
        return false;
      }

      const inserted = insertImage(parsed.toString());
      if (inserted) {
        setMediaStatus("Imagem incorporada no editor.");
      }
      return inserted;
    }

    if (preferredKind === "video") {
      const parsed = parseHttpUrl(normalized);
      if (!parsed) {
        setMediaStatus("Informe uma URL válida para o vídeo.");
        return false;
      }

      const inserted = inferred
        ? inferred.kind === "embed"
          ? insertVideo(inferred.src, "embed", inferred.title)
          : insertVideo(inferred.src, "video", inferred.title)
        : insertVideo(parsed.toString(), "video", "Vídeo");

      if (inserted) {
        setMediaStatus(
          inferred?.kind === "embed"
            ? "Vídeo incorporado com player embutido."
            : "Vídeo incorporado no editor.",
        );
      }
      return inserted;
    }

    if (!inferred) {
      return false;
    }

    if (inferred.kind === "image") {
      const inserted = insertImage(inferred.src);
      if (inserted) {
        setMediaStatus("Imagem colada como mídia incorporada.");
      }
      return inserted;
    }

    const inserted = insertVideo(inferred.src, inferred.kind === "embed" ? "embed" : "video", inferred.title);
    if (inserted) {
      setMediaStatus(
        inferred.kind === "embed"
          ? "Link de vídeo convertido em player embutido."
          : "Vídeo colado como mídia incorporada.",
      );
    }
    return inserted;
  }

  async function uploadFilesAndInsert(files: File[]) {
    const supportedFiles = files.filter(isArticleMediaFile);

    if (supportedFiles.length === 0) {
      setMediaStatus("Selecione ou cole arquivos de imagem/vídeo compatíveis.");
      return;
    }

    startUploadTransition(async () => {
      let uploadedCount = 0;

      for (const file of supportedFiles) {
        try {
          setMediaStatus(`Enviando ${file.name} para o editor...`);

          const payload = new FormData();
          payload.append("file", file);

          const response = await fetch("/api/biblioteca/articles/media-upload", {
            method: "POST",
            body: payload,
          });

          const result = (await response.json().catch(() => null)) as UploadResponse | null;

          if (!response.ok || !result?.ok || !result.media?.externalUrl) {
            throw new Error(result?.error || `Falha ao enviar ${file.name}.`);
          }

          const detectedKind = detectArticleMediaKindFromFile(file) ?? result.media.kind;
          const inserted =
            detectedKind === "image"
              ? insertImage(result.media.externalUrl, result.media.title)
              : insertVideo(result.media.externalUrl, "video", result.media.title);

          if (!inserted) {
            throw new Error(`Não foi possível inserir ${file.name} no editor.`);
          }

          uploadedCount += 1;

          if (result.warningCode && result.warnings?.length) {
            setMediaStatus(
              `Mídia enviada com avisos (${result.warningCode}): ${result.warnings.join(" | ")}`,
            );
            continue;
          }

          setMediaStatus(`${file.name} enviado e incorporado com sucesso.`);
        } catch (error) {
          setMediaStatus(error instanceof Error ? error.message : "Falha ao enviar mídia para o editor.");
          return;
        }
      }

      if (uploadedCount > 1) {
        setMediaStatus(`${uploadedCount} mídias enviadas e incorporadas no editor.`);
      }
    });
  }

  function onSelectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    void uploadFilesAndInsert(files);
  }

  function promptAndApplyLink() {
    const activeEditor = editorRef.current;
    if (!activeEditor) return;

    const previousHref = activeEditor.getAttributes("link").href as string | undefined;
    const nextHref = window.prompt("Informe a URL do link", previousHref ?? "https://");

    if (nextHref === null) {
      return;
    }

    const normalized = nextHref.trim();

    if (!normalized) {
      activeEditor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    activeEditor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
  }

  function promptAndInsertImage() {
    const nextUrl = window.prompt("Informe a URL da imagem", "https://");
    if (nextUrl === null) {
      return;
    }

    insertMediaByUrl(nextUrl, "image");
  }

  function promptAndInsertVideo() {
    const nextUrl = window.prompt(
      "Informe a URL do vídeo (arquivo direto, YouTube ou Vimeo)",
      "https://",
    );

    if (nextUrl === null) {
      return;
    }

    insertMediaByUrl(nextUrl, "video");
  }

  return (
    <div className="space-y-4 text-sm font-medium text-zinc-700">
      <div className="space-y-1">
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
            <EditorToolbarButton onClick={promptAndInsertImage}>Imagem</EditorToolbarButton>
            <EditorToolbarButton onClick={promptAndInsertVideo}>Vídeo</EditorToolbarButton>
            <EditorToolbarButton onClick={() => fileInputRef.current?.click()}>
              {isUploadingMedia ? "Enviando mídia..." : "Upload mídia"}
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

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            aria-label="Selecionar imagens e vídeos para o editor"
            onChange={onSelectFiles}
          />
          <input type="hidden" name={inputName} value={value} />
          <EditorContent editor={articleEditor} />
        </div>
      ) : (
        <textarea
          name={inputName}
          maxLength={120000}
          rows={14}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 font-mono text-sm outline-none ring-sky-500 focus:ring"
          placeholder="<article><h1>Título</h1><p>Escreva o artigo em HTML puro...</p></article>"
        />
      )}

      <div className="space-y-1">
        <p className="text-xs text-zinc-500">
          Cole links de imagem, vídeos diretos, URLs do YouTube/Vimeo, arraste arquivos ou use o upload
          para incorporar mídia com player e visualização embutidos.
        </p>
        {mediaStatus ? <p className="text-xs font-medium text-zinc-700">{mediaStatus}</p> : null}
      </div>

      <p className="text-xs text-zinc-500">
        Você pode alternar entre RTF e HTML. Scripts, estilos e atributos visuais serão removidos
        automaticamente por segurança.
      </p>

      {value.trim() ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Pré-visualização do artigo (HTML)</h2>
          <p className="mt-1 text-xs text-zinc-600">Prévia sanitizada para revisão antes da publicação.</p>

          <div className="mt-3 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <iframe
              title="Pré-visualização do artigo"
              srcDoc={buildLocalHtmlPreviewDocument(value)}
              className="h-[70vh] w-full"
              sandbox="allow-same-origin allow-scripts allow-popups allow-presentation"
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
