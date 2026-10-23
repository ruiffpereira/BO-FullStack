import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";
import { Badge, Button, EmptyState, Tabs } from "../ui/ui.jsx";
import { GuardButton } from "../components/GuardButton";
import { MailPager } from "../components/correio/MailThreadList";
import { usePageSubtitle } from "../context/PageMetaContext";
import { useGetMailCampaigns } from "../gen/backoffice/hooks/useGetMailCampaigns.js";
import { useGetMailCampaignsStatus } from "../gen/backoffice/hooks/useGetMailCampaignsStatus.js";
import type { CampaignsStatus } from "../gen/backoffice/types/CampaignsStatus";
import type { CampaignSummary } from "../gen/backoffice/types/CampaignSummary";
import { CAMPAIGNS_PATH, CAMPAIGN_FILTERS, CAMPAIGN_STATUS, NEW_CAMPAIGN, campaignHref, fmtDateTime, isCampaignStatus, pct } from "../lib/campaigns";
import { mailErrorMessage } from "../lib/mail";
import type { GetMailCampaignsQueryParamsStatusEnum } from "../gen/backoffice/types/GetMailCampaigns.js";

const PAGE_LIMIT = 25;
export const LOCKED_FALLBACK = "Disponível quando o teu domínio estiver configurado.";

/** Estado bloqueado (sem domínio próprio + `news.` verificados): a mensagem vem da API (`status.message`). */
export function CampaignsLockedNotice({ status, compact = false }: { status?: CampaignsStatus; compact?: boolean }) {
  const msg = status?.message || LOCKED_FALLBACK;
  if (compact) {
    return (
      <p role="status" data-testid="campaigns-locked" className="shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm px-3 py-2">
        {msg}
      </p>
    );
  }
  return (
    <div data-testid="campaigns-locked" className="flex-1 flex">
      <EmptyState icon="lock" title="Campanhas bloqueadas" desc={msg} />
    </div>
  );
}

function Row({ c }: { c: CampaignSummary }) {
  const st = isCampaignStatus(c.status) ? CAMPAIGN_STATUS[c.status] : { label: c.status ?? "—", tone: "neutral" as const };
  const n = c.counts;
  const date = c.status === "scheduled" ? `Agendada: ${fmtDateTime(c.scheduledAt)}` : c.sentAt ? fmtDateTime(c.sentAt) : fmtDateTime(c.createdAt);
  const showStats = c.status === "sent" || c.status === "sending";
  return (
    <li>
      <Link
        to={campaignHref(c.campaignId ?? "")}
        data-testid="campaign-row"
        className="flex flex-col gap-1 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 focus:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-800/50"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-sm break-words min-w-0 flex-1">{c.name}</span>
          <Badge tone={st.tone} dot>
            {st.label}
          </Badge>
        </div>
        <p className="text-xs text-zinc-500">{date}</p>
        {showStats && n && (
          <p className="text-xs text-zinc-600 dark:text-zinc-300 tabular-nums" data-testid="campaign-row-stats">
            {n.delivered ?? 0} entregues · {n.opened ?? 0} aberturas ({pct(n.opened, n.delivered)}) · {n.clicked ?? 0} cliques ({pct(n.clicked, n.delivered)})
          </p>
        )}
      </Link>
    </li>
  );
}

/**
 * Correio → Campanhas (B42 · fase 9). Sem domínio próprio + `news.` verificados a página mostra a mensagem do
 * `GET /mail/campaigns/status` (nunca um erro). Com eles: lista por estado com aberturas e cliques, e «Nova campanha»
 * (assistente em 4 passos em `/correio/campanhas/nova`). Folha `correio.campanhas` [Ver | Editar]; enviar é à parte.
 */
export function CorreioCampanhas() {
  const navigate = useNavigate();
  const statusQ = useGetMailCampaignsStatus({ query: { retry: false } });
  const status = statusQ.data;
  const available = !!status?.available;

  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [filter]);

  const listQ = useGetMailCampaigns(
    { ...(filter !== "all" ? { status: filter as GetMailCampaignsQueryParamsStatusEnum } : {}), page, limit: PAGE_LIMIT },
    { query: { enabled: statusQ.isSuccess, retry: false, placeholderData: keepPreviousData } },
  );
  const items = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;
  usePageSubtitle(listQ.data ? `${total} ${total === 1 ? "campanha" : "campanhas"}` : null);

  if (statusQ.isLoading) return <div className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  if (statusQ.isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600 dark:text-red-400">{mailErrorMessage(statusQ.error, "Não foi possível carregar as campanhas.")}</p>
        <Button variant="outline" size="sm" onClick={() => statusQ.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  // Bloqueado e sem histórico: só a mensagem. (Com histórico — o domínio perdeu-se depois de enviar — vê-se a lista.)
  const hasHistory = !listQ.isError && (listQ.data?.total ?? 0) > 0;
  if (!available && !hasHistory) return <CampaignsLockedNotice status={status} />;

  return (
    <div className="flex flex-col h-full min-h-0 gap-3" data-testid="correio-campanhas">
      {!available && <CampaignsLockedNotice status={status} compact />}
      {status?.paused && (
        <p role="status" data-testid="campaigns-paused" className="shrink-0 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm px-3 py-2">
          Os envios deste negócio estão pausados.{status.pausedReason ? ` (${status.pausedReason})` : ""} As campanhas agendadas esperam até serem retomados.
        </p>
      )}
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        <Tabs tabs={CAMPAIGN_FILTERS} value={filter} onChange={setFilter} size="sm" />
        <span className="flex-1" />
        {available && (
          <GuardButton leaf="correio.campanhas" icon="plus" onClick={() => navigate(`${CAMPAIGNS_PATH}/${NEW_CAMPAIGN}`)}>
            Nova campanha
          </GuardButton>
        )}
      </div>

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        {listQ.isLoading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : listQ.isError ? (
          <div className="p-4 space-y-2 text-sm text-red-600 dark:text-red-400">
            <p>{mailErrorMessage(listQ.error, "Não foi possível carregar as campanhas.")}</p>
            <Button size="sm" variant="outline" onClick={() => listQ.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex" data-testid="campaigns-empty">
            <EmptyState
              icon="mail"
              title={filter === "all" ? "Ainda não há campanhas" : "Nenhuma campanha neste estado"}
              desc={filter === "all" ? "Cria a primeira: escolhes quem recebe, escreves o email, testas e envias." : "Experimenta outro estado."}
            />
          </div>
        ) : (
          <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800" aria-label="Campanhas">
            {items.map((c) => (
              <Row key={c.campaignId} c={c} />
            ))}
          </ul>
        )}
        <MailPager page={page} limit={listQ.data?.limit ?? PAGE_LIMIT} total={total} onPage={setPage} />
      </div>
    </div>
  );
}
