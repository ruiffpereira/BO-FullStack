import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getNotificationsQueryKey } from "./useNotifications";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

export function useSSE() {
  const { accessToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    let active = true;
    let retryDelay = 2000;

    async function connect() {
      if (!active) return;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${API_BASE}/events/stream`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          scheduleRetry();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        retryDelay = 2000;

        while (active) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;
            try {
              const event = JSON.parse(raw);
              handleEvent(event);
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        scheduleRetry();
      }
    }

    function handleEvent(event: { type: string; data?: Record<string, unknown> }) {
      if (event.type === "connected") return;

      if (event.type === "notification") {
        // Always refresh the notification bell
        queryClient.invalidateQueries({ queryKey: getNotificationsQueryKey() });

        // Also refresh the relevant data list
        const notifType = event.data?.type;
        if (notifType === "booking") {
          queryClient.invalidateQueries({ queryKey: [{ url: "/schedule/appointments" }] });
        } else if (notifType === "order") {
          queryClient.invalidateQueries({ queryKey: [{ url: "/orders" }] });
        }
      }

      // Backoffice appointment update (status change, etc.) — refresh list only
      if (event.type === "appointments_refresh") {
        queryClient.invalidateQueries({ queryKey: [{ url: "/schedule/appointments" }] });
      }

      // Chat de suporte — nova mensagem OU leitura do outro lado ("visto" em
      // tempo real): refresca thread + lista de conversas + badges.
      if (event.type === "message" || event.type === "chat_read") {
        queryClient.invalidateQueries({ queryKey: ["chat"] });
      }
    }

    function scheduleRetry() {
      if (!active) return;
      setTimeout(() => { if (active) connect(); }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    }

    connect();

    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, [accessToken, isAuthenticated, queryClient]);
}
