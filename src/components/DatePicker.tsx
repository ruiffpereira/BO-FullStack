import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker, type Matcher } from 'react-day-picker'
import 'react-day-picker/style.css'
import './DateRangePicker.css'
import { pt } from 'date-fns/locale'
import { format } from 'date-fns'
import { useState } from 'react'
import { useAnchoredMenu } from './useAnchoredMenu'
import { Icon } from '../ui/icons.jsx'

const toDate = (iso?: string): Date | undefined => {
  if (!iso) return undefined
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/**
 * Selector de uma única data — campo (botão) + calendário flutuante da app
 * (react-day-picker, locale PT), em vez do date picker nativo do dispositivo.
 * Valor em ISO `yyyy-MM-dd`. Mesmo posicionamento/flip-up do Combobox.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Escolher data…',
  className = '',
  clearable = false,
  yearNav = false,
}: {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  placeholder?: string
  className?: string
  clearable?: boolean
  /** Mostra dropdowns de mês/ano (útil para datas distantes, ex.: nascimento). */
  yearNav?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { anchorRef, menuRef, style } = useAnchoredMenu<HTMLButtonElement>(open, [open])
  const selected = toDate(value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const disabled: Matcher[] = []
  const minD = toDate(min)
  const maxD = toDate(max)
  if (minD) disabled.push({ before: minD })
  if (maxD) disabled.push({ after: maxD })

  const showClear = clearable && !!value
  const now = new Date()
  const startMonth = yearNav ? (minD ?? new Date(now.getFullYear() - 100, 0)) : undefined
  const endMonth = yearNav ? (maxD ?? new Date(now.getFullYear() + 5, 11)) : undefined

  return (
    <>
      <div className="relative w-full">
        <button
          type="button"
          ref={anchorRef}
          onClick={() => setOpen((o) => !o)}
          className={`w-full flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-3 py-2 ${showClear ? 'pr-9' : ''} focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition ${value ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'} ${className}`}
        >
          <Icon name="calendar" className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="flex-1 text-left">{selected ? format(selected, 'dd/MM/yyyy') : placeholder}</span>
        </button>
        {showClear && (
          <span
            role="button"
            aria-label="Limpar data"
            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <Icon name="x" className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ ...style, width: 'auto' }}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 shadow-lg"
          >
            <DayPicker
              className="app-rdp"
              mode="single"
              selected={selected}
              onSelect={(d) => { if (d) { onChange(format(d, 'yyyy-MM-dd')); setOpen(false) } }}
              locale={pt}
              weekStartsOn={1}
              defaultMonth={selected}
              disabled={disabled}
              captionLayout={yearNav ? 'dropdown' : 'label'}
              startMonth={startMonth}
              endMonth={endMonth}
            />
          </div>,
          document.body,
        )}
    </>
  )
}
