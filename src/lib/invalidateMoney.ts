import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

/**
 * FI-05 — invalida TUDO o que mostra dinheiro. Chamar em toda a mutation que mexe em dinheiro (pagamento de marcação,
 * encomenda, despesa, mensalidade): o Dashboard, o Financeiro, a Loja, a ficha do cliente (dívida) e as listas de
 * marcações recalculam-se a partir da API. Os hooks do Kubb têm chaves `[{ url }]`; os dois hooks à mão
 * (`useDashboard`, `useFinanceiro`) têm chaves de texto — o predicado cobre os dois.
 */
const TEXT_ROOTS = new Set<unknown>([queryKeys.dashboard.root[0], queryKeys.financeiro.root[0]])
const URL_ROOTS = [
  '/dashboard', '/financeiro', '/orders', '/products', '/schedule/appointments', '/customers',
  '/expenses', '/gym', '/gym/mensalidade',
]

export function isMoneyKey(key: QueryKey): boolean {
  const head = key[0]
  if (typeof head === 'string') return TEXT_ROOTS.has(head) || URL_ROOTS.some((u) => head.startsWith(u))
  if (head && typeof head === 'object' && 'url' in head) {
    const url = String((head as { url: unknown }).url)
    return URL_ROOTS.some((u) => url.startsWith(u))
  }
  return false
}

export function invalidateMoney(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({ predicate: (q) => isMoneyKey(q.queryKey) })
}
