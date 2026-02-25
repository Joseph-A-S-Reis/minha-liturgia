"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  resolveAssetEmbedUrl,
  resolveAssetOpenUrl,
  resolveLibraryViewerKind,
  type LibraryAssetLike,
} from "@/lib/library/media";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type AssetViewerProps = {
  asset: LibraryAssetLike & {
    id?: string;
    title?: string | null;
  };
  className?: string;
};

export function AssetViewer({ asset, className }: AssetViewerProps) {
  const viewerKind = resolveLibraryViewerKind(asset);

  const embedUrl = useMemo(() => resolveAssetEmbedUrl(asset), [asset]);
  const openUrl = useMemo(() => resolveAssetOpenUrl(asset), [asset]);
  const label = asset.title ?? `Arquivo ${asset.kind}`;

  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1);

  const mediaClassName = className ?? "mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-white";

  if (!openUrl && !embedUrl) {
    return <p className="mt-2 text-xs text-amber-700">Mídia sem URL pública no momento.</p>;
  }

  if (viewerKind === "image") {
    const src = embedUrl ?? openUrl;

    return src ? (
      <div className={mediaClassName}>
        {isMediaLoading ? <InlineStatus message="Carregando imagem..." /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          loading="lazy"
          className="max-h-[60vh] w-full object-contain"
          referrerPolicy="no-referrer"
          onLoad={() => {
            setIsMediaLoading(false);
            setMediaError(null);
          }}
          onError={() => {
            setIsMediaLoading(false);
            setMediaError("Não foi possível carregar esta imagem.");
          }}
        />
        {mediaError ? <InlineStatus tone="error" message={mediaError} /> : null}
      </div>
    ) : (
      <AssetViewerFallback openUrl={openUrl} />
    );
  }

  if (viewerKind === "audio") {
    const src = embedUrl ?? openUrl;
    if (!src) {
      return <AssetViewerFallback openUrl={openUrl} />;
    }

    return (
      <div className={mediaClassName}>
        {isMediaLoading ? <InlineStatus message="Carregando áudio..." /> : null}
        <div className="p-3">
          <audio
            controls
            preload="metadata"
            className="w-full"
            src={src}
            onCanPlay={() => {
              setIsMediaLoading(false);
              setMediaError(null);
            }}
            onError={() => {
              setIsMediaLoading(false);
              setMediaError("Falha ao carregar este áudio.");
            }}
          />
        </div>
        {mediaError ? <InlineStatus tone="error" message={mediaError} /> : null}
      </div>
    );
  }

  if (viewerKind === "video") {
    const src = embedUrl ?? openUrl;
    if (!src) {
      return <AssetViewerFallback openUrl={openUrl} />;
    }

    return (
      <div className={mediaClassName}>
        {isMediaLoading ? <InlineStatus message="Carregando vídeo..." /> : null}
        <div className="aspect-video">
          <video
            controls
            preload="metadata"
            className="h-full w-full"
            src={src}
            onCanPlay={() => {
              setIsMediaLoading(false);
              setMediaError(null);
            }}
            onError={() => {
              setIsMediaLoading(false);
              setMediaError("Falha ao carregar este vídeo.");
            }}
          />
        </div>
        {mediaError ? <InlineStatus tone="error" message={mediaError} /> : null}
      </div>
    );
  }

  if (viewerKind === "pdf") {
    if (embedUrl) {
      return (
        <div className={mediaClassName}>
          {isMediaLoading ? <InlineStatus message="Carregando PDF..." /> : null}
          <iframe
            title={`Prévia de ${label}`}
            src={embedUrl}
            className="h-[70vh] w-full"
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => {
              setIsMediaLoading(false);
              setMediaError(null);
            }}
          />
          {mediaError ? <InlineStatus tone="error" message={mediaError} /> : null}
        </div>
      );
    }

    if (!openUrl) {
      return <AssetViewerFallback openUrl={openUrl} />;
    }

    return (
      <div className={`${mediaClassName} p-3`}>
        {isMediaLoading ? <InlineStatus message="Processando PDF..." /> : null}
        <Document
          file={openUrl}
          onLoadSuccess={(data) => {
            setPdfPageCount(data.numPages);
            setPdfPage(1);
            setIsMediaLoading(false);
            setMediaError(null);
          }}
          onLoadError={() => {
            setIsMediaLoading(false);
            setMediaError("Não foi possível carregar este PDF.");
          }}
        >
          <Page
            pageNumber={pdfPage}
            scale={pdfScale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            disabled={!pdfPageCount || pdfPage <= 1}
            onClick={() => setPdfPage((previous) => Math.max(1, previous - 1))}
            className="rounded-md border border-zinc-300 px-2 py-1 font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Página anterior
          </button>
          <button
            type="button"
            disabled={!pdfPageCount || pdfPage >= pdfPageCount}
            onClick={() => setPdfPage((previous) => {
              if (!pdfPageCount) return previous;
              return Math.min(pdfPageCount, previous + 1);
            })}
            className="rounded-md border border-zinc-300 px-2 py-1 font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Próxima página
          </button>
          <button
            type="button"
            onClick={() => setPdfScale((previous) => Math.max(0.8, Number((previous - 0.1).toFixed(1))))}
            className="rounded-md border border-zinc-300 px-2 py-1 font-semibold text-zinc-700"
          >
            Zoom -
          </button>
          <button
            type="button"
            onClick={() => setPdfScale((previous) => Math.min(2, Number((previous + 0.1).toFixed(1))))}
            className="rounded-md border border-zinc-300 px-2 py-1 font-semibold text-zinc-700"
          >
            Zoom +
          </button>
          <p className="text-zinc-500">
            {pdfPageCount ? `Página ${pdfPage} de ${pdfPageCount}` : "PDF carregado"}
          </p>
        </div>
        {mediaError ? <InlineStatus tone="error" message={mediaError} /> : null}
      </div>
    );
  }

  if (viewerKind === "html") {
    return (
      <HtmlBasicPreview
        assetId={asset.id ?? null}
        storageObjectKey={asset.storageObjectKey ?? null}
        externalUrl={asset.externalUrl ?? null}
        openUrl={openUrl}
        className={mediaClassName}
      />
    );
  }

  if (embedUrl) {
    return (
      <div className={mediaClassName}>
        {isMediaLoading ? <InlineStatus message="Carregando pré-visualização..." /> : null}
        <iframe
          title={`Visualização de ${label}`}
          src={embedUrl}
          className="h-80 w-full"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
          onLoad={() => {
            setIsMediaLoading(false);
            setMediaError(null);
          }}
        />
        {mediaError ? <InlineStatus tone="error" message={mediaError} /> : null}
      </div>
    );
  }

  return <AssetViewerFallback openUrl={openUrl} />;
}

