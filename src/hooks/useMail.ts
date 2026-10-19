import { useCallback } from "react";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useGetMailMailboxes } from "../gen/backoffice/hooks/useGetMailMailboxes.js";
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
