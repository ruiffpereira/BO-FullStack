import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { MessageThread } from "./MessageThread";
import { Composer } from "./Composer";
import {
  useSupportThread,
  useSendSupportMessage,
  useMarkSupportRead,
  useAdminThread,
  useSendAdminMessage,
  useMarkAdminRead,
  fetchOlderMessages,
  mergeMessages,
  type ChatMessage,
  type ChatThread,
  type MessageInput,
  type SenderRole,
} from "../../hooks/useChat";

export type ChatScope = { kind: "support" } | { kind: "admin"; tenantUserId: string };

/**
 * Vista de uma conversa: thread (mensagens) + composer. Liga os hooks certos
 * conforme o scope (tenant vs admin), trata do envio otimista, marca lida e
 * pagina mensagens antigas. Partilhada pelo ChatDrawer e pela tab Mensagens.
 */
export function ChatConversationView({ scope, active = true }: { scope: ChatScope; active?: boolean }) {
  const { authHeader, userId } = useAuth();
  const meRole: SenderRole = scope.kind === "support" ? "tenant" : "admin";
  const adminTenantId = scope.kind === "admin" ? scope.tenantUserId : null;
  const scopeKey = scope.kind === "support" ? "support" : `admin:${scope.tenantUserId}`;

  const support = useSupportThread(scope.kind === "support" && active);
  const admin = useAdminThread(adminTenantId);
  const thread: ChatThread | undefined = scope.kind === "support" ? support.data : admin.data;
  const isLoading = scope.kind === "support" ? support.isLoading : admin.isLoading;

  const sendSupport = useSendSupportMessage();
  const sendAdmin = useSendAdminMessage(adminTenantId ?? "");
  const markSupport = useMarkSupportRead();
  const markAdmin = useMarkAdminRead();

  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const tempCounter = useRef(0);

  // Reset ao trocar de conversa
  useEffect(() => {
    setOptimistic([]);
    setOlder([]);
    setHasMore(false);
  }, [scopeKey]);

  // hasMore inicial vem da query (enquanto não há páginas antigas carregadas)
  useEffect(() => {
    if (thread && older.length === 0) setHasMore(thread.hasMore);
  }, [thread, older.length]);

  // Remove otimistas já confirmadas pelo servidor (mesmo messageId)
  useEffect(() => {
    if (!thread) return;
    const serverIds = new Set(thread.messages.map((m) => m.messageId));
    setOptimistic((prev) => prev.filter((m) => !serverIds.has(m.messageId)));
  }, [thread]);

  // Marca lida quando a conversa está visível e tem não-lidas
  useEffect(() => {
    if (!active || !thread || thread.unread <= 0) return;
    if (scope.kind === "support") markSupport.mutate();
    else markAdmin.mutate(scope.tenantUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, thread?.unread, scopeKey]);

  const serverMessages = useMemo(
    () => mergeMessages(older, thread?.messages ?? []),
    [older, thread],
  );
  const messages = useMemo(
    () => mergeMessages(serverMessages, optimistic),
    [serverMessages, optimistic],
  );

  const onLoadOlder = useCallback(async () => {
    if (loadingOlder) return;
    const oldest = serverMessages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const res = await fetchOlderMessages(
        scope.kind === "support" ? { kind: "support" } : { kind: "admin", tenantUserId: scope.tenantUserId },
        oldest.createdAt,
        authHeader,
      );
      setOlder((prev) => mergeMessages(res.messages, prev));
      setHasMore(res.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, serverMessages, scope, authHeader]);

  const onSend = useCallback(
    async (input: MessageInput) => {
      const tempId = `temp-${tempCounter.current++}`;
      const temp: ChatMessage = {
        messageId: tempId,
        conversationId: thread?.conversationId ?? "",
        senderRole: meRole,
        senderUserId: userId ?? "",
        body: input.body ?? null,
        attachments: input.attachments ?? null,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setOptimistic((prev) => [...prev, temp]);
      try {
        const real =
          scope.kind === "support"
            ? await sendSupport.mutateAsync(input)
            : await sendAdmin.mutateAsync(input);
        setOptimistic((prev) => prev.map((m) => (m.messageId === tempId ? { ...real } : m)));
      } catch {
        setOptimistic((prev) =>
          prev.map((m) => (m.messageId === tempId ? { ...m, pending: false, failed: true } : m)),
        );
      }
    },
    [scope, thread, meRole, userId, sendSupport, sendAdmin],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <MessageThread
        messages={messages}
        meRole={meRole}
        otherLastReadAt={thread?.otherLastReadAt ?? null}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        onLoadOlder={onLoadOlder}
        isLoading={isLoading}
      />
      <Composer
        onSend={onSend}
        placeholder={scope.kind === "support" ? "Mensagem para o suporte…" : "Responder…"}
      />
    </div>
  );
}
