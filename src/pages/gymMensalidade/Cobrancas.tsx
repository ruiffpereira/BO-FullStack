import { useState, useEffect } from "react";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { fmtEur } from "../../lib/money";
import { colorFromName } from "../../lib/avatarColor";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, IconButton, Badge, Tabs, EmptyState, Avatar } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { LineChart, Waterfall } from "../../ui/charts.jsx";
import { useGymAnalytics } from "../../hooks/useGymAnalytics";
import { gymBulkMarkPaid, gymRemind } from "../../hooks/useFinanceiro";
import { InfoDot } from "../../components/financeiro/kit";
import { INFO } from "../../components/financeiro/info";
import { usePagination, Pagination } from "../../components/Pagination";
import { payMethodLabel } from "../../lib/gymPayMethod";
import { useGetGymMensalidadeFinance } from "../../gen/backoffice/hooks/useGetGymMensalidadeFinance.js";
import { Finance, FinanceRow, Status, currentPeriod, daysUntil, dueForPeriod, fmtPeriodo, fmtPeriodoLong, invalidateMens, shiftPeriod } from "./format";
import { PagamentoModal } from "./Modals";

// ── Cockpit de Cobranças: "quem falta cobrar este mês", cobra num clique ──────
export function CobrancasView({ period, filter, q, onPeriodChange, onFilterChange, onQChange, onOpen, onOpenConfirmBulk }: { period: string; filter: 'cobrar' | 'pago' | 'todos'; q: string; onPeriodChange: (p: string) => void; onFilterChange: (f: 'cobrar' | 'pago' | 'todos') => void; onQChange: (q: string) => void; onOpen: (c: { id: string; name: string }) => void; onOpenConfirmBulk?: () => void }) {
  const qc = useQueryClient()
  const [pag, setPag] = useState<{ customerId: string; period: string; amount: number; status?: Status; paidAmount?: number } | null>(null)
  const { data, isLoading, isError, refetch } = useGetGymMensalidadeFinance({ period }, { query: { placeholderData: keepPreviousData } })
  const fin: Finance | undefined = data
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)

  // Limpar seleção quando period/filter/q mudam
  useEffect(() => { setSel(new Set()) }, [period, filter, q])

  const toggleSel = (id: string) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); setSel(n) }

  const onLembrar = async (ids?: string[]) => {
    try { const r = await gymRemind(ids?.length ? { customerIds: ids, period } : { period }); toast.success(`${r.sent} lembrete${r.sent === 1 ? '' : 's'} enviado${r.sent === 1 ? '' : 's'}`) }
    catch (e) { toast.error(getApiError(e)) }
  }

  const onBulkPay = async () => {
    try {
      const r = await gymBulkMarkPaid({ customerIds: [...sel], period })
      toast.success(`${r.paid} marcado${r.paid === 1 ? '' : 's'} pago${r.paid === 1 ? '' : 's'}`)
      setSel(new Set())
      setConfirmBulk(false)
      invalidateMens(qc)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  // Lista filtrada/ordenada (null-safe) + paginação
  const isPaid = (r: FinanceRow) => r.status === 'paid'
  const billable = (fin?.rows ?? []).filter((r) => r.subscription || r.payment)  // Incluir órfãos
  const base = filter === 'cobrar' ? billable.filter((r) => !isPaid(r)) : filter === 'pago' ? billable.filter(isPaid) : billable
  const list = base
    .filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (Number(b.overdue) - Number(a.overdue)) || a.name.localeCompare(b.name))
  const pg = usePagination(list, { resetKey: `${filter}|${q}|${period}` })

  if (isError) return (
    <Card className="p-8 text-center space-y-3">
      <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar cobranças</p>
      <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar de novo</Button>
    </Card>
  )
  if (isLoading || !fin) return <Card className="p-8 text-center text-sm text-zinc-400">A carregar…</Card>

  const counts = { cobrar: billable.filter((r) => !isPaid(r)).length, pago: billable.filter(isPaid).length, todos: billable.length }
  const recebido = fin.kpis.recebido
  const mrr = fin.kpis.mrr
  // Previsto (recebido + por cobrar do mês) é a régua certa da barra de
  // cobrança — o MRR diverge com parciais, overrides e subscrições alteradas.
  const previsto = fin.kpis.previsto
  const pct = previsto > 0 ? Math.min(100, Math.round((recebido / previsto) * 100)) : 100

  const dueInfo = (r: FinanceRow): { text: string; fg: string } => {
    if (r.status === 'paid') return { text: r.payment?.method ? `Pago · ${payMethodLabel(r.payment.method)}` : 'Pago', fg: 'text-emerald-600 dark:text-emerald-400' }
    if (r.status === 'debt') return { text: `Falta ${fmtEur(Math.max(0, (r.payment?.amount ?? 0) - (r.payment?.paidAmount ?? 0)))}`, fg: 'text-amber-600 dark:text-amber-400' }
    const dd = r.payment?.dueDate ?? dueForPeriod(period, r.subscription?.dueDay ?? 8)
    const d = daysUntil(dd, fin.today)
    if (d < 0) return { text: `Venceu há ${-d} dia${-d !== 1 ? 's' : ''}`, fg: 'text-red-600 dark:text-red-400' }
    if (d === 0) return { text: 'Vence hoje', fg: 'text-amber-600 dark:text-amber-400' }
    return { text: `Vence em ${d} dia${d !== 1 ? 's' : ''}`, fg: 'text-zinc-400' }
  }

  return (
    <div className="space-y-5">
      {/* Mês + resumo de cobrança */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="inline-flex items-center gap-1">
            <IconButton icon="chevronLeft" label="Mês anterior" onClick={() => onPeriodChange(shiftPeriod(period, -1))} />
            <span className="text-sm font-semibold text-zinc-900 dark:text-white capitalize min-w-[130px] text-center">{fmtPeriodoLong(period)}</span>
            <IconButton icon="chevronRight" label="Mês seguinte" onClick={() => onPeriodChange(shiftPeriod(period, 1))} />
          </div>
          {period !== currentPeriod() && <Button variant="ghost" size="sm" onClick={() => onPeriodChange(currentPeriod())}>Mês atual</Button>}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Recebido</p>
            <p className="text-3xl font-semibold text-zinc-900 dark:text-white tabular-nums leading-tight">{fmtEur(recebido)} <span className="text-base font-normal text-zinc-400">/ {fmtEur(previsto)} previsto</span></p>
          </div>
          <div className="flex gap-6 text-sm">
            <div><p className="text-zinc-400 text-xs">Cobrança</p><p className={`font-semibold tabular-nums ${pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{pct}%</p></div>
            <div><p className="text-zinc-400 text-xs">Por cobrar</p><p className="font-semibold text-zinc-800 dark:text-zinc-100 tabular-nums">{fmtEur(fin.kpis.porCobrar)}</p></div>
            <div><p className="text-zinc-400 text-xs">Em atraso</p><p className={`font-semibold tabular-nums ${fin.kpis.emAtraso ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-100'}`}>{fin.kpis.emAtraso}</p></div>
            <div><p className="text-zinc-400 text-xs">MRR</p><p className="font-semibold text-zinc-800 dark:text-zinc-100 tabular-nums">{fmtEur(mrr)}</p></div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {/* Filtro + pesquisa */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Tabs
          size="sm"
          tabs={([['cobrar', 'Por cobrar'], ['pago', 'Pagos'], ['todos', 'Todos']] as const).map(([id, label]) => ({
            id,
            label: <>{label} <span className={filter === id ? 'opacity-80' : 'text-zinc-400'}>{counts[id]}</span></>,
          }))}
          value={filter}
          onChange={(id: string) => onFilterChange(id as typeof filter)}
        />
        <div className="relative sm:ml-auto sm:max-w-xs flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" className="w-[18px] h-[18px]" /></span>
          <input value={q} onChange={(e) => onQChange(e.target.value)} placeholder="Procurar cliente…" className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-transparent rounded-lg text-sm pl-10 pr-3 py-2 focus:bg-white dark:focus:bg-zinc-900 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none text-zinc-800 dark:text-zinc-100" />
        </div>
      </div>

      {/* Lista de cobrança */}
      {billable.length === 0 ? (
        <Card><EmptyState icon="euro" title="Sem clientes com plano" desc="Convida um sócio ou atribui uma subscrição na ficha do cliente para começar a cobrar." action={<GuardButton icon="mail" size="sm" onClick={() => onOpenConfirmBulk?.()}>Convidar sócio</GuardButton>} /></Card>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center text-sm text-zinc-400">{filter === 'cobrar' ? 'Tudo cobrado neste mês. 🎉' : 'Nada a mostrar.'}</Card>
      ) : (
        <div>
          <Card className="overflow-hidden divide-y divide-zinc-50 dark:divide-zinc-800/50">
          {pg.pageItems.map((r) => {
            const di = dueInfo(r)
            const amount = r.payment?.amount ?? r.subscription?.price ?? 0
            return (
              <button key={r.customerId} onClick={() => onOpen({ id: r.customerId, name: r.name })} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen({ id: r.customerId, name: r.name })} className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 text-left cursor-pointer">
                {!isPaid(r) && <input type="checkbox" checked={sel.has(r.customerId)} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); toggleSel(r.customerId) }} className="w-4 h-4 accent-accent shrink-0" aria-label={`Selecionar ${r.name}`} />}
                <Avatar name={r.name} color={colorFromName(r.name)} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-zinc-900 dark:text-white truncate">{r.name}</p>
                    {r.membershipStatus === 'pending' && <Badge tone="blue">Convidado</Badge>}
                    {r.blocked && <Badge tone="red">Bloqueado</Badge>}
                    {!r.subscription && <Badge tone="amber">Sem plano</Badge>}
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{r.subscription?.name || '—'} · {fmtEur(r.subscription?.price ?? 0)} · <span className={di.fg}>{di.text}</span></p>
                </div>
                {isPaid(r) ? (
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">{fmtEur(amount)}</span>
                ) : (
                  <GuardButton size="sm" icon="check" onClick={(e?: any) => { e?.stopPropagation(); setPag({ customerId: r.customerId, period, amount, status: r.status as Status, paidAmount: r.payment?.paidAmount ?? undefined }) }}>Marcar pago</GuardButton>
                )}
                <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 shrink-0" />
              </button>
            )
          })}
          </Card>
          <Pagination {...pg} />
        </div>
      )}

      {sel.size > 0 && (
        <div className="sticky bottom-3 z-20 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-900 text-white shadow-lg mx-auto max-w-lg">
          <span className="text-sm font-medium">{sel.size} selecionado{sel.size > 1 ? 's' : ''}</span>
          <button onClick={() => setSel(new Set())} className="text-xs text-zinc-400 hover:text-white">Limpar</button>
          <div className="ml-auto flex gap-2">
            <button onClick={() => onLembrar([...sel])} className="text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Lembrar</button>
            <GuardButton onClick={() => setConfirmBulk(true)} className="text-sm px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium">Marcar pagos</GuardButton>
          </div>
        </div>
      )}

      {pag && <PagamentoModal customerId={pag.customerId} period={pag.period} amount={pag.amount} status={pag.status} paidAmount={pag.paidAmount} onClose={() => setPag(null)} onSaved={() => invalidateMens(qc)} />}
      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={onBulkPay}
        variant="warning"
        title="Marcar como pagos?"
        description={`Vai marcar ${sel.size} cliente${sel.size > 1 ? 's' : ''} como pagos em ${fmtPeriodo(period)}.`}
        confirmLabel="Marcar pagos"
        pendingLabel="A marcar…"
      />
    </div>
  )
}

