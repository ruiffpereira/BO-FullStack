import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getChatSupportMessages } from "../gen/backoffice/hooks/useGetChatSupportMessages.js";
import { postChatSupportMessages } from "../gen/backoffice/hooks/usePostChatSupportMessages.js";
import { postChatSupportRead } from "../gen/backoffice/hooks/usePostChatSupportRead.js";
import { getAdminChatConversations } from "../gen/backoffice/hooks/useGetAdminChatConversations.js";
import { getAdminChatConversationsTenantuseridMessages } from "../gen/backoffice/hooks/useGetAdminChatConversationsTenantuseridMessages.js";
import { postAdminChatConversationsTenantuseridMessages } from "../gen/backoffice/hooks/usePostAdminChatConversationsTenantuseridMessages.js";
import { postAdminChatConversationsTenantuseridRead } from "../gen/backoffice/hooks/usePostAdminChatConversationsTenantuseridRead.js";

/**
 * Chat de suporte (Admin ↔ tenant). Migrado (B18) para os clients gerados pelo
 * Kubb — os paths deixaram de estar escritos à mão:
 *  Tenant: GET/POST /chat/support/messages · POST /chat/support/read
 *  Admin:  GET /admin/chat/conversations · GET/POST /admin/chat/conversations/:id/messages · POST .../read
 * Tipos mantidos localmente (em vez dos gerados): os gerados marcam como
 * opcionais campos que a API devolve sempre (ex.: `unread`) e não incluem os
 * campos só-de-cliente (`pending`/`failed`) usados pelo envio otimista — os
 * `as` abaixo fazem a ponte, o payload em runtime não muda.
 */

export type SenderRole = "admin" | "tenant";

export interface ChatAttachment {
  url: string;
  name?: string;
  mime?: string;
  size?: number;
  width?: number;
  height?: number;
  srcSet?: string;
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderRole: SenderRole;
  senderUserId: string;
  body: string | null;
  attachments: ChatAttachment[] | null;
  createdAt: string;
  /** Só no cliente: estado de envio otimista. */
  pending?: boolean;
  failed?: boolean;
}

export interface ChatThread {
  conversationId: string;
  tenantUserId?: string | null;
  messages: ChatMessage[];
  hasMore: boolean;
  unread: number;
  otherLastReadAt: string | null;
}

export interface ChatConversation {
  conversationId: string;
  tenantUserId: string;
  tenantName: string;
  tenantEmail: string | null;
  lastMessageAt: string | null;
  unread: number;
  lastMessage: { senderRole: SenderRole; preview: string; createdAt: string } | null;
}

export interface ConversationsResponse {
  conversations: ChatConversation[];
  unreadTotal: number;
}

export interface MessageInput {
  body?: string | null;
  attachments?: ChatAttachment[] | null;
}

export const chatKeys = {
  all: ["chat"] as const,
  support: ["chat", "support"] as const,
  adminConversations: (search?: string) => ["chat", "admin", "conversations", search ?? ""] as const,
  adminThread: (tenantUserId: string) => ["chat", "admin", "thread", tenantUserId] as const,
};

// ── Tenant ───────────────────────────────────────────────────────────────────

export function useSupportThread(enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery<ChatThread>({
    queryKey: chatKeys.support,
    enabled: isAuthenticated && enabled,
    staleTime: 0,
    queryFn: async () => (await getChatSupportMessages()) as ChatThread,
  });
}

export function useSendSupportMessage() {
  const qc = useQueryClient();
  return useMutation<ChatMessage, unknown, MessageInput>({
    mutationFn: async (input) => (await postChatSupportMessages(input)) as ChatMessage,
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
    queryFn: async () =>
      (await getAdminChatConversations(search ? { search } : undefined)) as ConversationsResponse,
  });
}

export function useAdminThread(tenantUserId: string | null) {
  const { isAuthenticated } = useAuth();
  return useQuery<ChatThread>({
    queryKey: chatKeys.adminThread(tenantUserId ?? ""),
    enabled: isAuthenticated && !!tenantUserId,
    staleTime: 0,
    queryFn: async () =>
      // `enabled` garante que a queryFn só corre com tenantUserId definido.
      (await getAdminChatConversationsTenantuseridMessages(tenantUserId as string)) as ChatThread,
  });
}

export function useSendAdminMessage(tenantUserId: string) {
  const qc = useQueryClient();
  return useMutation<ChatMessage, unknown, MessageInput>({
    mutationFn: async (input) =>
      (await postAdminChatConversationsTenantuseridMessages(tenantUserId, input)) as ChatMessage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.adminThread(tenantUserId) });
      qc.invalidateQueries({ queryKey: ["chat", "admin", "conversations"] });
    },
  });
}

export function useMarkAdminRead() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: async (tenantUserId) => {
      await postAdminChatConversationsTenantuseridRead(tenantUserId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "admin", "conversations"] }),
  });
}

// ── Util: carregar mensagens antigas (paginação) ─────────────────────────────

export async function fetchOlderMessages(
  scope: { kind: "support" } | { kind: "admin"; tenantUserId: string },
  before: string,
  _authHeader: () => Record<string, string>,
): Promise<ChatThread> {
  // `_authHeader` mantém-se na assinatura por compatibilidade com o chamador
  // (ChatConversationView.tsx, fora do âmbito desta migração) — deixou de ser
  // necessário: o client gerado corre no mesmo axiosInstance partilhado cujo
  // interceptor (AuthContext.tsx) já injeta o Authorization.
  const data =
    scope.kind === "support"
      ? await getChatSupportMessages({ before })
      : await getAdminChatConversationsTenantuseridMessages(scope.tenantUserId, { before });
  return data as ChatThread;
}

/**
 * Contador de não-lidas do utilizador atual (serve o badge do topbar/FAB/sidebar):
 *  - Admin → nº de conversas com mensagens por ler (`unreadTotal`).
 *  - Tenant → não-lidas da sua conversa de suporte.
 * Gere a query certa conforme o papel (evita 403 do lado errado).
 */
export function useChatUnread(): number {
  const { permissions } = useAuth();
  const isAdmin = permissions.some((p) => p.name === "VIEW_ADMIN");
  const admin = useAdminConversations("", isAdmin);
  const support = useSupportThread(!isAdmin);
  return isAdmin ? admin.data?.unreadTotal ?? 0 : support.data?.unread ?? 0;
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
