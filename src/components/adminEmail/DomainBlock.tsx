import { Badge } from "../../ui/ui.jsx";
import { GuardButton } from "../GuardButton";
import type { EmailDnsRecord } from "../../gen/backoffice/types/EmailDnsRecord.js";
import type { TenantEmailDomain } from "../../gen/backoffice/types/TenantEmailDomain.js";
import { DnsRecordsTable } from "./DnsRecordsTable";
import { NewsSection } from "./EmailStatusCard";
import { FEATURES } from "../../lib/features";

export type DomainKind = "platform" | "own";

export type Tenant = { userId: string; name: string };

const KIND_LABEL: Record<string, string> = {
  platform: "Endereço da plataforma",
  own: "Domínio próprio",
};

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-PT") : "");

/** «Pausa automática (queixas)» / «Pausa do admin». */
export const pausedByLabel = (by?: string | null) => (by === "auto" ? "automática, por queixas" : by === "admin" ? "pelo admin" : "");

/** Um domínio do tenant: estado, o que faz, registos do envio, registos da caixa (MX/DKIM), caixas e acções. */
export function DomainBlock({
  d,
  multi,
  busy,
  verifying,
  platformPending,
  ownPending,
  onVerify,
  onUsePlatform,
  onUseOwn,
  newsPending,
  onPrepareNews,
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
  newsPending: boolean;
  onPrepareNews: () => void;
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
  // Voltar ao envio da plataforma / usar o do negócio só faz sentido com um domínio próprio.
  const showSendingSwitch = isOwn;
  const mailOn = isOwn && !!d.mailMode && d.mailMode !== "none";
  const mailDomain = d.mailDomain ?? d.domain ?? "";
  const boxesOnOwn = activeBoxes.some((a) => a.toLowerCase().endsWith(`@${mailDomain.toLowerCase()}`));

  return (
    <section className="space-y-3" data-testid={`email-domain-block-${d.kind ?? "own"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {multi && <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{KIND_LABEL[d.kind ?? "own"]}</span>}
        <span className="font-mono text-sm break-all" data-testid="email-domain-name">
          {isOwn ? d.domain : (d.address ?? d.domain)}
        </span>
        <span data-testid="email-domain-state">
          {isOwn ? (
            verified ? <Badge tone="green">Verificado ✓</Badge> : <Badge tone="amber">Não verificado</Badge>
          ) : (
            <Badge tone="green">Pronto</Badge>
          )}
        </span>
        {!verified && missing > 0 && (
          <span className="text-xs text-zinc-500">
            {missing === 1 ? "falta 1 registo" : `faltam ${missing} registos`}
          </span>
        )}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-300" data-testid="email-sending-state">
        {d.useForSending && verified && d.sendingEnabled
          ? `Os emails do negócio saem de ${isOwn ? `${d.fromLocalPart}@${d.domain}` : (d.address ?? d.domain)}.`
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

      {!isOwn && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300" data-testid="platform-code-line">
          Código do negócio: <span className="font-mono">{d.platformCode}</span>
          {" — pode mudar-se quando quiseres (os endereços antigos continuam a receber)."}
        </p>
      )}

      {isOwn && (
        <>
          <DnsRecordsTable records={records} />
          <p className="text-xs text-zinc-400">
            Põe estes registos no DNS do domínio. Depois carrega em «Verificar agora» — o DNS pode demorar a propagar.
          </p>
        </>
      )}

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

      {/* Campanhas (fase 9): só no domínio próprio verificado. Abrem quando o domínio E o news. estão verificados. */}
      {FEATURES.campaigns && isOwn && verified && <NewsSection d={d} busy={busy} pending={newsPending} onPrepare={onPrepareNews} />}

      {mailOn && activeBoxes.length > 0 && (
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-3 space-y-2" data-testid="mailboxes-move">
          {boxesOnOwn ? (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">As caixas já usam o domínio próprio (@{mailDomain}).</p>
              <GuardButton size="sm" variant="outline" isLoading={movePending} disabled={busy} onClick={() => onMove("platform")}>
                Voltar as caixas ao endereço da plataforma
              </GuardButton>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                As caixas ainda usam o endereço da plataforma. Quando o domínio estiver verificado e o MX a apontar para
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
        {isOwn && (
          <GuardButton size="sm" icon="check" isLoading={verifying} disabled={busy} onClick={onVerify}>
            Verificar agora
          </GuardButton>
        )}
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
          {isOwn ? "Alterar domínio" : "Alterar código e remetente"}
        </GuardButton>
        <GuardButton size="sm" variant="danger" icon="trash" disabled={busy} onClick={onRemove}>
          {isOwn ? "Remover domínio" : "Remover endereço"}
        </GuardButton>
      </div>
    </section>
  );
}