function AssetViewerFallback({ openUrl }: { openUrl: string | null }) {
  if (!openUrl) {
    return <p className="mt-2 text-xs text-zinc-500">Pré-visualização indisponível para este arquivo.</p>;
  }

  return (
    <p className="mt-2 text-xs text-zinc-500">
      Pré-visualização indisponível. Use “Abrir em nova aba” para acessar o arquivo.
    </p>
  );
}

function InlineStatus({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "error";
}) {
  const className =
    tone === "error"
      ? "mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
      : "mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600";

  return <p className={className}>{message}</p>;
}

function HtmlBasicPreview({
  assetId,
  storageObjectKey,
  externalUrl,
  openUrl,
  className,
}: {
  assetId: string | null;
  storageObjectKey: string | null;
  externalUrl: string | null;
  openUrl: string | null;
  className: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHtml() {
      try {
        setLoading(true);
        setError(null);

        let response: Response;

        if (assetId) {
          response = await fetch(`/api/biblioteca/assets/${encodeURIComponent(assetId)}/html`, {
            method: "GET",
            cache: "no-store",
          });
        } else {
          const params = new URLSearchParams();
          if (storageObjectKey) params.set("storageObjectKey", storageObjectKey);
          if (externalUrl) params.set("externalUrl", externalUrl);

          if (!params.toString()) {
            throw new Error("Não foi possível identificar este arquivo HTML.");
          }

          response = await fetch(`/api/biblioteca/assets/html/preview?${params.toString()}`, {
            method: "GET",
            cache: "no-store",
          });
        }

        const payload = (await response.json().catch(() => null)) as
          | { html?: string; error?: string }
          | null;

        if (!response.ok || !payload?.html) {
          throw new Error(payload?.error || "Falha ao carregar HTML básico.");
        }

        if (!cancelled) {
          setHtml(payload.html);
          setLoading(false);
        }
      } catch (cause) {
        if (!cancelled) {
          setHtml(null);
          setLoading(false);
          setError(cause instanceof Error ? cause.message : "Erro ao processar HTML.");
        }
      }
    }

    void loadHtml();

    return () => {
      cancelled = true;
    };
  }, [assetId, storageObjectKey, externalUrl]);


  return (
    <div className={className}>
      {loading ? <InlineStatus message="Convertendo HTML básico..." /> : null}
      {error ? <InlineStatus tone="error" message={error} /> : null}

      {html ? (
        <div
          className="library-html-content h-[70vh] overflow-auto p-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}

      {!loading && !html ? <AssetViewerFallback openUrl={openUrl} /> : null}
    </div>
  );
}
