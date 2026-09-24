import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getGymMensalidadeAnalytics } from "../gen/backoffice/hooks/useGetGymMensalidadeAnalytics.js";

export interface GymMrrTrendPoint {
  period: string;
  recebido: number;
}

export interface GymWaterfallPoint {
  period: string;
  novo: number;
  expansao: number;
  contracao: number;
  perdido: number;
  liquido: number;
}

export interface GymAnalytics {
  mrr: number;
  arr: number;
  collectionRate: number;
  activeMembers: number;
  blockedMembers: number;
  inactiveMembers: number;
  inactiveAfterDays: number;
  churn: { rate: number; count: number; base: number };
  retentionRate: number;
  avgLifetimeMonths: number;
  ltv: number;
  mrrTrend: GymMrrTrendPoint[];
  waterfall: GymWaterfallPoint[];
}

/**
 * GET /gym/mensalidade/analytics — churn / retenção / LTV / MRR trend do tenant.
 * Migrado (B18) para o client gerado. Tipo local mantido: o spec ainda não
 * documenta `inactiveMembers`/`inactiveAfterDays`/`waterfall` (o runtime já os
 * devolve — atraso do Swagger, fora do âmbito desta migração de Backoffice).
 */
export function useGymAnalytics() {
  const { isAuthenticated } = useAuth();
  return useQuery<GymAnalytics>({
    queryKey: ["/gym/mensalidade/analytics"],
    enabled: isAuthenticated,
    queryFn: async () => (await getGymMensalidadeAnalytics()) as GymAnalytics,
  });
}
