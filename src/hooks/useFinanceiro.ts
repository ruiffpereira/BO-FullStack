import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import type { DashboardPeriod } from './useDashboard'
import { getFinanceiroNegocio } from '../gen/backoffice/hooks/useGetFinanceiroNegocio.js'
import { getFinanceiroAgenda } from '../gen/backoffice/hooks/useGetFinanceiroAgenda.js'
import { getFinanceiroLoja } from '../gen/backoffice/hooks/useGetFinanceiroLoja.js'
import { postGymMensalidadeBulkPay } from '../gen/backoffice/hooks/usePostGymMensalidadeBulkPay.js'
import { postGymMensalidadeRemind } from '../gen/backoffice/hooks/usePostGymMensalidadeRemind.js'
import { patchGymMensalidadeCustomersCustomeridPayOnly } from '../gen/backoffice/hooks/usePatchGymMensalidadeCustomersCustomeridPayOnly.js'

// Migrado (B18) para os clients gerados pelo Kubb — ver secção "Mutations do
// ginásio" para a nota sobre `authHeader` mantido por compatibilidade.

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

// path → função gerada. Mantém a MESMA query key de sempre
// (['financeiro', path, ...]) — só a chamada HTTP deixou de ter o path à mão.
const financeiroFetchers = {
  negocio: getFinanceiroNegocio,
  agenda: getFinanceiroAgenda,
  loja: getFinanceiroLoja,
} as const

type FinanceiroPath = keyof typeof financeiroFetchers

function useFinanceQuery<T>(
  path: FinanceiroPath,
  period: DashboardPeriod,
  iva: VatMode,
  customStart?: string,
  customEnd?: string,
) {
  const { isAuthenticated } = useAuth()
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
      // Os QueryParams gerados diferem ligeiramente entre os 3 endpoints (ex.:
      // `negocio` nem documenta `iva`) — cast pragmático, o runtime dos 3
      // sempre aceitou estes campos da mesma forma.
      const fetcher = financeiroFetchers[path] as unknown as (
        params?: Record<string, string>,
      ) => Promise<T>
      return fetcher(params)
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
// `authHeader` mantém-se nos parâmetros por compatibilidade com GymMensalidade.tsx
// (fora do âmbito desta migração) — deixou de ser necessário: o client gerado
// corre no mesmo axiosInstance partilhado cujo interceptor (AuthContext.tsx)
// já injeta o Authorization.
export async function gymBulkMarkPaid(_authHeader: () => Record<string, string>, body: { customerIds: string[]; period?: string; method?: string }) {
  const data = await postGymMensalidadeBulkPay(body)
  return data as { period: string; paid: number }
}
export async function gymRemind(_authHeader: () => Record<string, string>, body: { customerIds?: string[]; period?: string }) {
  const data = await postGymMensalidadeRemind(body)
  return data as { period: string; sent: number }
}
/** Marca/desmarca o cliente como "só paga" (fora das estatísticas de assiduidade). */
export async function gymSetPayOnly(_authHeader: () => Record<string, string>, customerId: string, payOnly: boolean) {
  const data = await patchGymMensalidadeCustomersCustomeridPayOnly(customerId, { payOnly })
  return data as { payOnly: boolean }
}
