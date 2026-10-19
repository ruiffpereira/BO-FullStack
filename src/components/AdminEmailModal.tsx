import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Badge, Card, Input } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { GuardButton } from "./GuardButton";
import { confirmDialog } from "./confirm";
import { getApiError } from "../lib/apiError";
import {
  useGetAdminUsersUseridEmailDomain,
  getAdminUsersUseridEmailDomainQueryKey,
} from "../gen/backoffice/hooks/useGetAdminUsersUseridEmailDomain.js";
import { usePutAdminUsersUseridEmailDomain } from "../gen/backoffice/hooks/usePutAdminUsersUseridEmailDomain.js";
import { useDeleteAdminUsersUseridEmailDomain } from "../gen/backoffice/hooks/useDeleteAdminUsersUseridEmailDomain.js";
import { usePostAdminUsersUseridEmailDomainVerify } from "../gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainVerify.js";
import { usePostAdminUsersUseridEmailDomainUsePlatform } from "../gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainUsePlatform.js";
import { usePostAdminUsersUseridEmailDomainUseOwn } from "../gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainUseOwn.js";
import { useGetAdminEmailStatus } from "../gen/backoffice/hooks/useGetAdminEmailStatus.js";
import type { EmailDnsRecord } from "../gen/backoffice/types/EmailDnsRecord.js";

// Mensagens PT dos erros da API (vêm em `error`, não em `code`).
const EMAIL_ERROR_BY_KEY: Record<string, string> = {
  domain_taken: "Esse domínio de email já pertence a outro cliente.",
  email_provider_error: "O fornecedor de email (Resend) não aceitou o pedido. Tenta de novo daqui a pouco.",
  domain_not_verified: "O domínio ainda não está verificado — põe os registos no DNS e carrega em «Verificar agora».",
};

export function emailErrorMessage(error: unknown): string {
  const status = (error as any)?.response?.status;
  const key = (error as any)?.response?.data?.error;
  if (typeof key === "string" && EMAIL_ERROR_BY_KEY[key]) return EMAIL_ERROR_BY_KEY[key];
  if (status === 400) return "Domínio inválido.";
  return getApiError(error, "Não foi possível concluir. Tenta novamente.");
}

