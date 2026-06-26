import { useState } from 'react'
import { Tabs } from '../ui/ui.jsx'
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

  const tabs: { id: FinanceiroTab; label: string; icon: string }[] = [
    { id: 'negocio', label: 'O Negócio', icon: 'euro' },
    { id: 'despesas', label: 'Despesas', icon: 'card' },
    ...(canGym ? [{ id: 'ginasio' as FinanceiroTab, label: 'Ginásio', icon: 'trend' }] : []),
  ]

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} value={effectiveTab} onChange={setTab} />
      {effectiveTab === 'negocio' && <Financeiro />}
      {effectiveTab === 'despesas' && <Despesas />}
      {effectiveTab === 'ginasio' && <MensalidadesTab />}
    </div>
  )
}
