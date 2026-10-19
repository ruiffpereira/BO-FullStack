import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Badge, Card, Input } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { GuardButton } from "./GuardButton";
import { confirmDialog, promptDialog } from "./confirm";
import { getApiError } from "../lib/apiError";
import { mailCodeMessage } from "../lib/mail";
import {
  useGetAdminUsersUseridEmailDomain,
  getAdminUsersUseridEmailDomainQueryKey,
} from "../gen/backoffice/hooks/useGetAdminUsersUseridEmailDomain.js";
import { usePutAdminUsersUseridEmailDomain } from "../gen/backoffice/hooks/usePutAdminUsersUseridEmailDomain.js";
import { useDeleteAdminUsersUseridEmailDomain } from "../gen/backoffice/hooks/useDeleteAdminUsersUseridEmailDomain.js";
import { usePostAdminUsersUseridEmailDomainVerify } from "../gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainVerify.js";
import { usePostAdminUsersUseridEmailDomainUsePlatform } from "../gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainUsePlatform.js";
import { usePostAdminUsersUseridEmailDomainUseOwn } from "../gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainUseOwn.js";
import { usePostAdminUsersUseridEmailDomainMailboxesMove } from "../gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainMailboxesMove.js";
import { usePostAdminUsersUseridEmailDomainPause } from "../gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainPause.js";
import { usePostAdminUsersUseridEmailDomainResume } from "../gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainResume.js";
import {
  useGetAdminUsersUseridMailboxes,
  getAdminUsersUseridMailboxesQueryKey,
} from "../gen/backoffice/hooks/useGetAdminUsersUseridMailboxes.js";
import { useGetAdminEmailStatus } from "../gen/backoffice/hooks/useGetAdminEmailStatus.js";
import type { EmailDnsRecord } from "../gen/backoffice/types/EmailDnsRecord.js";
import type { TenantEmailDomain } from "../gen/backoffice/types/TenantEmailDomain.js";
import { AdminMailboxesSection } from "./AdminMailboxesSection";

type DomainKind = "platform-subdomain" | "own";

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
  // Códigos da fase 7 (mx_conflict, mx_not_ready, kind_required, …) vivem em lib/mail.ts.
  const known = mailCodeMessage(key);
  if (known) return known;
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

/**
 * Tabela de registos DNS: o scroll horizontal vive só aqui dentro, nunca na página. `showState=false` para os
 * registos da CAIXA (MX/DKIM do Stalwart): a API não os verifica, só os mostra para copiar.
 */
