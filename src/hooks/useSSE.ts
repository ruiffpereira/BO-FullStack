import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getNotificationsQueryKey } from "./useNotifications";
import { getEventsStreamQueryKey } from "../gen/backoffice/hooks/useGetEventsStream.js";
import { getScheduleAppointmentsQueryKey } from "../gen/backoffice/hooks/useGetScheduleAppointments.js";
import { getOrdersQueryKey } from "../gen/backoffice/hooks/useGetOrders.js";

import { API_BASE } from "../lib/env";

// /events/stream é SSE — uma ligação longa lida com fetch + ReadableStream.
// O client gerado pelo Kubb é axios, que não serve para consumir um stream
// (não expõe o `body` como ReadableStream da mesma forma, e fecharia a
// ligação prematuramente); por isso este hook continua a usar `fetch` nativo.
// O que dá para tirar da string é o PATH em si: em vez de o escrever à mão,
// reaproveita-se a queryKey gerada pelo Kubb para este endpoint (o 1º elemento
// é sempre `{ url: "/events/stream" }` — mesma convenção usada em todos os
// outros hooks gerados), para que uma mudança de path no spec continue a
// partir o build em vez de partir só em produção.
const EVENTS_STREAM_PATH = getEventsStreamQueryKey()[0].url;

export function useSSE() {
  const { accessToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
        const res = await fetch(`${API_BASE}${EVENTS_STREAM_PATH}`, {
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
        // Chaves geradas pelo Kubb — mantêm-se a bater com as queries de leitura
        // (useGetScheduleAppointments / useGetOrders) mesmo que o path mude no
        // spec. É prefixo: invalida também as leituras com params (from/to, etc.).
        const notifType = event.data?.type;
        if (notifType === "booking") {
          queryClient.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() });
        } else if (notifType === "order") {
          queryClient.invalidateQueries({ queryKey: getOrdersQueryKey() });
        }
      }

      // Backoffice appointment update (status change, etc.) — refresh list only
      if (event.type === "appointments_refresh") {
        queryClient.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() });
      }

      // Chat de suporte — nova mensagem OU leitura do outro lado ("visto" em
      // tempo real): refresca thread + lista de conversas + badges.
      if (event.type === "message" || event.type === "chat_read") {
        queryClient.invalidateQueries({ queryKey: ["chat"] });
      }

      // Aviso (toast) de nova mensagem — exceto se já estiveres nas Mensagens.
      // Coalescido por conversa (mesmo id → substitui o toast anterior).
      if (event.type === "message" && !window.location.pathname.startsWith("/mensagens")) {
        const d = (event.data ?? {}) as {
          senderRole?: string;
          senderName?: string;
          preview?: string;
          conversationId?: string;
        };
        const who = d.senderRole === "admin" ? "Suporte" : d.senderName || "Nova mensagem";
        toast(`💬 ${who}`, {
          id: `chat-${d.conversationId ?? "x"}`,
          description: d.preview || "Tens uma nova mensagem.",
          action: { label: "Abrir", onClick: () => navigate("/mensagens") },
        });
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
  }, [accessToken, isAuthenticated, queryClient, navigate]);
}
