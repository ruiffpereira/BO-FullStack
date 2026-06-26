import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";

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

/** GET /dashboard?period= — analytics agregadas por módulo acessível. */
export function useDashboard(period: DashboardPeriod = "30d", customStart?: string, customEnd?: string) {
  const { authHeader, isAuthenticated } = useAuth();
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
      const res = await axiosInstance.get<DashboardData>("/dashboard", {
        params,
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data;
    },
  });
}
