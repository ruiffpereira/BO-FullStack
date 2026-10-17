import { useInRouterContext, useLocation } from 'react-router-dom'
import { useBillingReadOnly } from './useBillingReadOnly'
import { useTeamAccess } from './useTeamAccess'
import { moduleForPath } from '../lib/navigation'
import { VIEW_ONLY_MESSAGE } from '../lib/teamAccess'
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
  /**
   * `true` = as escritas desta página estão bloqueadas, seja por billing (devolvem 402) seja porque um
   * membro da equipa só tem `view` no módulo da página (devolvem 403 `TEAM_FORBIDDEN`).
   */
  readOnly: boolean
  /** Só o billing: a subscrição está bloqueada. */
  billingReadOnly: boolean
  /** Só a equipa (B41): o membro ligado só pode VER o módulo da página actual. */
  viewOnly: boolean
  /** Motivo do billing (grace/past_due_locked/canceled/…). */
  reason: BillingSubscriptionReasonEnum
  /** Texto PT a mostrar no tooltip/aria dos CTAs desativados (billing tem prioridade sobre "só ver"). */
  message: string
}

/**
 * Helper partilhado do WRITE-GUARD proativo (platform billing + permissões da equipa).
 *
 * Componentes que têm um CTA de escrita não-`Button` (ex.: um `<button>` cru)
 * chamam `const { readOnly, message } = useWriteGuard()` e fazem `disabled={... || readOnly}`
 * + `title={readOnly ? message : undefined}`. Para os `Button` partilhados existe
 * o drop-in `GuardButton`, que já aplica isto de forma consistente.
 *
 * Equipa (B41): o módulo da página actual resolve-se pelo pathname (`moduleForPath`, `lib/navigation.ts`)
 * e o nível vem de `can()` (AuthContext, dado pela API). Um membro com `view` nesse módulo fica bloqueado
 * com "Só tens permissão para ver". O dono nunca é afectado.
 *
 * Só para CTAs de gestão (POST/PUT/PATCH/DELETE). NÃO usar para navegação, leitura,
 * logout, portal de pagamento (Stripe) nem chat de suporte — um tenant bloqueado
 * tem de continuar a poder pagar e falar com o suporte.
 */
export function useWriteGuard(): WriteGuard {
  const { readOnly: billingReadOnly, reason } = useBillingReadOnly()
  const { isMember, can } = useTeamAccess()
  // Renderizado isolado (testes, sem Router) → sem pathname, sem bloqueio de equipa. `useInRouterContext` é
  // estável durante a vida do componente, por isso a chamada condicional não muda a ordem dos hooks.
  const inRouter = useInRouterContext()
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const pathname = inRouter ? useLocation().pathname : ''
  const mod = isMember ? moduleForPath(pathname) : undefined
  const viewOnly = !!mod && can(mod, 'view') && !can(mod, 'edit')
  return {
    readOnly: billingReadOnly || viewOnly,
    billingReadOnly,
    viewOnly,
    reason,
    message: billingReadOnly ? WRITE_GUARD_MESSAGE : VIEW_ONLY_MESSAGE,
  }
}
