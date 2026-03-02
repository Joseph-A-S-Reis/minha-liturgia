"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosSafari() {
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
  return isIOS && isSafari;
}

function isStandaloneDisplayMode() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallCta() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return isStandaloneDisplayMode();
  });
  const [isIos] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return isIosSafari();
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const showIosHint = useMemo(() => !isStandalone && isIos && !deferredPrompt, [isIos, isStandalone, deferredPrompt]);
  const showInstallButton = useMemo(
    () => !isStandalone && Boolean(deferredPrompt),
    [deferredPrompt, isStandalone],
  );

  async function handleInstall() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome !== "accepted") {
      setDismissed(true);
    }

    setDeferredPrompt(null);
  }

  if (isStandalone || (!showInstallButton && !showIosHint) || dismissed) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3 md:top-4 md:px-6">
      <div className="pointer-events-auto flex max-w-xl items-center gap-2 rounded-xl border border-sky-200 bg-white/95 px-3 py-2 text-xs text-[#003366] shadow-lg backdrop-blur md:text-sm">
        <Image
          src="/brand/logo-oficial.svg"
          alt="Minha Liturgia"
          width={26}
          height={26}
          className="h-6 w-6 shrink-0 rounded"
        />

        {showInstallButton ? (
          <>
            <p className="font-medium">Instale o app para usar em tela cheia no celular.</p>
            <button
              type="button"
              onClick={handleInstall}
              className="rounded-lg bg-[#003366] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#002244] md:text-sm"
            >
              Instalar
            </button>
          </>
        ) : (
          <p className="font-medium">
            No iPhone/iPad: toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
