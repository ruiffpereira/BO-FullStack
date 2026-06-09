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

  useEffect(() => {
    const supported =
      typeof Notification !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setIsSupported(supported);
    setRequiresInstall(isIOSDevice() && !isStandaloneDisplay());

    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (requiresInstall) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }
    try {
      // Get VAPID public key
      const { data } = await axiosInstance.get<{ publicKey: string }>(
        "/push/vapid-public-key",
        { withCredentials: true },
      );
      const applicationServerKey = urlB64ToUint8Array(data.publicKey)
        .buffer as ArrayBuffer;

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

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
    } catch {
      return false;
    }
  }, [requiresInstall]);

  const unsubscribe = useCallback(async (): Promise<void> => {
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
      setPermission("default");
    } catch {
      // ignore
    }
  }, []);

  const requestAndSubscribe = useCallback(async (): Promise<boolean> => {
    if (requiresInstall) return false;
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "denied") return false;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return false;
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

  return { permission, requestAndSubscribe, unsubscribe, isSupported, requiresInstall };
}
