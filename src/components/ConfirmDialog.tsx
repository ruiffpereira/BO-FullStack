import { ReactNode, useId } from 'react'
import { Modal, Button } from '../ui/ui.jsx'
import { Icon } from '../ui/icons.jsx'
import { GuardButton } from './GuardButton'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: ReactNode
  confirmLabel?: string
  pendingLabel?: string
  isPending?: boolean
  /** `primary` = confirmação não destrutiva (ex.: «Enviar agora»). */
  variant?: 'danger' | 'warning' | 'primary'
  cancelLabel?: string
  /** Folha(s) da árvore que mandam na escrita (ver `GuardButton`); omitida = a da rota actual. */
  leaf?: string | readonly string[]
  /** `false` = confirmar NÃO é uma escrita de gestão (ex.: revogar o acesso do suporte, que a API deixa fazer a um tenant read-only): botão sem write-guard. */
  guard?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Eliminar',
  pendingLabel = 'A eliminar…',
  isPending = false,
  variant = 'danger',
  cancelLabel = 'Cancelar',
  leaf,
  guard = true,
}: ConfirmDialogProps) {
  const titleId = useId()
  const tone = {
    danger: { icon: 'trash', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
    warning: { icon: 'alertTriangle', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    primary: { icon: 'check', color: 'text-zinc-700 dark:text-zinc-200', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  }[variant]
  const iconName = tone.icon
  const iconColor = tone.color
  const iconBg = tone.bg

  return (
    <Modal
      open={open}
      onClose={() => !isPending && onClose()}
      width="max-w-sm"
      labelledBy={titleId}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          {/* EQ-03: confirmar é uma ESCRITA — a membro só-ver (ou billing read-only) fica desactivado. */}
          {guard ? (
            <GuardButton variant={variant} leaf={leaf} onClick={onConfirm} disabled={isPending} isLoading={isPending}>
              {isPending ? pendingLabel : confirmLabel}
            </GuardButton>
          ) : (
            <Button variant={variant} onClick={onConfirm} disabled={isPending} isLoading={isPending}>
              {isPending ? pendingLabel : confirmLabel}
            </Button>
          )}
        </>
      }
    >
      <div className="flex gap-4">
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon name={iconName} className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <p id={titleId} className="font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">{title}</p>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{description}</div>
        </div>
      </div>
    </Modal>
  )
}
