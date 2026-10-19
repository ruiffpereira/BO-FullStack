import { Link, useParams } from "react-router-dom";
import { Button } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { usePageSubtitle } from "../context/PageMetaContext";
import { useGetMailCampaignsCampaignid } from "../gen/backoffice/hooks/useGetMailCampaignsCampaignid.js";
import { useGetMailCampaignsStatus } from "../gen/backoffice/hooks/useGetMailCampaignsStatus.js";
import { CampaignWizard } from "../components/correio/CampaignWizard";
import { CampaignDetail } from "../components/correio/CampaignDetail";
import { CampaignsLockedNotice } from "./CorreioCampanhas";
import { CAMPAIGNS_PATH, NEW_CAMPAIGN } from "../lib/campaigns";
import { mailErrorMessage } from "../lib/mail";

/**
 * `/correio/campanhas/:campaignId` — `nova` abre o assistente vazio; um rascunho reabre o assistente; qualquer outro
 * estado mostra a ficha com as estatísticas. Folha `correio.campanhas`.
 */
export function CorreioCampanha() {
  const { campaignId = "" } = useParams();
  const isNew = campaignId === NEW_CAMPAIGN;
  const statusQ = useGetMailCampaignsStatus({ query: { retry: false } });
  const campaignQ = useGetMailCampaignsCampaignid(campaignId, { query: { enabled: !isNew && !!campaignId, retry: false } });
  const campaign = campaignQ.data;
  usePageSubtitle(isNew ? "Nova campanha" : (campaign?.name ?? null));

  const back = (
    <Link to={CAMPAIGNS_PATH} className="shrink-0 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 self-start">
      <Icon name="chevronLeft" className="w-4 h-4" /> Campanhas
    </Link>
  );

  let body;
  if (statusQ.isLoading || (!isNew && campaignQ.isLoading)) {
    body = <div className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  } else if (!isNew && campaignQ.isError) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-red-600 dark:text-red-400" data-testid="campaign-load-error">
          {(campaignQ.error as any)?.response?.status === 404 ? "Esta campanha já não existe." : mailErrorMessage(campaignQ.error, "Não foi possível carregar a campanha.")}
        </p>
        <Button variant="outline" size="sm" onClick={() => campaignQ.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  } else if (isNew || campaign?.status === "draft") {
    // Rascunhos só se criam/editam com as campanhas abertas (a API recusa com 409 `CAMPAIGNS_LOCKED`).
    body = statusQ.data && !statusQ.data.available ? <CampaignsLockedNotice status={statusQ.data} /> : <CampaignWizard campaign={isNew ? null : (campaign ?? null)} status={statusQ.data} />;
  } else if (campaign) {
    body = <CampaignDetail campaign={campaign} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-3" data-testid="correio-campanha">
      {back}
      {body}
    </div>
  );
}
