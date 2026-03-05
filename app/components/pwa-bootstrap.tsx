"use client";

import { useEffect, useRef, useState } from "react";

type ReleaseChange = {
  category: "feature" | "fix" | "improvement" | "security" | "breaking";
  title: string;
  description: string;
};

type ReleaseNotes = {
  version: string;
  releasedAt: string;
  title: string;
  highlights: string[];
  changes: ReleaseChange[];
};

type CurrentVersionResponse = {
  latest: {
    version: string;
    releasedAt: string;
    title: string;
    highlights: string[];
  };
};

const RELEASE_NOTES_ARMED_KEY = "pwa-release-notes-armed";
const RELEASE_NOTES_SEEN_PREFIX = "pwa-release-notes-seen:";

const RELEASE_CATEGORY_LABEL: Record<ReleaseChange["category"], string> = {
  feature: "Novidade",
  fix: "Correção",
  improvement: "Melhoria",
  security: "Segurança",
  breaking: "Importante",
};

export function PwaBootstrap() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotes | null>(null);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const hasControllerChanged = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    function trackRegistration(registration: ServiceWorkerRegistration) {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;

        if (!installing) {
          return;
        }

        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(installing);
          }
        });
      });
    }

    let updateInterval: number | null = null;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        trackRegistration(registration);

        updateInterval = window.setInterval(() => {
          registration.update().catch(() => {
            // ignore transient update failures
          });
        }, 60 * 1000);
      })
      .catch((error) => {
        console.error("Falha ao registrar service worker:", error);
      });

    const handleControllerChange = () => {
      if (hasControllerChanged.current) {
        return;
      }

      hasControllerChanged.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      if (updateInterval) {
        window.clearInterval(updateInterval);
      }

      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function maybeOpenReleaseNotesAfterUpdate() {
      if (typeof window === "undefined") {
        return;
      }

      const armed = window.localStorage.getItem(RELEASE_NOTES_ARMED_KEY) === "1";

      if (!armed) {
        return;
      }

      try {
        const currentResponse = await fetch("/api/version/current", { cache: "no-store" });

        if (!currentResponse.ok) {
          return;
        }

        const currentPayload = (await currentResponse.json()) as CurrentVersionResponse;
        const currentVersion = currentPayload.latest?.version?.trim();

        if (!currentVersion) {
          return;
        }

        const seenKey = `${RELEASE_NOTES_SEEN_PREFIX}${currentVersion}`;

        if (window.localStorage.getItem(seenKey) === "1") {
          window.localStorage.removeItem(RELEASE_NOTES_ARMED_KEY);
          return;
        }

        const changelogResponse = await fetch(
          `/api/version/changelog?version=${encodeURIComponent(currentVersion)}`,
          { cache: "no-store" },
        );

        if (!changelogResponse.ok) {
          return;
        }

        const changelogPayload = (await changelogResponse.json()) as { release?: ReleaseNotes };

        if (!changelogPayload.release || cancelled) {
          return;
        }

        setReleaseNotes(changelogPayload.release);
        setIsReleaseNotesOpen(true);
        window.localStorage.removeItem(RELEASE_NOTES_ARMED_KEY);
      } catch {
        // keep armed flag for next reload in case of transient failure
      }
    }

    maybeOpenReleaseNotesAfterUpdate();

    return () => {
      cancelled = true;
    };
  }, []);

  function applyUpdate() {
    if (!waitingWorker) {
      return;
    }

    window.localStorage.setItem(RELEASE_NOTES_ARMED_KEY, "1");
    setIsRefreshing(true);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  function closeReleaseNotes() {
    if (releaseNotes) {
      window.localStorage.setItem(`${RELEASE_NOTES_SEEN_PREFIX}${releaseNotes.version}`, "1");
    }

    setIsReleaseNotesOpen(false);
  }

  return (
    <>
      {waitingWorker ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-3 md:bottom-4 md:px-6">
          <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl border border-emerald-200 bg-white/95 px-3 py-2 text-xs text-[#003366] shadow-lg backdrop-blur md:text-sm">
            <p className="font-medium">Nova versão disponível. Atualize para usar a versão mais recente.</p>
            <button
              type="button"
              onClick={applyUpdate}
              disabled={isRefreshing}
              className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70 md:text-sm"
            >
              {isRefreshing ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>
      ) : null}

      {isReleaseNotesOpen && releaseNotes ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45" aria-hidden />

          <div className="relative z-71 w-full max-w-2xl rounded-2xl border border-sky-200 bg-white p-5 text-[#003366] shadow-2xl md:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Notas da versão</p>
                <h2 className="mt-1 text-lg font-bold md:text-xl">{releaseNotes.title}</h2>
                <p className="mt-1 text-xs text-slate-600 md:text-sm">
                  Versão {releaseNotes.version} • {releaseNotes.releasedAt}
                </p>
              </div>

              <button
                type="button"
                onClick={closeReleaseNotes}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              {releaseNotes.highlights.length ? (
                <section>
                  <h3 className="text-sm font-semibold md:text-base">Destaques</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs md:text-sm">
                    {releaseNotes.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <h3 className="text-sm font-semibold md:text-base">Mudanças</h3>
                <ul className="mt-2 space-y-2">
                  {releaseNotes.changes.map((change) => (
                    <li key={`${change.category}:${change.title}`} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 md:text-xs">
                        {RELEASE_CATEGORY_LABEL[change.category]}
                      </p>
                      <p className="mt-1 text-sm font-semibold md:text-[15px]">{change.title}</p>
                      <p className="mt-1 text-xs text-slate-700 md:text-sm">{change.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeReleaseNotes}
                className="rounded-lg bg-[#003366] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#002244] md:text-sm"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
