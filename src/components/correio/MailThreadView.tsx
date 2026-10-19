import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Badge } from "../../ui/ui.jsx";
import { Icon } from "../../ui/icons.jsx";
import { GuardButton } from "../GuardButton";
import { useTeamAccess } from "../../hooks/useTeamAccess";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import {
  useGetMailMailboxesMailboxidThreadsThreadid,
} from "../../gen/backoffice/hooks/useGetMailMailboxesMailboxidThreadsThreadid.js";
import { usePostMailMailboxesMailboxidThreadsThreadidRead } from "../../gen/backoffice/hooks/usePostMailMailboxesMailboxidThreadsThreadidRead.js";
import { usePostMailMailboxesMailboxidThreadsThreadidUnread } from "../../gen/backoffice/hooks/usePostMailMailboxesMailboxidThreadsThreadidUnread.js";
import { usePostMailMailboxesMailboxidThreadsThreadidArchive } from "../../gen/backoffice/hooks/usePostMailMailboxesMailboxidThreadsThreadidArchive.js";
import { usePostMailMailboxesMailboxidThreadsThreadidUnarchive } from "../../gen/backoffice/hooks/usePostMailMailboxesMailboxidThreadsThreadidUnarchive.js";
import type { MailMessage } from "../../gen/backoffice/types/MailMessage";
import type { MailAttachment } from "../../gen/backoffice/types/MailAttachment";
import {
  addressFull,
  addressListFull,
  formatBytes,
  formatMailDate,
  mailErrorMessage,
  normCid,
  type MailMode,
} from "../../lib/mail";
import { blobToDataUrlSafe, downloadMailAttachment, fetchMailAttachment, useInvalidateMail } from "../../hooks/useMail";
import { MailHtmlFrame } from "./MailHtmlFrame";
import { MailComposer } from "./MailComposer";

/** Imagens `cid:` de uma mensagem, resolvidas pelos anexos (data URI). Só as que o HTML realmente usa. */
function useCidImages(mailboxId: string, msg: MailMessage): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const html = (msg.html ?? "").toLowerCase();
    const atts = (msg.attachments ?? []).filter(
      (a) => a.attachmentId && a.cid && (a.type ?? "").startsWith("image/") && html.includes(normCid(a.cid)),
    );
    if (!msg.emailId || atts.length === 0) {
      setMap({});
      return;
    }
    let alive = true;
    Promise.all(
      atts.map(async (a) => {
        try {
          const blob = await fetchMailAttachment(mailboxId, msg.emailId!, a.attachmentId!);
          return [normCid(a.cid), await blobToDataUrlSafe(blob, a.type)] as const;
        } catch {
          return null; // uma imagem que falha fica no marcador; o resto da mensagem lê-se na mesma
        }
      }),
    ).then((rows) => {
      if (alive) setMap(Object.fromEntries(rows.filter((r): r is readonly [string, string] => !!r)));
    });
    return () => {
      alive = false;
    };
  }, [mailboxId, msg.emailId, msg.html, msg.attachments]);
  return map;
}

