import { useState } from 'react'
import { Icon } from '../ui/icons.jsx'
import { useAuth } from '../context/AuthContext'
import { Financeiro } from './Financeiro'
import { Despesas } from './Despesas'
import { MensalidadesTab } from './GymMensalidade'

type FinanceiroTab = 'negocio' | 'despesas' | 'ginasio'

/**
 * Página "Financeiro" (core, todos os tenants). Secções:
 *  - "O Negócio" → dashboard agregado (`Financeiro.tsx`): mostra agenda/loja/ginásio
 *    conforme os módulos do tenant + despesas. Adapta-se sozinho.
 *  - "Despesas"  → registo de custos (`Despesas.tsx`).
 *  - "Ginásio"   → mensalidades + subscrições do ginásio (`MensalidadesTab`),
 *    só para tenants com `VIEW_GYM`.
 * A barra de tabs fica por cima; cada secção mantém o seu próprio cabeçalho/controlos.
 */
export function FinanceiroPage({ initialTab = 'negocio' }: { initialTab?: FinanceiroTab }) {
  const { hasPermission } = useAuth()
  const canGym = hasPermission('VIEW_GYM')
  const [tab, setTab] = useState<FinanceiroTab>(initialTab)
  const effectiveTab = tab === 'ginasio' && !canGym ? 'negocio' : tab

  const tabs: [FinanceiroTab, string, string][] = [
    ['negocio', 'O Negócio', 'euro'],
    ['despesas', 'Despesas', 'card'],
    ...(canGym ? [['ginasio', 'Ginásio', 'trend'] as [FinanceiroTab, string, string]] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 w-full sm:w-auto sm:inline-flex">
        {tabs.map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${effectiveTab === id ? 'bg-white dark:bg-zinc-900 text-accent shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
            <Icon name={icon} className="w-4 h-4" />{label}
          </button>
        ))}
      </div>
      {effectiveTab === 'negocio' && <Financeiro />}
      {effectiveTab === 'despesas' && <Despesas />}
      {effectiveTab === 'ginasio' && <MensalidadesTab />}
    </div>
  )
}
