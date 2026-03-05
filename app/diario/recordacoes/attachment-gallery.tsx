"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JournalMemoryAttachmentView } from "./actions";

type AttachmentGalleryProps = {
  attachments: JournalMemoryAttachmentView[];
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function getKindByMime(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image" as const;
  if (mimeType === "application/pdf") return "pdf" as const;
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "docx" as const;
  }

  return "file" as const;
}

export function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [showArrows, setShowArrows] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const safeIndex = useMemo(() => {
    if (attachments.length === 0) return 0;
    return Math.min(selectedIndex, attachments.length - 1);
  }, [attachments.length, selectedIndex]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;

    const update = () => {
      const hasOverflow = node.scrollWidth > node.clientWidth + 2;
      setShowArrows(hasOverflow);
      setCanScrollLeft(node.scrollLeft > 2);
      setCanScrollRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 2);
    };

    update();

    const onScroll = () => update();
    const onResize = () => update();

    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [attachments.length]);

  if (attachments.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Galeria de anexos</h2>
        <p className="mt-2 text-sm text-zinc-600">Esta recordação ainda não possui anexos.</p>
      </section>
    );
  }

  const selected = attachments[safeIndex];
  const selectedUrl = `/api/diario/recordacoes/anexos/${selected.id}`;
  const selectedKind = getKindByMime(selected.mimeType);

  const scrollByStep = (direction: "left" | "right") => {
    const node = scrollerRef.current;
    if (!node) return;

    const step = Math.max(220, Math.floor(node.clientWidth * 0.6));
    node.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" });
  };

  const handleSelectAttachment = (index: number) => {
    if (index === safeIndex) {
      setIsViewerOpen((open) => !open);
      return;
    }

    setSelectedIndex(index);
    setIsViewerOpen(true);
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Galeria de anexos</h2>

      <div className="mt-4 space-y-3">
        <div className="relative rounded-xl border border-zinc-200 bg-zinc-50 px-10 py-2">
          {showArrows ? (
            <button
              type="button"
              onClick={() => scrollByStep("left")}
              disabled={!canScrollLeft}
              aria-label="Anexo anterior"
              className="absolute left-2 top-1/2 inline-flex -translate-y-1/2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ←
            </button>
          ) : null}

          <div
            ref={scrollerRef}
            className="flex gap-2 overflow-x-auto scroll-smooth py-1 [scrollbar-width:thin]"
          >
            {attachments.map((attachment, index) => {
              const kind = getKindByMime(attachment.mimeType);
              const isActive = index === safeIndex;
              const attachmentUrl = `/api/diario/recordacoes/anexos/${attachment.id}`;

              return (
                <button
                  key={attachment.id}
                  type="button"
                  onClick={() => handleSelectAttachment(index)}
                  className={`h-32 w-52 shrink-0 overflow-hidden rounded-xl border text-left transition ${
                    isActive
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  {kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attachmentUrl}
                      alt={attachment.fileName}
                      className="h-20 w-full border-b border-zinc-200 bg-white object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center border-b border-zinc-200 bg-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {kind}
                    </div>
                  )}

                  <div className="px-2 py-1.5">
                    <p className="truncate text-xs font-semibold text-zinc-800">{attachment.fileName}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{formatBytes(attachment.fileSize)}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {showArrows ? (
            <button
              type="button"
              onClick={() => scrollByStep("right")}
              disabled={!canScrollRight}
              aria-label="Próximo anexo"
              className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              →
            </button>
          ) : null}
        </div>

        {isViewerOpen ? (
          <div className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{selected.fileName}</p>
                <p className="text-xs text-zinc-500">
                  {selected.mimeType} · {formatBytes(selected.fileSize)}
                </p>
              </div>
              <Link
                href={selectedUrl}
                className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Baixar arquivo
              </Link>
            </header>

            {selectedKind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedUrl}
                alt={selected.fileName}
                className="h-105 w-full rounded-lg border border-zinc-200 bg-white object-contain"
                loading="lazy"
              />
            ) : null}

            {selectedKind === "pdf" ? (
              <iframe
                title={`Visualização de ${selected.fileName}`}
                src={selectedUrl}
                className="h-105 w-full rounded-lg border border-zinc-200 bg-white"
              />
            ) : null}

            {selectedKind === "docx" ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
                <p className="font-medium text-zinc-900">Documento DOCX</p>
                <p className="mt-1">
                  O navegador pode ter suporte parcial para DOCX inline. Use o botão &quot;Baixar arquivo&quot;
                  para abrir no visualizador nativo do seu dispositivo.
                </p>
                <iframe
                  title={`Visualização parcial de ${selected.fileName}`}
                  src={selectedUrl}
                  className="mt-3 h-90 w-full rounded-lg border border-zinc-200"
                />
              </div>
            ) : null}

            {selectedKind === "file" ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
                Pré-visualização não disponível para este tipo de arquivo.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
            Visualizador recolhido. Clique na miniatura para abrir novamente.
          </div>
        )}
      </div>
    </section>
  );
}
