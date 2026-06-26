import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Badge, PageHeader, EmptyState, SectionTitle, BADGE_TONES } from '../ui/ui.jsx'
import { useDashboard, type DashboardPeriod } from '../hooks/useDashboard'
import { DEFAULT_CATEGORY_COLOR } from '../utils/expenseCategories'
import { DateRangePicker, type DateRange } from '../components/DateRangePicker'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

const fmtEur = (n: number) =>
  '€' + (n || 0).toLocaleString('pt-PT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })

// Um único conjunto de períodos (janelas progressivas, sem duplicar
// "calendário" vs "rolling") + "Personalizado" via DateRangePicker.
const PRESETS: { key: DashboardPeriod; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: '12m', label: '12 meses' },
]

function Kpi({ label, value, icon, tone, delta, deltaGood = 'up', sub, loading }: {
  label: string; value: string; icon: string; tone: keyof typeof BADGE_TONES
  delta?: number | null; deltaGood?: 'up' | 'down'; sub?: string; loading?: boolean
}) {
  const positive = delta !== undefined && delta !== null && delta !== 0
  const isGood = positive && ((delta! > 0 && deltaGood === 'up') || (delta! < 0 && deltaGood === 'down'))
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${BADGE_TONES[tone]}`}>
          <Icon name={icon} className="w-[18px] h-[18px]" />
        </div>
        {positive && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            <Icon name={delta! > 0 ? 'arrowUp' : 'arrowDown'} className="w-3 h-3" />
            {Math.abs(delta!)}%
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <p className="text-2xl font-semibold text-zinc-900 dark:text-white mt-3 tabular-nums tracking-tight">{value}</p>
      )}
      <p className="text-[13px] text-zinc-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </Card>
  )
}


export function Financeiro() {
  const { username } = useAuth()
  const [period, setPeriod] = useState<DashboardPeriod>('30d')
  const [range, setRange] = useState<DateRange | undefined>()
  const [customOpen, setCustomOpen] = useState(false)
  const customStart = range?.from ? format(range.from, 'yyyy-MM-dd') : ''
  const customEnd = range?.to ? format(range.to, 'yyyy-MM-dd') : ''
  const { data, isLoading } = useDashboard(period, customStart, customEnd)

  const sched = data?.schedule
  const ecom = data?.ecommerce
  const gym = data?.gym
  const exp = data?.expenses

  // ── KPIs agregados (inclui mensalidades do ginásio) ──────────────────────────
  const revenue = (sched?.period.revenue ?? 0) + (ecom?.period.revenue ?? 0) + (gym?.period.revenue ?? 0)
  const revenuePrev = (sched?.period.revenuePrevious ?? 0) + (ecom?.period.revenuePrevious ?? 0) + (gym?.period.revenuePrevious ?? 0)
  const revenueGrowth = revenuePrev === 0 ? null : Math.round(((revenue - revenuePrev) / revenuePrev) * 1000) / 10
  const expenses = exp?.period.total ?? 0
  const profit = revenue - expenses
  const orders = (ecom?.period.orders ?? 0) + (sched?.period.total ?? 0)
  const txCount = (ecom?.period.orders ?? 0) + (sched?.period.byStatus?.completed ?? 0)
  const avgTicket = txCount > 0 ? revenue / txCount : 0
  const newCustomers = ecom?.customers.new ?? 0

  // ── Série temporal combinada (receita / despesas / lucro) ────────────────────
  const series = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; expenses: number }>()
    const add = (date: string, rev: number, ex: number) => {
      const cur = map.get(date) ?? { date, revenue: 0, expenses: 0 }
      cur.revenue += rev
      cur.expenses += ex
      map.set(date, cur)
    }
    sched?.revenueByPeriod.forEach((p) => add(p.date, p.revenue, 0))
    ecom?.revenueByPeriod.forEach((p) => add(p.date, p.revenue, 0))
    gym?.revenueByPeriod.forEach((p) => add(p.date, p.revenue, 0))
    exp?.expensesByPeriod.forEach((p) => add(p.date, 0, p.amount))
    return [...map.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({ ...p, profit: p.revenue - p.expenses }))
  }, [sched, ecom, gym, exp])

  const maxBar = Math.max(1, ...series.map((p) => Math.max(p.revenue, p.expenses)))

  // ── Top serviços + produtos combinados ───────────────────────────────────────
  const topItems = useMemo(() => {
    const items: { name: string; revenue: number; kind: string }[] = []
    sched?.topServices.forEach((s) => items.push({ name: s.name ?? 'Serviço', revenue: s.revenue, kind: 'Serviço' }))
    ecom?.topProducts.forEach((p) => items.push({ name: p.name ?? 'Produto', revenue: p.totalRevenue, kind: 'Produto' }))
    if (gym && gym.period.revenue > 0) items.push({ name: 'Mensalidades', revenue: gym.period.revenue, kind: 'Ginásio' })
    return items.sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [sched, ecom, gym])
  const maxItem = Math.max(1, ...topItems.map((i) => i.revenue))

  const hasAnything = sched || ecom || gym || exp

  if (!isLoading && !hasAnything) {
    return (
      <div className="space-y-6">
        <PageHeader title="Financeiro" subtitle="Receita, despesas e lucro do teu negócio." />
        <Card className="p-2">
          <EmptyState icon="euro" title="Sem dados financeiros" desc="Precisas de acesso a Agenda, Loja ou Despesas para ver métricas aqui." />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" subtitle={`Resumo do negócio${username ? `, ${username}` : ''}.`}>
        <div className="relative">
          <div className="inline-flex flex-wrap items-center rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-white dark:bg-zinc-900">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => { setPeriod(p.key); setCustomOpen(false) }}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${period === p.key ? 'bg-accent text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
              >
                {p.label}
              </button>
            ))}
            <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
            <button
              onClick={() => { setPeriod('custom'); setCustomOpen((o) => !o) }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${period === 'custom' ? 'bg-accent text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              <Icon name="calendar" className="w-3.5 h-3.5" />
              {period === 'custom' && range?.from && range?.to
                ? `${format(range.from, 'd MMM', { locale: pt })} – ${format(range.to, 'd MMM', { locale: pt })}`
                : 'Personalizado'}
            </button>
          </div>
          {customOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setCustomOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-40 shadow-lg rounded-xl">
                <DateRangePicker
                  value={range}
                  onChange={(r) => { setRange(r); setPeriod('custom'); if (r?.from && r?.to) setCustomOpen(false) }}
                />
              </div>
            </>
          )}
        </div>
      </PageHeader>

      {/* ── 6 cartões principais ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="Receita" icon="euro" tone="green" loading={isLoading} value={fmtEur(revenue)} delta={revenueGrowth} deltaGood="up" sub="vs. período anterior" />
        <Kpi label="Despesas" icon="card" tone="red" loading={isLoading} value={fmtEur(expenses)} delta={exp?.period.totalGrowth ?? null} deltaGood="down" sub="vs. período anterior" />
        <Kpi label="Lucro" icon="trend" tone={profit >= 0 ? 'blue' : 'red'} loading={isLoading} value={fmtEur(profit)} sub={revenue > 0 ? `Margem ${Math.round((profit / revenue) * 100)}%` : undefined} />
        <Kpi label="Clientes novos" icon="users" tone="violet" loading={isLoading} value={String(newCustomers)} delta={ecom?.customers.newGrowth ?? null} deltaGood="up" />
        <Kpi label="Vendas / Marcações" icon="cart" tone="amber" loading={isLoading} value={String(orders)} delta={ecom?.period.ordersGrowth ?? sched?.period.countGrowth ?? null} deltaGood="up" />
        <Kpi label="Ticket médio" icon="star" tone="blue" loading={isLoading} value={fmtEur(avgTicket)} />
      </div>

      {/* ── Receita vs Despesas ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Receita vs Despesas</SectionTitle>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Receita</span>
            <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Despesas</span>
          </div>
        </div>
        {series.length === 0 ? (
          <p className="text-sm text-zinc-400">Sem movimentos no período.</p>
        ) : (
          <div className="flex items-end gap-1.5 h-44 overflow-x-auto">
            {series.map((p) => (
              <div key={p.date} className="flex-1 min-w-[16px] flex flex-col items-center gap-1 group relative">
                <div className="w-full flex items-end justify-center gap-0.5 h-40">
                  <div className="w-1/2 rounded-t bg-emerald-500/90 transition-all" style={{ height: `${Math.max(2, (p.revenue / maxBar) * 100)}%` }} />
                  <div className="w-1/2 rounded-t bg-red-400/90 transition-all" style={{ height: `${Math.max(2, (p.expenses / maxBar) * 100)}%` }} />
                </div>
                <span className="text-[9px] text-zinc-400 truncate w-full text-center">{p.date.slice(5)}</span>
                <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded-md bg-zinc-900 text-white text-[11px] px-2 py-1 shadow-lg">
                  <div>{p.date}</div>
                  <div className="text-emerald-300">Receita {fmtEur(p.revenue)}</div>
                  <div className="text-red-300">Despesa {fmtEur(p.expenses)}</div>
                  <div className="text-zinc-200">Lucro {fmtEur(p.profit)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Lucro por período ── */}
        <Card className="p-5">
          <SectionTitle>Lucro por período</SectionTitle>
          {series.length === 0 ? (
            <p className="text-sm text-zinc-400">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {series.slice(-8).map((p) => {
                const maxProfit = Math.max(1, ...series.map((s) => Math.abs(s.profit)))
                const pct = Math.round((Math.abs(p.profit) / maxProfit) * 100)
                return (
                  <div key={p.date} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 w-16 shrink-0">{p.date.slice(5)}</span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className={`h-full rounded-full ${p.profit >= 0 ? 'bg-blue-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs font-semibold tabular-nums w-20 text-right ${p.profit >= 0 ? 'text-zinc-700 dark:text-zinc-200' : 'text-red-500'}`}>{fmtEur(p.profit)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* ── Despesas por categoria ── */}
        <Card className="p-5">
          <SectionTitle>Despesas por categoria</SectionTitle>
          {!exp || exp.byCategory.length === 0 ? (
            <p className="text-sm text-zinc-400">Sem despesas no período.</p>
          ) : (
            <div className="space-y-3">
              {exp.byCategory.map((c) => {
                const maxCat = Math.max(1, ...exp.byCategory.map((x) => x.total))
                const color = c.color ?? DEFAULT_CATEGORY_COLOR
                return (
                  <div key={c.categoryId ?? 'none'}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                        {c.name ?? 'Sem categoria'}
                      </span>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white tabular-nums">{fmtEur(c.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.round((c.total / maxCat) * 100)}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Top serviços / produtos ── */}
      <Card className="p-5">
        <SectionTitle>Top serviços e produtos</SectionTitle>
        {topItems.length === 0 ? (
          <p className="text-sm text-zinc-400">Sem vendas no período.</p>
        ) : (
          <div className="space-y-3">
            {topItems.map((it, i) => (
              <div key={`${it.kind}-${it.name}-${i}`} className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400 w-5 shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-700 dark:text-zinc-200 truncate flex items-center gap-2">
                      {it.name}
                      <Badge tone={it.kind === 'Serviço' ? 'blue' : 'green'}>{it.kind}</Badge>
                    </span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white tabular-nums ml-2">{fmtEur(it.revenue)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((it.revenue / maxItem) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
