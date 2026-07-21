import { useQuery } from '@tanstack/react-query'
import { axiosInstance } from '@kubb/plugin-client/clients/axios'
import { useAuth } from '../context/AuthContext'
import type { DashboardPeriod } from './useDashboard'

export type VatMode = 'com' | 'sem'

export interface Money {
  faturado: number
  recebido: number
  emDivida: number
  faturadoGrowth?: number | null
  recebidoGrowth?: number | null
}

export interface AgendaFinance {
  period: DashboardPeriod
  iva: VatMode
  money: Money
  valorMedioPorMarcacao: number
  counts: { total: number; byStatus: Record<string, number> }
  rates: { completion: number; cancellation: number; noShow: number }
  paymentMethods: { cash: number; mbway: number; card: number }
  revenueByPeriod: { date: string; faturado: number; recebido: number }[]
  topServices: { serviceId: string | null; name: string | null; color: string | null; count: number; faturado: number }[]
  heatmap: { dayOfWeek: number; day: string; hour: number; count: number }[]
  occupancy: { availableHours: number; bookedHours: number; occupancyPct: number; revenuePerHour: number }
  customers: { novos: number; recorrentes: number; taxaRetorno: number; novosGrowth: number | null; perdidos: number; lostAfterDays: number }
  lostCustomers: { customerId: string; name: string; contact: string | null; email: string | null; lastVisit: string; daysSince: number; visits: number }[]
}

export interface LojaFinance {
  period: DashboardPeriod
  iva: VatMode
  money: Money
  margem: { total: number; coverage: number; marginPct: number }
  valorMedioPorCompra: number
  counts: { orders: number; byStatus: Record<string, number> }
  devolucoes: number
  descontoDado: number
  revenueByPeriod: { date: string; faturado: number; margem: number }[]
  topProducts: { productId: string; name: string | null; stock: number | null; qty: number; faturado: number; margem: number | null }[]
  topCategories: { categoryId: string | null; name: string; faturado: number }[]
  customers: { novos: number; recorrentes: number; perdidos: number; taxaRecompra: number; ltv: number; novosGrowth: number | null; lostAfterDays: number }
  inventory: {
    lowStock: { name: string; reference: string | null; stock: number }[]
    deadStock: { count: number; value: number; items: { name: string; stock: number; value: number }[] }
  }
  abandonedCarts: { count: number; value: number }
}

export interface NegocioFinance {
  period: DashboardPeriod
  modules: { agenda: boolean; loja: boolean; gym: boolean }
  money: Money
  despesas: number
  lucro: number
  margem: number
  revenueBySource: Partial<Record<'agenda' | 'loja' | 'gym', number>>
  health: {
    score: number
    hasData: boolean
    factors: { key: string; label: string; score: number; weight: number; detail: string }[]
  }
}

function useFinanceQuery<T>(
  path: string,
  period: DashboardPeriod,
  iva: VatMode,
  customStart?: string,
  customEnd?: string,
) {
  const { authHeader, isAuthenticated } = useAuth()
  const isCustomValid = period !== 'custom' || (!!customStart && !!customEnd)
  return useQuery<T>({
    queryKey: ['financeiro', path, period, iva, customStart, customEnd],
    enabled: isAuthenticated && isCustomValid,
    queryFn: async () => {
      const params: Record<string, string> = { period, iva }
      if (period === 'custom' && customStart && customEnd) {
        params.startDate = customStart
        params.endDate = customEnd
      }
      const res = await axiosInstance.get<T>(`/financeiro/${path}`, {
        params,
        headers: authHeader(),
        withCredentials: true,
      })
      return res.data
    },
  })
}

export const useNegocioFinance = (period: DashboardPeriod = 'month', iva: VatMode = 'com', s?: string, e?: string) =>
  useFinanceQuery<NegocioFinance>('negocio', period, iva, s, e)
export const useAgendaFinance = (period: DashboardPeriod = 'month', iva: VatMode = 'com', s?: string, e?: string) =>
  useFinanceQuery<AgendaFinance>('agenda', period, iva, s, e)
export const useLojaFinance = (period: DashboardPeriod = 'month', iva: VatMode = 'com', s?: string, e?: string) =>
  useFinanceQuery<LojaFinance>('loja', period, iva, s, e)

// ── Mutations do ginásio (cobrança em massa / lembretes) ──
export async function gymBulkMarkPaid(authHeader: () => Record<string, string>, body: { customerIds: string[]; period?: string; method?: string }) {
  const res = await axiosInstance.post('/gym/mensalidade/bulk-pay', body, { headers: authHeader(), withCredentials: true })
  return res.data as { period: string; paid: number }
}
export async function gymRemind(authHeader: () => Record<string, string>, body: { customerIds?: string[]; period?: string }) {
  const res = await axiosInstance.post('/gym/mensalidade/remind', body, { headers: authHeader(), withCredentials: true })
  return res.data as { period: string; sent: number }
}
/** Marca/desmarca o cliente como "só paga" (fora das estatísticas de assiduidade). */
export async function gymSetPayOnly(authHeader: () => Record<string, string>, customerId: string, payOnly: boolean) {
  const res = await axiosInstance.patch(`/gym/mensalidade/customers/${customerId}/pay-only`, { payOnly }, { headers: authHeader(), withCredentials: true })
  return res.data as { payOnly: boolean }
}
