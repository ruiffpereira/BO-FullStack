import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getDashboard as getDashboardGen } from "../gen/backoffice/hooks/useGetDashboard.js";
import type { GetDashboard200, GetDashboard200PeriodEnum } from "../gen/backoffice/types/GetDashboard.js";

/**
 * Tipos DERIVADOS do gerado, nunca uma `interface` à mão ao lado: dois tipos a
 * descrever a mesma resposta foi o que segurou o cast do `/analytics/site`
 * (B20) — o gerado corrigia-se e o local continuava a mentir. Mesmo padrão do
 * `useGymAnalytics.ts`.
 */
export type DashboardData = GetDashboard200;
export type DashboardPeriod = GetDashboard200PeriodEnum;

export type ScheduleStats = NonNullable<DashboardData["schedule"]>;
export type EcommerceStats = NonNullable<DashboardData["ecommerce"]>;
export type GymStats = NonNullable<DashboardData["gym"]>;
export type ExpensesStats = DashboardData["expenses"];

/**
 * `orders` só existe no `revenueByPeriod` do `ecommerce` (não no de
 * `schedule`/`gym`) — mantido opcional aqui para continuar a servir os três,
 * como antes da migração.
 */
export type RevenuePoint = ScheduleStats["revenueByPeriod"][number] & { orders?: number };

/**
 * GET /dashboard?period= — analytics agregadas por módulo acessível.
 * Migrado (B18) para o client gerado. O param `period` já não precisa de
 * cast: `GetDashboardQueryParams` tem `period` opcional, por isso o `tsc`
 * aceita o objeto largo (com `startDate`/`endDate` extra, para "custom") sem
 * reclamar (B19 não mudou isto — nunca foi preciso).
 *
 * O cast na RESPOSTA caiu (B20): o schema de `schedule.period` no `@swagger`
 * passou a declarar `revenuePrevious` (que o controller já devolvia e o
 * Dashboard já usava) e `required` em todos os campos de `schedule`,
 * `ecommerce`, `gym` e `expenses` — os tipos locais acima derivam agora do
 * gerado em vez de uma `interface` à parte.
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
      return await getDashboardGen(params);
    },
  });
}
