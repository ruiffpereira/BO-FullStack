import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";

/**
 * Chat de suporte (Admin ↔ tenant). Endpoints manuais (sem Kubb):
 *  Tenant: GET/POST /chat/support/messages · POST /chat/support/read
 *  Admin:  GET /admin/chat/conversations · GET/POST /admin/chat/conversations/:id/messages · POST .../read
 * Tipos definidos localmente (espelham os schemas OpenAPI Chat* da API).
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
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<ChatThread>({
    queryKey: chatKeys.support,
    enabled: isAuthenticated && enabled,
    staleTime: 0,
    queryFn: async () => {
      const res = await axiosInstance.get<ChatThread>("/chat/support/messages", {
        headers: authHeader(),
      });
      return res.data;
    },
  });
}

export function useSendSupportMessage() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation<ChatMessage, unknown, MessageInput>({
    mutationFn: async (input) => {
      const res = await axiosInstance.post<ChatMessage>("/chat/support/messages", input, {
        headers: authHeader(),
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.support }),
  });
}

export function useMarkSupportRead() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await axiosInstance.post("/chat/support/read", {}, { headers: authHeader() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.support }),
  });
}

// ── Admin ────────────────────────────────────────────────────────────────────

export function useAdminConversations(search = "", enabled = true) {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<ConversationsResponse>({
    queryKey: chatKeys.adminConversations(search),
    enabled: isAuthenticated && enabled,
    staleTime: 0,
    queryFn: async () => {
      const res = await axiosInstance.get<ConversationsResponse>("/admin/chat/conversations", {
        headers: authHeader(),
        params: search ? { search } : undefined,
      });
      return res.data;
    },
  });
}

export function useAdminThread(tenantUserId: string | null) {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<ChatThread>({
    queryKey: chatKeys.adminThread(tenantUserId ?? ""),
    enabled: isAuthenticated && !!tenantUserId,
    staleTime: 0,
    queryFn: async () => {
      const res = await axiosInstance.get<ChatThread>(
        `/admin/chat/conversations/${tenantUserId}/messages`,
        { headers: authHeader() },
      );
      return res.data;
    },
  });
}

export function useSendAdminMessage(tenantUserId: string) {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation<ChatMessage, unknown, MessageInput>({
    mutationFn: async (input) => {
      const res = await axiosInstance.post<ChatMessage>(
        `/admin/chat/conversations/${tenantUserId}/messages`,
        input,
        { headers: authHeader() },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.adminThread(tenantUserId) });
      qc.invalidateQueries({ queryKey: ["chat", "admin", "conversations"] });
    },
  });
}

export function useMarkAdminRead() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: async (tenantUserId) => {
      await axiosInstance.post(
        `/admin/chat/conversations/${tenantUserId}/read`,
        {},
        { headers: authHeader() },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "admin", "conversations"] }),
  });
}

// ── Util: carregar mensagens antigas (paginação) ─────────────────────────────

export async function fetchOlderMessages(
  scope: { kind: "support" } | { kind: "admin"; tenantUserId: string },
  before: string,
  authHeader: () => Record<string, string>,
): Promise<ChatThread> {
  const url =
    scope.kind === "support"
      ? "/chat/support/messages"
      : `/admin/chat/conversations/${scope.tenantUserId}/messages`;
  const res = await axiosInstance.get<ChatThread>(url, {
    headers: authHeader(),
    params: { before },
  });
  return res.data;
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
