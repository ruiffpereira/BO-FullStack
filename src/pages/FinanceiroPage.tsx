import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Tabs, PageHeader } from '../ui/ui.jsx'
import { DateRangePicker, type DateRange } from '../components/DateRangePicker'
import { VatToggle } from '../components/financeiro/kit'
import type { DashboardPeriod } from '../hooks/useDashboard'
import type { VatMode } from '../hooks/useFinanceiro'
import { ONegocio } from './financeiro/ONegocio'
import { FinanceiroAgenda } from './financeiro/FinanceiroAgenda'
import { FinanceiroLoja } from './financeiro/FinanceiroLoja'
import { Despesas } from './Despesas'
import { MensalidadesTab } from './GymMensalidade'

type Tab = 'negocio' | 'agenda' | 'loja' | 'ginasio' | 'despesas'
const VERTICALS: Tab[] = ['negocio', 'agenda', 'loja']

const PRESETS: { key: DashboardPeriod; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mês' },
  { key: 'lastMonth', label: 'Último mês' },
  { key: 'year', label: 'Ano' },
]

/**
 * Página "Financeiro" (core). Tabs por vertical, cada uma só visível com a
 * permissão respetiva; "O Negócio" (consolidado) e "Despesas" sempre presentes.
 * Período + IVA são partilhados pelos verticais (O Negócio/Agenda/Loja); Despesas
 * e Ginásio mantêm os seus próprios controlos. Estado da tab vai à URL (?vista=).
 */
export function FinanceiroPage({ initialTab }: { initialTab?: Tab }) {
  const { hasPermission, username } = useAuth()
  const canSchedule = hasPermission('VIEW_SCHEDULE')
  const canProducts = hasPermission('VIEW_PRODUCTS')
  const canGym = hasPermission('VIEW_GYM')

  const [params, setParams] = useSearchParams()
  const urlTab = (params.get('vista') as Tab) || initialTab || 'negocio'

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'negocio', label: 'O Negócio', icon: 'euro' },
    ...(canSchedule ? [{ id: 'agenda' as Tab, label: 'Agenda', icon: 'calendar' }] : []),
    ...(canProducts ? [{ id: 'loja' as Tab, label: 'Loja', icon: 'cart' }] : []),
    ...(canGym ? [{ id: 'ginasio' as Tab, label: 'Ginásio', icon: 'trend' }] : []),
    { id: 'despesas', label: 'Despesas', icon: 'card' },
  ]
  // Tab pedida sem permissão → cai em "O Negócio".
  const allowed = new Set(tabs.map((t) => t.id))
  const tab: Tab = allowed.has(urlTab) ? urlTab : 'negocio'
  const setTab = (t: Tab) => { const p = new URLSearchParams(params); p.set('vista', t); setParams(p, { replace: true }) }

  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [iva, setIva] = useState<VatMode>('com')
  const [range, setRange] = useState<DateRange | undefined>()
  const [customOpen, setCustomOpen] = useState(false)
  const customStart = range?.from ? format(range.from, 'yyyy-MM-dd') : ''
  const customEnd = range?.to ? format(range.to, 'yyyy-MM-dd') : ''

  const isVertical = VERTICALS.includes(tab)

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {isVertical && (
        <PageHeader title="Financeiro" subtitle={`Resumo do negócio${username ? `, ${username}` : ''}.`}>
          <div className="flex flex-wrap items-center gap-2">
            {/* IVA só afeta Agenda/Loja (decompõem por item); O Negócio agrega recebido. */}
            {(tab === 'agenda' || tab === 'loja') && <VatToggle value={iva} onChange={setIva} />}
            <div className="relative">
              <div className="inline-flex flex-wrap items-center rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-white dark:bg-zinc-900">
                {PRESETS.map((p) => (
                  <button key={p.key} onClick={() => { setPeriod(p.key); setCustomOpen(false) }}
                    className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${period === p.key ? 'bg-accent text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
                    {p.label}
                  </button>
                ))}
                <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
                <button onClick={() => { setPeriod('custom'); setCustomOpen((o) => !o) }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${period === 'custom' ? 'bg-accent text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
                  <Icon name="calendar" className="w-3.5 h-3.5" />
                  {period === 'custom' && range?.from && range?.to ? `${format(range.from, 'd MMM', { locale: pt })} – ${format(range.to, 'd MMM', { locale: pt })}` : 'Personalizado'}
                </button>
              </div>
              {customOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setCustomOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 shadow-lg rounded-xl">
                    <DateRangePicker value={range} onChange={(r) => { setRange(r); setPeriod('custom'); if (r?.from && r?.to) setCustomOpen(false) }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </PageHeader>
      )}

      {tab === 'negocio' && <ONegocio period={period} iva={iva} customStart={customStart} customEnd={customEnd} />}
      {tab === 'agenda' && <FinanceiroAgenda period={period} iva={iva} customStart={customStart} customEnd={customEnd} />}
      {tab === 'loja' && <FinanceiroLoja period={period} iva={iva} customStart={customStart} customEnd={customEnd} />}
      {tab === 'ginasio' && <MensalidadesTab />}
      {tab === 'despesas' && <Despesas />}
    </div>
  )
}
