import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Financeiro } from './Financeiro'
import { GymFinanceiro } from './GymFinanceiro'

/**
 * Rota `/financeiro`. O menu lateral "Financeiro" aparece com `VIEW_STATS` **ou**
 * `VIEW_GYM`. O conteúdo adapta-se à permissão:
 *  - só ginásio → financeiro do ginásio (mensalidades);
 *  - só geral   → financeiro geral (receita/despesas/lucro);
 *  - ambos      → toggle Geral · Ginásio.
 */
export function FinanceiroRoute() {
  const { hasPermission } = useAuth()
  const gym = hasPermission('VIEW_GYM')
  const stats = hasPermission('VIEW_STATS')
  const [tab, setTab] = useState<'geral' | 'ginasio'>('geral')

  if (gym && !stats) return <GymFinanceiro />
  if (!gym) return <Financeiro />

  // Tem as duas permissões → toggle entre o financeiro geral e o do ginásio.
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 w-full sm:w-auto sm:inline-flex">
        {([['geral', 'Geral', 'euro'], ['ginasio', 'Ginásio', 'trend']] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === id ? 'bg-white dark:bg-zinc-900 text-accent shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
            <Icon name={icon} className="w-4 h-4" />{label}
          </button>
        ))}
      </div>
      {tab === 'geral' ? <Financeiro /> : <GymFinanceiro />}
    </div>
  )
}
