import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Modal, Button, Input } from "../../ui/ui.jsx";
import { Icon } from "../../ui/icons.jsx";
import { GuardButton } from "../GuardButton";
import { usePostMailMailboxesMailboxidSend } from "../../gen/backoffice/hooks/usePostMailMailboxesMailboxidSend.js";
import { uploadImage } from "../../gen/backoffice/hooks/useUploadImage.js";
import { uploadPdf } from "../../gen/backoffice/hooks/useUploadPdf.js";
import type { MailMessage } from "../../gen/backoffice/types/MailMessage";
import { addressName, formatBytes, mailErrorMessage, parseRecipients, type MailMode } from "../../lib/mail";
import { useInvalidateMail } from "../../hooks/useMail";

const TITLE: Record<MailMode, string> = {
  new: "Novo email",
  reply: "Responder",
  reply_all: "Responder a todos",
  forward: "Encaminhar",
};

const MAX_FILES = 5;
const MAX_TOTAL = 20 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/**
 * Compositor: novo email, responder, responder a todos, encaminhar. O `from` é SEMPRE a caixa (a API não deixa
 * escolher). Em responder/responder a todos os destinatários e o assunto ficam vazios por omissão — a API deriva-os
 * do email original; só se escrever aqui é que o que escreveu manda. Novo email e Encaminhar exigem destinatário.
 * Anexos (foto/PDF) sobem para o storage do tenant (`module=mail`) antes do envio.
 */
export function MailComposer({
  open,
  onClose,
  mailboxId,
  mailboxAddress,
  mode,
  original,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  mailboxId: string;
  mailboxAddress: string;
  mode: MailMode;
  /** O email a que se responde / que se encaminha (da MESMA caixa). */
  original?: MailMessage | null;
  onSent?: (res: { emailId?: string; threadId?: string }) => void;
}) {
  const invalidate = useInvalidateMail();
  const send = usePostMailMailboxesMailboxidSend();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cada abertura começa limpa.
  useEffect(() => {
    if (!open) return;
    setTo("");
    setCc("");
    setBcc("");
    setShowCc(false);
    setSubject("");
    setText("");
    setFiles([]);
    setBusy(false);
    setTouched(false);
  }, [open, mode, original?.emailId]);

  const replying = mode === "reply" || mode === "reply_all";
  const pTo = parseRecipients(to);
  const pCc = parseRecipients(cc);
  const pBcc = parseRecipients(bcc);
  const invalid = [...pTo.invalid, ...pCc.invalid, ...pBcc.invalid];
  const recipientCount = pTo.valid.length + pCc.valid.length + pBcc.valid.length;
  const needsRecipient = !replying; // novo / encaminhar
  const missingRecipient = needsRecipient && recipientCount === 0;
  const empty = !text.trim() && files.length === 0;
  const totalSize = files.reduce((n, f) => n + f.size, 0);

  const error =
    invalid.length > 0
      ? `Endereço inválido: ${invalid[0]}`
      : missingRecipient
        ? "Indica pelo menos um destinatário."
        : recipientCount > 20
          ? "Demasiados destinatários (máximo 20)."
          : null;

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!MIMES.has(f.type)) {
        toast.error(`«${f.name}» não é uma foto (JPEG/PNG/WebP) nem um PDF.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        toast.error(`No máximo ${MAX_FILES} anexos.`);
        break;
      }
      if (next.reduce((n, x) => n + x.size, 0) + f.size > MAX_TOTAL) {
        toast.error("Os anexos juntos passam os 20 MB.");
        break;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    setTouched(true);
    if (busy || error || empty) return;
    setBusy(true);
    try {
      const attachments: { url: string; name: string; mime: any }[] = [];
      for (const f of files) {
        if (f.type === "application/pdf") {
          const r = await uploadPdf({ file: f, module: "mail" });
          attachments.push({ url: r.fileUrl, name: f.name, mime: f.type });
        } else {
          const r: any = await uploadImage({ image: f, module: "mail" } as any);
          attachments.push({ url: r.fileUrl, name: f.name, mime: f.type });
        }
      }
      const res = await send.mutateAsync({
        mailboxId,
        data: {
          mode,
          ...(mode !== "new" && original?.emailId ? { emailId: original.emailId } : {}),
          ...(pTo.valid.length ? { to: pTo.valid } : {}),
          ...(pCc.valid.length ? { cc: pCc.valid } : {}),
          ...(pBcc.valid.length ? { bcc: pBcc.valid } : {}),
          ...(subject.trim() ? { subject: subject.trim() } : {}),
          text,
          ...(attachments.length ? { attachments } : {}),
        },
      });
      toast.success("Email enviado.");
      invalidate();
      onSent?.(res ?? {});
      onClose();
    } catch (e) {
      toast.error(mailErrorMessage(e, "Não foi possível enviar o email."));
    } finally {
      setBusy(false);
    }
  }

  const replyHint =
    mode === "reply_all"
      ? "Se deixares vazio, responde ao remetente e a todos os que estavam em cópia."
      : mode === "reply"
        ? `Se deixares vazio, responde a ${original ? addressName(original.outgoing ? original.to?.[0] : original.from?.[0]) || "quem escreveu" : "quem escreveu"}.`
        : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITLE[mode]}
      subtitle={`De: ${mailboxAddress}`}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <GuardButton
            leaf="correio.caixa"
            icon="send"
            onClick={submit}
            isLoading={busy}
            disabled={busy || (touched && (!!error || empty))}
          >
            Enviar
          </GuardButton>
        </>
      }
    >
      <div className="space-y-3" data-testid="mail-composer">
        <Input
          label="Para"
          value={to}
          onChange={(e: any) => setTo(e.target.value)}
          placeholder={replying ? "Automático" : "nome@exemplo.pt, outro@exemplo.pt"}
          hint={replyHint}
          autoComplete="off"
          inputMode="email"
        />
        {showCc ? (
          <>
            <Input label="Cc" value={cc} onChange={(e: any) => setCc(e.target.value)} autoComplete="off" inputMode="email" />
            <Input label="Bcc" value={bcc} onChange={(e: any) => setBcc(e.target.value)} autoComplete="off" inputMode="email" />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowCc(true)}
            className="text-[13px] font-medium text-accent hover:underline"
          >
            Cc / Bcc
          </button>
        )}
        <Input
          label="Assunto"
          value={subject}
          onChange={(e: any) => setSubject(e.target.value)}
          placeholder={mode === "new" ? "" : "Igual ao da conversa"}
          autoComplete="off"
        />
        <label className="block">
          <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Mensagem</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition resize-y"
          />
        </label>

        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Anexos">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="inline-flex items-center gap-1.5 max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-300"
              >
                <Icon name="paperclip" className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="text-zinc-400 shrink-0">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  aria-label={`Remover ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <Icon name="x" className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept={ACCEPT} multiple className="sr-only" aria-label="Escolher anexos" onChange={(e) => pickFiles(e.target.files)} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon="paperclip"
            disabled={busy || files.length >= MAX_FILES}
            onClick={() => fileRef.current?.click()}
          >
            Anexar
          </Button>
          <span className="text-xs text-zinc-400">
            Fotos e PDF · até {MAX_FILES} anexos, 20 MB{totalSize > 0 ? ` (${formatBytes(totalSize)})` : ""}
          </span>
        </div>

        {touched && (error || empty) && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error ?? "O email está vazio — escreve uma mensagem ou junta um anexo."}
          </p>
        )}
      </div>
    </Modal>
  );
}
