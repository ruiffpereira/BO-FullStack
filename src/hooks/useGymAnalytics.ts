import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getGymMensalidadeAnalytics } from "../gen/backoffice/hooks/useGetGymMensalidadeAnalytics.js";
import type { GetGymMensalidadeAnalytics200 } from "../gen/backoffice/types/GetGymMensalidadeAnalytics.js";

/**
 * Tipos DERIVADOS do gerado, nunca uma `interface` à mão ao lado: dois tipos a
 * descrever a mesma resposta foi o que segurou o cast do `/analytics/site`
 * (B20) — o gerado corrigia-se e o local continuava a mentir.
 */
export type GymAnalytics = GetGymMensalidadeAnalytics200;
export type GymMrrTrendPoint = GymAnalytics["mrrTrend"][number];
export type GymWaterfallPoint = GymAnalytics["waterfall"][number];

/**
 * GET /gym/mensalidade/analytics — churn / retenção / LTV / MRR trend do tenant.
 * Migrado (B18) para o client gerado. O cast `as GymAnalytics` CAIU
 * (2026-09-26, B20): o `@swagger` do controller passou a declarar `required`
 * em todos os campos (API@68f8036), e o gerado deixou de os ter opcionais.
 */
export function useGymAnalytics() {
  const { isAuthenticated } = useAuth();
  return useQuery<GymAnalytics>({
    queryKey: ["/gym/mensalidade/analytics"],
    enabled: isAuthenticated,
    queryFn: async () => await getGymMensalidadeAnalytics(),
  });
}
