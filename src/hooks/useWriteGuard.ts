import { useBillingReadOnly } from './useBillingReadOnly'
import type { BillingSubscriptionReasonEnum } from '../gen/backoffice/types/BillingSubscription'

/**
 * Mensagem única (PT) mostrada nos CTAs de escrita bloqueados por billing read-only.
 * Uma só string em toda a app → mensagem consistente (o link de regularização vive
 * no `BillingBanner`, sempre visível no topo do Shell neste estado, e no toast do
 * gate 402 — ver `src/lib/billing402.ts`).
 */
export const WRITE_GUARD_MESSAGE =
  'Pagamento pendente — regulariza a subscrição em Faturação para voltar a editar.'

export interface WriteGuard {
  /** `true` = a subscrição está bloqueada; as escritas devolvem 402. */
  readOnly: boolean
  /** Motivo do estado (grace/past_due_locked/canceled/…). */
  reason: BillingSubscriptionReasonEnum
  /** Texto PT a mostrar no tooltip/aria dos CTAs desativados. */
  message: string
}

/**
 * Helper partilhado do WRITE-GUARD proativo do platform billing.
 *
 * Componentes que têm um CTA de escrita não-`Button` (ex.: um `<button>` cru)
 * chamam `const { readOnly, message } = useWriteGuard()` e fazem `disabled={... || readOnly}`
 * + `title={readOnly ? message : undefined}`. Para os `Button` partilhados existe
 * o drop-in `GuardButton`, que já aplica isto de forma consistente.
 *
 * Só para CTAs de gestão (POST/PUT/PATCH/DELETE). NÃO usar para navegação, leitura,
 * logout, portal de pagamento (Stripe) nem chat de suporte — um tenant bloqueado
 * tem de continuar a poder pagar e falar com o suporte.
 */
export function useWriteGuard(): WriteGuard {
  const { readOnly, reason } = useBillingReadOnly()
  return { readOnly, reason, message: WRITE_GUARD_MESSAGE }
}
