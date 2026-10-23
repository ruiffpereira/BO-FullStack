import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { MessageThread } from "./MessageThread";
import { Composer } from "./Composer";
import { SUPPORT_UNAVAILABLE_NOTE } from "../../lib/supportSession";
import { VIEW_ONLY_MESSAGE } from "../../lib/teamAccess";
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
import {
  useCustomerThread,
  useReplyCustomer,
  useMarkCustomerRead,
  useTeamThread,
  useSendTeam,
  useMarkTeamRead,
  fetchOlderCustomer,
  fetchOlderTeam,
} from "../../hooks/useMessages";

/** Suporte/admin (já existiam) + B43: conversa com um cliente do site e conversa 1-para-1 da equipa. */
export type ChatScope =
  | { kind: "support" }
  | { kind: "admin"; tenantUserId: string; tenantName?: string }
  | { kind: "customer"; conversationId: string }
  | { kind: "team"; personKey: string };

const REMOVED_NOTE = "Esta pessoa já não está na equipa — a conversa fica só para leitura.";

function scopeKeyOf(scope: ChatScope): string {
  switch (scope.kind) {
    case "support": return "support";
    case "admin": return `admin:${scope.tenantUserId}`;
    case "customer": return `customer:${scope.conversationId}`;
    case "team": return `team:${scope.personKey}`;
  }
}

/**
 * Vista de uma conversa: thread (mensagens) + composer. Liga os hooks certos
 * conforme o scope (tenant vs admin), trata do envio otimista, marca lida e
 * pagina mensagens antigas. Partilhada pelo ChatDrawer e pela tab Mensagens.
 */
export function ChatConversationView({ scope, active = true }: { scope: ChatScope; active?: boolean }) {
  const { userId, supportSession, can } = useAuth();
  // Equipa (B41/B43): cada conversa guarda-se pela SUA folha — só `view` lê mas não envia. (O dono pode sempre.)
  const leaf =
    scope.kind === "support" ? "mensagens.suporte"
    : scope.kind === "customer" ? "mensagens.clientes"
    : scope.kind === "team" ? "mensagens.equipa"
    : null;
  const viewOnlyByTree = leaf !== null && can(leaf, "view") && !can(leaf, "edit");
  // Sessão de suporte: o chat é só de leitura (a API recusa enviar e marcar lida).
  const inSupport = !!supportSession;
  const meRole: SenderRole =
    scope.kind === "support" ? "tenant" : scope.kind === "admin" ? "admin" : scope.kind === "customer" ? "business" : "me";
  const adminTenantId = scope.kind === "admin" ? scope.tenantUserId : null;
  const customerId = scope.kind === "customer" ? scope.conversationId : null;
  const teamKey = scope.kind === "team" ? scope.personKey : null;
  const scopeKey = scopeKeyOf(scope);

  const support = useSupportThread(scope.kind === "support" && active);
  const admin = useAdminThread(adminTenantId);
  const customer = useCustomerThread(customerId);
  const team = useTeamThread(teamKey);
  const current = { support, admin, customer, team }[scope.kind];
  const thread: ChatThread | undefined = current.data;
  const isLoading = current.isLoading;
  // Membro removido (equipa): o fio fica para leitura, com o nome guardado.
  const removedReadOnly = scope.kind === "team" && !!thread?.readOnly;
  const viewOnly = viewOnlyByTree || removedReadOnly;

  const sendSupport = useSendSupportMessage();
  const sendAdmin = useSendAdminMessage(adminTenantId ?? "");
  const sendCustomer = useReplyCustomer(customerId ?? "");
  const sendTeam = useSendTeam(teamKey ?? "");
  const markSupport = useMarkSupportRead();
  const markAdmin = useMarkAdminRead();
  const markCustomer = useMarkCustomerRead();
  const markTeam = useMarkTeamRead();

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
    if (inSupport || !active || !thread || thread.unread <= 0) return;
    if (scope.kind === "support") markSupport.mutate();
    else if (scope.kind === "admin") markAdmin.mutate(scope.tenantUserId);
    else if (scope.kind === "customer") markCustomer.mutate(scope.conversationId);
    else markTeam.mutate(scope.personKey);
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
      const res =
        scope.kind === "customer"
          ? await fetchOlderCustomer(scope.conversationId, oldest.createdAt)
          : scope.kind === "team"
            ? await fetchOlderTeam(scope.personKey, oldest.createdAt)
            : await fetchOlderMessages(
                scope.kind === "support" ? { kind: "support" } : { kind: "admin", tenantUserId: scope.tenantUserId },
                oldest.createdAt,
              );
      setOlder((prev) => mergeMessages(res.messages, prev));
      setHasMore(res.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, serverMessages, scope]);

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
        const sender = { support: sendSupport, admin: sendAdmin, customer: sendCustomer, team: sendTeam }[scope.kind];
        const real = await sender.mutateAsync(input);
        setOptimistic((prev) => prev.map((m) => (m.messageId === tempId ? { ...real } : m)));
      } catch {
        setOptimistic((prev) =>
          prev.map((m) => (m.messageId === tempId ? { ...m, pending: false, failed: true } : m)),
        );
      }
    },
    [scope, thread, meRole, userId, sendSupport, sendAdmin, sendCustomer, sendTeam],
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
        tenantName={scope.kind === "admin" ? scope.tenantName : undefined}
      />
      <Composer
        onSend={onSend}
        placeholder={
          scope.kind === "support" ? "Mensagem para o suporte…"
          : scope.kind === "team" ? "Escreve uma mensagem…"
          : "Responder…"
        }
        allowPdf={scope.kind === "customer" || scope.kind === "team"}
        disabled={inSupport || viewOnly}
        disabledNote={
          inSupport ? SUPPORT_UNAVAILABLE_NOTE : removedReadOnly ? REMOVED_NOTE : viewOnly ? VIEW_ONLY_MESSAGE : undefined
        }
      />
    </div>
  );
}
