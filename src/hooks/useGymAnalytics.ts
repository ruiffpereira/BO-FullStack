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
 * Migrado (B18) para o client gerado. B19 já documenta todos os campos
 * (`arr`/`collectionRate`/`inactiveMembers`/`inactiveAfterDays`/`waterfall`
 * incluídos), mas NENHUM está marcado `required` no schema — o gerado tem
 * `mrr?`, `arr?`, … todos opcionais, e o `tsc` só reporta o primeiro (`mrr`)
 * porque a checagem de assignability pára no primeiro campo incompatível.
 * O runtime sempre devolve o objeto completo; falta o `required: [...]` no
 * `@swagger` do controller — cast mantido até isso ser corrigido na API.
 */
export function useGymAnalytics() {
  const { isAuthenticated } = useAuth();
  return useQuery<GymAnalytics>({
    queryKey: ["/gym/mensalidade/analytics"],
    enabled: isAuthenticated,
    queryFn: async () => (await getGymMensalidadeAnalytics()) as GymAnalytics,
  });
}
