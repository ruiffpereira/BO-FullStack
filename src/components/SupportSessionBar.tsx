import { Icon } from '../ui/icons.jsx'
import { Button } from '../ui/ui.jsx'
import { useAuth } from '../context/AuthContext'

/** HH:mm (pt-PT) de uma data ISO; "—" se inválida. */
export function formatClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Faixa de "sessão de suporte" no topo do Shell. Só existe enquanto
 * `supportSession` está activa. É um filho normal do layout flex do Shell
 * (`shrink-0`) — nada de `position: fixed` nem alturas medidas à mão: o resto
 * do layout encolhe sozinho. Tom âmbar (tokens que existem no Tailwind), com
 * contraste próprio em claro e escuro.
 *
 * O "Sair" termina a sessão só localmente (`endImpersonation("exit")`, sem
 * rede) e tenta fechar o separador (só fecha se foi aberto por `window.open`).
 */
export function SupportSessionBar() {
  const { supportSession, endImpersonation } = useAuth()
  if (!supportSession) return null

  const exit = () => {
    endImpersonation('exit')
    try {
      window.close()
    } catch {
      // o ecrã "A sessão de suporte terminou" cobre o caso de o browser não deixar fechar
    }
  }

  return (
    <div
      role="region"
      aria-label="Sessão de suporte"
      className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-2 border-b border-amber-300 dark:border-amber-600/50 bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-100"
    >
      <Icon name="shield" className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-300" />
      <p className="min-w-0 flex-1 text-sm">
        Sessão de suporte — estás na conta de{' '}
        <strong className="font-semibold">{supportSession.tenantName}</strong>
        {' · '}termina às {formatClock(supportSession.expiresAt)}
      </p>
      <Button size="sm" variant="outline" onClick={exit}>
        Sair
      </Button>
    </div>
  )
}