// ── Análise: churn / retenção / LTV / MRR trend ──────────────────────────────
function KpiCard({ label, value, hint, tone, info }: { label: string; value: string; hint?: string; tone?: 'green' | 'red' | 'amber'; info?: { title: string; body: React.ReactNode } }) {
  const toneFg = tone === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'red' ? 'text-red-600 dark:text-red-400'
    : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : 'text-zinc-900 dark:text-white'
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
        {info && <InfoDot title={info.title} body={info.body} />}
      </div>
      <p className={`text-2xl sm:text-[28px] font-semibold tabular-nums leading-tight mt-1 ${toneFg}`}>{value}</p>
      {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
    </Card>
  )
}

export function AnaliseView() {
  const { data, isLoading, isError, refetch } = useGymAnalytics()
  if (isError) return (
    <Card className="p-8 text-center space-y-3">
      <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar análise</p>
      <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar de novo</Button>
    </Card>
  )
  if (isLoading || !data) return <Card className="p-8 text-center text-sm text-zinc-400">A carregar análise…</Card>

  const churnTone = data.churn.rate > 10 ? 'red' : data.churn.rate > 0 ? 'amber' : 'green'
  const retentionTone = data.retentionRate >= 70 ? 'green' : data.retentionRate >= 40 ? 'amber' : 'red'
  const trendLabels = data.mrrTrend.map((t) => fmtPeriodo(t.period))
  const trendSeries = [{ name: 'Recebido', color: '#1F8A5B', values: data.mrrTrend.map((t) => t.recebido) }]
  const hasTrend = data.mrrTrend.some((t) => t.recebido > 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="MRR" value={fmtEur(data.mrr)} hint="Subscrições ativas" info={INFO.mrr} />
        <KpiCard label="ARR" value={fmtEur(data.arr)} hint="Receita anual (MRR×12)" info={INFO.arr} />
        <KpiCard label="Taxa de cobrança" value={`${data.collectionRate}%`} hint="Recebido / esperado" tone={data.collectionRate >= 80 ? 'green' : 'amber'} info={INFO.collection} />
        <KpiCard label="Membros ativos" value={String(data.activeMembers)} hint={data.blockedMembers ? `${data.blockedMembers} bloqueado${data.blockedMembers !== 1 ? 's' : ''}` : 'Com subscrição'} info={INFO.activeMembers} />
        <KpiCard label="Inativos" value={String(data.inactiveMembers)} hint={`sem treinar há +${data.inactiveAfterDays}d`} tone={data.inactiveMembers > 0 ? 'amber' : 'green'} info={INFO.inactive} />
        <KpiCard label="Churn" value={`${data.churn.rate}%`} hint={`${data.churn.count} de ${data.churn.base} no último mês`} tone={churnTone} info={INFO.churn} />
        <KpiCard label="Retenção" value={`${data.retentionRate}%`} hint="Mês anterior → atual" tone={retentionTone} info={INFO.retention} />
        <KpiCard label="LTV" value={fmtEur(data.ltv)} hint={`~${data.avgLifetimeMonths} meses pagos`} info={INFO.ltv} />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Tendência do MRR</h3>
            <InfoDot title={INFO.mrrTrend.title} body={INFO.mrrTrend.body} />
          </div>
          <span className="text-xs text-zinc-400">Recebido · 6 meses</span>
        </div>
        {hasTrend ? (
          <LineChart labels={trendLabels} series={trendSeries} height={220} format={(n: number) => fmtEur(n)} />
        ) : (
          <div className="py-10 text-center text-sm text-zinc-400">Sem pagamentos registados nos últimos 6 meses.</div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Movimento do MRR</h3>
            <InfoDot title={INFO.waterfall.title} body={INFO.waterfall.body} />
          </div>
          <span className="text-xs text-zinc-400">ganho (novo+expansão) vs perda</span>
        </div>
        {data.waterfall?.some((w) => w.novo || w.perdido || w.expansao || w.contracao) ? (
          <Waterfall data={data.waterfall} format={(n: number) => fmtEur(n)} />
        ) : (
          <div className="py-10 text-center text-sm text-zinc-400">Sem movimento de mensalidades nos últimos meses.</div>
        )}
      </Card>
    </div>
  )
}
