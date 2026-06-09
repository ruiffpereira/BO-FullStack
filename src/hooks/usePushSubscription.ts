import { useCallback, useEffect, useState } from "react";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";

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
      const { data } = await axiosInstance.get<{ publicKey: string }>(
        "/push/vapid-public-key",
        { withCredentials: true },
      );
      const applicationServerKey = urlB64ToUint8Array(data.publicKey)
        .buffer as ArrayBuffer;

      const registration = await navigator.serviceWorker.ready;
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));

      const json = sub.toJSON();
      await axiosInstance.post(
        "/push/subscribe",
        {
          endpoint: json.endpoint,
          keys: json.keys,
        },
        { withCredentials: true },
      );

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
      await axiosInstance.post(
        "/push/unsubscribe",
        {
          endpoint: sub.endpoint,
        },
        { withCredentials: true },
      );
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
        const json = existing.toJSON();
        axiosInstance
          .post(
            "/push/subscribe",
            {
              endpoint: json.endpoint,
              keys: json.keys,
            },
            { withCredentials: true },
          )
          .catch(() => {});
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
