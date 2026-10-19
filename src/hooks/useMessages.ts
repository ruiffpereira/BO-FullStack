import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getMessagesSummary, getMessagesSummaryQueryKey } from "../gen/backoffice/hooks/useGetMessagesSummary.js";
import { listCustomerConversations } from "../gen/backoffice/hooks/useListCustomerConversations.js";
import { getCustomerConversationMessages } from "../gen/backoffice/hooks/useGetCustomerConversationMessages.js";
import { replyCustomerConversation } from "../gen/backoffice/hooks/useReplyCustomerConversation.js";
import { readCustomerConversation } from "../gen/backoffice/hooks/useReadCustomerConversation.js";
import { getCustomerConversationByCustomer } from "../gen/backoffice/hooks/useGetCustomerConversationByCustomer.js";
import { listTeamPeople } from "../gen/backoffice/hooks/useListTeamPeople.js";
import { getTeamThread } from "../gen/backoffice/hooks/useGetTeamThread.js";
import { sendTeamMessage } from "../gen/backoffice/hooks/useSendTeamMessage.js";
import { readTeamThread } from "../gen/backoffice/hooks/useReadTeamThread.js";
import type { MessagesCustomerThread } from "../gen/backoffice/types/MessagesCustomerThread.js";
import type { MessagesTeamThread } from "../gen/backoffice/types/MessagesTeamThread.js";
import type { MessagesCustomerList } from "../gen/backoffice/types/MessagesCustomerList.js";
import type { MessagesTeamPeople } from "../gen/backoffice/types/MessagesTeamPeople.js";
import type { MessagesSummary } from "../gen/backoffice/types/MessagesSummary.js";
import type { ChatAttachment, ChatMessage, ChatThread, MessageInput } from "./useChat";

/**
 * Mensagens (B43): conversas com clientes do site e conversas 1-para-1 da equipa. Clients gerados pelo Kubb
 * (tag `Mensagens`); aqui só se normaliza a resposta para o `ChatThread` que o `ChatConversationView` já consome
 * (o fio do Suporte), para nunca forkar a lógica do fio/compositor.
 *  - Clientes: o negócio é o lado `business` (as minhas mensagens), o cliente é `customer`.
 *  - Equipa: a API diz `mine`; normaliza-se para `me`/`other`.
 */

export const messagesKeys = {
  all: ["messages"] as const,
  customerList: (filter: string, search: string, limit: number) =>
    ["messages", "customers", "list", filter, search, limit] as const,
  customerThread: (conversationId: string) => ["messages", "customers", "thread", conversationId] as const,
  byCustomer: (customerId: string) => ["messages", "customers", "by-customer", customerId] as const,
  teamPeople: ["messages", "team", "people"] as const,
  teamThread: (personKey: string) => ["messages", "team", "thread", personKey] as const,
};

/** Invalida tudo o que depende das mensagens (listas, fios, contadores) — usado nas mutações e nos eventos SSE. */
export function invalidateMessages(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: messagesKeys.all });
  void qc.invalidateQueries({ queryKey: getMessagesSummaryQueryKey() });
}

// ── Normalização (exportada para teste) ──────────────────────────────────────

export function customerThreadToChat(t: MessagesCustomerThread): ChatThread {
  return {
    conversationId: t.conversationId,
    title: t.customerName,
    subtitle: t.customerEmail ?? null,
    messages: t.messages.map(
      (m): ChatMessage => ({
        messageId: m.messageId,
        conversationId: m.conversationId,
        senderRole: m.senderRole,
        senderUserId: m.senderRole === "customer" ? t.customerId : "",
        // O nome mostra-se só no lado do negócio (que membro respondeu); o cliente já está no cabeçalho.
        senderName: m.senderRole === "business" ? (m.senderName ?? null) : null,
        body: m.body ?? null,
        attachments: (m.attachments ?? null) as unknown as ChatAttachment[] | null,
        createdAt: m.createdAt,
      }),
    ),
    hasMore: t.hasMore,
    unread: t.unread,
    otherLastReadAt: t.otherLastReadAt ?? null,
  };
}

export function teamThreadToChat(t: MessagesTeamThread): ChatThread {
  return {
    conversationId: t.conversationId ?? "",
    title: t.person.name,
    readOnly: t.readOnly,
    messages: t.messages.map(
      (m): ChatMessage => ({
        messageId: m.messageId,
        conversationId: m.conversationId,
        senderRole: m.mine ? "me" : "other",
        senderUserId: m.senderKey,
        // 1-para-1: o nome da outra pessoa já está no cabeçalho.
        senderName: null,
        body: m.body ?? null,
        attachments: (m.attachments ?? null) as unknown as ChatAttachment[] | null,
        createdAt: m.createdAt,
      }),
    ),
    hasMore: t.hasMore,
    unread: t.unread,
    otherLastReadAt: t.otherLastReadAt ?? null,
  };
}

