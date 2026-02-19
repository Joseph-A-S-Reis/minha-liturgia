"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PushConfigResponse = {
  enabled: boolean;
  publicKey?: string;
  error?: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function PushSubscriptionCard() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const canRequest = useMemo(() => isSupported && Boolean(publicKey), [isSupported, publicKey]);

  async function getServiceWorkerRegistration() {
    return navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }

  const refreshSubscriptionState = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const configResponse = await fetch("/api/calendario/push/subscription", {
      method: "GET",
      cache: "no-store",
    });

    const config = (await configResponse.json()) as PushConfigResponse;

    if (!config.enabled || !config.publicKey) {
      setPublicKey(null);
      setError(config.error ?? "Push não habilitado no servidor.");
      return;
    }

    setPublicKey(config.publicKey);

    const registration = await getServiceWorkerRegistration();
    const existing = await registration.pushManager.getSubscription();
    setIsEnabled(Boolean(existing));
  }, []);

  useEffect(() => {
    refreshSubscriptionState().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar estado de push.");
    });
  }, [refreshSubscriptionState]);

  async function enablePush() {
    if (!canRequest || !publicKey) return;

    setIsLoading(true);
    setStatus(null);
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Permissão de notificação não concedida.");
      }

      const registration = await getServiceWorkerRegistration();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json = subscription.toJSON();

      const response = await fetch("/api/calendario/push/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });

      if (!response.ok) {
        throw new Error("Não foi possível salvar inscrição push no servidor.");
      }

      setIsEnabled(true);
      setStatus("Notificações push ativadas neste dispositivo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao ativar push.");
    } finally {
      setIsLoading(false);
    }
  }

  async function disablePush() {
    setIsLoading(true);
    setStatus(null);
    setError(null);

    try {
      const registration = await getServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsEnabled(false);
        return;
      }

      await fetch("/api/calendario/push/subscription", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      await subscription.unsubscribe();

      setIsEnabled(false);
      setStatus("Notificações push desativadas neste dispositivo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao desativar push.");
    } finally {
      setIsLoading(false);
    }
  }

  async function sendTestPush() {
    setIsLoading(true);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch("/api/calendario/push/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Minha Liturgia",
          body: "Teste de notificação recebido. Está tudo funcionando ✨",
          url: "/calendario",
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        summary?: { sent: number; total: number };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao enviar notificação de teste.");
      }

      setStatus(
        payload.summary
          ? `Teste enviado: ${payload.summary.sent}/${payload.summary.total} assinatura(s).`
          : "Teste enviado.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao enviar teste push.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Notificações do calendário (Push)</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Ative para receber lembretes no dispositivo, mesmo fora da página.
      </p>

      {!isSupported ? (
        <p className="mt-2 text-xs font-medium text-amber-700">
          Este navegador não suporta Push Notifications.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
      {status ? <p className="mt-2 text-xs font-medium text-emerald-700">{status}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {isEnabled ? (
          <button
            type="button"
            onClick={disablePush}
            disabled={isLoading}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Desativar neste dispositivo
          </button>
        ) : (
          <button
            type="button"
            onClick={enablePush}
            disabled={isLoading || !canRequest}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white! transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Ativar push neste dispositivo
          </button>
        )}

        <button
          type="button"
          onClick={sendTestPush}
          disabled={isLoading || !isEnabled}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Enviar teste
        </button>
      </div>
    </section>
  );
}
