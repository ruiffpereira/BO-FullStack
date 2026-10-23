import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Modal } from "../../ui/ui.jsx";
import { Icon } from "../../ui/icons.jsx";
import { GuardButton } from "../GuardButton";
import { confirmDialog } from "../confirm";
import { useInvalidateMail } from "../../hooks/useMail";
import { useGetMailMailboxesMailboxidAppPassword } from "../../gen/backoffice/hooks/useGetMailMailboxesMailboxidAppPassword.js";
import { usePostMailMailboxesMailboxidAppPassword } from "../../gen/backoffice/hooks/usePostMailMailboxesMailboxidAppPassword.js";
import { useDeleteMailMailboxesMailboxidAppPassword } from "../../gen/backoffice/hooks/useDeleteMailMailboxesMailboxidAppPassword.js";
import type { MailAppPasswordCreated } from "../../gen/backoffice/types/MailAppPasswordCreated.js";
import type { MailClientSettings } from "../../gen/backoffice/types/MailClientSettings.js";
import { mailErrorMessage, mailLeaf } from "../../lib/mail";

type Box = { mailboxId?: string; address?: string; /** Caixa pessoal: não depende de `correio.caixa`. */ personal?: boolean };

async function copy(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${what} copiado`);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-28 shrink-0 text-xs text-zinc-500">{label}</span>
      <span className={`min-w-0 flex-1 break-all text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
      <button
        type="button"
        aria-label={`Copiar ${label.toLowerCase()}`}
        title={`Copiar ${label.toLowerCase()}`}
        onClick={() => copy(value, label)}
        className="shrink-0 p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <Icon name="copy" className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const server = (s?: { host?: string | null; port?: number; security?: string }) =>
  s?.host ? `${s.host}${s.port ? `:${s.port}` : ""}${s.security ? ` (${s.security})` : ""}` : "";

/**
 * Correio → Caixa → «Configurar no telemóvel»: a password da app (IMAP/SMTP no telemóvel ou no Outlook) da caixa que é
 * MINHA (a pessoal e a `suporte@` para o dono, a própria para um membro — a API diz-o em `canManageAppPassword`). A password
 * aparece UMA vez, logo a seguir a gerar: fica só em memória deste componente (não vai para a cache de queries) e some
 * ao fechar. «Revogar» corta todas as passwords da app (o Backoffice continua a funcionar).
 */
export function MailAppPasswordModal({ mailbox, onClose }: { mailbox: Box | null; onClose: () => void }) {
  const mailboxId = mailbox?.mailboxId ?? "";
  const invalidate = useInvalidateMail();
  const [created, setCreated] = useState<MailAppPasswordCreated | null>(null);

  const statusQ = useGetMailMailboxesMailboxidAppPassword(mailboxId, { query: { enabled: !!mailboxId, retry: false } });

  const createM = usePostMailMailboxesMailboxidAppPassword({
    mutation: {
      onSuccess: (res) => {
        setCreated(res);
        invalidate();
      },
      onError: (e: unknown) => toast.error(mailErrorMessage(e, "Não foi possível gerar a password.")),
    },
  });
  const revokeM = useDeleteMailMailboxesMailboxidAppPassword({
    mutation: {
      onSuccess: () => {
        setCreated(null);
        toast.success("Passwords da app revogadas.");
        invalidate();
      },
      onError: (e: unknown) => toast.error(mailErrorMessage(e, "Não foi possível revogar.")),
    },
  });

  // Fechar (ou mudar de caixa) apaga a password do ecrã.
  useEffect(() => {
    setCreated(null);
  }, [mailboxId]);
  const close = () => {
    setCreated(null);
    createM.reset();
    onClose();
  };

  const status = statusQ.data;
  const settings: MailClientSettings | undefined = created?.settings ?? status?.settings;
  const count = created?.count ?? status?.count ?? 0;

  const revoke = async () => {
    const ok = await confirmDialog({
      title: "Revogar as passwords da app?",
      message:
        "O telemóvel e o Outlook deixam de abrir esta caixa até gerares uma password nova. O Backoffice continua a funcionar.",
      confirmLabel: "Revogar",
      danger: true,
      leaf: mailLeaf(mailbox?.personal), // a do botão que abre este diálogo (caixa pessoal: sem folha da equipa)
    });
    if (ok && mailboxId) revokeM.mutate({ mailboxId });
  };

  return (
    <Modal
      open={!!mailbox}
      onClose={close}
      title="Configurar no telemóvel"
      subtitle={mailbox?.address}
      width="max-w-xl"
      footer={
        <>
          {count > 0 && (
            <GuardButton
              leaf={mailLeaf(mailbox?.personal)}
              variant="danger"
              isLoading={revokeM.isPending}
              disabled={revokeM.isPending || createM.isPending}
              onClick={revoke}
            >
              Revogar passwords da app
            </GuardButton>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={close}>
            Fechar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Para abrir esta caixa no telemóvel ou no Outlook, cria uma conta de email (IMAP) com os dados abaixo e uma
          <strong> password da app</strong>. Não uses a password do Backoffice.
        </p>

        {created?.password && (
          <div
            className="space-y-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-3"
            data-testid="app-password-once"
          >
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Password da app</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-white dark:bg-zinc-900 px-3 py-2 font-mono text-sm" data-testid="app-password-value">
                {created.password}
              </code>
              <Button size="sm" variant="outline" icon="copy" onClick={() => copy(created.password ?? "", "Password")}>
                Copiar
              </Button>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300" data-testid="app-password-warning">
              <strong>Copia-a agora.</strong> Por segurança não volta a aparecer — se a perderes, gera outra.
            </p>
          </div>
        )}

        {settings && (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800 px-3" data-testid="app-password-settings">
            <Row label="Utilizador" value={settings.username ?? mailbox?.address ?? ""} />
            <Row label="Servidor IMAP" value={server(settings.imap)} />
            <Row label="Servidor SMTP" value={server(settings.smtp)} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {statusQ.isLoading ? (
            <span className="text-sm text-zinc-400">…</span>
          ) : count > 0 ? (
            <Badge tone="green" dot>
              {count === 1 ? "1 password da app activa" : `${count} passwords da app activas`}
            </Badge>
          ) : (
            <Badge tone="neutral">Sem passwords da app</Badge>
          )}
          {status?.createdAt && !created && (
            <span className="text-xs text-zinc-500">
              Última criada em {new Date(status.createdAt).toLocaleDateString("pt-PT")}
            </span>
          )}
        </div>

        <GuardButton
          leaf={mailLeaf(mailbox?.personal)}
          icon="key"
          isLoading={createM.isPending}
          disabled={createM.isPending || revokeM.isPending || count >= 5}
          title={count >= 5 ? "Já há 5 passwords da app — revoga-as para gerar outra." : undefined}
          onClick={() => mailboxId && createM.mutate({ mailboxId })}
        >
          {created ? "Gerar outra password" : "Gerar password da app"}
        </GuardButton>
        {statusQ.isError && (
          <p className="text-sm text-red-600 dark:text-red-400">{mailErrorMessage(statusQ.error, "Não foi possível carregar o estado.")}</p>
        )}
      </div>
    </Modal>
  );
}
