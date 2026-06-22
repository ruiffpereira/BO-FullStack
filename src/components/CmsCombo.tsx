import { useState, useEffect, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { Icon } from '../ui/icons.jsx'
import { useGetCmsSearch } from '../hooks/useCmsSearch'
import { useGetSettingsLanguages } from '../hooks/useSettingsLanguages'
import { CmsTranslationsModal } from './CmsTranslationsModal'
import { ensureCmsName } from '../lib/gymCms'

/**
 * Selector de entrada CMS (nome traduzível). Comportamento:
 * - Com entrada selecionada (`value`): caixa com o nome + **×** para limpar;
 *   clicar na caixa abre o editor de traduções.
 * - Sem seleção: campo de pesquisa que lista **entradas existentes** do contexto
 *   (navegáveis com ↑/↓ e Enter) para **reutilizar**.
 * - **Não cria entradas aqui** (sem botão "criar puro"): se escreveres um nome
 *   novo, é criado **ao Guardar** o formulário. Há uma opção para **criar já e
 *   adicionar traduções** (cria a entrada agora e abre o editor de línguas).
 *
 * Controlado por `value` (contentKey) + `name` (texto). `onChange(key, name)`.
 */
export function CmsCombo({
  value,
  name,
  onChange,
  context,
  label,
  placeholder = 'Pesquisar ou escrever um nome…',
}: {
  value: string | null
  name: string
  onChange: (key: string | null, name: string) => void
  context: string
  label?: string
  placeholder?: string
}) {
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'
  const [open, setOpen] = useState(false)
  const [translating, setTranslating] = useState<string | null>(null)
  const [highlighted, setHighlighted] = useState(0)
  const [debouncedQ, setDebouncedQ] = useState(name)

  // Debounce do termo de pesquisa (evita refetch a cada tecla).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(name), 200)
    return () => clearTimeout(t)
  }, [name])

  const { data: results = [] } = useGetCmsSearch(
    { q: debouncedQ || undefined, context, lang: defaultLang },
    { query: { enabled: open && !value } },
  )
  const suggestions = results.filter((r) => r.key !== value)
  const exactMatch = results.some((r) => (r.label ?? '').trim().toLowerCase() === name.trim().toLowerCase())
  const showCreate = !!name.trim() && !exactMatch
  const optionCount = suggestions.length + (showCreate ? 1 : 0)

  useEffect(() => { setHighlighted(0) }, [debouncedQ, open])

  // Cria já a entrada CMS (nome na língua padrão) e abre as traduções.
  const createAndTranslate = async () => {
    if (!name.trim()) return
    try {
      const key = await ensureCmsName(value, context, name, defaultLang)
      onChange(key, name)
      setOpen(false)
      setTranslating(key)
    } catch {
      toast.error('Erro ao criar a entrada CMS')
    }
  }

  const activate = (idx: number) => {
    if (idx < suggestions.length) {
      const r = suggestions[idx]
      onChange(r.key, r.label ?? '')
      setOpen(false)
    } else if (showCreate) {
      createAndTranslate()
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setHighlighted((i) => Math.min(i + 1, Math.max(optionCount - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && optionCount > 0) { e.preventDefault(); activate(highlighted) }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div>
      {label && <span className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</span>}

      {value ? (
        // ── Caixa da entrada selecionada (clicar = traduções; × = limpar) ──
        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setTranslating(value)}
            className="flex-1 flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors min-w-0"
            title="Editar traduções"
          >
            <Icon name="layers" className="w-4 h-4 text-accent shrink-0" />
            <span className="font-medium text-zinc-800 dark:text-zinc-100 truncate">{name || value}</span>
          </button>
          <button
            type="button"
            onClick={() => onChange(null, '')}
            className="px-3 py-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg leading-none border-l border-zinc-200 dark:border-zinc-700"
            title="Limpar"
          >
            ×
          </button>
        </div>
      ) : (
        // ── Pesquisa / escrever nome novo ──
        <div className="relative">
          <input
            type="text"
            value={name}
            onChange={(e) => onChange(null, e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400"
          />
          {open && (suggestions.length > 0 || showCreate) && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden">
              {suggestions.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-400">Entradas existentes (reutilizar)</p>
                  <div className="max-h-56 overflow-y-auto">
                    {suggestions.map((r, idx) => (
                      <button
                        key={r.key}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); activate(idx) }}
                        onMouseEnter={() => setHighlighted(idx)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${highlighted === idx ? 'bg-accent/[0.10] dark:bg-accent/[0.16]' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                      >
                        <Icon name="layers" className="w-3.5 h-3.5 text-accent/70 shrink-0" />
                        <span className="font-medium text-zinc-800 dark:text-zinc-100 truncate">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {showCreate && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); activate(suggestions.length) }}
                  onMouseEnter={() => setHighlighted(suggestions.length)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-accent border-t border-zinc-100 dark:border-zinc-800 transition-colors ${highlighted === suggestions.length ? 'bg-accent/[0.10]' : 'hover:bg-accent/[0.08]'}`}
                >
                  <Icon name="plus" className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Criar “{name.trim()}” e adicionar traduções</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {translating && (
        <CmsTranslationsModal cmsKey={translating} defaultLang={defaultLang} defaultValue={name} onClose={() => setTranslating(null)} />
      )}
    </div>
  )
}
