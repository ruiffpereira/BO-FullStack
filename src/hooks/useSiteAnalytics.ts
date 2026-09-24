import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { getAnalyticsSite } from "../gen/backoffice/hooks/useGetAnalyticsSite.js";
import { getAnalyticsSiteDomain } from "../gen/backoffice/hooks/useGetAnalyticsSiteDomain.js";
import { putAnalyticsSiteDomain } from "../gen/backoffice/hooks/usePutAnalyticsSiteDomain.js";

/**
 * Estatísticas do site público do tenant (Umami auto-hospedado — o Plausible
 * saiu do projeto em 2026-09-21, sem caminho legado).
 * Migrado para os clients gerados pelo Kubb. Bearer auto-injetado pelo
 * interceptor do `axiosInstance` partilhado (AuthContext.tsx) — o client
 * gerado corre nesse mesmo `axiosInstance`, por isso `authHeader()` deixou
 * de ser preciso aqui. As credenciais do Umami nunca chegam ao browser. A
 * API limita a leitura ao site do próprio tenant (`User.analyticsSiteId`),
 * isolamento multi-tenant.
 *
 * B19: `GET /analytics/site/domain` e `PUT /analytics/site/domain` passaram a
 * documentar a resposta (`{ websiteDomain: string | null }`, campo
 * obrigatório) — idêntica à local `SiteDomainResponse`, por isso os casts
 * dessas duas caíram.
 *
 * `GET /analytics/site` continua com cast: o schema documenta `configured`
 * como opcional (`configured?: boolean`) embora o runtime o devolva sempre —
 * falta o `required: ["configured"]` no `@swagger` do controller. `domain`
 * também está tipado `string | null` no gerado contra `string | undefined`
 * localmente (`SiteAnalyticsResponse.domain?: string`) — mais uma
 * incompatibilidade por trás da primeira que o `tsc` reporta.
 */

// Períodos suportados (herdados da sintaxe da Stats API do Plausible — mantidos
// por serem os que esta página já usa; a API traduz para o que o Umami espera).
// Nota: "7d"/"30d" vão até ONTEM (não incluem hoje); "day" (Hoje) e "month"
// (Este mês) incluem o dia corrente — daí o default ser "month".
export type AnalyticsPeriod = "day" | "7d" | "30d" | "month" | "6mo";

export interface AnalyticsAggregate {
  visitors?: { value: number };
  pageviews?: { value: number };
  bounce_rate?: { value: number };
  visit_duration?: { value: number };
}

export interface AnalyticsTimeseriesPoint {
  date: string;
  visitors: number;
}

export interface AnalyticsBreakdownRow {
  // page → "página"; source → "origem"
  page?: string;
  source?: string;
  visitors: number;
}

/** Par de tracking público de um website Umami — o snippet que um site
 *  EXTERNO (fora do site-engine) cola no próprio HTML. Só presente quando o
 *  tenant tem `analyticsSiteId` provisionado E o Umami está configurado no
 *  servidor (nunca um segredo — ver `src/utils/umami.ts` na API). */
export interface AnalyticsTrackingSnippet {
  websiteId: string;
  src: string;
}

export interface SiteAnalyticsResponse {
  configured: boolean;
  /** `no-domain`: tenant ainda não definiu domínio. `no-analytics-site`:
   *  já tem domínio, mas ainda não há site Umami provisionado (sucede o
   *  extinto `no-plausible`). */
  reason?: "no-analytics-site" | "no-domain";
  domain?: string;
  period?: string;
  aggregate?: AnalyticsAggregate;
  timeseries?: AnalyticsTimeseriesPoint[];
  topPages?: AnalyticsBreakdownRow[];
  sources?: AnalyticsBreakdownRow[];
  tracking?: AnalyticsTrackingSnippet;
  error?: string;
}

export interface SiteDomainResponse {
  websiteDomain: string | null;
}

const analyticsKey = (period: AnalyticsPeriod) => ["site-analytics", period];
const DOMAIN_KEY = ["site-analytics", "domain"];

/** GET /analytics/site?period= — estatísticas agregadas + séries + listas. */
export function useSiteAnalytics(period: AnalyticsPeriod) {
  const { isAuthenticated } = useAuth();
  return useQuery<SiteAnalyticsResponse>({
    queryKey: analyticsKey(period),
    enabled: isAuthenticated,
    queryFn: async () => (await getAnalyticsSite({ period })) as SiteAnalyticsResponse,
  });
}

/** GET /analytics/site/domain — domínio atual do site do tenant. */
export function useSiteDomain() {
  const { isAuthenticated } = useAuth();
  return useQuery<SiteDomainResponse>({
    queryKey: DOMAIN_KEY,
    enabled: isAuthenticated,
    queryFn: async () => await getAnalyticsSiteDomain(),
  });
}

/** PUT /analytics/site/domain — guarda o domínio (normalizado no servidor). */
export function useSetSiteDomain() {
  const qc = useQueryClient();
  return useMutation<SiteDomainResponse, unknown, string>({
    mutationFn: async (domain: string) => await putAnalyticsSiteDomain({ domain }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DOMAIN_KEY });
      qc.invalidateQueries({ queryKey: ["site-analytics"] });
    },
    // Sem isto a mutação falhava em SILÊNCIO: o formulário não tem `onError`,
    // e o utilizador via apenas o botão parar de girar sem nada acontecer.
    // Passou a importar a 2026-09-21, quando a API ganhou o 409 `domain_taken`
    // (um domínio já reclamado por outro tenant) e esta página deixou de ser
    // só do dono — `/estatisticas` passou a `CORE_PATHS` em `Shell.tsx`.
    // A função gerada continua a REJEITAR (throw) em não-2xx tal como o
    // axiosInstance manual — não usa `validateStatus` para resolver o 401/409
    // como resposta normal — por isso este catch por status continua válido.
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (status === 409 || code === "domain_taken") {
        // Não se diz de QUEM é — a API também não o revela, de propósito:
        // confirmar o dono seria dizer a um tenant que outro existe.
        toast.error("Esse domínio já está a ser usado. Confirma se está bem escrito.");
        return;
      }
      toast.error("Não foi possível guardar o domínio.");
    },
  });
}