// ── Contador (menu, topbar, FAB) ─────────────────────────────────────────────

/** `GET /messages/summary` — fecha em sessão de suporte (403), por isso nem se pede. */
export function useMessagesSummary(enabled = true) {
  const { isAuthenticated, supportSession } = useAuth();
  return useQuery<MessagesSummary>({
    queryKey: getMessagesSummaryQueryKey(),
    enabled: isAuthenticated && enabled && !supportSession,
    staleTime: 0,
    queryFn: async () => (await getMessagesSummary()) as MessagesSummary,
  });
}

// ── Clientes ─────────────────────────────────────────────────────────────────

export type CustomerFilter = "all" | "unread";

export function useCustomerConversations(opts: { filter: CustomerFilter; search: string; limit: number; enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const { filter, search, limit, enabled = true } = opts;
  return useQuery<MessagesCustomerList>({
    queryKey: messagesKeys.customerList(filter, search, limit),
    enabled: isAuthenticated && enabled,
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await listCustomerConversations({ filter, ...(search ? { search } : {}), limit, offset: 0 })) as MessagesCustomerList,
  });
}

export function useCustomerThread(conversationId: string | null) {
  const { isAuthenticated } = useAuth();
  return useQuery<ChatThread>({
    queryKey: messagesKeys.customerThread(conversationId ?? ""),
    enabled: isAuthenticated && !!conversationId,
    staleTime: 0,
    queryFn: async () =>
      customerThreadToChat(await getCustomerConversationMessages(conversationId as string)),
  });
}

export function useReplyCustomer(conversationId: string) {
  const qc = useQueryClient();
  return useMutation<ChatMessage, unknown, MessageInput>({
    mutationFn: async (input) => {
      const m = await replyCustomerConversation(conversationId, input as never);
      return {
        messageId: m.messageId,
        conversationId: m.conversationId,
        senderRole: "business",
        senderUserId: "",
        senderName: m.senderName ?? null,
        body: m.body ?? null,
        attachments: (m.attachments ?? null) as unknown as ChatAttachment[] | null,
        createdAt: m.createdAt,
      };
    },
    onSuccess: () => invalidateMessages(qc),
  });
}

export function useMarkCustomerRead() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: async (conversationId) => {
      await readCustomerConversation(conversationId);
    },
    onSuccess: () => invalidateMessages(qc),
  });
}

/** Atalho da ficha do cliente: existe conversa? (`conversationId` null = nunca falou). */
export function useConversationByCustomer(customerId: string | null | undefined, enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery<{ conversationId: string | null; unread: number }>({
    queryKey: messagesKeys.byCustomer(customerId ?? ""),
    enabled: isAuthenticated && enabled && !!customerId,
    staleTime: 0,
    queryFn: async () =>
      (await getCustomerConversationByCustomer(customerId as string)) as { conversationId: string | null; unread: number },
  });
}

// ── Equipa ───────────────────────────────────────────────────────────────────

export function useTeamPeople(enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery<MessagesTeamPeople>({
    queryKey: messagesKeys.teamPeople,
    enabled: isAuthenticated && enabled,
    staleTime: 0,
    queryFn: async () => (await listTeamPeople()) as MessagesTeamPeople,
  });
}

export function useTeamThread(personKey: string | null) {
  const { isAuthenticated } = useAuth();
  return useQuery<ChatThread>({
    queryKey: messagesKeys.teamThread(personKey ?? ""),
    enabled: isAuthenticated && !!personKey,
    staleTime: 0,
    queryFn: async () => teamThreadToChat(await getTeamThread(personKey as string)),
  });
}

export function useSendTeam(personKey: string) {
  const qc = useQueryClient();
  return useMutation<ChatMessage, unknown, MessageInput>({
    mutationFn: async (input) => {
      const m = await sendTeamMessage(personKey, input as never);
      return {
        messageId: m.messageId,
        conversationId: m.conversationId,
        senderRole: "me",
        senderUserId: m.senderKey,
        senderName: null,
        body: m.body ?? null,
        attachments: (m.attachments ?? null) as unknown as ChatAttachment[] | null,
        createdAt: m.createdAt,
      };
    },
    onSuccess: () => invalidateMessages(qc),
  });
}

export function useMarkTeamRead() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: async (personKey) => {
      await readTeamThread(personKey);
    },
    onSuccess: () => invalidateMessages(qc),
  });
}

// ── Paginação para trás ──────────────────────────────────────────────────────

export async function fetchOlderCustomer(conversationId: string, before: string): Promise<ChatThread> {
  return customerThreadToChat(await getCustomerConversationMessages(conversationId, { before }));
}

export async function fetchOlderTeam(personKey: string, before: string): Promise<ChatThread> {
  return teamThreadToChat(await getTeamThread(personKey, { before }));
}
