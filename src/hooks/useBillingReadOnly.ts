import { useGetBillingSubscription } from '../gen/backoffice/hooks/useGetBillingSubscription'
import type { BillingSubscriptionReasonEnum } from '../gen/backoffice/types/BillingSubscription'

export interface BillingReadOnlyState {
  /**
   * `true` quando a subscrição da plataforma do tenant está read-only — a gestão
   * está bloqueada e as escritas (POST/PUT/PATCH/DELETE) devolvem 402. Deriva do
   * `readOnly` autoritativo que a API já calcula (pagamento em atraso além do
   * grace / cancelada).
   */
  readOnly: boolean
  /** Motivo do estado (`none`/`trialing`/`active`/`grace`/`past_due_locked`/`canceled`/…). */
  reason: BillingSubscriptionReasonEnum
}

/**
 * Fonte única de verdade para "estou read-only agora?" no Backoffice.
 *
 * Lê a subscrição da plataforma pela cache do React Query (`useGetBillingSubscription`
 * — a mesma query que a Faturação/BillingBanner já usam, sem rede extra). Serve o
 * WRITE-GUARD **proativo** (ver `useWriteGuard`/`GuardButton`): desativar CTAs de
 * escrita ANTES de bater na API. O feedback **reativo** (toast ao apanhar 402)
 * continua no interceptor do `AuthContext` (ver `src/lib/billing402.ts`).
 */
export function useBillingReadOnly(): BillingReadOnlyState {
  // staleTime alto: este hook é chamado de dentro de modais (ApptModal, NovaApptModal,
  // ProdutoModal, modais do ginásio) que montam de novo em cada abertura — sem isto,
  // os defaults globais (staleTime:0 + refetchOnMount:true, src/lib/queryClient.ts)
  // disparavam um GET /billing/subscription a cada abertura de modal.
  const { data } = useGetBillingSubscription({ query: { staleTime: 5 * 60_000 } })
  return {
    readOnly: data?.readOnly ?? false,
    reason: data?.reason ?? 'none',
  }
}
