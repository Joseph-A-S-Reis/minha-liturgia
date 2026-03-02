"use client";

import { useEffect, useRef, useState } from "react";

export function PwaBootstrap() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  function applyUpdate() {
    if (!waitingWorker) {
      return;
    }

    setIsRefreshing(true);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  if (!waitingWorker) {
    return null;
  }

  return (
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
  );
}