function AttachmentChip({ mailboxId, emailId, att }: { mailboxId: string; emailId: string; att: MailAttachment }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      data-testid="mail-attachment"
      disabled={busy || !att.attachmentId}
      onClick={async () => {
        if (!att.attachmentId) return;
        setBusy(true);
        try {
          await downloadMailAttachment(mailboxId, emailId, att.attachmentId, att.name ?? "anexo");
        } catch (e) {
          toast.error(mailErrorMessage(e, "Não foi possível descarregar o anexo."));
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1.5 max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
    >
      <Icon name={busy ? "loader" : "paperclip"} className={`w-3.5 h-3.5 shrink-0 ${busy ? "animate-spin" : ""}`} />
      <span className="truncate">{att.name || "anexo"}</span>
      {att.size ? <span className="text-zinc-400 shrink-0">{formatBytes(att.size)}</span> : null}
    </button>
  );
}

function MessageCard({
  mailboxId,
  msg,
  remoteImages,
}: {
  mailboxId: string;
  msg: MailMessage;
  remoteImages: boolean;
}) {
  const cidImages = useCidImages(mailboxId, msg);
  const downloads = (msg.attachments ?? []).filter((a) => !a.inline);
  const from = msg.from?.[0];
  return (
    <article
      data-testid="mail-message"
      className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
    >
      <header className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold text-zinc-900 dark:text-white break-words">
            {msg.outgoing ? "Tu" : addressFull(from) || "(sem remetente)"}
            {msg.outgoing && <Badge tone="blue" className="ml-2 align-middle">Enviado</Badge>}
          </p>
          <time className="shrink-0 text-xs text-zinc-400" dateTime={msg.receivedAt}>
            {formatMailDate(msg.receivedAt)}
          </time>
        </div>
        <p className="mt-0.5 text-xs text-zinc-500 break-words">Para: {addressListFull(msg.to) || "—"}</p>
        {(msg.cc?.length ?? 0) > 0 && <p className="text-xs text-zinc-500 break-words">Cc: {addressListFull(msg.cc)}</p>}
      </header>
      <div className="px-4 py-3">
        {msg.html ? (
          <MailHtmlFrame html={msg.html} allowRemoteImages={remoteImages} cidImages={cidImages} />
        ) : msg.text ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-zinc-800 dark:text-zinc-200">{msg.text}</pre>
        ) : (
          <p className="text-sm text-zinc-400">(sem conteúdo)</p>
        )}
      </div>
      {downloads.length > 0 && msg.emailId && (
        <footer className="px-4 pb-3 flex flex-wrap gap-2" aria-label="Anexos">
          {downloads.map((a) => (
            <AttachmentChip key={a.attachmentId ?? a.name} mailboxId={mailboxId} emailId={msg.emailId!} att={a} />
          ))}
        </footer>
      )}
    </article>
  );
}

/**
 * Conversa aberta: mensagens (HTML num iframe isolado), imagens remotas bloqueadas até ao clique, anexos para
 * descarregar e as acções. «Marcar lida» ao abrir é SÓ de quem pode Responder (Ver não mexe no estado); as acções de
 * escrita vão atrás de `GuardButton` com a folha `correio.caixa`.
 */
export function MailThreadView({
  mailboxId,
  mailboxAddress,
  threadId,
  archived,
  onBack,
}: {
  mailboxId: string;
  mailboxAddress: string;
  threadId: string;
  /** A pasta aberta é o Arquivo (a acção passa a «Desarquivar»). */
  archived: boolean;
  onBack: () => void;
}) {
  const invalidate = useInvalidateMail();
  const { can } = useTeamAccess();
  const { readOnly } = useWriteGuard("correio.caixa");
  const canRespond = can("correio.caixa", "edit");
  const [remote, setRemote] = useState(false);
  const [composer, setComposer] = useState<MailMode | null>(null);

  useEffect(() => {
    setRemote(false);
    setComposer(null);
  }, [threadId]);

  const q = useGetMailMailboxesMailboxidThreadsThreadid(
    mailboxId,
    threadId,
    remote ? { remoteImages: "true" } : undefined,
    { query: { retry: false } },
  );
  const messages = q.data?.messages ?? [];
  const last = messages[messages.length - 1];
  const hasRemote = messages.some((m) => m.hasRemoteImages);
  const hasUnread = messages.some((m) => m.unread);

  const markRead = usePostMailMailboxesMailboxidThreadsThreadidRead();
  const markUnread = usePostMailMailboxesMailboxidThreadsThreadidUnread();
  const archive = usePostMailMailboxesMailboxidThreadsThreadidArchive();
  const unarchive = usePostMailMailboxesMailboxidThreadsThreadidUnarchive();

  // Marca lida ao abrir — só quem pode Responder (a API recusa a quem só vê) e uma vez por conversa.
  const markedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!q.data || !hasUnread || !canRespond || readOnly) return;
    if (markedFor.current === threadId) return;
    markedFor.current = threadId;
    markRead.mutate({ mailboxId, threadId }, { onSuccess: () => invalidate() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, hasUnread, canRespond, readOnly, threadId, mailboxId]);

  const act = (m: typeof archive, ok: string, then?: () => void) =>
    m.mutate(
      { mailboxId, threadId },
      {
        onSuccess: () => {
          toast.success(ok);
          invalidate();
          then?.();
        },
        onError: (e) => toast.error(mailErrorMessage(e, "Não foi possível concluir.")),
      },
    );

  const subject = messages[0]?.subject || "(sem assunto)";

  return (
    <div className="flex flex-1 flex-col min-h-0" data-testid="mail-thread">
      <header className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 px-3 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="Voltar"
            className="lg:hidden w-9 h-9 -ml-1 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
          >
            <Icon name="chevronLeft" className="w-5 h-5" />
          </button>
          <h3 data-testid="mail-thread-subject" className="min-w-0 flex-1 text-sm font-semibold text-zinc-900 dark:text-white truncate">
            {q.isLoading ? "…" : subject}
          </h3>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <GuardButton leaf="correio.caixa" size="sm" variant="outline" icon="send" disabled={!last} onClick={() => setComposer("reply")}>
            Responder
          </GuardButton>
          <GuardButton leaf="correio.caixa" size="sm" variant="outline" disabled={!last} onClick={() => setComposer("reply_all")}>
            Responder a todos
          </GuardButton>
          <GuardButton leaf="correio.caixa" size="sm" variant="outline" disabled={!last} onClick={() => setComposer("forward")}>
            Encaminhar
          </GuardButton>
          {archived ? (
            <GuardButton
              leaf="correio.caixa"
              size="sm"
              variant="ghost"
              isLoading={unarchive.isPending}
              onClick={() => act(unarchive, "Conversa desarquivada.", onBack)}
            >
              Desarquivar
            </GuardButton>
          ) : (
            <GuardButton
              leaf="correio.caixa"
              size="sm"
              variant="ghost"
              isLoading={archive.isPending}
              onClick={() => act(archive, "Conversa arquivada.", onBack)}
            >
              Arquivar
            </GuardButton>
          )}
          <GuardButton
            leaf="correio.caixa"
            size="sm"
            variant="ghost"
            isLoading={markUnread.isPending}
            onClick={() => act(markUnread, "Marcada como não lida.", onBack)}
          >
            Marcar como não lido
          </GuardButton>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50/60 dark:bg-zinc-950/40 p-3 space-y-3">
        {hasRemote && !remote && (
          <div
            data-testid="mail-remote-images"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
          >
            <span className="flex-1 min-w-[12rem]">As imagens remotas estão bloqueadas — quem enviou pode saber que abriste o email.</span>
            <Button size="sm" variant="outline" onClick={() => setRemote(true)}>
              Mostrar imagens
            </Button>
          </div>
        )}
        {q.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ) : q.isError ? (
          <div className="text-sm text-red-600 dark:text-red-400 space-y-2">
            <p>{mailErrorMessage(q.error, "Não foi possível abrir a conversa.")}</p>
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          messages.map((m) => <MessageCard key={m.emailId} mailboxId={mailboxId} msg={m} remoteImages={remote} />)
        )}
      </div>

      <MailComposer
        open={composer !== null}
        onClose={() => setComposer(null)}
        mailboxId={mailboxId}
        mailboxAddress={mailboxAddress}
        mode={composer ?? "reply"}
        original={last}
      />
    </div>
  );
}
