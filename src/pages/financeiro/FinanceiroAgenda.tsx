import { useAgendaFinance, type VatMode } from '../../hooks/useFinanceiro'
import type { DashboardPeriod } from '../../hooks/useDashboard'
import { Card, Badge, SectionTitle, EmptyState } from '../../ui/ui.jsx'
import { Icon } from '../../ui/icons.jsx'
import { AreaChart, DonutChart, BarChart, Heatmap } from '../../ui/charts.jsx'
import { KpiCard, MoneyTriad, fmtEur, InfoDot } from '../../components/financeiro/kit'
import { INFO } from '../../components/financeiro/info'

const STATUS_PT: Record<string, string> = { pending: 'Pendentes', confirmed: 'Confirmadas', completed: 'Concluídas', cancelled: 'Canceladas', no_show: 'Faltas' }

export function FinanceiroAgenda({ period, iva, customStart, customEnd }: {
  period: DashboardPeriod; iva: VatMode; customStart?: string; customEnd?: string
}) {
  const { data, isLoading } = useAgendaFinance(period, iva, customStart, customEnd)

  if (!isLoading && (!data || data.counts.total === 0)) {
    return <Card className="p-2"><EmptyState icon="calendar" title="Sem marcações no período" desc="Quando houver marcações concluídas, o financeiro da agenda aparece aqui." /></Card>
  }

  const pm = data?.paymentMethods
  const pmTotal = (pm?.cash ?? 0) + (pm?.mbway ?? 0) + (pm?.card ?? 0)
  const pmData = pmTotal > 0 && pm ? [
    { nome: `Numerário · ${fmtEur(pm.cash)}`, v: Math.round((pm.cash / pmTotal) * 100), cor: '#1F8A5B' },
    { nome: `MB Way · ${fmtEur(pm.mbway)}`, v: Math.round((pm.mbway / pmTotal) * 100), cor: '#2A6FDB' },
    { nome: `Cartão · ${fmtEur(pm.card)}`, v: Math.round((pm.card / pmTotal) * 100), cor: '#7C5CDB' },
  ].filter((d) => d.v > 0) : []

  const serie = (data?.revenueByPeriod ?? []).map((p) => ({ m: p.date.slice(5), v: p.faturado }))
  const funnel = data ? Object.entries(data.counts.byStatus).filter(([, v]) => v > 0).map(([k, v]) => ({ d: STATUS_PT[k] ?? k, v })) : []

  return (
    <div className="space-y-6">
      <MoneyTriad money={data?.money} loading={isLoading} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Valor médio por marcação" icon="star" tone="blue" loading={isLoading} value={fmtEur(data?.valorMedioPorMarcacao ?? 0)} info={INFO.valorMarcacao} />
        <KpiCard label="Ocupação da agenda" icon="calendar" tone="violet" loading={isLoading} value={`${data?.occupancy.occupancyPct ?? 0}%`} sub={`${data?.occupancy.bookedHours ?? 0}h de ${data?.occupancy.availableHours ?? 0}h`} info={INFO.ocupacao} />
        <KpiCard label="Receita por hora de cadeira" icon="trend" tone="green" loading={isLoading} value={fmtEur(data?.occupancy.revenuePerHour ?? 0)} info={INFO.receitaHora} />
        <KpiCard label="Taxa de retorno" icon="users" tone="amber" loading={isLoading} value={`${data?.customers.taxaRetorno ?? 0}%`} sub="clientes que voltam" info={INFO.taxaRetorno} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle right={<InfoDot title={INFO.faturacaoTempo.title} body={INFO.faturacaoTempo.body} />}>Faturação ao longo do tempo</SectionTitle>
          {serie.length > 0 ? <AreaChart data={serie} valueKey="v" labelKey="m" format={fmtEur} yAxis height={200} /> : <p className="text-sm text-zinc-400 mt-3">Sem dados no período.</p>}
        </Card>
        <Card className="p-5">
          <SectionTitle right={<InfoDot title={INFO.metodos.title} body={INFO.metodos.body} />}>Métodos de pagamento</SectionTitle>
          {pmData.length > 0 ? <div className="mt-3"><DonutChart data={pmData} /></div> : <p className="text-sm text-zinc-400 mt-3">Sem pagamentos no período.</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle right={<InfoDot title={INFO.heatmap.title} body={INFO.heatmap.body} />}>Ocupação por dia e hora</SectionTitle>
          <div className="mt-4"><Heatmap data={data?.heatmap ?? []} /></div>
        </Card>
        <Card className="p-5">
          <SectionTitle right={<InfoDot title={INFO.funil.title} body={INFO.funil.body} />}>Estados das marcações</SectionTitle>
          {funnel.length > 0 ? <BarChart data={funnel} valueKey="v" labelKey="d" height={200} /> : <p className="text-sm text-zinc-400 mt-3">Sem marcações.</p>}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-zinc-500">
            <span>Conclusão <strong className="text-emerald-600">{data?.rates.completion ?? 0}%</strong></span>
            <span>Cancelamento <strong className="text-red-500">{data?.rates.cancellation ?? 0}%</strong></span>
            <span>Faltas <strong className="text-amber-600">{data?.rates.noShow ?? 0}%</strong></span>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle right={<InfoDot title={INFO.topServicos.title} body={INFO.topServicos.body} />}>Top serviços</SectionTitle>
        {(data?.topServices ?? []).length === 0 ? <p className="text-sm text-zinc-400 mt-3">Sem serviços no período.</p> : (
          <div className="space-y-3 mt-3">
            {data!.topServices.map((s, i) => {
              const max = Math.max(1, ...data!.topServices.map((x) => x.faturado))
              return (
                <div key={s.serviceId ?? i} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-zinc-400 w-5 shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-700 dark:text-zinc-200 truncate flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color ?? '#2A6FDB' }} />
                        {s.name ?? 'Serviço'} <span className="text-zinc-400 text-xs">· {s.count}×</span>
                      </span>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white tabular-nums ml-2">{fmtEur(s.faturado)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((s.faturado / max) * 100)}%` }} /></div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Clientes: novos / recorrentes / perdidos + lista de quem está a fugir */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Clientes novos" icon="users" tone="green" loading={isLoading} value={String(data?.customers.novos ?? 0)} delta={data?.customers.novosGrowth} deltaGood="up" info={INFO.novos} />
        <KpiCard label="Recorrentes" icon="users" tone="blue" loading={isLoading} value={String(data?.customers.recorrentes ?? 0)} info={INFO.recorrentes} />
        <KpiCard label="Perdidos" icon="ban" tone="red" loading={isLoading} value={String(data?.customers.perdidos ?? 0)} sub={`sem marcar há +${data?.customers.lostAfterDays ?? 60}d`} info={INFO.perdidos} />
      </div>

      {(data?.lostCustomers ?? []).length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Clientes a fugir</h3>
            <Badge tone="amber">{data!.lostCustomers.length}</Badge>
          </div>
          <ul className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {data!.lostCustomers.slice(0, 12).map((c) => (
              <li key={c.customerId} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{c.name}</p>
                  <p className="text-xs text-zinc-400">Última visita há {c.daysSince} dias · {c.visits} visitas</p>
                </div>
                {c.contact && <a href={`tel:${c.contact}`} className="text-zinc-400 hover:text-accent" title="Ligar"><Icon name="phone" className="w-4 h-4" /></a>}
                {c.email && <a href={`mailto:${c.email}`} className="text-zinc-400 hover:text-accent" title="Email"><Icon name="mail" className="w-4 h-4" /></a>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
