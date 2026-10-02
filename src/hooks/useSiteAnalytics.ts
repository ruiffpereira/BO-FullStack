import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getAnalyticsSite } from "../gen/backoffice/hooks/useGetAnalyticsSite.js";
import type { GetAnalyticsSite200 } from "../gen/backoffice/types/GetAnalyticsSite.js";

/**
 * Estatísticas do site público do tenant (Umami auto-hospedado).
 * Migrado para os clients gerados pelo Kubb. Bearer auto-injetado pelo
 * interceptor do `axiosInstance` partilhado (AuthContext.tsx) — o client
 * gerado corre nesse mesmo `axiosInstance`, por isso `authHeader()` deixou
 * de ser preciso aqui. As credenciais do Umami nunca chegam ao browser. A
 * API limita a leitura ao site do próprio tenant (`User.analyticsSiteId`),
 * isolamento multi-tenant.
 *
 * O domínio do site já não é daqui: define-o o dono da plataforma no Admin
 * (`PUT /admin/users/{userId}/site-domain`). B20 (2026-09-24): `GET /analytics/site` não tem cast. O
 * spec pôs `configured` em `required`, e os tipos locais passaram a derivar do
 * gerado em vez de o duplicarem — ver o bloco de tipos abaixo. A
 * chamada deste ficheiro não faz `as` sobre a resposta; se voltar a ser preciso um,
 * o problema está no spec ou num tipo duplicado, não no frontend.
 */

// Períodos suportados (a API traduz para o que o Umami espera).
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

const analyticsKey = (period: AnalyticsPeriod) => ["site-analytics", period];

/** GET /analytics/site?period= — estatísticas agregadas + séries + listas. */
export function useSiteAnalytics(period: AnalyticsPeriod) {
  const { isAuthenticated } = useAuth();
  return useQuery<SiteAnalyticsResponse>({
    queryKey: analyticsKey(period),
    enabled: isAuthenticated,
    queryFn: async () => await getAnalyticsSite({ period }),
  });
}
