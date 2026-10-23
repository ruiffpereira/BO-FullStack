import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import type { DashboardPeriod } from './useDashboard'
import { getFinanceiroNegocio } from '../gen/backoffice/hooks/useGetFinanceiroNegocio.js'
import { getFinanceiroAgenda } from '../gen/backoffice/hooks/useGetFinanceiroAgenda.js'
import { getFinanceiroLoja } from '../gen/backoffice/hooks/useGetFinanceiroLoja.js'
import { postGymMensalidadeBulkPay } from '../gen/backoffice/hooks/usePostGymMensalidadeBulkPay.js'
import { postGymMensalidadeRemind } from '../gen/backoffice/hooks/usePostGymMensalidadeRemind.js'
import { patchGymMensalidadeCustomersCustomeridPayOnly } from '../gen/backoffice/hooks/usePatchGymMensalidadeCustomersCustomeridPayOnly.js'
import type { FinanceiroAgenda } from '../gen/backoffice/types/FinanceiroAgenda.js'
import type { FinanceiroLoja } from '../gen/backoffice/types/FinanceiroLoja.js'
import type { FinanceiroNegocio } from '../gen/backoffice/types/FinanceiroNegocio.js'
import { queryKeys } from '../lib/queryKeys'

// Tipos DERIVADOS do gerado (nunca uma interface à mão ao lado).
export type VatMode = 'com' | 'sem'
export type AgendaFinance = FinanceiroAgenda
export type LojaFinance = FinanceiroLoja
export type NegocioFinance = FinanceiroNegocio
/** Os três `money` partilham faturado/recebido/emDivida; os crescimentos variam por módulo. */
export type Money = Pick<FinanceiroAgenda['money'], 'faturado' | 'recebido' | 'emDivida'> &
  Partial<Pick<FinanceiroAgenda['money'], 'faturadoGrowth' | 'recebidoGrowth'>>

type FinanceParams = { period: DashboardPeriod; iva: VatMode; staff?: string; startDate?: string; endDate?: string }

function useFinanceQuery<T>(
  path: 'negocio' | 'agenda' | 'loja',
  fetcher: (params: FinanceParams) => Promise<T>,
  period: DashboardPeriod,
  iva: VatMode,
  customStart?: string,
  customEnd?: string,
  staff?: string,
) {
  const { isAuthenticated } = useAuth()
  const isCustomValid = period !== 'custom' || (!!customStart && !!customEnd)
  return useQuery<T>({
    queryKey: queryKeys.financeiro.of(path, period, iva, customStart, customEnd, staff),
    enabled: isAuthenticated && isCustomValid,
    queryFn: () => {
      const params: FinanceParams = { period, iva }
      // Profissionais: `none` ou o id de um profissional (omitido = Global).
      if (staff) params.staff = staff
      if (period === 'custom' && customStart && customEnd) {
        params.startDate = customStart
        params.endDate = customEnd
      }
      return fetcher(params)
    },
  })
}

// `negocio` não documenta `iva` no spec (o parâmetro é ignorado/aceite pela API); o objecto largo passa sem cast.
export const useNegocioFinance = (period: DashboardPeriod = 'month', iva: VatMode = 'com', s?: string, e?: string, staff?: string) =>
  useFinanceQuery<NegocioFinance>('negocio', (p) => getFinanceiroNegocio(p), period, iva, s, e, staff)
export const useAgendaFinance = (period: DashboardPeriod = 'month', iva: VatMode = 'com', s?: string, e?: string, staff?: string) =>
  useFinanceQuery<AgendaFinance>('agenda', (p) => getFinanceiroAgenda(p), period, iva, s, e, staff)
export const useLojaFinance = (period: DashboardPeriod = 'month', iva: VatMode = 'com', s?: string, e?: string, staff?: string) =>
  useFinanceQuery<LojaFinance>('loja', (p) => getFinanceiroLoja(p), period, iva, s, e, staff)

// ── Mutations do ginásio (cobrança em massa / lembretes) ──
// O client gerado corre no `axiosInstance` partilhado: o interceptor (AuthContext.tsx) injeta o Authorization.
export async function gymBulkMarkPaid(body: { customerIds: string[]; period?: string; method?: string }) {
  const data = await postGymMensalidadeBulkPay(body)
  return data as { period: string; paid: number }
}
export async function gymRemind(body: { customerIds?: string[]; period?: string }) {
  const data = await postGymMensalidadeRemind(body)
  return data as { period: string; sent: number }
}
/** Marca/desmarca o cliente como "só paga" (fora das estatísticas de assiduidade). */
export async function gymSetPayOnly(customerId: string, payOnly: boolean) {
  const data = await patchGymMensalidadeCustomersCustomeridPayOnly(customerId, { payOnly })
  return data as { payOnly: boolean }
}