async function copyText(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${what} copiado`);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function CopyCell({ value, what }: { value: string; what: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="font-mono text-xs break-all min-w-0">{value}</span>
      <button
        type="button"
        aria-label={`Copiar ${what}`}
        title={`Copiar ${what}`}
        onClick={() => copyText(value, what.charAt(0).toUpperCase() + what.slice(1))}
        className="shrink-0 p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <Icon name="copy" className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Tabela de registos DNS: o scroll horizontal vive só aqui dentro, nunca na página. */
export function DnsRecordsTable({ records }: { records: EmailDnsRecord[] }) {
  if (records.length === 0)
    return <p className="text-sm text-zinc-500">Sem registos para mostrar.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800" data-testid="dns-records">
      <table className="w-full text-sm min-w-[34rem]">
        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Nome</th>
            <th className="px-3 py-2">Valor</th>
            <th className="px-3 py-2">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {records.map((r, i) => (
            <tr key={`${r.type}-${r.name}-${i}`} data-testid="dns-record-row" className="align-top">
              <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                {r.type}
                {r.priority != null && <span className="text-zinc-400"> · {r.priority}</span>}
              </td>
              <td className="px-3 py-2.5 max-w-[12rem]">
                <CopyCell value={r.name ?? ""} what="nome" />
              </td>
              <td className="px-3 py-2.5 max-w-[18rem]">
                <CopyCell value={r.value ?? ""} what="valor" />
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {r.verified ? (
                  <Badge tone="green">✓ Verificado</Badge>
                ) : (
                  <Badge tone="amber">✗ {r.status && r.status !== "verified" ? r.status : "Em falta"}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Tenant = { userId: string; name: string };

/**
 * Admin → Utilizadores → acção "Email" (B42 · fase 4): o domínio de email do tenant — estado, registos DNS para
 * copiar, verificar, voltar ao envio da plataforma e remover. Só o dono da plataforma mexe aqui.
 */
export function AdminEmailModal({ tenant, onClose }: { tenant: Tenant | null; onClose: () => void }) {
  const qc = useQueryClient();
  const userId = tenant?.userId ?? "";
  const { data, isLoading, isError, error } = useGetAdminUsersUseridEmailDomain(userId, {
    query: { enabled: !!tenant },
  });
  const [editing, setEditing] = useState(false);
  const [domain, setDomain] = useState("");
  const [senderName, setSenderName] = useState("");
  const [localPart, setLocalPart] = useState("geral");

  const d = data?.domain ?? null;
  const records = d?.records ?? [];
  const missing = records.filter((r) => !r.verified).length;
  const verified = !!d?.verified;

  // Ao abrir (ou mudar de tenant) volta à vista principal.
  useEffect(() => {
    setEditing(false);
  }, [userId]);

  // Sem domínio: abre logo o formulário, com a sugestão pré-preenchida.
  const showForm = !!tenant && !!data && (editing || !d);
  useEffect(() => {
    if (!data) return;
    if (d && editing) {
      setDomain(d.domain ?? "");
      setSenderName(d.senderName ?? "");
      setLocalPart(d.fromLocalPart || "geral");
    } else if (!d) {
      setDomain(data.suggestedDomain ?? "");
      setSenderName(tenant?.name ?? "");
      setLocalPart("geral");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, editing]);

  const refresh = () => qc.invalidateQueries({ queryKey: getAdminUsersUseridEmailDomainQueryKey(userId) });
  const onError = (e: unknown) => toast.error(emailErrorMessage(e));
  const client = {};

  const putM = usePutAdminUsersUseridEmailDomain({
    client,
    mutation: {
      onSuccess: () => {
        toast.success("Domínio de email guardado");
        setEditing(false);
        refresh();
      },
      onError,
    },
  });
  const verifyM = usePostAdminUsersUseridEmailDomainVerify({
    client,
    mutation: {
      onSuccess: (res: any) => {
        const ok = res?.domain?.verified;
        if (ok) toast.success("Domínio verificado");
        else toast.info("Ainda há registos por verificar. O DNS pode demorar a propagar.");
        refresh();
      },
      onError,
    },
  });
  const platformM = usePostAdminUsersUseridEmailDomainUsePlatform({
    client,
    mutation: {
      onSuccess: () => {
        toast.success("O envio voltou à plataforma");
        refresh();
      },
      onError,
    },
  });
  const ownM = usePostAdminUsersUseridEmailDomainUseOwn({
    client,
    mutation: {
      onSuccess: () => {
        toast.success("O envio passa a sair do domínio do negócio");
        refresh();
      },
      onError,
    },
  });
  const deleteM = useDeleteAdminUsersUseridEmailDomain({
    client,
    mutation: {
      onSuccess: () => {
        toast.success("Domínio de email removido");
        setEditing(false);
        refresh();
      },
      onError,
    },
  });

  const busy = putM.isPending || verifyM.isPending || platformM.isPending || ownM.isPending || deleteM.isPending;

  const save = () => {
    if (!tenant) return;
    putM.mutate({
      userId: tenant.userId,
      data: {
        domain: domain.trim(),
        fromLocalPart: localPart.trim() || undefined,
        senderName: senderName.trim() || null,
      },
    });
  };

  const remove = async () => {
    if (!tenant || !d) return;
    const ok = await confirmDialog({
      title: "Remover o domínio de email?",
      message: `${d.domain} deixa de enviar os emails de ${tenant.name}; voltam a sair do endereço da plataforma. O domínio também é apagado no Resend.`,
      confirmLabel: "Remover",
      danger: true,
    });
    if (ok) deleteM.mutate({ userId: tenant.userId });
  };

  const footer = showForm ? (
    <>
      {d && (
        <Button variant="ghost" onClick={() => setEditing(false)} disabled={putM.isPending}>
          Cancelar
        </Button>
      )}
      {!d && (
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      )}
      <GuardButton isLoading={putM.isPending} disabled={!domain.trim() || putM.isPending} onClick={save}>
        {d ? "Guardar" : "Configurar"}
      </GuardButton>
    </>
  ) : (
    <Button variant="ghost" onClick={onClose}>
      Fechar
    </Button>
  );

  return (
    <Modal open={!!tenant} onClose={onClose} title="Email" subtitle={tenant?.name} width="max-w-3xl" footer={footer}>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      ) : isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {getApiError(error, "Não foi possível carregar o estado do email.")}
        </p>
      ) : showForm ? (
        <div className="space-y-4">
          {!d && (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Este negócio ainda não tem domínio de email. Os emails automáticos (marcações, reset de password, convites)
              continuam a sair do endereço da plataforma até o domínio ficar verificado.
            </p>
          )}
          <Input
            label="Domínio de email"
            value={domain}
            onChange={(e: any) => setDomain(e.target.value)}
            placeholder={data?.platformDomain ? `negocio.${data.platformDomain}` : "negocio.exemplo.pt"}
            hint="Um subdomínio (ex.: tifas.rufvision.com) não mexe no email que o negócio já usa."
            autoComplete="off"
          />
          <Input
            label="Nome do remetente"
            value={senderName}
            onChange={(e: any) => setSenderName(e.target.value)}
            placeholder="Nome do negócio"
            autoComplete="off"
          />
          <Input
            label="Parte local do endereço"
            value={localPart}
            onChange={(e: any) => setLocalPart(e.target.value)}
            placeholder="geral"
            hint={`Os emails saem de ${localPart.trim() || "geral"}@${domain.trim() || "dominio"}.`}
            autoComplete="off"
          />
          {d && domain.trim().toLowerCase() !== (d.domain ?? "").toLowerCase() && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Mudar de domínio cria o novo no Resend, apaga o antigo e volta a «Não verificado».
            </p>
          )}
        </div>
      ) : d ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-sm break-all" data-testid="email-domain-name">{d.domain}</span>
            <span data-testid="email-domain-state">
              {verified ? <Badge tone="green">Verificado ✓</Badge> : <Badge tone="amber">Não verificado</Badge>}
            </span>
            {!verified && missing > 0 && (
              <span className="text-xs text-zinc-500">
                {missing === 1 ? "falta 1 registo" : `faltam ${missing} registos`}
              </span>
            )}
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-300" data-testid="email-sending-state">
            {d.useForSending && verified && d.sendingEnabled
              ? `Os emails do negócio saem de ${d.fromLocalPart}@${d.domain}.`
              : !d.useForSending
                ? "O envio está na plataforma (o domínio fica configurado, mas não é usado)."
                : "Os emails continuam a sair da plataforma até o domínio ficar verificado."}
          </p>

          <DnsRecordsTable records={records} />
          <p className="text-xs text-zinc-400">
            Põe estes registos no DNS do domínio. Depois carrega em «Verificar agora» — o DNS pode demorar a propagar.
          </p>

          <div className="flex flex-wrap gap-2">
            <GuardButton
              size="sm"
              icon="check"
              isLoading={verifyM.isPending}
              disabled={busy}
              onClick={() => tenant && verifyM.mutate({ userId: tenant.userId })}
            >
              Verificar agora
            </GuardButton>
            {d.useForSending ? (
              <GuardButton
                size="sm"
                variant="outline"
                isLoading={platformM.isPending}
                disabled={busy}
                onClick={() => tenant && platformM.mutate({ userId: tenant.userId })}
              >
                Voltar ao envio da plataforma
              </GuardButton>
            ) : (
              <GuardButton
                size="sm"
                variant="outline"
                isLoading={ownM.isPending}
                disabled={busy || !verified}
                title={verified ? undefined : "O domínio ainda não está verificado"}
                onClick={() => tenant && ownM.mutate({ userId: tenant.userId })}
              >
                Usar o domínio do negócio
              </GuardButton>
            )}
            <GuardButton size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
              Alterar domínio
            </GuardButton>
            <GuardButton size="sm" variant="danger" icon="trash" disabled={busy} onClick={remove}>
              Remover domínio
            </GuardButton>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

const STALWART_LABEL: Record<string, { text: string; tone: "neutral" | "green" | "red" | "amber" }> = {
  not_configured: { text: "Por configurar", tone: "neutral" },
  ok: { text: "OK", tone: "green" },
  unreachable: { text: "Inalcançável", tone: "red" },
  auth_failed: { text: "Credencial errada", tone: "amber" },
};

/** Admin → Sistema: estado do Resend e do Stalwart (`GET /admin/email/status`). */
export function EmailStatusCard() {
  const { data, isLoading, isError } = useGetAdminEmailStatus();
  const resend = data?.resend;
  const stalwart = STALWART_LABEL[data?.stalwart?.status ?? "not_configured"] ?? STALWART_LABEL.not_configured;

  return (
    <Card className="p-4 space-y-4" data-testid="email-status-card">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">Email</h3>
        <p className="text-[13px] text-zinc-500">
          Envio pelo Resend e caixa de correio no Stalwart.
          {data?.platformDomain ? ` Domínio da plataforma: ${data.platformDomain}.` : ""}
        </p>
      </div>
      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Não foi possível carregar.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1" data-testid="email-resend">
            <p className="text-[13px] text-zinc-500">Resend</p>
            {isLoading ? (
              <p className="text-sm text-zinc-400">…</p>
            ) : (
              <>
                <p className="text-sm font-medium">{resend?.configured ? "Configurado" : "Por configurar"}</p>
                <p className="text-xs text-zinc-500">
                  Domínios: {resend?.domains?.verified ?? 0} verificados · {resend?.domains?.unverified ?? 0} por verificar
                </p>
                <p className="text-xs text-zinc-500">
                  Envios {resend?.period ? `em ${resend.period}` : "este mês"}:{" "}
                  <span className="tabular-nums font-medium">{resend?.sentThisMonth ?? 0}</span>
                </p>
              </>
            )}
          </div>
          <div className="space-y-1" data-testid="email-stalwart">
            <p className="text-[13px] text-zinc-500">Stalwart (caixa de correio)</p>
            {isLoading ? (
              <p className="text-sm text-zinc-400">…</p>
            ) : (
              <Badge tone={stalwart.tone} dot>
                {stalwart.text}
              </Badge>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
