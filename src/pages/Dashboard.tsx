import { useMemo, useState, type ReactNode } from "react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { pt } from "date-fns/locale";
import { useAuth } from "../context/AuthContext";
import { Card, Badge, EmptyState, SectionTitle } from "../ui/ui.jsx";
import { FirstValueChecklist } from "../components/FirstValueChecklist";
import { useGetCustomers } from "../gen/backoffice/hooks/useGetCustomers.js";
import { useGetOrders } from "../gen/backoffice/hooks/useGetOrders.js";
import { useGetScheduleAppointments } from "../gen/backoffice/hooks/useGetScheduleAppointments.js";
import { useGetScheduleServices } from "../gen/backoffice/hooks/useGetScheduleServices.js";
import { useGetGymMensalidadeFinance } from "../gen/backoffice/hooks/useGetGymMensalidadeFinance.js";
import { useDashboard } from "../hooks/useDashboard";
import { StaffFilterSelect } from "../components/StaffSelect";
import { STAFF_ALL, staffParam } from "../lib/staffFilter";
import { useNow } from "../hooks/useNow";
import { fmtEur } from "../lib/money";
import { dashboardBlocks, dashboardSpine, hasRevenue, revenueSourcesLabel } from "../lib/dashboardBlocks";
import { Appt, DayRail } from "./dashboard/DayRail";
import { CustomersWelcome, FulfillmentSpine, OrderLike, OrdersList, StockAlerts } from "./dashboard/Lists";
import { GymCobrancasSpine, GymMiniCard, gymDerive } from "./dashboard/GymBlocks";
import { Kpi, KpiCard, STATUS_PT } from "./dashboard/shared";

