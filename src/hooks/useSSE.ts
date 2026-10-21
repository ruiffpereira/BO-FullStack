import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getNotificationsQueryKey } from "./useNotifications";
import { getEventsStreamQueryKey } from "../gen/backoffice/hooks/useGetEventsStream.js";
import { getScheduleAppointmentsQueryKey } from "../gen/backoffice/hooks/useGetScheduleAppointments.js";
import { getOrdersQueryKey } from "../gen/backoffice/hooks/useGetOrders.js";
import { getMessagesSummaryQueryKey } from "../gen/backoffice/hooks/useGetMessagesSummary.js";
import { messagesKeys } from "./useMessages";
import { invalidateMailQueries } from "./useMail";
import { mailThreadHref, CORREIO_PATH } from "../lib/mail";

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
  const { accessToken, isAuthenticated, supportSession, isMember, refreshAccess } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);
  // Já houve uma ligação neste ecrã? As seguintes (retry, token renovado) refrescam o que se pode ter perdido no intervalo.
  const connectedOnceRef = useRef(false);

  useEffect(() => {
    // Sessão de suporte: a API devolve 403 IMPERSONATION_FORBIDDEN em
    // /events/stream — nem se tenta ligar.
    // Membro da equipa (B41 2c): o stream já aceita membros e filtra os eventos pelas folhas que têm. O servidor
    // FECHA a ligação quando o membro é desactivado/removido, muda de folhas ou de password — daí o retry com
    // backoff também quando o stream termina limpo, e o `refreshAccess` (folhas novas; um 401 cai no
    // interceptor → refresh → login, como qualquer pedido).
    if (!isAuthenticated || !accessToken || supportSession) return;

    let active = true;
    let retryDelay = 2000;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function revalidateSession() {
      // Falha de rede/401 duro: o interceptor trata (refresh → login); aqui só não deixa a promise solta.
      void refreshAccess?.().catch(() => {});
    }

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
          if (res.status === 401 || res.status === 403) revalidateSession();
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
        // O servidor fechou a ligação (membro desactivado/removido/mudou de folhas ou de password): voltar a ligar.
        if (active) {
          revalidateSession();
          scheduleRetry();
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        scheduleRetry();
      }
    }

    function handleEvent(event: { type: string; data?: Record<string, unknown> }) {
      if (event.type === "connected") {
        // O SSE não repete o que passou enquanto esteve em baixo (429, rede, token renovado): ao religar, refresca.
        if (connectedOnceRef.current) {
          queryClient.invalidateQueries({ queryKey: messagesKeys.all });
          queryClient.invalidateQueries({ queryKey: ["chat"] });
          queryClient.invalidateQueries({ queryKey: getMessagesSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getNotificationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getOrdersQueryKey() });
          invalidateMailQueries(queryClient);
        }
        connectedOnceRef.current = true;
        return;
      }

      if (event.type === "notification") {
        // Always refresh the notification bell
        queryClient.invalidateQueries({ queryKey: getNotificationsQueryKey() });

        // Also refresh the relevant data list
        // Chaves geradas pelo Kubb — mantêm-se a bater com as queries de leitura
        // (useGetScheduleAppointments / useGetOrders) mesmo que o path mude no
        // spec. É prefixo: invalida também as leituras com params (from/to, etc.).
        const notifType = event.data?.type;
        // Email novo na caixa do negócio: a notificação é o aviso; a lista da Caixa actualiza-se já.
        if (notifType === "email") invalidateMailQueries(queryClient);
        if (notifType === "booking") {
          queryClient.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() });
        } else if (notifType === "order") {
          queryClient.invalidateQueries({ queryKey: getOrdersQueryKey() });
        }
      }

      // Correio (CR-27): a API limpou avisos de email desta pessoa (leu a conversa noutro separador/dispositivo) — refresca o sino.
      if (event.type === "notifications_refresh") {
        queryClient.invalidateQueries({ queryKey: getNotificationsQueryKey() });
      }

      // Backoffice appointment update (status change, etc.) — refresh list only
      if (event.type === "appointments_refresh") {
        queryClient.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() });
      }

      // Chat de suporte — nova mensagem OU leitura do outro lado ("visto" em
      // tempo real): refresca thread + lista de conversas + badges.
      if (event.type === "message" || event.type === "chat_read") {
        queryClient.invalidateQueries({ queryKey: ["chat"] });
        // O Suporte também conta no total do menu (summary).
        queryClient.invalidateQueries({ queryKey: getMessagesSummaryQueryKey() });
      }

      // Mensagens (B43): clientes (`customer_*`, folha mensagens.clientes) e equipa (`team_*`, dirigido à outra
      // pessoa) — refresca lista de conversas, fio aberto e contadores (summary).
      if (
        event.type === "customer_message" ||
        event.type === "customer_chat_read" ||
        event.type === "team_message" ||
        event.type === "team_chat_read"
      ) {
        queryClient.invalidateQueries({ queryKey: messagesKeys.all });
        queryClient.invalidateQueries({ queryKey: getMessagesSummaryQueryKey() });
      }

      // Correio (B42): email novo na caixa PESSOAL (a do negócio avisa pelo sino). Refresca lista, conversa e contadores.
      if (event.type === "mail_new") {
        invalidateMailQueries(queryClient);
        if (!window.location.pathname.startsWith(CORREIO_PATH)) {
          const d = (event.data ?? {}) as { title?: string; body?: string; mailboxId?: string; threadId?: string };
          toast(`✉️ ${d.title || "Novo email"}`, {
            id: `mail-${d.mailboxId ?? "x"}`,
            description: d.body,
            action: {
              label: "Abrir",
              onClick: () => navigate(d.mailboxId && d.threadId ? mailThreadHref(d.mailboxId, d.threadId) : CORREIO_PATH),
            },
          });
        }
      }

      // Toast de mensagem de cliente / de colega — exceto se já estás nas Mensagens. Coalescido por conversa.
      if (
        (event.type === "customer_message" || event.type === "team_message") &&
        !window.location.pathname.startsWith("/mensagens")
      ) {
        const d = (event.data ?? {}) as {
          customerName?: string;
          senderName?: string;
          senderKey?: string;
          preview?: string;
          conversationId?: string;
        };
        const isCustomer = event.type === "customer_message";
        const who = isCustomer ? d.customerName || "Cliente" : d.senderName || "Equipa";
        const target = isCustomer
          ? `/mensagens?conversa=${encodeURIComponent(d.conversationId ?? "")}`
          : `/mensagens/backoffice?com=${encodeURIComponent(d.senderKey ?? "")}`;
        toast(`💬 ${who}`, {
          id: `msg-${d.conversationId ?? "x"}`,
          description: d.preview || "Tens uma nova mensagem.",
          action: { label: "Abrir", onClick: () => navigate(target) },
        });
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
          action: { label: "Abrir", onClick: () => navigate(d.senderRole === "admin" ? "/mensagens/backoffice?com=suporte" : "/mensagens") },
        });
      }
    }

    function scheduleRetry() {
      if (!active) return;
      timer = setTimeout(() => { if (active) connect(); }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    }

    connect();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [accessToken, isAuthenticated, supportSession, isMember, refreshAccess, queryClient, navigate]);
}
