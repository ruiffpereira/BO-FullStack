import { useCallback } from "react";
import { toast } from "sonner";
import { useQueryClient, type Query, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useGetMailMailboxes } from "../gen/backoffice/hooks/useGetMailMailboxes.js";
import { usePostMailMailboxesMailboxidThreadsThreadidPin } from "../gen/backoffice/hooks/usePostMailMailboxesMailboxidThreadsThreadidPin.js";
import { usePostMailMailboxesMailboxidThreadsThreadidUnpin } from "../gen/backoffice/hooks/usePostMailMailboxesMailboxidThreadsThreadidUnpin.js";
import { getNotificationsQueryKey } from "./useNotifications";
import { mailErrorMessage } from "../lib/mail";
import { getMailMailboxesMailboxidEmailsEmailidAttachmentsAttachmentid } from "../gen/backoffice/hooks/useGetMailMailboxesMailboxidEmailsEmailidAttachmentsAttachmentid.js";

/** Chaves do Kubb começam por `{ url: "/mail/…" }` — é o prefixo que o SSE e as mutações invalidam. */
const isMailQuery = (q: Query) => {
  const head = q.queryKey[0] as { url?: unknown } | undefined;
  return typeof head?.url === "string" && head.url.startsWith("/mail");
};

export function useInvalidateMail() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ predicate: isMailQuery }), [qc]);
}

/** Depois de ler uma conversa a API limpa o aviso do sino (CR-27): refresca o sino sem esperar pelo SSE. */
export function invalidateNotifications(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: getNotificationsQueryKey() });
}

/** Para o `useSSE` (fora de componentes): invalida tudo o que é correio. */
export function invalidateMailQueries(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ predicate: isMailQuery });
}

/**
 * Contador de não lidas do item «Correio» (soma das caixas a que tenho acesso). Só corre com o item na sidebar e
 * fora de uma sessão de suporte (a API fecha `/mail/*` aí). Recarrega de vez em quando; o SSE `mail_new` invalida já.
 */
export function useMailUnread(enabled: boolean): number {
  const { supportSession } = useAuth();
  const q = useGetMailMailboxes({
    query: { enabled: enabled && !supportSession, refetchInterval: 60_000, staleTime: 15_000, retry: false },
  });
  return (q.data?.mailboxes ?? []).reduce((n, m) => n + (m.unread ?? 0), 0);
}

/** Descarrega o binário (autenticado) de um anexo recebido. */
export async function fetchMailAttachment(mailboxId: string, emailId: string, attachmentId: string): Promise<Blob> {
  const res = await getMailMailboxesMailboxidEmailsEmailidAttachmentsAttachmentid(mailboxId, emailId, attachmentId, {
    responseType: "blob",
  });
  return res as unknown as Blob;
}

/** Entrega o anexo ao utilizador como descarga. */
export async function downloadMailAttachment(mailboxId: string, emailId: string, attachmentId: string, name: string) {
  const blob = await fetchMailAttachment(mailboxId, emailId, attachmentId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name || "anexo";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Blob → data URI (as imagens `cid:` vão para um iframe sem origem própria, onde um `blob:` do pai não carrega). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Como `blobToDataUrl`, mas com o tipo do anexo (o servidor pode servir imagens como octet-stream). */
export function blobToDataUrlSafe(blob: Blob, type?: string): Promise<string> {
  return blobToDataUrl(type ? new Blob([blob], { type }) : blob);
}

// ── Fixar conversas (CR-26) ───────────────────────────────────────────────────

type Snapshot = Array<[readonly unknown[], unknown]>;
type ThreadList = { items?: Array<{ threadId?: string; pinned?: boolean }> };

const keyHead = (q: Query) => q.queryKey[0] as { url?: string; params?: { mailboxId?: string; threadId?: string } } | undefined;

/**
 * Optimistic update: a linha passa já para o topo (ou volta) em todas as listas da caixa, e o detalhe diz `pinned`. Devolve o que
 * estava para repor se a API recusar. A ordem certa (por data, em todas as páginas) vem da API quando as listas se invalidam a seguir.
 */
export function applyPinOptimistic(qc: QueryClient, mailboxId: string, threadId: string, pinned: boolean): Snapshot {
  const snapshot: Snapshot = [];
  const mine = (q: Query, url: string) => {
    const h = keyHead(q);
    return h?.url === url && h.params?.mailboxId === mailboxId;
  };
  qc.getQueriesData({ predicate: (q) => mine(q, "/mail/mailboxes/:mailboxId/threads") || (mine(q, "/mail/mailboxes/:mailboxId/threads/:threadId") && keyHead(q)?.params?.threadId === threadId) }).forEach(([key, data]) =>
    snapshot.push([key, data]),
  );
  qc.setQueriesData<ThreadList>({ predicate: (q) => mine(q, "/mail/mailboxes/:mailboxId/threads") }, (old) => {
    if (!old?.items) return old;
    const items = old.items.map((i) => (i.threadId === threadId ? { ...i, pinned } : i));
    return { ...old, items: [...items.filter((i) => i.pinned), ...items.filter((i) => !i.pinned)] };
  });
  qc.setQueriesData<{ pinned?: boolean }>(
    { predicate: (q) => mine(q, "/mail/mailboxes/:mailboxId/threads/:threadId") && keyHead(q)?.params?.threadId === threadId },
    (old) => (old ? { ...old, pinned } : old),
  );
  return snapshot;
}

/** Fixar / desafixar com optimistic update; as escritas ficam atrás do `GuardButton` de quem chama. */
export function usePinThread(mailboxId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateMail();
  const pin = usePostMailMailboxesMailboxidThreadsThreadidPin();
  const unpin = usePostMailMailboxesMailboxidThreadsThreadidUnpin();
  const toggle = useCallback(
    (threadId: string, pinned: boolean) => {
      const snapshot = applyPinOptimistic(qc, mailboxId, threadId, pinned);
      (pinned ? pin : unpin).mutate(
        { mailboxId, threadId },
        {
          onError: (e) => {
            snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
            toast.error(mailErrorMessage(e, "Não foi possível fixar a conversa."));
          },
          onSettled: () => {
            void invalidate();
          },
        },
      );
    },
    [qc, mailboxId, pin, unpin, invalidate],
  );
  return { toggle, isPending: pin.isPending || unpin.isPending };
}
