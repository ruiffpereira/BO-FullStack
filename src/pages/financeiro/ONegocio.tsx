import { useMemo, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../ui/icons.jsx'
import { useNegocioFinance, type VatMode } from '../../hooks/useFinanceiro'
import { useDashboard, type DashboardPeriod } from '../../hooks/useDashboard'
import { Card, Badge, SectionTitle, EmptyState } from '../../ui/ui.jsx'
import { DonutChart } from '../../ui/charts.jsx'
import { KpiCard, MoneyTriad, HealthScore, fmtEur, InfoDot } from '../../components/financeiro/kit'
import { INFO } from '../../components/financeiro/info'

const SOURCE = { agenda: { nome: 'Agenda', cor: '#2A6FDB' }, loja: { nome: 'Loja', cor: '#1F8A5B' }, gym: { nome: 'Ginásio', cor: '#7C5CDB' } }

export function ONegocio({ period, iva, customStart, customEnd }: {
  period: DashboardPeriod; iva: VatMode; customStart?: string; customEnd?: string
}) {
  const { isMember, can } = useAuth()
  const { data, isLoading } = useNegocioFinance(period, iva, customStart, customEnd)
  // A série diária vem do /dashboard, que um membro só pode pedir com a folha `dashboard`.
  const dashAllowed = !isMember || can('dashboard')
  const { data: dash } = useDashboard(period, customStart, customEnd, dashAllowed)

  // Blocos que entraram (B41 2c): falso = "sem acesso", nunca 0 €. Sem `included` (resposta antiga) assume-se tudo.
  const inc = data?.included
  const incAgenda = inc ? !!inc.agenda : true
  const incLoja = inc ? !!inc.loja : true
  const incGym = inc ? !!inc.gym : true
  const incDespesas = inc ? !!inc.despesas : true
  const hasRevenue = incAgenda || incLoja || incGym

  const sched = incAgenda ? dash?.schedule : undefined
  const ecom = incLoja ? dash?.ecommerce : undefined
  const gym = incGym ? dash?.gym : undefined
  const exp = incDespesas ? dash?.expenses : undefined

  // Série combinada receita/despesa (reaproveita o dashboard agregado) — só dos blocos incluídos.
  const series = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; expenses: number }>()
    const add = (date: string, rev: number, ex: number) => {
      const cur = map.get(date) ?? { date, revenue: 0, expenses: 0 }
      cur.revenue += rev; cur.expenses += ex; map.set(date, cur)
    }
    sched?.revenueByPeriod?.forEach((p) => add(p.date, p.revenue, 0))
    ecom?.revenueByPeriod?.forEach((p) => add(p.date, p.revenue, 0))
    gym?.revenueByPeriod?.forEach((p) => add(p.date, p.revenue, 0))
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
  if (data && !hasRevenue && !incDespesas) {
    return <Card className="p-2"><EmptyState icon="lock" title="Sem áreas para mostrar" desc="Ainda não tens acesso a nenhuma das áreas deste consolidado." /></Card>
  }

  // Quadro incompleto (o score de saúde só existe com todos os blocos): avisa, sem alarme.
  const partial = !!data && (data.health === null || !hasRevenue || !incDespesas)

  // KPIs de dinheiro: só os que têm base — sem despesas não há lucro/margem; sem receitas não há recebido/dívida.
  const kpis: ReactNode[] = []
  if (hasRevenue) kpis.push(<KpiCard key="rec" label="Receita (recebido)" icon="euro" tone="green" loading={isLoading} value={fmtEur(data?.money.recebido ?? 0)} delta={data?.money.recebidoGrowth} deltaGood="up" info={INFO.receita} />)
  if (incDespesas) kpis.push(<KpiCard key="desp" label="Despesas" icon="card" tone="red" loading={isLoading} value={fmtEur(data?.despesas ?? 0)} info={INFO.despesas} />)
  if (incDespesas && data?.lucro != null) kpis.push(<KpiCard key="lucro" label="Lucro" icon="trend" tone={data.lucro >= 0 ? 'blue' : 'red'} loading={isLoading} value={fmtEur(data.lucro)} sub={`Margem ${data.margem ?? 0}%`} info={INFO.lucro} />)
  if (hasRevenue) kpis.push(<KpiCard key="div" label="Em dívida" icon="star" tone="amber" loading={isLoading} value={fmtEur(data?.money.emDivida ?? 0)} sub="a receber" info={{ title: 'Em dívida', body: 'Faturado − Recebido: o que ainda falta entrar em caixa no período.' }} />)
  const KPI_COLS = ['', 'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4']

  // Gráfico de série (precisa do /dashboard) + donut por fonte: o que sobra ocupa a largura toda.
  const showSeries = dashAllowed && (hasRevenue || incDespesas)
  const showDonut = hasRevenue

  return (
    <div className="space-y-6">
      {partial && (
        <p data-testid="negocio-partial" className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Icon name="lock" className="w-3.5 h-3.5 shrink-0" /> Só vês as áreas a que tens acesso
        </p>
      )}

      {/* Score de saúde + tríade */}
      {(isLoading || data?.health || hasRevenue) && (
        <div className={`grid grid-cols-1 gap-4 ${(isLoading || data?.health) && hasRevenue ? 'lg:grid-cols-2' : ''}`}>
          {isLoading ? <Card className="p-5 h-44 animate-pulse" /> : data?.health ? <HealthScore score={data.health.score} hasData={data.health.hasData} factors={data.health.factors} /> : null}
          {hasRevenue && <MoneyTriad money={data?.money} loading={isLoading} />}
        </div>
      )}

      {/* Dinheiro */}
      {kpis.length > 0 && <div className={`grid grid-cols-2 gap-4 ${KPI_COLS[kpis.length]}`}>{kpis}</div>}

      <div className={`grid grid-cols-1 gap-4 ${showSeries && showDonut ? 'lg:grid-cols-3' : ''}`}>
        {/* Receita vs Despesas */}
        {showSeries && (
        <Card className={`p-5 ${showDonut ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{hasRevenue && incDespesas ? "Receita vs Despesas" : hasRevenue ? "Receita" : "Despesas"}</h2>
              <InfoDot title={INFO.revVsExp.title} body={INFO.revVsExp.body} />
            </div>
            <div className="flex items-center gap-4 text-xs">
              {hasRevenue && <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Receita</span>}
              {incDespesas && <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Despesas</span>}
            </div>
          </div>
          {series.length === 0 ? <p className="text-sm text-zinc-400">Sem movimentos no período.</p> : (
            <div className="flex items-end gap-1.5 h-44 overflow-x-auto">
              {series.map((p) => (
                <div key={p.date} className="flex-1 min-w-[16px] flex flex-col items-center gap-1 group relative">
                  <div className="w-full flex items-end justify-center gap-0.5 h-40">
                    {hasRevenue && <div className={`${incDespesas ? 'w-1/2' : 'w-full'} rounded-t bg-emerald-500/90`} style={{ height: `${Math.max(2, (p.revenue / maxBar) * 100)}%` }} />}
                    {incDespesas && <div className={`${hasRevenue ? 'w-1/2' : 'w-full'} rounded-t bg-red-400/90`} style={{ height: `${Math.max(2, (p.expenses / maxBar) * 100)}%` }} />}
                  </div>
                  <span className="text-[9px] text-zinc-400 truncate w-full text-center">{p.date.slice(5)}</span>
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded-md bg-zinc-900 text-white text-[11px] px-2 py-1 shadow-lg">
                    <div>{p.date}</div>
                    {hasRevenue && <div className="text-emerald-300">Receita {fmtEur(p.revenue)}</div>}
                    {incDespesas && <div className="text-red-300">Despesa {fmtEur(p.expenses)}</div>}
                    {hasRevenue && incDespesas && <div className="text-zinc-200">Lucro {fmtEur(p.profit)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        )}
        {/* Distribuição de receita por fonte */}
        {showDonut && (
        <Card className="p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Receita por fonte</h2>
            <InfoDot title={INFO.revSource.title} body={INFO.revSource.body} />
          </div>
          {sourceData.length > 0 ? <div className="mt-3"><DonutChart data={sourceData} /></div> : <p className="text-sm text-zinc-400 mt-3">Sem receita no período.</p>}
        </Card>
        )}
      </div>
    </div>
  )
}
