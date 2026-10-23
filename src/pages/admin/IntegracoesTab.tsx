import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { Icon } from "../../ui/icons.jsx";
import { Card, Badge, Input } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { useGoogleStatus, useGoogleReviews, useGoogleConnect, useGoogleDisconnect, useSetGooglePlace } from "../../hooks/useGoogleIntegration";
import { FEATURES } from "../../lib/features";
import { fmtDateTime } from "./shared";

// ─── Integrações (Google Calendar + Reviews) tab ─────────────────────────────
function StarRating({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="text-amber-500 text-sm" aria-label={`${rating} estrelas`}>
      {"★".repeat(full)}
      <span className="text-zinc-300 dark:text-zinc-600">{"★".repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

export function IntegracoesTab() {
  const { data: status, isLoading } = useGoogleStatus();
  const connect = useGoogleConnect();
  const disconnect = useGoogleDisconnect();
  const setPlace = useSetGooglePlace();
  const [placeId, setPlaceId] = useState("");

  // Pré-preenche o Place ID com o valor guardado quando o estado chega.
  useEffect(() => {
    if (status?.placeId != null) setPlaceId(status.placeId);
  }, [status?.placeId]);

  const reviewsEnabled = Boolean(status?.placeId);
  const { data: reviews, isFetching: reviewsLoading } = useGoogleReviews(reviewsEnabled);

  const handleConnect = () => {
    connect.mutate(undefined, {
      onSuccess: (url) => { window.location.href = url; },
      onError: (e: any) => toast.error(getApiError(e)),
    });
  };

  const handleDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => toast.success("Google Calendar desligado"),
      onError: (e: any) => toast.error(getApiError(e)),
    });
  };

  const handleSavePlace = () => {
    setPlace.mutate(placeId.trim(), {
      onSuccess: () => toast.success("Place ID guardado"),
      onError: (e: any) => toast.error(getApiError(e)),
    });
  };

  const connected = status?.connected;
  const configured = status?.configured ?? true;

  return (
    <div className="space-y-6">
      {/* Google Calendar — escondido por agora (lib/features.ts) */}
      {FEATURES.googleCalendar && (
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Icon name="calendar" className="w-4 h-4 text-accent" />
              Google Calendar
            </h3>
            <p className="mt-1 text-sm text-zinc-500 max-w-prose">
              Sincroniza automaticamente as marcações da agenda com o teu Google Calendar.
              Criar, alterar ou cancelar uma marcação reflete-se no calendário.
            </p>
          </div>
          {!isLoading && (
            <Badge tone={connected ? "green" : "neutral"} dot>
              {connected ? "Ligado" : "Não ligado"}
            </Badge>
          )}
        </div>

        {!configured ? (
          <p className="mt-4 text-sm rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 p-3 text-amber-700 dark:text-amber-400">
            O servidor não tem o Google configurado (faltam <code>GOOGLE_CLIENT_ID</code> /
            <code> GOOGLE_CLIENT_SECRET</code>). A sincronização fica desativada.
          </p>
        ) : (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {connected ? (
              <>
                <GuardButton variant="ghost" icon="logout" onClick={handleDisconnect} disabled={disconnect.isPending}>
                  Desligar
                </GuardButton>
                {status?.connectedAt && (
                  <span className="text-xs text-zinc-400">
                    Ligado desde {fmtDateTime(status.connectedAt)}
                  </span>
                )}
              </>
            ) : (
              <GuardButton icon="calendar" onClick={handleConnect} disabled={connect.isPending}>
                Conectar Google Calendar
              </GuardButton>
            )}
          </div>
        )}
      </Card>
      )}

      {/* Google Reviews */}
      <Card className="p-5">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Icon name="star" className="w-4 h-4 text-amber-500" />
          Google Reviews
        </h3>
        <p className="mt-1 text-sm text-zinc-500 max-w-prose">
          Indica o <span className="font-medium">Place ID</span> do teu negócio no Google para
          mostrar as avaliações. Encontra-o no Google Place ID Finder.
        </p>

        <div className="mt-4 flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[16rem]">
            <Input
              label="Place ID"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              placeholder="ChIJ..."
            />
          </div>
          <GuardButton onClick={handleSavePlace} disabled={setPlace.isPending}>
            Guardar
          </GuardButton>
        </div>

        {/* Pré-visualização das reviews */}
        {reviewsEnabled && (
          <div className="mt-5">
            {reviewsLoading ? (
              <p className="text-sm text-zinc-400">A carregar avaliações…</p>
            ) : reviews && !reviews.configured ? (
              <p className="text-sm text-zinc-400">
                Reviews indisponíveis — falta a chave da Places API no servidor.
              </p>
            ) : reviews?.error ? (
              <p className="text-sm text-red-500">{reviews.error}</p>
            ) : reviews && reviews.reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.rating != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <StarRating rating={reviews.rating} />
                    <span className="font-medium">{reviews.rating}</span>
                    {reviews.total != null && (
                      <span className="text-zinc-400">({reviews.total} avaliações)</span>
                    )}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {reviews.reviews.slice(0, 4).map((r, i) => (
                    <div key={i} className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{r.author_name}</span>
                        <StarRating rating={r.rating} />
                      </div>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-4">{r.text}</p>
                      <p className="mt-2 text-xs text-zinc-400">{r.relative_time_description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Sem avaliações para mostrar.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
