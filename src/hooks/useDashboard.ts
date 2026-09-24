import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getDashboard as getDashboardGen } from "../gen/backoffice/hooks/useGetDashboard.js";
import type { GetDashboardQueryParams } from "../gen/backoffice/types/GetDashboard.js";

export type DashboardPeriod = "7d" | "30d" | "90d" | "12m" | "today" | "week" | "month" | "lastMonth" | "year" | "total" | "custom";

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders?: number;
}

export interface ScheduleStats {
  period: {
    total: number;
    byStatus: Record<string, number>;
    revenue: number;
    revenuePrevious: number;
    revenueGrowth: number | null;
    countGrowth: number | null;
  };
  completionRate: number;
  cancellationRate: number;
  avgRevenue: number;
  upcomingToday: number;
  upcomingWeek: number;
  revenueByPeriod: RevenuePoint[];
  topServices: {
    serviceId: string;
    name: string | null;
    color: string | null;
    count: number;
    revenue: number;
  }[];
  busyDays: { dayOfWeek: number; day: string; count: number }[];
  busyHours: { hour: number; label: string; count: number }[];
}

export interface EcommerceStats {
  period: {
    orders: number;
    revenue: number;
    revenuePrevious: number;
    revenueGrowth: number | null;
    ordersGrowth: number | null;
    avgOrderValue: number;
    byStatus: Record<string, number>;
  };
  revenueByPeriod: RevenuePoint[];
  topProducts: {
    productId: string;
    name: string | null;
    stock: number | null;
    totalQty: number;
    totalRevenue: number;
  }[];
  topCategories: { categoryId: string; name: string; revenue: number }[];
  customers: {
    total: number;
    new: number;
    newPrevious: number;
    newGrowth: number | null;
    byPeriod: { date: string; count: number }[];
  };
  stockAlerts: { name: string; reference: string; stock: number }[];
  couponUsage: { code: string; uses: number; totalDiscount: number }[];
}

export interface ExpensesStats {
  period: {
    total: number;
    totalPrevious: number;
    totalGrowth: number | null;
  };
  byCategory: { categoryId: string | null; name: string; color: string; total: number }[];
  expensesByPeriod: { date: string; amount: number }[];
}

export interface GymStats {
  period: {
    revenue: number;
    revenuePrevious: number;
    revenueGrowth: number | null;
  };
  revenueByPeriod: RevenuePoint[];
  activeMembers: number;
}

export interface DashboardData {
  period: DashboardPeriod;
  schedule?: ScheduleStats;
  ecommerce?: EcommerceStats;
  gym?: GymStats;
  expenses?: ExpensesStats;
}

/**
 * GET /dashboard?period= — analytics agregadas por módulo acessível.
 * Migrado (B18) para o client gerado. `DashboardPeriod` é mais largo (inclui
 * "today"/"week"/"month"/… usados também pelo Financeiro) do que o enum de 4
 * valores que o spec documenta para este endpoint — cast pragmático via
 * `unknown`, o runtime sempre aceitou o valor tal como estava. O gen também
 * não documenta `gym`/`expenses` no corpo da resposta (o runtime devolve-os).
 */
export function useDashboard(period: DashboardPeriod = "30d", customStart?: string, customEnd?: string) {
  const { isAuthenticated } = useAuth();
  const isCustomValid = period !== "custom" || (!!customStart && !!customEnd);
  return useQuery<DashboardData>({
    queryKey: ["dashboard", period, customStart, customEnd],
    enabled: isAuthenticated && isCustomValid,
    queryFn: async () => {
      const params: Record<string, string> = { period };
      if (period === "custom" && customStart && customEnd) {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const data = await getDashboardGen(params as unknown as GetDashboardQueryParams);
      return data as DashboardData;
    },
  });
}
