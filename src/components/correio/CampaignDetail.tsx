import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, Card } from "../../ui/ui.jsx";
import { GuardButton } from "../GuardButton";
import { confirmDialog } from "../confirm";
import { useAuth } from "../../context/AuthContext";
import { useInvalidateMail } from "../../hooks/useMail";
import { useGetMailCampaignsCampaignidStats } from "../../gen/backoffice/hooks/useGetMailCampaignsCampaignidStats.js";
import { usePostMailCampaignsCampaignidDuplicate } from "../../gen/backoffice/hooks/usePostMailCampaignsCampaignidDuplicate.js";
import { usePostMailCampaignsCampaignidCancel } from "../../gen/backoffice/hooks/usePostMailCampaignsCampaignidCancel.js";
import { useDeleteMailCampaignsCampaignid } from "../../gen/backoffice/hooks/useDeleteMailCampaignsCampaignid.js";
import type { Campaign } from "../../gen/backoffice/types/Campaign";
import {
  CAMPAIGNS_PATH,
  CAMPAIGN_STATUS,
  campaignErrorMessage,
  campaignHref,
  fmtDateTime,
  isCampaignStatus,
  pct,
  segmentLabel,
} from "../../lib/campaigns";

function StatCard({ id, label, value, hint }: { id: string; label: string; value?: number; hint?: string }) {
  return (
    <Card className="px-3 py-2.5" data-testid={`campaign-stat-${id}`}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value ?? "—"}</p>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </Card>
  );
}

/**
 * Ficha de uma campanha que já não é rascunho: estado, quando, estatísticas (entregues, aberturas, cliques,
 * anulações, bounces, queixas), Duplicar (Editar) e Cancelar (só com `correio.campanhas.enviar`). Enquanto envia, as
 * estatísticas actualizam sozinhas.
 */
export function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate();
  const invalidate = useInvalidateMail();
  const { can } = useAuth();
  const canSend = can("correio.campanhas.enviar", "edit");
  const id = campaign.campaignId ?? "";
  const st = isCampaignStatus(campaign.status) ? CAMPAIGN_STATUS[campaign.status] : { label: campaign.status ?? "—", tone: "neutral" as const };
  const live = campaign.status === "sending" || campaign.status === "scheduled";

  const statsQ = useGetMailCampaignsCampaignidStats(id, {
    query: { enabled: !!id, retry: false, refetchInterval: campaign.status === "sending" ? 15_000 : false },
  });
  const s = statsQ.data;

  const duplicateM = usePostMailCampaignsCampaignidDuplicate();
  const cancelM = usePostMailCampaignsCampaignidCancel();
  const deleteM = useDeleteMailCampaignsCampaignid();

  const duplicate = async () => {
    try {
      const copy = (await duplicateM.mutateAsync({ campaignId: id })) as Campaign;
      toast.success("Criámos um rascunho com o mesmo conteúdo.");
      invalidate();
      if (copy.campaignId) navigate(campaignHref(copy.campaignId));
    } catch (e) {
      toast.error(campaignErrorMessage(e));
    }
  };

  const cancel = async () => {
    const sending = campaign.status === "sending";
    const ok = await confirmDialog({
      title: sending ? "Parar o envio?" : "Cancelar o agendamento?",
      message: sending
        ? "O que ainda está na fila não sai. O que já saiu não se desfaz."
        : "A campanha deixa de estar agendada e não é enviada.",
      confirmLabel: sending ? "Parar o envio" : "Cancelar agendamento",
      danger: true,
      leaf: "correio.campanhas.enviar", // a do botão que abre este diálogo
    });
    if (!ok) return;
    try {
      await cancelM.mutateAsync({ campaignId: id });
      toast.success(sending ? "Envio parado." : "Agendamento cancelado.");
      invalidate();
    } catch (e) {
      toast.error(campaignErrorMessage(e));
    }
  };

  const remove = async () => {
    const ok = await confirmDialog({ title: "Apagar a campanha?", message: "Desaparece da lista. Isto não se desfaz.", confirmLabel: "Apagar", danger: true });
    if (!ok) return;
    try {
      await deleteM.mutateAsync({ campaignId: id });
      toast.success("Campanha apagada.");
      invalidate();
      navigate(CAMPAIGNS_PATH, { replace: true });
    } catch (e) {
      toast.error(campaignErrorMessage(e));
    }
  };

  const when =
    campaign.status === "scheduled"
      ? `Agendada para ${fmtDateTime(campaign.scheduledAt)}`
      : campaign.status === "sent"
        ? `Enviada em ${fmtDateTime(campaign.sentAt)}`
        : campaign.status === "sending"
          ? `A enviar desde ${fmtDateTime(campaign.startedAt)}`
          : `Criada em ${fmtDateTime(campaign.createdAt)}`;
  const canDelete = campaign.status === "cancelled" || campaign.status === "failed";

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 overflow-y-auto" data-testid="campaign-detail">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-lg font-semibold break-words min-w-0" data-testid="campaign-name">
            {campaign.name}
          </h2>
          <span data-testid="campaign-status">
            <Badge tone={st.tone} dot>
              {st.label}
            </Badge>
          </span>
        </div>
        <p className="text-sm text-zinc-500">
          {when} · {segmentLabel(campaign.segment)} · {(campaign.languages ?? []).map((l) => l.toUpperCase()).join(", ") || "—"}
        </p>
        {campaign.status === "failed" && campaign.failReason && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {campaign.failReason}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <GuardButton leaf="correio.campanhas" variant="outline" icon="copy" isLoading={duplicateM.isPending} disabled={duplicateM.isPending} onClick={duplicate}>
            Duplicar
          </GuardButton>
          {live && canSend && (
            <GuardButton leaf="correio.campanhas.enviar" variant="danger" icon="ban" isLoading={cancelM.isPending} disabled={cancelM.isPending} onClick={cancel}>
              {campaign.status === "sending" ? "Parar o envio" : "Cancelar agendamento"}
            </GuardButton>
          )}
          {canDelete && (
            <GuardButton leaf="correio.campanhas" variant="ghost" icon="trash" disabled={deleteM.isPending} onClick={remove}>
              Apagar
            </GuardButton>
          )}
          <Button variant="ghost" onClick={() => navigate(CAMPAIGNS_PATH)}>
            Voltar à lista
          </Button>
        </div>
      </Card>

      {statsQ.isError ? (
        <p className="text-sm text-red-600 dark:text-red-400" data-testid="campaign-stats-error">
          Não foi possível carregar as estatísticas.
        </p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="campaign-stats">
          <StatCard id="total" label="Destinatários" value={s?.total} />
          <StatCard id="delivered" label="Entregues" value={s?.delivered} hint={pct(s?.delivered, s?.total)} />
          <StatCard id="opened" label="Aberturas" value={s?.opened} hint={pct(s?.opened, s?.delivered)} />
          <StatCard id="clicked" label="Cliques" value={s?.clicked} hint={pct(s?.clicked, s?.delivered)} />
          <StatCard id="unsubscribed" label="Anulações" value={s?.unsubscribed} />
          <StatCard id="bounced" label="Bounces" value={s?.bounced} />
          <StatCard id="complained" label="Queixas" value={s?.complained} />
          <StatCard id="queued" label="Na fila" value={s?.queued} />
          {(s?.skipped ?? 0) > 0 && <StatCard id="skipped" label="Não saíram" value={s?.skipped} hint="Anularam ou bloquearam entretanto" />}
          {(s?.failed ?? 0) > 0 && <StatCard id="failed" label="Falharam" value={s?.failed} />}
        </div>
      )}
    </div>
  );
}
