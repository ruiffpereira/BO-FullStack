import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../ui/icons.jsx'
import { useGetBillingSubscription } from '../gen/backoffice/hooks/useGetBillingSubscription'
import { fmtLongDate } from '../lib/billingStatus'

/**
 * Faixa de billing no topo do Shell (acima do `<main>`, visível em todas as
 * páginas). Invisível quando está tudo bem — só aparece quando o estado da
 * subscrição da plataforma justifica uma ação (princípio do brief: "invisível
 * quando pago, óbvio quando é preciso agir").
 *
 * - `trialing` a ≤3 dias do fim  → info (azul, role=status), DISPENSÁVEL (o
 *   dispensar persiste em localStorage por período de trial).
 * - `grace` (pagamento em atraso, ainda dentro do grace) → aviso âmbar
 *   (role=status), NÃO dispensável.
 * - `past_due_locked` / `canceled` (acesso limitado a leitura) → alerta vermelho
 *   (role=alert), NÃO dispensável.
 * - `none`/`active`/`incomplete`/trial longe → sem banner.
 *
 * Não aparece na própria página `/faturacao` (evita redundância) nem enquanto o
 * estado ainda está a carregar.
 */

const DAY_MS = 864e5
const TRIAL_NEAR_DAYS = 3
// Chave do dispensar (por período): guardamos o `trialEnd` dispensado; se o
// período mudar, o valor deixa de bater certo e o banner volta a aparecer.
const TRIAL_DISMISS_KEY = 'billing.banner.trialDismissedFor'

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.ceil((t - Date.now()) / DAY_MS)
}

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(TRIAL_DISMISS_KEY)
  } catch {
    return null
  }
}

type BannerTone = 'blue' | 'amber' | 'red'

const BAR: Record<BannerTone, string> = {
  blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-200',
  amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200',
  red: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300',
}
const BAR_ICON: Record<BannerTone, string> = {
  blue: 'text-blue-500',
  amber: 'text-amber-500',
  red: 'text-red-500',
}

export function BillingBanner() {
  const { data, isLoading } = useGetBillingSubscription()
  const location = useLocation()
  const [dismissedFor, setDismissedFor] = useState<string | null>(readDismissed)

  // Silencioso enquanto carrega, sem dados, ou na própria página de faturação.
  if (isLoading || !data) return null
  if (location.pathname === '/faturacao') return null

  const reason = data.reason
  let tone: BannerTone
  let role: 'status' | 'alert'
  let icon: string
  let text: string
  let dismissKey: string | null = null
  // Self-serve (T9): trial local acabado, sem cartão associado — link extra
  // "fala connosco" para o chat de suporte, além do "Ver faturação" habitual.
  let extraLink: { to: string; label: string } | null = null

  if (reason === 'trialing') {
    const days = daysUntil(data.trialEnd)
    if (days == null || days > TRIAL_NEAR_DAYS) return null // trial ainda longe
    const key = data.trialEnd ?? 'trial'
    if (dismissedFor === key) return null // já dispensado este período
    tone = 'blue'
    role = 'status'
    icon = 'clock'
    text = `O teu período de teste termina a ${fmtLongDate(data.trialEnd)}.`
    dismissKey = key
  } else if (reason === 'grace') {
    tone = 'amber'
    role = 'status'
    icon = 'alertTriangle'
    text = `Pagamento em atraso — regulariza até ${fmtLongDate(data.graceEndsAt)}.`
  } else if (reason === 'past_due_locked' || reason === 'canceled') {
    tone = 'red'
    role = 'alert'
    icon = 'lock'
    text = 'Acesso limitado a leitura — regulariza o pagamento.'
  } else if (reason === 'trial_expired') {
    tone = 'red'
    role = 'alert'
    icon = 'ban'
    text = 'O teu período experimental terminou — fala connosco.'
    extraLink = { to: '/mensagens', label: 'Falar com o suporte' }
  } else {
    return null // none / active / incomplete → sem banner
  }

  const dismiss = () => {
    if (!dismissKey) return
    try {
      window.localStorage.setItem(TRIAL_DISMISS_KEY, dismissKey)
    } catch {
      /* ignore storage errors */
    }
    setDismissedFor(dismissKey)
  }

  return (
    <div
      role={role}
      className={`shrink-0 border-b px-4 sm:px-6 py-2.5 flex items-center gap-3 text-sm ${BAR[tone]}`}
    >
      <Icon name={icon} className={`w-[18px] h-[18px] shrink-0 ${BAR_ICON[tone]}`} />
      <p className="flex-1 min-w-0 font-medium">{text}</p>
      {extraLink && (
        <Link
          to={extraLink.to}
          className="shrink-0 font-semibold underline underline-offset-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-current/40 hover:opacity-80"
        >
          {extraLink.label}
        </Link>
      )}
      <Link
        to="/faturacao"
        className="shrink-0 font-semibold underline underline-offset-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-current/40 hover:opacity-80"
      >
        Ver faturação
      </Link>
      {dismissKey && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar aviso"
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
