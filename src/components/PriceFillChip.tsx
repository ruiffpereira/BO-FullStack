import { Icon } from '../ui/icons.jsx'
import { fmtEur } from '../lib/money'

/**
 * Pílula para preencher um campo de valor com um preço de referência (preço do
 * serviço na Agenda / da subscrição no ginásio) num clique — evita digitar à mão.
 * Partilhada pelo pagamento da Agenda (ApptModal) e pelo PagamentoModal do gym.
 */
export function PriceFillChip({
  amount,
  label,
  onClick,
  active = false,
  className = '',
}: {
  amount: number
  label: string
  onClick: () => void
  active?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Preencher com ${fmtEur(amount)}`}
      aria-pressed={active}
      className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition active:scale-[.97] ${
        active
          ? 'border-accent/40 bg-accent/15 text-accent'
          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-accent/40 hover:bg-accent/10 hover:text-accent dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300'
      } ${className}`}
    >
      <Icon name="euro" className="h-3 w-3 opacity-70 group-hover:opacity-100" />
      <span>{label}</span>
      <span className="tabular-nums font-semibold">{fmtEur(amount)}</span>
    </button>
  )
}
