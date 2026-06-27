import { useMemo } from 'react'
import { useNegocioFinance, type VatMode } from '../../hooks/useFinanceiro'
import { useDashboard, type DashboardPeriod } from '../../hooks/useDashboard'
import { Card, Badge, SectionTitle, EmptyState } from '../../ui/ui.jsx'
import { DonutChart } from '../../ui/charts.jsx'
import { KpiCard, MoneyTriad, HealthScore, fmtEur } from '../../components/financeiro/kit'

const SOURCE = { agenda: { nome: 'Agenda', cor: '#2A6FDB' }, loja: { nome: 'Loja', cor: '#1F8A5B' }, gym: { nome: 'Ginásio', cor: '#7C5CDB' } }

export function ONegocio({ period, iva, customStart, customEnd }: {
  period: DashboardPeriod; iva: VatMode; customStart?: string; customEnd?: string
}) {
  const { data, isLoading } = useNegocioFinance(period, iva, customStart, customEnd)
  const { data: dash } = useDashboard(period, customStart, customEnd)

  const sched = dash?.schedule, ecom = dash?.ecommerce, gym = dash?.gym, exp = dash?.expenses

  // Série combinada receita/despesa (reaproveita o dashboard agregado).
  const series = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; expenses: number }>()
    const add = (date: string, rev: number, ex: number) => {
      const cur = map.get(date) ?? { date, revenue: 0, expenses: 0 }
      cur.revenue += rev; cur.expenses += ex; map.set(date, cur)
    }
    sched?.revenueByPeriod.forEach((p) => add(p.date, p.revenue, 0))
    ecom?.revenueByPeriod.forEach((p) => add(p.date, p.revenue, 0))
    gym?.revenueByPeriod.forEach((p) => add(p.date, p.revenue, 0))
    exp?.expensesByPeriod.forEach((p) => add(p.date, 0, p.amount))
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ ...p, profit: p.revenue - p.expenses }))
  }, [sched, ecom, gym, exp])
  const maxBar = Math.max(1, ...series.map((p) => Math.max(p.revenue, p.expenses)))

  const sourceData = useMemo(() => {
    const src = data?.revenueBySource ?? {}
    const total = Object.values(src).reduce((s, v) => s + (v ?? 0), 0)
    if (total <= 0) return []
    return (Object.keys(src) as (keyof typeof SOURCE)[]).filter((k) => (src[k] ?? 0) > 0).map((k) => ({
      nome: `${SOURCE[k].nome} · ${fmtEur(src[k] as number)}`, v: Math.round(((src[k] as number) / total) * 100), cor: SOURCE[k].cor,
    }))
  }, [data])

  if (!isLoading && !data) {
    return <Card className="p-2"><EmptyState icon="euro" title="Sem dados financeiros" desc="Precisas de acesso a Agenda, Loja ou Ginásio para ver o consolidado." /></Card>
  }

  return (
    <div className="space-y-6">
      {/* Score de saúde + tríade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data ? <HealthScore score={data.health.score} factors={data.health.factors} /> : <Card className="p-5 h-44 animate-pulse" />}
        <MoneyTriad money={data?.money} loading={isLoading} />
      </div>

      {/* Dinheiro */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Receita (recebido)" icon="euro" tone="green" loading={isLoading} value={fmtEur(data?.money.recebido ?? 0)} delta={data?.money.recebidoGrowth} deltaGood="up" />
        <KpiCard label="Despesas" icon="card" tone="red" loading={isLoading} value={fmtEur(data?.despesas ?? 0)} />
        <KpiCard label="Lucro" icon="trend" tone={(data?.lucro ?? 0) >= 0 ? 'blue' : 'red'} loading={isLoading} value={fmtEur(data?.lucro ?? 0)} sub={`Margem ${data?.margem ?? 0}%`} />
        <KpiCard label="Em dívida" icon="star" tone="amber" loading={isLoading} value={fmtEur(data?.money.emDivida ?? 0)} sub="a receber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Receita vs Despesas */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Receita vs Despesas</SectionTitle>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Receita</span>
              <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Despesas</span>
            </div>
          </div>
          {series.length === 0 ? <p className="text-sm text-zinc-400">Sem movimentos no período.</p> : (
            <div className="flex items-end gap-1.5 h-44 overflow-x-auto">
              {series.map((p) => (
                <div key={p.date} className="flex-1 min-w-[16px] flex flex-col items-center gap-1 group relative">
                  <div className="w-full flex items-end justify-center gap-0.5 h-40">
                    <div className="w-1/2 rounded-t bg-emerald-500/90" style={{ height: `${Math.max(2, (p.revenue / maxBar) * 100)}%` }} />
                    <div className="w-1/2 rounded-t bg-red-400/90" style={{ height: `${Math.max(2, (p.expenses / maxBar) * 100)}%` }} />
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
        {/* Distribuição de receita por fonte */}
        <Card className="p-5">
          <SectionTitle>Receita por fonte</SectionTitle>
          {sourceData.length > 0 ? <div className="mt-3"><DonutChart data={sourceData} /></div> : <p className="text-sm text-zinc-400 mt-3">Sem receita no período.</p>}
        </Card>
      </div>
    </div>
  )
}
