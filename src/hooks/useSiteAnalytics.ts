import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { getAnalyticsSite } from "../gen/backoffice/hooks/useGetAnalyticsSite.js";
import { getAnalyticsSiteDomain } from "../gen/backoffice/hooks/useGetAnalyticsSiteDomain.js";
import { putAnalyticsSiteDomain } from "../gen/backoffice/hooks/usePutAnalyticsSiteDomain.js";
import type { GetAnalyticsSite200 } from "../gen/backoffice/types/GetAnalyticsSite.js";

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
 * B20 (2026-09-24) fechou o último: `GET /analytics/site` já não tem cast. O
 * spec pôs `configured` em `required`, e os tipos locais passaram a derivar do
 * gerado em vez de o duplicarem — ver o bloco de tipos abaixo. Nenhuma das três
 * chamadas deste ficheiro faz `as` sobre a resposta; se voltar a ser preciso um,
 * o problema está no spec ou num tipo duplicado, não no frontend.
 */

// Períodos suportados (herdados da sintaxe da Stats API do Plausible — mantidos
// por serem os que esta página já usa; a API traduz para o que o Umami espera).
// Nota: "7d"/"30d" vão até ONTEM (não incluem hoje); "day" (Hoje) e "month"
// (Este mês) incluem o dia corrente — daí o default ser "month".
export type AnalyticsPeriod = "day" | "7d" | "30d" | "month" | "6mo";

/**
 * A resposta é O TIPO GERADO, não uma cópia. Havia duas descrições da mesma
 * resposta — a gerada e uma `interface` escrita à mão aqui — e era a segunda,
 * fixada pelo `useQuery<...>`, que obrigava ao cast no `queryFn`. Os campos
 * abaixo derivam-se do gerado (`NonNullable<...>`/indexação), por isso um
 * `pnpm kubb` que mude o contrato parte o `tsc` em vez de passar em silêncio.
 *
 * O gerado é mais fraco de propósito: tudo o que depende de ramo
 * (`configured`, erro do Umami, domínio externo) é opcional, porque é mesmo
 * opcional na resposta. Era esse o bug que o cast escondia.
 */
export type SiteAnalyticsResponse = GetAnalyticsSite200;

export type AnalyticsAggregate = NonNullable<GetAnalyticsSite200["aggregate"]>;

export type AnalyticsTimeseriesPoint = NonNullable<GetAnalyticsSite200["timeseries"]>[number];

/**
 * `topPages` e `sources` são tipos DISTINTOS no gerado (um tem `page`, o outro
 * `source`), mas a `BreakdownList` do `Estatisticas.tsx` serve os dois e indexa
 * por `r[labelKey]`. A intersecção dá `{ page?, source?, visitors? }` — a forma
 * que a lista precisa — e continua a aceitar qualquer um dos dois arrays, já
 * que o campo em falta é opcional de cada lado.
 */
export type AnalyticsBreakdownRow = NonNullable<GetAnalyticsSite200["topPages"]>[number] &
  NonNullable<GetAnalyticsSite200["sources"]>[number];

/** Par de tracking público de um website Umami — o snippet que um site
 *  EXTERNO (fora do site-engine) cola no próprio HTML. Só presente quando o
 *  tenant tem `analyticsSiteId` provisionado E o Umami está configurado no
 *  servidor (nunca um segredo — ver `src/utils/umami.ts` na API). */
export type AnalyticsTrackingSnippet = NonNullable<GetAnalyticsSite200["tracking"]>;

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
    queryFn: async () => await getAnalyticsSite({ period }),
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
