import { useState, useRef, useEffect, useMemo, forwardRef, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../ui/icons.jsx'
import { useAnchoredMenu } from './useAnchoredMenu'

export interface ComboboxOption {
  value: string
  label: string
}

export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  /** Rótulo opcional acima do controlo (mesmo estilo dos Input/Select). */
  label?: string
  /** aria-label do botão, para quando não há `label` visível (ex.: dentro de uma linha de tabela). */
  ariaLabel?: string
  disabled?: boolean
}

/**
 * Dropdown custom (não nativo) com pesquisa. O menu é renderizado num portal
 * (document.body) com posição fixa, para nunca ser cortado pelo overflow de um
 * modal/contentor. `ref` aponta para o botão (permite `.focus()` externo).
 */
export const Combobox = forwardRef<HTMLButtonElement, ComboboxProps>(function Combobox(
  {
    value,
    onChange,
    options,
    placeholder = 'Seleccionar…',
    searchPlaceholder = 'Pesquisar…',
    className = '',
    label,
    ariaLabel,
    disabled = false,
  },
  ref,
) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value) ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  // Posicionamento do menu (portal + flip-up) partilhado com o CmsCombo.
  const { anchorRef, menuRef, style } = useAnchoredMenu<HTMLButtonElement>(open, [filtered.length], highlight)

  const setBtnRef = (el: HTMLButtonElement | null) => {
    anchorRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as MutableRefObject<HTMLButtonElement | null>).current = el
  }

  // Ao abrir: limpar pesquisa e focar o campo.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlight(0)
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  // Fechar ao clicar fora (botão ou menu no portal).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const o = filtered[highlight]; if (o) pick(o.value) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div className={className}>
      {label && (
        <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">{label}</span>
      )}
      <button
        ref={setBtnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-left transition hover:border-zinc-300 dark:hover:border-zinc-600 focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`flex-1 truncate ${selected ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="chevronDown" className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={style}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlight(0) }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-400">Sem resultados</li>
            ) : (
              filtered.map((o, i) => (
                <li key={o.value} role="option" aria-selected={o.value === value} data-idx={i}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(o.value)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition ${
                      i === highlight ? 'bg-accent/10 text-accent' : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.value === value && <Icon name="check" className="w-4 h-4 text-accent" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  )
})