export function Dashboard() {
  const { hasPermission, username, isMember, can, member } = useAuth()
  const now = useNow()
  const thisMonth = format(now, 'yyyy-MM')
  const today = format(now, 'yyyy-MM-dd')
  const monthLabel = format(now, 'MMMM', { locale: pt })

  // Agregados cross-vertical (receita de hoje por módulo, sócios, alertas, etc.)
  // Profissionais: Global · Sem profissional · cada um (`?staff=`) — filtra o resumo, as marcações e as encomendas.
  const [staffSel, setStaffSel] = useState<string>(STAFF_ALL)
  const staff = staffParam(staffSel)
  const { data: dash, isLoading: loadingDash } = useDashboard('today', undefined, undefined, true, staff)

  // O que se mostra (B41 2c): o dono vê os módulos do tenant (Clientes é core); um membro vê só os blocos que a API
  // pôs em `included` — e enquanto o `/dashboard` não responde não pede nada que a API possa recusar com 403.
  const blocks = useMemo(
    () => dashboardBlocks({
      isMember,
      included: dash?.included,
      perms: {
        schedule: hasPermission('VIEW_SCHEDULE'),
        products: hasPermission('VIEW_PRODUCTS'),
        gym: hasPermission('VIEW_GYM'),
      },
    }),
    [isMember, dash?.included, hasPermission],
  )
  const canSchedule = blocks.schedule
  const canOrders = blocks.orders
  const canGym = blocks.gymRevenue

  const { data: customersData, isLoading: loadingCustomers } = useGetCustomers({
    query: { enabled: blocks.customers },
  })
  const { data: ordersData, isLoading: loadingOrders } = useGetOrders({ limit: 6, ...(staff ? { staff } : {}) }, {
    query: { enabled: canOrders },
  })
  const { data: appointmentsData, isLoading: loadingAppts } = useGetScheduleAppointments(
    { month: thisMonth, ...(staff ? { staff } : {}) },
    { query: { enabled: canSchedule } },
  )
  const { data: servicesData } = useGetScheduleServices({
    query: { enabled: canSchedule && (!isMember || can('agenda.servicos')) },
  })
  const { data: gymFinanceData, isLoading: loadingGym } = useGetGymMensalidadeFinance(
    { period: thisMonth },
    { query: { enabled: canGym } },
  )

  const appts = useMemo(() => (appointmentsData ?? []) as Appt[], [appointmentsData])
  const orders = useMemo(() => (ordersData?.rows ?? []) as OrderLike[], [ordersData])
  const services = useMemo(() => servicesData ?? [], [servicesData])
  const gymFin = gymFinanceData

  const colorOf = useMemo(() => {
    const m = new Map(services.map((s) => [s.serviceId, s.color || '#2A6FDB']))
    return (id?: string | null) => (id && m.get(id)) || '#2A6FDB'
  }, [services])

  // ── Today ──────────────────────────────────────────────────────────────
  const apptsToday = useMemo(() => appts.filter((a) => a.date === today), [appts, today])
  const pendingToday = apptsToday.filter((a) => a.status === 'pending').length

  // Receita de hoje agregada (agenda + loja + ginásio), dos dados reais do /dashboard.
  // Só soma as fontes visíveis (sem `schedule.valores` a agenda nem traz o campo).
  const revToday = (blocks.scheduleValues ? dash?.schedule?.period.revenue ?? 0 : 0)
    + (blocks.orders ? dash?.ecommerce?.period?.revenue ?? 0 : 0)
    + (blocks.gymRevenue ? dash?.gym?.period?.revenue ?? 0 : 0)
  const salesToday = dash?.ecommerce?.period?.revenue ?? 0
  const stockAlerts = blocks.stock ? dash?.ecommerce?.stockAlerts ?? [] : []
  // «Por despachar» vem da API (LJ-11: pending + processing de TODAS as encomendas), não das 6 mais recentes.
  const openOrders = ordersData?.stats?.open ?? 0
  const recentOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()).slice(0, 6),
    [orders],
  )

  // Clientes (core): total + novos nos últimos 7 dias (quando há createdAt).
  const customers = useMemo(() => (customersData?.rows ?? []) as { createdAt?: string }[], [customersData])
  const totalCustomers = customersData?.count ?? customers.length
  const newCustomers = useMemo(() => {
    const since = subDays(now, 7)
    return customers.filter((c) => c.createdAt && new Date(c.createdAt) >= since).length
  }, [customers, now])

  // ── 14-day appointment series + 7d-over-7d delta ──────────────────────────
  const { spark14, weekDelta, weekCount } = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(now, 13), end: now })
    const counts: Record<string, number> = {}
    for (const a of appts) counts[a.date] = (counts[a.date] ?? 0) + 1
    const series = days.map((d) => counts[format(d, 'yyyy-MM-dd')] ?? 0)
    const last7 = series.slice(7).reduce((s, v) => s + v, 0)
    const prev7 = series.slice(0, 7).reduce((s, v) => s + v, 0)
    return { spark14: series, weekDelta: last7 - prev7, weekCount: last7 }
  }, [appts, now])

  // ── Status breakdown (mês, agenda) ────────────────────────────────────────
  const breakdown = useMemo(() => {
    const c = (st: string) => appts.filter((a) => a.status === st).length
    return [
      { key: 'pending',   label: STATUS_PT.pending,   count: c('pending'),   color: 'bg-amber-400' },
      { key: 'confirmed', label: STATUS_PT.confirmed, count: c('confirmed'), color: 'bg-blue-500' },
      { key: 'completed', label: STATUS_PT.completed, count: c('completed'), color: 'bg-emerald-500' },
      { key: 'cancelled', label: STATUS_PT.cancelled, count: c('cancelled'), color: 'bg-red-400' },
    ]
  }, [appts])

  const gym = gymDerive(gymFin)

  // ── KPI band: âncora por vertical ativa + "Receita de hoje" agregada ───────
  const kpis = useMemo(() => {
    const list: Kpi[] = []
    if (hasRevenue(blocks)) list.push({ label: 'Receita de hoje', value: fmtEur(revToday), sub: revenueSourcesLabel(blocks), icon: 'euro', tone: 'green', loading: loadingDash, href: '/financeiro' })
    if (canSchedule) list.push({ label: 'Marcações hoje', value: apptsToday.length, sub: pendingToday ? `${pendingToday} por confirmar` : apptsToday.length ? 'tudo confirmado' : 'dia livre', icon: 'calendar', tone: 'blue', loading: loadingAppts, href: `/agenda?data=${today}` })
    if (canGym) {
      list.push(gym.emAtraso > 0
        ? { label: 'Em atraso', value: gym.emAtraso, sub: 'mensalidades', icon: 'alertTriangle', tone: 'red', loading: loadingGym, href: '/financeiro/ginasio' }
        : { label: 'Por cobrar', value: fmtEur(gym.porCobrar), sub: `de ${fmtEur(gym.previsto)} previstos`, icon: 'card', tone: 'amber', loading: loadingGym, href: '/financeiro/ginasio' })
    }
    if (canOrders) {
      list.push(openOrders > 0
        ? { label: 'Por despachar', value: openOrders, sub: 'encomendas', icon: 'package', tone: 'amber', loading: loadingOrders, href: '/loja/encomendas' }
        : { label: 'Vendas de hoje', value: fmtEur(salesToday), sub: 'loja', icon: 'cart', tone: 'blue', loading: loadingDash, href: '/loja/encomendas' })
    }
    // Core + fillers (só para encher a faixa em tenants de uma só vertical).
    if (blocks.customers) list.push({ label: 'Clientes', value: totalCustomers, sub: newCustomers ? `${newCustomers} novos esta semana` : 'no total', icon: 'users', tone: 'violet', loading: loadingCustomers, href: '/clientes' })
    if (canSchedule) list.push({ label: 'Marcações · 14 dias', value: weekCount, sub: 'últimos 7 dias', icon: 'trend', tone: 'violet', loading: loadingAppts, delta: weekDelta, spark: spark14, href: '/agenda' })
    if (blocks.gymMembers) list.push({ label: 'Sócios ativos', value: dash?.gym?.activeMembers ?? '—', sub: 'ginásio', icon: 'users', tone: 'violet', loading: loadingDash, href: '/financeiro/ginasio' })
    if (canOrders) list.push({ label: 'Ticket médio', value: fmtEur(dash?.ecommerce?.period?.avgOrderValue ?? 0), sub: 'por encomenda', icon: 'cart', tone: 'blue', loading: loadingDash, href: '/loja/encomendas' })
    return list.slice(0, 4)
  }, [blocks, canSchedule, canOrders, canGym, revToday, apptsToday.length, pendingToday, today, gym.emAtraso, gym.porCobrar, gym.previsto, openOrders, salesToday, totalCustomers, newCustomers, weekCount, weekDelta, spark14, dash, loadingDash, loadingAppts, loadingGym, loadingOrders, loadingCustomers])

  // ── Espinha (peça central) por prioridade operacional ─────────────────────
  const spine = dashboardSpine(blocks)

  // ── Carris de apoio (as outras verticais ativas) ──────────────────────────
  const rail: ReactNode[] = []
  if (canSchedule && appts.length > 0) {
    rail.push(
      <Card key="status" className="p-5">
        <SectionTitle>Estado das marcações · {monthLabel}</SectionTitle>
        <div className="space-y-3">
          {breakdown.map(({ key, label, count, color }) => (
            <div key={key} className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
              <span className="text-sm text-zinc-600 dark:text-zinc-300 flex-1">{label}</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white tabular-nums w-6 text-right">{count}</span>
              <div className="w-16 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: appts.length ? `${Math.round((count / appts.length) * 100)}%` : '0%' }} />
              </div>
            </div>
          ))}
          <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">{appts.length} marcações no total</p>
        </div>
      </Card>,
    )
  }
  if (canGym && spine !== 'gym') rail.push(<GymMiniCard key="gym" fin={gymFin} monthLabel={monthLabel} />)
  if (canOrders && spine !== 'loja') {
    if (recentOrders.length > 0 || openOrders > 0) {
      rail.push(
        <Card key="orders" className="p-5">
          <SectionTitle right={openOrders > 0 ? <Badge tone="amber">{openOrders} por despachar</Badge> : undefined}>Últimas encomendas</SectionTitle>
          {recentOrders.length === 0
            ? <EmptyState icon="cart" title="Sem encomendas" desc="As encomendas mais recentes aparecem aqui." />
            : <OrdersList orders={recentOrders} />}
        </Card>,
      )
    }
  }
  // O stock tem folha própria (loja.produtos): pode haver stock sem encomendas, e vice-versa.
  if (stockAlerts.length > 0 && spine !== 'loja') rail.push(<StockAlerts key="stock" alerts={stockAlerts} />)

  const hasRail = rail.length > 0
  const hasSpine = spine !== 'none'
  // Nada para mostrar (um membro sem nenhum cartão visível, ou o /dashboard ainda a carregar): estado vazio, sem buracos.
  const nothingToShow = kpis.length === 0 && !hasSpine && !hasRail

  return (
    <div className="space-y-6">
      {/* Onboarding do dono: lê clientes/serviços/produtos que um membro pode não ter. */}
      {!isMember && <FirstValueChecklist />}

      {/* Header — frames the day, not a vanity greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-accent uppercase tracking-wide">
            {format(now, 'EEEE', { locale: pt })}
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">
            {format(now, "d 'de' MMMM", { locale: pt })}
            <span className="text-zinc-300 dark:text-zinc-600 font-normal"> · </span>
            <span className="font-mono tabular-nums text-zinc-400 text-lg">{format(now, 'HH:mm')}</span>
          </h1>
        </div>
        <div className="sm:ml-auto flex flex-wrap items-center gap-3">
          <StaffFilterSelect value={staffSel} onChange={setStaffSel} leaves={["financeiro.negocio", "financeiro.agenda", "financeiro.loja"]} />
          <p className="text-sm text-zinc-400">Olá, {(isMember ? member?.name?.split(' ')[0] : username) ?? '—'}</p>
        </div>
      </div>

      {/* KPI band */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
        </div>
      )}

      {/* Sem acesso a nenhum bloco (ou o /dashboard ainda a carregar, para um membro) */}
      {nothingToShow && (
        loadingDash
          ? <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />)}</div>
          : <EmptyState icon="lock" title="Sem dados para mostrar" desc="O dono da conta ainda não te deu acesso a nenhuma área deste resumo." />
      )}

      {/* Main — spine adapts to the tenant's business */}
      {(hasSpine || hasRail) && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {hasSpine && (
        <Card className={`p-5 ${hasRail ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          {spine === 'agenda' && (
            <>
              <SectionTitle right={<span className="text-xs text-zinc-400 tabular-nums">{apptsToday.length} hoje</span>}>Hoje</SectionTitle>
              {loadingAppts
                ? <div className="space-y-3 py-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />)}</div>
                : <DayRail appts={apptsToday} colorOf={colorOf} now={now} />}
            </>
          )}
          {spine === 'gym' && <GymCobrancasSpine fin={gymFin} monthLabel={monthLabel} loading={loadingGym} />}
          {spine === 'loja' && <FulfillmentSpine orders={orders} openCount={openOrders} salesToday={salesToday} alerts={stockAlerts} loading={loadingOrders} />}
          {spine === 'core' && <CustomersWelcome total={totalCustomers} newCount={newCustomers} loading={loadingCustomers} />}
        </Card>
        )}

        {hasRail && <div className={hasSpine ? 'lg:col-span-5 space-y-4' : 'lg:col-span-12 space-y-4'}>{rail}</div>}
      </div>
      )}
    </div>
  )
}
