import { useCallback, useEffect, useState } from "react";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePushSubscription() {
  const { userId } = useAuth();
  const isAuthenticated = userId !== null;
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }
    try {
      // Get VAPID public key
      const { data } = await axiosInstance.get<{ publicKey: string }>(
        `${BASE}/push/vapid-public-key`,
      );
      const applicationServerKey = urlB64ToUint8Array(data.publicKey).buffer as ArrayBuffer;

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const json = sub.toJSON();
      await axiosInstance.post(`${BASE}/push/subscribe`, {
        endpoint: json.endpoint,
        keys: json.keys,
      });

      setPermission("granted");
      return true;
    } catch {
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (!sub) return;
      await axiosInstance.post(`${BASE}/push/unsubscribe`, {
        endpoint: sub.endpoint,
      });
      await sub.unsubscribe();
      setPermission("default");
    } catch {
      // ignore
    }
  }, []);

  const requestAndSubscribe = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "denied") return false;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return false;
    return subscribe();
  }, [subscribe]);

  // Auto-subscribe when the service worker is ready and authenticated.
  // Always re-sends existing browser subscription to the server (server does upsert),
  // so the DB stays in sync even if the table was created after the user first subscribed.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!("serviceWorker" in navigator)) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        const json = existing.toJSON();
        axiosInstance
          .post(`${BASE}/push/subscribe`, { endpoint: json.endpoint, keys: json.keys })
          .catch(() => {});
        return;
      }
      subscribe().catch(() => {});
    });
  }, [isAuthenticated, subscribe]);

  return { permission, requestAndSubscribe, unsubscribe };
}
