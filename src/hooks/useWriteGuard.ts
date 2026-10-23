import { useContext } from 'react'
import { useInRouterContext, UNSAFE_LocationContext } from 'react-router-dom'
import { useBillingReadOnly } from './useBillingReadOnly'
import { useTeamAccess } from './useTeamAccess'
import { isLeafExempt, leafForPath } from '../lib/navigation'
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
  /** Só a equipa (B41): o membro ligado só pode VER a folha da página actual (ou a pedida em `leaf`). */
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
 * Equipa (B41 2b): a FOLHA da página actual resolve-se pelo pathname (`leafForPath`, `lib/navigation.ts`) e o nível
 * vem de `can()` (AuthContext, dado pela API). Um membro sem `edit` nessa folha fica bloqueado com "Só tens
 * permissão para ver". Onde uma página mistura folhas (modal de marcação, custo do produto, apagar cliente…) o
 * controlo passa a folha certa em `leaf` (uma ou várias; basta `edit` numa). O dono nunca é afectado.
 *
 * Só para CTAs de gestão (POST/PUT/PATCH/DELETE). NÃO usar para navegação, leitura,
 * logout, portal de pagamento (Stripe) nem chat de suporte — um tenant bloqueado
 * tem de continuar a poder pagar e falar com o suporte.
 */
export function useWriteGuard(leaf?: string | readonly string[]): WriteGuard {
  const { readOnly: billingReadOnly, reason } = useBillingReadOnly()
  const { isMember, can } = useTeamAccess()
  // Renderizado isolado (testes, sem Router) → sem pathname, sem bloqueio de equipa.
  const inRouter = useInRouterContext()
  // Fora de um Router o contexto é `null` → lê-se sem chamar `useLocation` condicionalmente.
  const pathname = useContext(UNSAFE_LocationContext)?.location.pathname ?? ''
  const pathLeaf = isMember && !leaf ? leafForPath(pathname) : undefined
  const leaves: readonly string[] = !isMember ? [] : leaf ? (typeof leaf === 'string' ? [leaf] : leaf) : pathLeaf ? [pathLeaf] : []
  // Fail-closed (EQ-03/EQ-04): um membro numa rota sem folha (e não isenta) só lê. Sem Router não há pathname → não decide.
  const unmapped = isMember && !leaf && inRouter && !pathLeaf && !isLeafExempt(pathname)
  const viewOnly = unmapped || (leaves.length > 0 && !leaves.some((l) => can(l, 'edit')))
  return {
    readOnly: billingReadOnly || viewOnly,
    billingReadOnly,
    viewOnly,
    reason,
    message: billingReadOnly ? WRITE_GUARD_MESSAGE : VIEW_ONLY_MESSAGE,
  }
}
