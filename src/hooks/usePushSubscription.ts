import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getPushVapidPublicKey } from "../gen/backoffice/hooks/useGetPushVapidPublicKey.js";
import { postPushSubscribe } from "../gen/backoffice/hooks/usePostPushSubscribe.js";
import { postPushUnsubscribe } from "../gen/backoffice/hooks/usePostPushUnsubscribe.js";
import type { PostPushSubscribeMutationRequest } from "../gen/backoffice/types/PostPushSubscribe.js";

/**
 * Migrado para os clients gerados pelo Kubb. Bearer/baseURL/withCredentials
 * já vêm do interceptor do `axiosInstance` partilhado (AuthContext.tsx) — o
 * client gerado corre nesse mesmo `axiosInstance`, por isso já não se passa
 * `withCredentials` à mão nestas chamadas.
 */

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * `PushSubscriptionJSON` (lib.dom) tipa `endpoint`/`keys` como opcionais —
 * uma subscrição real do browser tem sempre os dois, mas o guarda evita um
 * cast às cegas para `PostPushSubscribeMutationRequest` (que os exige).
 * Devolve `null` quando a subscrição do browser vem incompleta (nunca deveria
 * acontecer em runtime, mas mantém o tipo honesto).
 */
function toSubscribePayload(json: PushSubscriptionJSON): PostPushSubscribeMutationRequest | null {
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export function usePushSubscription() {
  const { isAuthenticated } = useAuth();
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [requiresInstall, setRequiresInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateSupport = () => {
      const ios = isIOSDevice();
      const standalone = isStandaloneDisplay();
      const supported =
        typeof Notification !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      setIsIOS(ios);
      setIsStandalone(standalone);
      setIsSupported(supported);
      setRequiresInstall(ios && !standalone);

      if (typeof Notification !== "undefined") {
        setPermission(Notification.permission);
      }
    };

    updateSupport();
    window.addEventListener("focus", updateSupport);
    document.addEventListener("visibilitychange", updateSupport);
    return () => {
      window.removeEventListener("focus", updateSupport);
      document.removeEventListener("visibilitychange", updateSupport);
    };
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (requiresInstall) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Este dispositivo/browser nao suporta push notifications.");
      return false;
    }
    try {
      const { publicKey } = await getPushVapidPublicKey();
      // Spec marca `publicKey` como opcional (contrato genérico), mas uma
      // resposta 200 desta rota traz sempre a chave — a alternativa (503)
      // já rejeita a promise antes de chegarmos aqui.
      if (!publicKey) {
        throw new Error("O servidor não devolveu a chave pública VAPID.");
      }
      const applicationServerKey = urlB64ToUint8Array(publicKey)
        .buffer as ArrayBuffer;

      const registration = await navigator.serviceWorker.ready;
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));

      const payload = toSubscribePayload(sub.toJSON());
      if (!payload) {
        throw new Error("Subscrição push inválida (faltam endpoint/keys).");
      }
      await postPushSubscribe(payload);

      setPermission("granted");
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nao foi possivel ativar push notifications neste dispositivo.",
      );
      return false;
    }
  }, [requiresInstall]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (!sub) return;
      await postPushUnsubscribe({ endpoint: sub.endpoint });
      await sub.unsubscribe();
      setPermission(
        typeof Notification !== "undefined"
          ? Notification.permission
          : "default",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nao foi possivel desativar push notifications.",
      );
    }
  }, []);

  const requestAndSubscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (requiresInstall) return false;
    if (typeof Notification === "undefined") {
      setError("Este dispositivo/browser nao suporta notificacoes.");
      return false;
    }
    if (Notification.permission === "denied") {
      setError("As notificacoes estao bloqueadas nas definicoes do browser.");
      return false;
    }
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") {
      setError("Permissao de notificacoes nao concedida.");
      return false;
    }
    return subscribe();
  }, [requiresInstall, subscribe]);

  // Auto-subscribe when the service worker is ready and authenticated.
  // Always re-sends existing browser subscription to the server (server does upsert),
  // so the DB stays in sync even if the table was created after the user first subscribed.
  useEffect(() => {
    if (!isAuthenticated || requiresInstall) return;
    if (!("serviceWorker" in navigator)) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    setError(null);
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        const payload = toSubscribePayload(existing.toJSON());
        if (payload) postPushSubscribe(payload).catch(() => {});
        return;
      }
      subscribe().catch(() => {});
    });
  }, [isAuthenticated, requiresInstall, subscribe]);

  // Ensure a previous user's device subscription is removed on logout/session loss.
  useEffect(() => {
    if (isAuthenticated) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    navigator.serviceWorker.ready.then(async (reg) => {
      if (cancelled) return;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await sub.unsubscribe().catch(() => {});
      if (cancelled) return;
      setPermission(
        typeof Notification !== "undefined"
          ? Notification.permission
          : "default",
      );
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return {
    permission,
    requestAndSubscribe,
    unsubscribe,
    isSupported,
    requiresInstall,
    isIOS,
    isStandalone,
    error,
  };
}
