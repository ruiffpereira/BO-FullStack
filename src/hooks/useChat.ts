import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getChatSupportMessages } from "../gen/backoffice/hooks/useGetChatSupportMessages.js";
import { postChatSupportMessages } from "../gen/backoffice/hooks/usePostChatSupportMessages.js";
import { postChatSupportRead } from "../gen/backoffice/hooks/usePostChatSupportRead.js";
import { getAdminChatConversations } from "../gen/backoffice/hooks/useGetAdminChatConversations.js";
import { getAdminChatConversationsTenantuseridMessages } from "../gen/backoffice/hooks/useGetAdminChatConversationsTenantuseridMessages.js";
import { postAdminChatConversationsTenantuseridMessages } from "../gen/backoffice/hooks/usePostAdminChatConversationsTenantuseridMessages.js";
import { useMessagesSummary } from "./useMessages";
import { postAdminChatConversationsTenantuseridRead } from "../gen/backoffice/hooks/usePostAdminChatConversationsTenantuseridRead.js";
import type { ChatAttachment as GenChatAttachment } from "../gen/backoffice/types/ChatAttachment.js";
import type { ChatConversation as GenChatConversation } from "../gen/backoffice/types/ChatConversation.js";
import type { ChatMessage as GenChatMessage } from "../gen/backoffice/types/ChatMessage.js";
import type { ChatMessageInput } from "../gen/backoffice/types/ChatMessageInput.js";
import type { ChatThread as GenChatThread } from "../gen/backoffice/types/ChatThread.js";
import type { GetAdminChatConversations200 } from "../gen/backoffice/types/GetAdminChatConversations.js";
import { queryKeys } from '../lib/queryKeys'

/**
 * Chat de suporte (Admin ↔ tenant). Migrado (B18) para os clients gerados pelo
 * Kubb — os paths deixaram de estar escritos à mão:
 *  Tenant: GET/POST /chat/support/messages · POST /chat/support/read
 *  Admin:  GET /admin/chat/conversations · GET/POST /admin/chat/conversations/:id/messages · POST .../read
 * Tipos DERIVADOS do gerado: só se acrescenta o que o gerado não pode saber — os
 * campos só-de-cliente (`pending`/`failed`, envio otimista), os papéis das
 * conversas de Clientes/Equipa (B43) e o cabeçalho dessas conversas.
 */

/** Suporte: admin/tenant · Clientes (B43): business/customer · Equipa (B43): me/other. */
export type SenderRole = "admin" | "tenant" | "business" | "customer" | "me" | "other";

export type ChatAttachment = GenChatAttachment;

export type ChatMessage = Omit<GenChatMessage, "senderRole" | "senderName"> & {
  senderRole: SenderRole;
  /** Nome do membro da equipa que escreveu (B41); `null` = o dono do tenant ou o suporte. */
  senderName?: string | null;
  /** Só no cliente: estado de envio otimista. */
  pending?: boolean;
  failed?: boolean;
};

export type ChatThread = Omit<GenChatThread, "messages"> & {
  messages: ChatMessage[];
  /** B43: nome para o cabeçalho (cliente / pessoa da equipa) e conversa só de leitura (membro removido). */
  title?: string;
  subtitle?: string | null;
  readOnly?: boolean;
};

export type ChatConversation = GenChatConversation;

export type ConversationsResponse = GetAdminChatConversations200;

export type MessageInput = ChatMessageInput;

export const chatKeys = queryKeys.chat;

// ── Tenant ───────────────────────────────────────────────────────────────────

export function useSupportThread(enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery<ChatThread>({
    queryKey: chatKeys.support,
    enabled: isAuthenticated && enabled,
    staleTime: 0,
    queryFn: () => getChatSupportMessages(),
  });
}

export function useSendSupportMessage() {
  const qc = useQueryClient();
  return useMutation<ChatMessage, unknown, MessageInput>({
    mutationFn: (input) => postChatSupportMessages(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.support }),
  });
}

export function useMarkSupportRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await postChatSupportRead();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.support }),
  });
}

// ── Admin ────────────────────────────────────────────────────────────────────

export function useAdminConversations(search = "", enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery<ConversationsResponse>({
    queryKey: chatKeys.adminConversations(search),
    enabled: isAuthenticated && enabled,
    staleTime: 0,
    queryFn: () =>
      getAdminChatConversations(search ? { search } : undefined),
  });
}

export function useAdminThread(tenantUserId: string | null) {
  const { isAuthenticated } = useAuth();
  return useQuery<ChatThread>({
    queryKey: chatKeys.adminThread(tenantUserId ?? ""),
    enabled: isAuthenticated && !!tenantUserId,
    staleTime: 0,
    queryFn: () =>
      // `enabled` garante que a queryFn só corre com tenantUserId definido.
      getAdminChatConversationsTenantuseridMessages(tenantUserId as string),
  });
}

export function useSendAdminMessage(tenantUserId: string) {
  const qc = useQueryClient();
  return useMutation<ChatMessage, unknown, MessageInput>({
    mutationFn: (input) =>
      postAdminChatConversationsTenantuseridMessages(tenantUserId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.adminThread(tenantUserId) });
      qc.invalidateQueries({ queryKey: chatKeys.adminConversationsRoot });
    },
  });
}

export function useMarkAdminRead() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: async (tenantUserId) => {
      await postAdminChatConversationsTenantuseridRead(tenantUserId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.adminConversationsRoot }),
  });
}

// ── Util: carregar mensagens antigas (paginação) ─────────────────────────────

export async function fetchOlderMessages(
  scope: { kind: "support" } | { kind: "admin"; tenantUserId: string },
  before: string,
): Promise<ChatThread> {
  const data =
    scope.kind === "support"
      ? await getChatSupportMessages({ before })
      : await getAdminChatConversationsTenantuseridMessages(scope.tenantUserId, { before });
  return data;
}

/**
 * Contador de não-lidas do utilizador atual (serve o badge do topbar/FAB/sidebar):
 *  - Admin → nº de conversas com mensagens por ler (`unreadTotal`) do Suporte.
 *  - Tenant/membro → `summary.total` (B43: Clientes + Equipa + Suporte, cada um só com a sua folha).
 * Gere a query certa conforme o papel (evita 403 do lado errado).
 */
export function useChatUnread(): number {
  const { permissions, isMember, can } = useAuth();
  const isAdmin = permissions.some((p) => p.name === "VIEW_ADMIN");
  // Um membro sem nenhuma folha de Mensagens não tem chat (a API devolveria 403): nem se pede.
  const hasLeaf = !isMember || can("mensagens");
  const admin = useAdminConversations("", isAdmin);
  const summary = useMessagesSummary(!isAdmin && hasLeaf);
  return isAdmin ? admin.data?.unreadTotal ?? 0 : summary.data?.total ?? 0;
}

/** Une mensagens por messageId (incoming sobrepõe), mantém otimistas e ordena. */
export function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of prev) byId.set(m.messageId, m);
  for (const m of incoming) byId.set(m.messageId, m);
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}
