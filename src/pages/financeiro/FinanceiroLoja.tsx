import { Link } from 'react-router-dom'
import { useLojaFinance, type VatMode } from '../../hooks/useFinanceiro'
import type { DashboardPeriod } from '../../hooks/useDashboard'
import { Card, Badge, SectionTitle, EmptyState } from '../../ui/ui.jsx'
import { Icon } from '../../ui/icons.jsx'
import { AreaChart } from '../../ui/charts.jsx'
import { KpiCard, MoneyTriad, fmtEur, InfoDot } from '../../components/financeiro/kit'
import { INFO } from '../../components/financeiro/info'

export function FinanceiroLoja({ period, iva, customStart, customEnd }: {
  period: DashboardPeriod; iva: VatMode; customStart?: string; customEnd?: string
}) {
  const { data, isLoading } = useLojaFinance(period, iva, customStart, customEnd)

  if (!isLoading && (!data || data.counts.orders === 0)) {
    return <Card className="p-2"><EmptyState icon="cart" title="Sem vendas no período" desc="Quando houver encomendas, o financeiro da loja aparece aqui." /></Card>
  }

  const serie = (data?.revenueByPeriod ?? []).map((p) => ({ m: p.date.slice(5), v: p.faturado }))
  const maxCat = Math.max(1, ...(data?.topCategories ?? []).map((c) => c.faturado))

  return (
    <div className="space-y-6">
      <MoneyTriad money={data?.money} loading={isLoading} />

      {/* Aviso: definir custo p/ margem real */}
      {data && data.margem.coverage < 100 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <Icon name="alertTriangle" className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
            Margem disponível para <strong>{data.margem.coverage}%</strong> da receita. Define o <strong>custo</strong> dos produtos para veres a margem real.
          </p>
          <Link to="/loja" className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline shrink-0">Definir custos →</Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Margem bruta" icon="trend" tone="green" loading={isLoading} value={fmtEur(data?.margem.total ?? 0)} sub={`${data?.margem.marginPct ?? 0}% de margem`} info={INFO.margem} />
        <KpiCard label="Valor médio por compra" icon="star" tone="blue" loading={isLoading} value={fmtEur(data?.valorMedioPorCompra ?? 0)} info={INFO.valorCompra} />
        <KpiCard label="LTV do cliente" icon="users" tone="violet" loading={isLoading} value={fmtEur(data?.customers.ltv ?? 0)} sub="receita média / cliente" info={INFO.ltvLoja} />
        <KpiCard label="Taxa de recompra" icon="cart" tone="amber" loading={isLoading} value={`${data?.customers.taxaRecompra ?? 0}%`} sub="clientes com ≥2 compras" info={INFO.taxaRecompra} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle right={<InfoDot title={INFO.faturacaoTempo.title} body={INFO.faturacaoTempo.body} />}>Faturação ao longo do tempo</SectionTitle>
          {serie.length > 0 ? <AreaChart data={serie} valueKey="v" labelKey="m" format={fmtEur} yAxis height={200} /> : <p className="text-sm text-zinc-400 mt-3">Sem dados no período.</p>}
        </Card>
        <Card className="p-5">
          <SectionTitle right={<InfoDot title={INFO.topCategorias.title} body={INFO.topCategorias.body} />}>Top categorias</SectionTitle>
          {(data?.topCategories ?? []).length === 0 ? <p className="text-sm text-zinc-400 mt-3">Sem vendas.</p> : (
            <div className="space-y-3 mt-3">
              {data!.topCategories.map((c) => (
                <div key={c.categoryId ?? 'none'}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="text-zinc-600 dark:text-zinc-300 truncate">{c.name}</span>
                    <span className="font-semibold text-zinc-900 dark:text-white tabular-nums">{fmtEur(c.faturado)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((c.faturado / maxCat) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle right={<InfoDot title={INFO.topProdutos.title} body={INFO.topProdutos.body} />}>Top produtos</SectionTitle>
        {(data?.topProducts ?? []).length === 0 ? <p className="text-sm text-zinc-400 mt-3">Sem vendas no período.</p> : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="font-medium py-2 pr-3">Produto</th><th className="font-medium py-2 px-3">Qtd</th>
                <th className="font-medium py-2 px-3">Faturado</th><th className="font-medium py-2 px-3 hidden sm:table-cell">Margem</th>
                <th className="font-medium py-2 px-3 hidden md:table-cell">Stock</th>
              </tr></thead>
              <tbody>
                {data!.topProducts.map((p) => (
                  <tr key={p.productId} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-zinc-900 dark:text-white truncate max-w-[200px]">{p.name ?? '—'}</td>
                    <td className="py-2.5 px-3 text-zinc-500 tabular-nums">{p.qty}</td>
                    <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-200 tabular-nums">{fmtEur(p.faturado)}</td>
                    <td className="py-2.5 px-3 tabular-nums hidden sm:table-cell">{p.margem != null ? <span className="text-emerald-600 dark:text-emerald-400">{fmtEur(p.margem)}</span> : <span className="text-zinc-400">—</span>}</td>
                    <td className="py-2.5 px-3 hidden md:table-cell">{p.stock != null && p.stock <= 5 ? <Badge tone="red">{p.stock}</Badge> : <span className="text-zinc-400 tabular-nums">{p.stock ?? '—'}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Clientes novos" icon="users" tone="green" loading={isLoading} value={String(data?.customers.novos ?? 0)} delta={data?.customers.novosGrowth} deltaGood="up" info={INFO.novos} />
        <KpiCard label="Recorrentes" icon="users" tone="blue" loading={isLoading} value={String(data?.customers.recorrentes ?? 0)} info={INFO.recorrentes} />
        <KpiCard label="Perdidos" icon="ban" tone="red" loading={isLoading} value={String(data?.customers.perdidos ?? 0)} sub={`sem comprar há +${data?.customers.lostAfterDays ?? 90}d`} info={INFO.perdidos} />
      </div>

      {/* Inventário + carrinhos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <SectionTitle right={<InfoDot title={INFO.stockParado.title} body={INFO.stockParado.body} />}>Stock parado</SectionTitle>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white mt-2 tabular-nums">{fmtEur(data?.inventory.deadStock.value ?? 0)}</p>
          <p className="text-xs text-zinc-400">{data?.inventory.deadStock.count ?? 0} produtos sem vendas há 90 dias</p>
          <div className="mt-3 space-y-1.5">
            {(data?.inventory.deadStock.items ?? []).slice(0, 5).map((it, i) => (
              <div key={i} className="flex items-center justify-between text-xs"><span className="text-zinc-500 truncate">{it.name}</span><span className="text-zinc-400 tabular-nums">{it.stock}× · {fmtEur(it.value)}</span></div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle right={<InfoDot title={INFO.carrinhos.title} body={INFO.carrinhos.body} />}>Carrinhos abandonados</SectionTitle>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white mt-2 tabular-nums">{data?.abandonedCarts.count ?? 0}</p>
          <p className="text-xs text-zinc-400">≈ {fmtEur(data?.abandonedCarts.value ?? 0)} por converter</p>
        </Card>
        <Card className="p-5">
          <SectionTitle right={<InfoDot title={INFO.devolucoesDescontos.title} body={INFO.devolucoesDescontos.body} />}>Devoluções e descontos</SectionTitle>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between text-sm"><span className="text-zinc-500">Devoluções</span><span className="font-semibold text-red-500 tabular-nums">{fmtEur(data?.devolucoes ?? 0)}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-zinc-500">Desconto dado</span><span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{fmtEur(data?.descontoDado ?? 0)}</span></div>
          </div>
        </Card>
      </div>
    </div>
  )
}
