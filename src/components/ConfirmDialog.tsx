import { ReactNode } from 'react'
import { Modal, Button } from '../ui/ui.jsx'
import { Icon } from '../ui/icons.jsx'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: ReactNode
  confirmLabel?: string
  pendingLabel?: string
  isPending?: boolean
  variant?: 'danger' | 'warning'
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
}: ConfirmDialogProps) {
  const iconName = variant === 'danger' ? 'trash' : 'alertTriangle'
  const iconColor = variant === 'danger'
    ? 'text-red-600 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400'
  const iconBg = variant === 'danger'
    ? 'bg-red-50 dark:bg-red-500/10'
    : 'bg-amber-50 dark:bg-amber-500/10'
  const confirmCls = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700'
    : 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 hover:border-amber-700'

  return (
    <Modal
      open={open}
      onClose={() => !isPending && onClose()}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition disabled:opacity-60 ${confirmCls}`}
          >
            {isPending ? (
              <>
                <Icon name="loader" className="w-4 h-4 animate-spin" />
                {pendingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon name={iconName} className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">{title}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
    </Modal>
  )
}
