import { toast } from 'sonner'
import { isBillingReadOnlyError } from './billingStatus'

/**
 * Feedback **reativo** do gate read-only do platform billing.
 *
 * Quando uma escrita de gestão (POST/PUT/PATCH/DELETE) é respondida com 402 pelo
 * `billingGate` da API (subscrição por regularizar), mostramos UM toast coalescido
 * a apontar o tenant para `/faturacao`. Complementa o `BillingBanner` (aviso
 * proativo, sempre visível): isto é o feedback no momento exato em que se tenta
 * editar — princípio do brief "degradar, não punir" (caminho claro de
 * regularização, não uma porta trancada silenciosa).
 *
 * **Não engole o erro:** o interceptor continua a rejeitar a promise, por isso as
 * mutations do React Query veem o 402 e correm o seu `onError` normalmente. Aqui
 * só ADICIONAMOS o toast.
 *
 * Dedup em duas camadas: id fixo (`billing-402`) → o sonner mantém um só toast em
 * ecrã; + um throttle temporal para não repetir a chamada numa rajada de escritas
 * falhadas (ex.: o user carrega várias vezes seguidas).
 */

const TOAST_ID = 'billing-402'
const THROTTLE_MS = 5_000
let lastShownAt = 0

export function notifyBillingReadOnly(
  status: number | undefined,
  data: unknown,
  navigate: (to: string) => void,
): boolean {
  if (!isBillingReadOnlyError(status, data)) return false
  const now = Date.now()
  if (now - lastShownAt < THROTTLE_MS) return true // já avisado há pouco — não repetir
  lastShownAt = now
  toast.error(
    'A tua subscrição está por regularizar — regulariza o pagamento para voltar a editar.',
    {
      id: TOAST_ID,
      action: { label: 'Faturação', onClick: () => navigate('/faturacao') },
    },
  )
  return true
}

/** Reset do throttle — só para testes (o estado do módulo persiste entre casos). */
export function resetBillingReadOnlyThrottle() {
  lastShownAt = 0
}
