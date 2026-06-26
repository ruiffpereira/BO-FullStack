import { useState } from 'react'
import { Icon } from '../ui/icons.jsx'
import { Financeiro } from './Financeiro'
import { Despesas } from './Despesas'

/**
 * Página "Financeiro" (core, todos os tenants). Duas secções:
 *  - "O Negócio" → dashboard agregado (`Financeiro.tsx`): mostra agenda/loja/ginásio
 *    conforme os módulos do tenant + despesas. Adapta-se sozinho.
 *  - "Despesas"  → registo de custos (`Despesas.tsx`).
 * A barra de tabs fica por cima; cada secção mantém o seu próprio cabeçalho/controlos.
 */
export function FinanceiroPage({ initialTab = 'negocio' }: { initialTab?: 'negocio' | 'despesas' }) {
  const [tab, setTab] = useState<'negocio' | 'despesas'>(initialTab)
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 w-full sm:w-auto sm:inline-flex">
        {([['negocio', 'O Negócio', 'euro'], ['despesas', 'Despesas', 'card']] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === id ? 'bg-white dark:bg-zinc-900 text-accent shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
            <Icon name={icon} className="w-4 h-4" />{label}
          </button>
        ))}
      </div>
      {tab === 'negocio' ? <Financeiro /> : <Despesas />}
    </div>
  )
}
