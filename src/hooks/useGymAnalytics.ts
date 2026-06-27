import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";

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

/** GET /gym/mensalidade/analytics — churn / retenção / LTV / MRR trend do tenant. */
export function useGymAnalytics() {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<GymAnalytics>({
    queryKey: ["/gym/mensalidade/analytics"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await axiosInstance.get<GymAnalytics>("/gym/mensalidade/analytics", {
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data;
    },
  });
}