export function DnsRecordsTable({
  records,
  showState = true,
  testId = "dns-records",
  rowTestId = "dns-record-row",
}: {
  records: EmailDnsRecord[];
  showState?: boolean;
  testId?: string;
  rowTestId?: string;
}) {
  if (records.length === 0)
    return <p className="text-sm text-zinc-500">Sem registos para mostrar.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800" data-testid={testId}>
      <table className={`w-full text-sm ${showState ? "min-w-[34rem]" : "min-w-[28rem]"}`}>
        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Nome</th>
            <th className="px-3 py-2">Valor</th>
            {showState && <th className="px-3 py-2">Estado</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {records.map((r, i) => (
            <tr key={`${r.type}-${r.name}-${i}`} data-testid={rowTestId} className="align-top">
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
              {showState && (
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {r.verified ? (
                    <Badge tone="green">✓ Verificado</Badge>
                  ) : (
                    <Badge tone="amber">✗ {r.status && r.status !== "verified" ? r.status : "Em falta"}</Badge>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Tenant = { userId: string; name: string };

const KIND_LABEL: Record<string, string> = {
  "platform-subdomain": "Subdomínio da plataforma",
  own: "Domínio próprio",
};

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-PT") : "");

/** «Pausa automática (queixas)» / «Pausa do admin». */
const pausedByLabel = (by?: string | null) => (by === "auto" ? "automática, por queixas" : by === "admin" ? "pelo admin" : "");

/**
 * Admin → Utilizadores → acção "Email" (B42 · fases 4 e 7): os domínios de email do tenant — o subdomínio da plataforma
 * e o domínio próprio (coexistem) —, de onde sai o email agora, registos DNS para copiar (envio + caixa), verificar,
 * voltar ao envio da plataforma, mover as caixas, pausar envios e remover. Só o dono da plataforma mexe aqui.
 */
export function AdminEmailModal({ tenant, onClose }: { tenant: Tenant | null; onClose: () => void }) {
  const qc = useQueryClient();
  const userId = tenant?.userId ?? "";
  const { data, isLoading, isError, error } = useGetAdminUsersUseridEmailDomain(userId, {
    query: { enabled: !!tenant },
  });
  const mailboxesQ = useGetAdminUsersUseridMailboxes(userId, { query: { enabled: !!tenant, retry: false } });
  // `null` = vista principal; "new-platform" / "new-own" = adicionar; um `kind` = alterar esse domínio.
  const [editing, setEditing] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [senderName, setSenderName] = useState("");
  const [localPart, setLocalPart] = useState("geral");
  // «Já tem email neste domínio?» e onde fica a caixa (só no domínio próprio).
  const [existing, setExisting] = useState<"" | "yes" | "no">("");
  const [mailChoice, setMailChoice] = useState<"" | "root" | "subdomain" | "none">("");

  // Envelopes antigos só traziam `domain`; os da fase 7 trazem `domains[]`.
  const domains: TenantEmailDomain[] = data?.domains?.length ? data.domains : data?.domain ? [data.domain] : [];
  const multi = domains.length > 1;
  const platformDomain = data?.platformDomain ?? null;
  const hasPlatformSub = domains.some((x) => x.kind === "platform-subdomain");
  const hasOwn = domains.some((x) => x.kind === "own");

  // Ao abrir (ou mudar de tenant) volta à vista principal.
  useEffect(() => {
    setEditing(null);
  }, [userId]);

  // Sem domínio nenhum: abre logo o formulário, com a sugestão pré-preenchida.
  const formKey = editing ?? (data && domains.length === 0 ? "first" : null);
  const showForm = !!tenant && !!data && formKey !== null;
  useEffect(() => {
    if (!data || !formKey) return;
    if (formKey === "first" || formKey === "new-platform") {
      setDomain(data.suggestedDomain ?? "");
      setSenderName(tenant?.name ?? "");
      setLocalPart("geral");
      setExisting("");
      setMailChoice("");
    } else if (formKey === "new-own") {
      setDomain("");
      setSenderName(tenant?.name ?? "");
      setLocalPart("geral");
      setExisting("");
      setMailChoice("");
    } else {
      const cur = domains.find((x) => x.kind === formKey);
      setDomain(cur?.domain ?? "");
      setSenderName(cur?.senderName ?? "");
      setLocalPart(cur?.fromLocalPart || "geral");
      setExisting(cur?.existingEmail == null ? "" : cur.existingEmail ? "yes" : "no");
      setMailChoice(cur?.existingEmail == null ? "" : (cur.mailMode ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, !!data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getAdminUsersUseridEmailDomainQueryKey(userId) });
    qc.invalidateQueries({ queryKey: getAdminUsersUseridMailboxesQueryKey(userId) });
    qc.invalidateQueries({ queryKey: [{ url: "/admin/email/status" }] });
  };
  const onError = (e: unknown) => toast.error(emailErrorMessage(e));
  const client = {};

  const putM = usePutAdminUsersUseridEmailDomain({
    client,
    mutation: {
      onSuccess: () => {
        toast.success("Domínio de email guardado");
        setEditing(null);
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
        setEditing(null);
        refresh();
      },
      onError,
    },
  });
  const moveM = usePostAdminUsersUseridEmailDomainMailboxesMove({
    client,
    mutation: {
      onSuccess: (res: any) => {
        const moved = res?.moved?.length ?? 0;
        const skipped = res?.skipped?.length ?? 0;
        toast.success(
          moved === 1 ? "1 caixa mudou de endereço." : `${moved} caixas mudaram de endereço.`,
        );
        if (skipped > 0)
          toast.info(
            skipped === 1
              ? "1 caixa ficou como estava: o endereço novo já existe."
              : `${skipped} caixas ficaram como estavam: o endereço novo já existe.`,
          );
        refresh();
      },
      onError,
    },
  });
  const pauseM = usePostAdminUsersUseridEmailDomainPause({
    client,
    mutation: {
      onSuccess: () => {
        toast.success("Envios da caixa pausados");
        refresh();
      },
      onError,
    },
  });
  const resumeM = usePostAdminUsersUseridEmailDomainResume({
    client,
    mutation: {
      onSuccess: () => {
        toast.success("Envios retomados");
        refresh();
      },
      onError,
    },
  });

  const busy =
    putM.isPending ||
    verifyM.isPending ||
    platformM.isPending ||
    ownM.isPending ||
    deleteM.isPending ||
    moveM.isPending ||
    pauseM.isPending ||
    resumeM.isPending;

  // O domínio escrito é «próprio» se não está debaixo do domínio da plataforma.
  const typed = domain.trim().toLowerCase();
  const looksPlatform = !!platformDomain && typed.endsWith(`.${platformDomain.toLowerCase()}`);
  const isOwnForm = typed !== "" && !looksPlatform;
  const mailIncomplete = isOwnForm && (existing === "" || mailChoice === "");

  const pickExisting = (v: "yes" | "no") => {
    setExisting(v);
    // Com email existente a raiz está proibida (cortava-o); sem email, a raiz é o caminho normal.
    setMailChoice((cur) => (v === "yes" ? (cur === "root" || cur === "" ? "subdomain" : cur) : cur === "" ? "root" : cur));
  };

  const save = () => {
    if (!tenant) return;
    putM.mutate({
      userId: tenant.userId,
      data: {
        domain: domain.trim(),
        fromLocalPart: localPart.trim() || undefined,
        senderName: senderName.trim() || null,
        ...(isOwnForm && existing !== "" && mailChoice !== ""
          ? { existingEmail: existing === "yes", mail: mailChoice }
          : {}),
      },
    });
  };

  const kindParams = (kind?: string) => (multi && kind ? { params: { kind: kind as DomainKind } } : {});

  const remove = async (d: TenantEmailDomain) => {
    if (!tenant) return;
    const ok = await confirmDialog({
      title: "Remover o domínio de email?",
      message: `${d.domain} deixa de enviar os emails de ${tenant.name}; voltam a sair do endereço da plataforma. O domínio também é apagado no Resend.`,
      confirmLabel: "Remover",
      danger: true,
    });
    if (ok) deleteM.mutate({ userId: tenant.userId, ...kindParams(d.kind) });
  };

  // Caixas activas (para saber onde estão e se há o que mover).
  const activeBoxes = (mailboxesQ.data?.mailboxes ?? []).filter((b) => b.status === "active");
  const ownDomain = domains.find((x) => x.kind === "own");

  const moveBoxes = async (to: "own" | "platform") => {
    if (!tenant || !ownDomain) return;
    const ok = await confirmDialog({
      title: to === "own" ? "Mover as caixas para o domínio próprio?" : "Voltar as caixas ao subdomínio da plataforma?",
      message:
        to === "own"
          ? `O login passa a ser geral@${ownDomain.mailDomain ?? ownDomain.domain}. As mensagens ficam onde estão e os endereços antigos continuam a entregar na mesma caixa. Só funciona com o MX do domínio já a apontar para o servidor de correio.`
          : "Os logins voltam aos endereços do subdomínio da plataforma e a mudança automática para o domínio próprio fica travada.",
      confirmLabel: to === "own" ? "Mover" : "Voltar",
    });
    if (ok) moveM.mutate({ userId: tenant.userId, data: { to } });
  };

  const pause = async () => {
    if (!tenant) return;
    const reason = await promptDialog({
      title: "Pausar os envios deste negócio?",
      message:
        "A caixa deixa de enviar. Os emails automáticos (marcações, reset de password, convites) continuam a sair.",
      label: "Motivo (opcional)",
      confirmLabel: "Pausar envios",
    });
    if (reason === null) return;
    pauseM.mutate({ userId: tenant.userId, data: reason.trim() ? { reason: reason.trim() } : {} });
  };

  const footer = showForm ? (
    <>
      {domains.length > 0 && (
        <Button variant="ghost" onClick={() => setEditing(null)} disabled={putM.isPending}>
          Cancelar
        </Button>
      )}
      {domains.length === 0 && (
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      )}
      <GuardButton isLoading={putM.isPending} disabled={!domain.trim() || putM.isPending || mailIncomplete} onClick={save}>
        {domains.length > 0 && formKey !== "new-own" && formKey !== "new-platform" ? "Guardar" : "Configurar"}
      </GuardButton>
    </>
  ) : (
    <Button variant="ghost" onClick={onClose}>
      Fechar
    </Button>
  );

  const sending = data?.sending;

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
          {domains.length === 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Este negócio ainda não tem domínio de email. Os emails automáticos (marcações, reset de password, convites)
              continuam a sair do endereço da plataforma até o domínio ficar verificado.
            </p>
          )}
          <Input
            label="Domínio de email"
            value={domain}
            onChange={(e: any) => setDomain(e.target.value)}
            placeholder={
              formKey === "new-own" ? "negocio.pt" : platformDomain ? `negocio.${platformDomain}` : "negocio.exemplo.pt"
            }
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

          {isOwnForm && (
            <fieldset className="space-y-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-3" data-testid="own-domain-mail">
              <legend className="px-1 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Já tem email neste domínio?</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="existing-email" checked={existing === "yes"} onChange={() => pickExisting("yes")} />
                  Sim, já usa email neste domínio
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="existing-email" checked={existing === "no"} onChange={() => pickExisting("no")} />
                  Não, o domínio ainda não tem email
                </label>
              </div>

              {existing !== "" && (
                <div className="space-y-2 text-sm" role="radiogroup" aria-label="Onde fica a caixa de correio">
                  <label className={`flex items-start gap-2 ${existing === "yes" ? "opacity-50" : ""}`}>
                    <input
                      type="radio"
                      name="mail-choice"
                      className="mt-1"
                      checked={mailChoice === "root"}
                      disabled={existing === "yes"}
                      onChange={() => setMailChoice("root")}
                    />
                    <span>
                      Na raiz do domínio — <span className="font-mono text-xs">geral@{typed}</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="mail-choice"
                      className="mt-1"
                      checked={mailChoice === "subdomain"}
                      onChange={() => setMailChoice("subdomain")}
                    />
                    <span>
                      Num subdomínio — <span className="font-mono text-xs">geral@contacto.{typed}</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="mail-choice"
                      className="mt-1"
                      checked={mailChoice === "none"}
                      onChange={() => setMailChoice("none")}
                    />
                    <span>Sem caixa neste domínio — só o envio dos emails automáticos</span>
                  </label>
                </div>
              )}

              <p
                className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-2.5 text-xs text-amber-800 dark:text-amber-200"
                data-testid="mx-warning"
              >
                <strong>Atenção ao MX.</strong> Pôr a caixa na raiz muda o registo MX do domínio e corta o email que o
                negócio já usa (Gmail, Google Workspace, …). Se já tem email, a raiz fica indisponível: usa o subdomínio
                ou «Sem caixa». Migrar o email que já existe não é automático.
              </p>
            </fieldset>
          )}

          {formKey !== "first" && formKey !== "new-platform" && formKey !== "new-own" && (() => {
            const cur = domains.find((x) => x.kind === formKey);
            return cur && typed !== (cur.domain ?? "").toLowerCase() ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Mudar de domínio cria o novo no Resend, apaga o antigo e volta a «Não verificado».
              </p>
            ) : null;
          })()}
        </div>
      ) : domains.length > 0 ? (
        <div className="space-y-5">
          {data?.sendingFrom && (
            <p className="text-sm text-zinc-700 dark:text-zinc-200" data-testid="email-sending-from">
              Os emails do negócio saem agora de <span className="font-mono">{data.sendingFrom}</span>.
            </p>
          )}

          {sending && (
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-3"
              data-testid="email-pause"
            >
              {sending.paused ? (
                <>
                  <Badge tone="red">Envios pausados</Badge>
                  <span className="text-sm text-zinc-600 dark:text-zinc-300 min-w-0" data-testid="email-pause-reason">
                    {[
                      sending.pausedAt ? `desde ${fmtDate(sending.pausedAt)}` : "",
                      pausedByLabel(sending.pausedBy),
                      sending.reason ? `motivo: ${sending.reason}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <GuardButton
                    size="sm"
                    className="ml-auto"
                    isLoading={resumeM.isPending}
                    disabled={busy}
                    onClick={() => tenant && resumeM.mutate({ userId: tenant.userId })}
                  >
                    Retomar envios
                  </GuardButton>
                </>
              ) : (
                <>
                  <span className="text-sm text-zinc-600 dark:text-zinc-300 min-w-0">
                    Envios da caixa a funcionar
                    {sending.limits?.mailboxPerDay
                      ? ` · até ${sending.limits.mailboxPerDay} destinatários por dia em cada caixa`
                      : ""}
                    .
                  </span>
                  <GuardButton size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={pause}>
                    Pausar envios
                  </GuardButton>
                </>
              )}
            </div>
          )}

          {domains.map((d) => (
            <DomainBlock
              key={d.kind ?? d.domain}
              d={d}
              multi={multi}
              busy={busy}
              verifying={verifyM.isPending}
              platformPending={platformM.isPending}
              ownPending={ownM.isPending}
              onVerify={() => tenant && verifyM.mutate({ userId: tenant.userId, ...kindParams(d.kind) })}
              onUsePlatform={() => tenant && platformM.mutate({ userId: tenant.userId, ...kindParams(d.kind) })}
              onUseOwn={() => tenant && ownM.mutate({ userId: tenant.userId, ...kindParams(d.kind) })}
              onEdit={() => setEditing(d.kind ?? "own")}
              onRemove={() => remove(d)}
              activeBoxes={activeBoxes.map((b) => b.address ?? "")}
              movePending={moveM.isPending}
              onMove={moveBoxes}
            />
          ))}

          <div className="flex flex-wrap gap-2">
            {!hasOwn && (
              <GuardButton size="sm" variant="outline" icon="plus" disabled={busy} onClick={() => setEditing("new-own")}>
                Adicionar domínio próprio
              </GuardButton>
            )}
            {!hasPlatformSub && data?.suggestedDomain && (
              <GuardButton size="sm" variant="outline" icon="plus" disabled={busy} onClick={() => setEditing("new-platform")}>
                Adicionar subdomínio da plataforma
              </GuardButton>
            )}
          </div>

          {/* Caixas de correio do tenant (B42 · fases 5 e 6) */}
          {tenant && <AdminMailboxesSection userId={tenant.userId} />}
        </div>
      ) : null}
    </Modal>
  );
}

/** Um domínio do tenant: estado, o que faz, registos do envio, registos da caixa (MX/DKIM), caixas e acções. */
function DomainBlock({
  d,
  multi,
  busy,
  verifying,
  platformPending,
  ownPending,
  onVerify,
  onUsePlatform,
  onUseOwn,
  onEdit,
  onRemove,
  activeBoxes,
  movePending,
  onMove,
}: {
  d: TenantEmailDomain;
  multi: boolean;
  busy: boolean;
  verifying: boolean;
  platformPending: boolean;
  ownPending: boolean;
  onVerify: () => void;
  onUsePlatform: () => void;
  onUseOwn: () => void;
  onEdit: () => void;
  onRemove: () => void;
  activeBoxes: string[];
  movePending: boolean;
  onMove: (to: "own" | "platform") => void;
}) {
  const records = d.records ?? [];
  const mailRecords = (d.mailRecords ?? []) as EmailDnsRecord[];
  const missing = records.filter((r) => !r.verified).length;
  const verified = !!d.verified;
  const isOwn = d.kind === "own";
  // Voltar ao envio da plataforma / usar o do negócio actua no domínio próprio (ou no único que há).
  const showSendingSwitch = !multi || isOwn;
  const mailOn = isOwn && !!d.mailMode && d.mailMode !== "none";
  const mailDomain = d.mailDomain ?? d.domain ?? "";
  const boxesOnOwn = activeBoxes.some((a) => a.toLowerCase().endsWith(`@${mailDomain.toLowerCase()}`));

  return (
    <section className="space-y-3" data-testid={`email-domain-block-${d.kind ?? "own"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {multi && <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{KIND_LABEL[d.kind ?? "own"]}</span>}
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

      {isOwn && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300" data-testid="email-mail-mode">
          {d.mailMode === "root"
            ? `Caixa de correio na raiz do domínio (@${d.domain}).`
            : d.mailMode === "subdomain"
              ? `Caixa de correio no subdomínio (@${mailDomain}).`
              : "Sem caixa de correio neste domínio."}
          {d.existingEmail ? " O negócio já tem email neste domínio." : ""}
        </p>
      )}

      <DnsRecordsTable records={records} />
      <p className="text-xs text-zinc-400">
        Põe estes registos no DNS do domínio. Depois carrega em «Verificar agora» — o DNS pode demorar a propagar.
      </p>

      {mailRecords.length > 0 && (
        <div className="space-y-2" data-testid="mail-records">
          <h4 className="text-sm font-semibold">Registos da caixa (MX e DKIM)</h4>
          <DnsRecordsTable records={mailRecords} showState={false} testId="mail-records-table" rowTestId="mail-record-row" />
          <p className="text-xs text-zinc-400">
            O MX decide para onde chega o email do domínio
            {d.mailMode === "root" ? " — na raiz, substitui o que lá estiver." : "."} Estes registos não são verificados
            automaticamente.
          </p>
        </div>
      )}

      {mailOn && activeBoxes.length > 0 && (
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-3 space-y-2" data-testid="mailboxes-move">
          {boxesOnOwn ? (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">As caixas já usam o domínio próprio (@{mailDomain}).</p>
              <GuardButton size="sm" variant="outline" isLoading={movePending} disabled={busy} onClick={() => onMove("platform")}>
                Voltar as caixas ao subdomínio da plataforma
              </GuardButton>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                As caixas ainda usam o subdomínio da plataforma. Quando o domínio estiver verificado e o MX a apontar para
                o servidor de correio, passam para <span className="font-mono">@{mailDomain}</span> (o endereço antigo
                continua a entregar).
              </p>
              <GuardButton
                size="sm"
                isLoading={movePending}
                disabled={busy || !verified}
                title={verified ? undefined : "O domínio ainda não está verificado"}
                onClick={() => onMove("own")}
              >
                Mover as caixas para o domínio próprio
              </GuardButton>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <GuardButton size="sm" icon="check" isLoading={verifying} disabled={busy} onClick={onVerify}>
          Verificar agora
        </GuardButton>
        {showSendingSwitch &&
          (d.useForSending ? (
            <GuardButton size="sm" variant="outline" isLoading={platformPending} disabled={busy} onClick={onUsePlatform}>
              Voltar ao envio da plataforma
            </GuardButton>
          ) : (
            <GuardButton
              size="sm"
              variant="outline"
              isLoading={ownPending}
              disabled={busy || !verified}
              title={verified ? undefined : "O domínio ainda não está verificado"}
              onClick={onUseOwn}
            >
              Usar o domínio do negócio
            </GuardButton>
          ))}
        <GuardButton size="sm" variant="outline" disabled={busy} onClick={onEdit}>
          Alterar domínio
        </GuardButton>
        <GuardButton size="sm" variant="danger" icon="trash" disabled={busy} onClick={onRemove}>
          Remover domínio
        </GuardButton>
      </div>
    </section>
  );
}

const STALWART_LABEL: Record<string, { text: string; tone: "neutral" | "green" | "red" | "amber" }> = {
  not_configured: { text: "Por configurar", tone: "neutral" },
  ok: { text: "OK", tone: "green" },
  unreachable: { text: "Inalcançável", tone: "red" },
  auth_failed: { text: "Credencial errada", tone: "amber" },
};

/** Admin → Sistema: estado do Resend e do Stalwart (`GET /admin/email/status`) e os tenants com os envios pausados. */
export function EmailStatusCard() {
  const { data, isLoading, isError, refetch } = useGetAdminEmailStatus();
  const resend = data?.resend;
  const stalwart = STALWART_LABEL[data?.stalwart?.status ?? "not_configured"] ?? STALWART_LABEL.not_configured;
  const paused = data?.pausedTenants ?? [];

  const resumeM = usePostAdminUsersUseridEmailDomainResume({
    client: {},
    mutation: {
      onSuccess: () => {
        toast.success("Envios retomados");
        refetch?.();
      },
      onError: (e: unknown) => toast.error(emailErrorMessage(e)),
    },
  });

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
        <>
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

          <div className="space-y-2" data-testid="email-paused-tenants">
            <p className="text-[13px] text-zinc-500">Negócios com os envios pausados</p>
            {isLoading ? null : paused.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                {paused.map((t) => (
                  <li key={t.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5" data-testid="email-paused-row">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.name || t.userId}</p>
                      <p className="text-xs text-zinc-500">
                        {[
                          t.pausedAt ? `desde ${fmtDate(t.pausedAt)}` : "",
                          pausedByLabel(t.pausedBy),
                          t.reason ? `motivo: ${t.reason}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <GuardButton
                      size="sm"
                      variant="outline"
                      aria-label={`Retomar envios de ${t.name || t.userId}`}
                      disabled={resumeM.isPending}
                      onClick={() => t.userId && resumeM.mutate({ userId: t.userId })}
                    >
                      Retomar
                    </GuardButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
