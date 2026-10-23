import { toast } from "sonner";
import { Badge, Card } from "../../ui/ui.jsx";
import { GuardButton } from "../GuardButton";
import { usePostAdminUsersUseridEmailDomainResume } from "../../gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainResume.js";
import { useGetAdminEmailStatus } from "../../gen/backoffice/hooks/useGetAdminEmailStatus.js";
import type { TenantEmailDomain } from "../../gen/backoffice/types/TenantEmailDomain.js";
import { DnsRecordsTable } from "./DnsRecordsTable";
import { emailErrorMessage } from "../AdminEmailModal";
import { fmtDate, pausedByLabel } from "./DomainBlock";

/** `news.<domínio>` das campanhas: acção «Preparar campanhas (news.)» e, depois de criado, os registos com o estado ✓/✗. */
export function NewsSection({ d, busy, pending, onPrepare }: { d: TenantEmailDomain; busy: boolean; pending: boolean; onPrepare: () => void }) {
  const news = d.news;
  const configured = !!news?.configured;
  return (
    <div className="space-y-2" data-testid="news-section">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h4 className="text-sm font-semibold">Campanhas</h4>
        {configured && <span className="font-mono text-sm break-all" data-testid="news-domain-name">{news?.domain}</span>}
        {configured && (
          <span data-testid="news-state">
            {news?.verified ? <Badge tone="green">Verificado ✓</Badge> : <Badge tone="amber">Não verificado</Badge>}
          </span>
        )}
      </div>
      {!configured ? (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            As campanhas saem de um subdomínio próprio (<span className="font-mono">news.{d.domain}</span>) para não pôr em
            risco a reputação do email normal do negócio.
          </p>
          <GuardButton size="sm" icon="mail" isLoading={pending} disabled={busy} onClick={onPrepare}>
            Preparar campanhas (news.)
          </GuardButton>
        </>
      ) : (
        <>
          <DnsRecordsTable records={news?.records ?? []} testId="news-records" rowTestId="news-record-row" />
          <p className="text-xs text-zinc-400">
            As campanhas só abrem quando o domínio e o {news?.domain ?? "news."} estão verificados. «Verificar agora» confere os dois.
          </p>
        </>
      )}
    </div>
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
                    Domínios próprios: {resend?.domains?.verified ?? 0} verificados · {resend?.domains?.unverified ?? 0} por verificar
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

          {data?.platformDns?.records?.length ? (
            <div className="space-y-1" data-testid="email-platform-dns">
              <p className="text-[13px] text-zinc-500">DNS do email da plataforma (um só, para todos os negócios)</p>
              {data.platformDns.records.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="email-platform-dns-row">
                  <span className="font-mono text-xs">
                    {r.type} · {r.name} → {r.value} · prioridade {r.priority}
                  </span>
                  {r.ok ? <Badge tone="green">✅ A apontar para nós</Badge> : <Badge tone="amber">❌ Por pôr</Badge>}
                </div>
              ))}
              <p className="text-xs text-zinc-400">Só leitura: o registo MX do domínio da plataforma põe-se uma vez, no fornecedor de DNS.</p>
            </div>
          ) : null}

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
