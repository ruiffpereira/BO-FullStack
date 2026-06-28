import { useState, useMemo, useEffect } from 'react'
import { Icon } from '../ui/icons.jsx'

/** Tamanho de página por omissão — consistente em toda a app. */
export const PAGE_SIZE = 10

export interface PaginationState<T> {
  page: number
  setPage: (p: number) => void
  pageCount: number
  total: number
  start: number
  end: number
  pageItems: T[]
}

/**
 * Paginação client-side de um array já em memória. Consistente em todas as tabelas.
 * `resetKey` → quando muda (ex.: pesquisa/filtro/mês), volta à página 1.
 */
export function usePagination<T>(
  items: T[],
  opts?: { pageSize?: number; resetKey?: unknown },
): PaginationState<T> {
  const pageSize = opts?.pageSize ?? PAGE_SIZE
  const [page, setPage] = useState(1)

  // Filtro/pesquisa/mês mudou → volta ao início.
  useEffect(() => { setPage(1) }, [opts?.resetKey])

  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  // Se a lista encolheu para baixo da página atual, recua para a última válida.
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * pageSize
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize])

  return { page: safePage, setPage, pageCount, total, start, end: Math.min(start + pageSize, total), pageItems }
}

const btn =
  'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 ' +
  'hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600 transition ' +
  'disabled:opacity-40 disabled:hover:text-zinc-500 disabled:hover:border-zinc-200 dark:disabled:hover:border-zinc-700'

/**
 * Controlo de paginação — "X–Y de Z" + ‹ página / total ›. Esconde-se com 1 página.
 * Serve tanto a `usePagination` (client-side) como paginação server-side (passa os
 * 6 campos à mão; `pageItems` extra de um spread é ignorado).
 */
export function Pagination({ page, setPage, pageCount, total, start, end }: {
  page: number
  setPage: (p: number) => void
  pageCount: number
  total: number
  start: number
  end: number
}) {
  if (total === 0 || pageCount <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 pt-3 mt-1 text-sm">
      <p className="text-zinc-400 tabular-nums">{start + 1}–{end} <span className="text-zinc-300 dark:text-zinc-600">de</span> {total}</p>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Página anterior" className={btn}>
          <Icon name="chevronLeft" className="w-4 h-4" />
        </button>
        <span className="px-1.5 text-zinc-500 tabular-nums min-w-[3.5rem] text-center">{page} / {pageCount}</span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pageCount} aria-label="Página seguinte" className={btn}>
          <Icon name="chevronRight" className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
