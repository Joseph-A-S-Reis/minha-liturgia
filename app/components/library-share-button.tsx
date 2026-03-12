"use client";

import type { SVGProps } from "react";
import { useState } from "react";

function ShareButtonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.3 10.9 7.4-4.1" />
      <path d="m8.3 13.1 7.4 4.1" />
    </svg>
  );
}

type LibraryShareButtonProps = {
  title: string;
  url: string;
  className?: string;
};

export function LibraryShareButton({ title, url, className }: LibraryShareButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setFeedback("Link compartilhado.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setFeedback("Link copiado.");
      } else {
        window.prompt("Copie o link da publicação:", url);
        setFeedback("Link pronto para copiar.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setFeedback("Não foi possível compartilhar agora.");
    } finally {
      window.setTimeout(() => setFeedback(null), 2200);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleShare}
        className={className ?? "inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-sky-300 hover:text-sky-700"}
      >
        <ShareButtonIcon className="size-4" /> Compartilhar
      </button>
      {feedback ? <p className="text-xs text-zinc-500">{feedback}</p> : null}
    </div>
  );
}
