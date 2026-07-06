import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { pt } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Badge, EmptyState, SectionTitle, BADGE_TONES } from '../ui/ui.jsx'
import { Sparkline } from '../ui/charts.jsx'
import { FirstValueChecklist } from '../components/FirstValueChecklist'
import { useGetCustomers } from '../gen/backoffice/hooks/useGetCustomers.js'
import { useGetOrders } from '../gen/backoffice/hooks/useGetOrders.js'
import { useGetScheduleAppointments } from '../gen/backoffice/hooks/useGetScheduleAppointments.js'
import { useGetScheduleServices } from '../gen/backoffice/hooks/useGetScheduleServices.js'
import { useGetGymMensalidadeFinance } from '../gen/backoffice/hooks/useGetGymMensalidadeFinance.js'
import { useDashboard } from '../hooks/useDashboard'

const fmtEur = (n: number) =>
  '€' + n.toLocaleString('pt-PT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })

const STATUS_PT: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmada', completed: 'Concluída', cancelled: 'Cancelada',
}
const STATUS_TONE: Record<string, string> = {
  pending: 'amber', confirmed: 'blue', completed: 'green', cancelled: 'red',
}
const DONE = new Set(['completed', 'cancelled'])

// Encomendas ainda por despachar (não enviadas / não canceladas).
const OPEN_ORDER = new Set(['pending', 'processing'])

// HH:mm[:ss] → minutes since midnight
const toMin = (t: string) => {
  const [h, m] = t.split(':')
  return Number(h) * 60 + Number(m)
}

/** Ticks every minute so the "agora" marker tracks real time without a noisy seconds clock. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// ── KPI ───────────────────────────────────────────────────────────────────
type Kpi = {
  label: string; value: string | number; sub?: string
  icon: string; tone: keyof typeof BADGE_TONES; loading?: boolean
  delta?: number; spark?: number[]; href?: string
}

function KpiCard({ label, value, sub, icon, tone, loading, delta, spark, href }: Kpi) {
  const navigate = useNavigate()
  const body = (
    <Card className={`p-4 flex flex-col h-full ${href ? 'group-hover/kpi:border-accent/40 transition-colors' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${BADGE_TONES[tone]}`}>
          <Icon name={icon} className="w-4 h-4" />
        </div>
        {delta !== undefined && delta !== 0 && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} className="w-3 h-3" />
            {Math.abs(delta)}
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <p className="text-[26px] leading-none font-semibold text-zinc-900 dark:text-white mt-3 tabular-nums tracking-tight">{value}</p>
      )}
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] text-zinc-500 truncate">{label}</p>
          {sub && <p className="text-xs text-zinc-400 mt-0.5 truncate">{sub}</p>}
        </div>
        {spark && spark.some((v) => v > 0) && (
          <Sparkline data={spark} color="#2A6FDB" width={64} height={26} up={delta === undefined || delta >= 0} />
        )}
      </div>
    </Card>
  )
  if (!href) return body
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      aria-label={`${label}: ${value}`}
      className="group/kpi text-left w-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {body}
    </button>
  )
}

// ── Clickable row helper (em atraso / encomendas) ─────────────────────────────
function RowLink({ to, children, ariaLabel }: { to: string; children: ReactNode; ariaLabel: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      aria-label={ariaLabel}
      className="group/row w-full text-left flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
    >
      {children}
    </button>
  )
}

// ── Agenda spine: the day as a spine ─────────────────────────────────────────
type Appt = { appointmentId: string; date: string; time: string; serviceId?: string | null; serviceName: string; clientName: string; status?: string }

function DayRail({ appts, colorOf, now }: {
  appts: Appt[]; colorOf: (id?: string | null) => string; now: Date
}) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const sorted = useMemo(() => [...appts].sort((a, b) => a.time.localeCompare(b.time)), [appts])

  // The next thing the operator actually has to do.
  const next = useMemo(
    () => sorted.find((a) => toMin(a.time) >= nowMin && !DONE.has(a.status ?? '')),
    [sorted, nowMin],
  )
  const nextInMin = next ? toMin(next.time) - nowMin : null

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Dia livre"
        desc="Sem marcações para hoje. Quando entrarem reservas, aparecem aqui em linha do tempo."
      />
    )
  }

  // Index at which the "agora" marker should sit among the appointments.
  const nowIndex = sorted.findIndex((a) => toMin(a.time) > nowMin)
  const markerAt = nowIndex === -1 ? sorted.length : nowIndex

  return (
    <div>
      {/* Próximo — the one decision that matters right now */}
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-accent/5 dark:bg-accent/10 border border-accent/15 px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
          <Icon name="clock" className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0">
          {next ? (
            <>
              <p className="text-[13px] text-zinc-500">
                Próximo {nextInMin !== null && nextInMin >= 0
                  ? <span className="text-accent font-medium">· {nextInMin === 0 ? 'agora' : `em ${nextInMin} min`}</span>
                  : null}
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                {next.time.slice(0, 5)} · {next.clientName}
                <span className="font-normal text-zinc-500"> — {next.serviceName}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-zinc-500">Dia concluído</p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Sem mais marcações por hoje</p>
            </>
          )}
        </div>
      </div>

      {/* Timeline rail */}
      <ol className="relative">
        {sorted.map((a, i) => {
          const isNext = next?.appointmentId === a.appointmentId
          const past = DONE.has(a.status ?? '') || toMin(a.time) < nowMin
          const col = colorOf(a.serviceId)
          return (
            <li key={a.appointmentId}>
              {i === markerAt && <NowMarker time={now} />}
              <div className="relative flex gap-3 pb-3 last:pb-0">
                <time className={`w-11 shrink-0 pt-0.5 text-right text-[13px] font-mono tabular-nums ${past ? 'text-zinc-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                  {a.time.slice(0, 5)}
                </time>
                <div className="relative flex flex-col items-center">
                  <span
                    className="mt-1 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-zinc-900 shrink-0"
                    style={{ background: col }}
                  />
                  {i < sorted.length - 1 && <span className="flex-1 w-px bg-zinc-200 dark:bg-zinc-800" />}
                </div>
                <div className={`flex-1 min-w-0 rounded-lg px-3 py-2 -my-0.5 transition-colors ${
                  isNext
                    ? 'bg-accent/5 dark:bg-accent/10 ring-1 ring-accent/20'
                    : past ? 'opacity-60' : ''
                }`}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate flex-1">{a.clientName}</p>
                    <Badge tone={(STATUS_TONE[a.status ?? ''] as any) ?? 'neutral'}>
                      {STATUS_PT[a.status ?? ''] ?? a.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{a.serviceName}</p>
                </div>
              </div>
            </li>
          )
        })}
        {markerAt === sorted.length && <NowMarker time={now} trailing />}
      </ol>
    </div>
  )
}

function NowMarker({ time, trailing = false }: { time: Date; trailing?: boolean }) {
  return (
    <div className={`relative flex items-center gap-3 ${trailing ? 'pt-1' : 'py-1'}`}>
      <span className="w-11 shrink-0 text-right text-[11px] font-mono font-semibold text-accent tabular-nums">
        {format(time, 'HH:mm')}
      </span>
      <span className="relative flex items-center justify-center w-2.5">
        <span className="absolute w-2.5 h-2.5 rounded-full bg-accent/30 animate-ping motion-reduce:animate-none" />
        <span className="relative w-2 h-2 rounded-full bg-accent ring-4 ring-white dark:ring-zinc-900" />
      </span>
      <span className="flex items-center gap-2 flex-1">
        <span className="h-px flex-1 bg-gradient-to-r from-accent/40 to-transparent" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">agora</span>
      </span>
    </div>
  )
}

// ── Gym: mensalidades (recebido vs previsto + quem está em atraso) ────────────
type GymRow = { customerId: string; name: string; overdue: boolean; subscription: unknown | null; status: string }
type GymFinance = { kpis: { recebido: number; emDivida: number; emAtraso: number; mrr: number; blocked: number }; rows: GymRow[] }

function gymDerive(fin?: GymFinance) {
  const k = fin?.kpis
  const previsto = k?.mrr ?? 0
  const recebido = k?.recebido ?? 0
  const pct = previsto > 0 ? Math.min(100, Math.round((recebido / previsto) * 100)) : 0
  const porCobrar = Math.max(0, previsto - recebido)
  const overdue = (fin?.rows ?? []).filter((r) => r.overdue)
  return { previsto, recebido, pct, porCobrar, emAtraso: k?.emAtraso ?? 0, mrr: previsto, overdue }
}

function GymProgress({ recebido, previsto, pct }: { recebido: number; previsto: number; pct: number }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[26px] leading-none font-semibold text-zinc-900 dark:text-white tabular-nums tracking-tight">
          {fmtEur(recebido)}
          <span className="text-base font-normal text-zinc-400"> / {fmtEur(previsto)}</span>
        </p>
        <span className="text-sm font-semibold text-zinc-500 tabular-nums">{pct}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function GymCobrancasSpine({ fin, monthLabel, loading }: { fin?: GymFinance; monthLabel: string; loading?: boolean }) {
  const { recebido, previsto, pct, porCobrar, emAtraso, mrr, overdue } = gymDerive(fin)
  if (loading) return <div className="space-y-3 py-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />)}</div>
  return (
    <div>
      <SectionTitle right={<span className="text-xs text-zinc-400">Mensalidades</span>}>Cobranças · {monthLabel}</SectionTitle>
      <GymProgress recebido={recebido} previsto={previsto} pct={pct} />

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 py-2.5">
          <p className="text-xs text-zinc-400">Por cobrar</p>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 tabular-nums">{fmtEur(porCobrar)}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 py-2.5">
          <p className="text-xs text-zinc-400">Em atraso</p>
          <p className={`text-sm font-semibold tabular-nums ${emAtraso ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-100'}`}>{emAtraso}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 py-2.5">
          <p className="text-xs text-zinc-400">MRR</p>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 tabular-nums">{fmtEur(mrr)}</p>
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle right={overdue.length > 6 ? <span className="text-xs text-zinc-400">+{overdue.length - 6}</span> : undefined}>
          Em atraso
        </SectionTitle>
        {overdue.length === 0 ? (
          <p className="text-sm text-zinc-400 py-2">Tudo em dia — ninguém em atraso este mês. ✓</p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {overdue.slice(0, 6).map((r) => (
              <RowLink key={r.customerId} to={`/clientes?cliente=${encodeURIComponent(r.customerId)}`} ariaLabel={`Abrir ficha de ${r.name}`}>
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-medium text-zinc-900 dark:text-white truncate group-hover/row:text-accent">{r.name}</span>
                <Badge tone="red">Em atraso</Badge>
              </RowLink>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GymMiniCard({ fin, monthLabel }: { fin?: GymFinance; monthLabel: string }) {
  const navigate = useNavigate()
  const { recebido, previsto, pct, emAtraso } = gymDerive(fin)
  return (
    <Card className="p-5">
      <SectionTitle right={
        <button type="button" onClick={() => navigate('/financeiro/ginasio')} className="text-xs text-accent hover:underline px-2 py-1 -mr-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">Ver cobranças</button>
      }>
        Ginásio · {monthLabel}
      </SectionTitle>
      <GymProgress recebido={recebido} previsto={previsto} pct={pct} />
      {emAtraso > 0 && (
        <button
          type="button"
          onClick={() => navigate('/financeiro/ginasio')}
          className="mt-3 w-full flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-left"
        >
          <Icon name="alertTriangle" className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300 font-medium">{emAtraso} cliente{emAtraso === 1 ? '' : 's'} em atraso</span>
        </button>
      )}
    </Card>
  )
}

// ── Loja: encomendas por despachar + últimas ─────────────────────────────────
type OrderLike = { orderId?: string; status?: string; price?: number | string; createdAt?: string; customerName?: string; clientName?: string }

function OrdersList({ orders }: { orders: OrderLike[] }) {
  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {orders.map((o, i) => (
        <RowLink key={o.orderId ?? i} to="/loja?tab=encomendas" ariaLabel={`Abrir encomendas`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate group-hover/row:text-accent">
              {o.customerName ?? o.clientName ?? `Encomenda #${String(o.orderId ?? i).slice(0, 8)}`}
            </p>
            <p className="text-xs text-zinc-400">
              {o.createdAt ? format(new Date(o.createdAt), 'd MMM yyyy', { locale: pt }) : '—'}
              {o.status && OPEN_ORDER.has(o.status) ? <span className="text-amber-600 dark:text-amber-400"> · por despachar</span> : null}
            </p>
          </div>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtEur(Number(o.price) || 0)}</span>
        </RowLink>
      ))}
    </div>
  )
}

function FulfillmentSpine({ orders, openCount, salesToday, alerts, loading }: {
  orders: OrderLike[]; openCount: number; salesToday: number; alerts: { name: string; reference: string; stock: number }[]; loading?: boolean
}) {
  const navigate = useNavigate()
  if (loading) return <div className="space-y-3 py-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />)}</div>
  const recent = [...orders]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 6)
  return (
    <div className="space-y-5">
      {/* Por despachar — the one thing to act on */}
      <button
        type="button"
        onClick={() => navigate('/loja?tab=encomendas')}
        className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left border transition-colors ${
          openCount > 0
            ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/70 dark:border-amber-500/20'
            : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/70 dark:border-emerald-500/20'
        }`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${openCount > 0 ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'}`}>
          <Icon name="package" className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {openCount > 0 ? `${openCount} encomenda${openCount === 1 ? '' : 's'} por despachar` : 'Tudo despachado'}
          </p>
          <p className="text-[13px] text-zinc-500">Vendas de hoje · <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmtEur(salesToday)}</span></p>
        </div>
      </button>

      <div>
        <SectionTitle>Últimas encomendas</SectionTitle>
        {recent.length === 0
          ? <EmptyState icon="cart" title="Sem encomendas" desc="As encomendas mais recentes aparecem aqui." />
          : <OrdersList orders={recent} />}
      </div>

      {alerts.length > 0 && <StockAlerts alerts={alerts} bare />}
    </div>
  )
}

function StockAlerts({ alerts, bare = false }: { alerts: { name: string; reference: string; stock: number }[]; bare?: boolean }) {
  const navigate = useNavigate()
  const inner = (
    <>
      <SectionTitle right={<span className="text-xs text-zinc-400">{alerts.length}</span>}>Stock baixo</SectionTitle>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {alerts.slice(0, 6).map((s) => (
          <button
            key={s.reference || s.name}
            type="button"
            onClick={() => navigate('/loja?tab=produtos')}
            className="group/row w-full text-left flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <Icon name="alertTriangle" className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="flex-1 min-w-0 text-sm font-medium text-zinc-900 dark:text-white truncate group-hover/row:text-accent">{s.name}</span>
            <Badge tone={s.stock <= 0 ? 'red' : 'amber'}>{s.stock <= 0 ? 'esgotado' : `${s.stock} un`}</Badge>
          </button>
        ))}
      </div>
    </>
  )
  return bare ? <div>{inner}</div> : <Card className="p-5">{inner}</Card>
}

// ── Core fallback (tenant só com clientes/conteúdos) ─────────────────────────
function CustomersWelcome({ total, newCount, loading }: { total: number; newCount: number; loading?: boolean }) {
  const navigate = useNavigate()
  return (
    <div>
      <SectionTitle>Os teus clientes</SectionTitle>
      {loading ? (
        <div className="h-7 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <p className="text-[32px] leading-none font-semibold text-zinc-900 dark:text-white tabular-nums tracking-tight">{total}</p>
      )}
      <p className="text-[13px] text-zinc-500 mt-1.5">{newCount > 0 ? `${newCount} novo${newCount === 1 ? '' : 's'} esta semana` : 'no total'}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => navigate('/clientes')} className="inline-flex items-center gap-2 rounded-lg bg-accent/10 text-accent px-3 py-2 text-sm font-medium hover:bg-accent/15 transition-colors">
          <Icon name="users" className="w-4 h-4" /> Ver clientes
        </button>
        <button type="button" onClick={() => navigate('/conteudos')} className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          <Icon name="edit" className="w-4 h-4" /> Conteúdos
        </button>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { authHeader, hasPermission, username } = useAuth()
  const headers = authHeader()
  const now = useNow()
  const thisMonth = format(now, 'yyyy-MM')
  const today = format(now, 'yyyy-MM-dd')
  const monthLabel = format(now, 'MMMM', { locale: pt })

  const canProducts = hasPermission('VIEW_PRODUCTS')
  const canSchedule = hasPermission('VIEW_SCHEDULE')
  const canGym = hasPermission('VIEW_GYM')
  // Clientes é core (todos os tenants) — não gatear no Dashboard.

  // Agregados cross-vertical (receita de hoje por módulo, sócios, alertas, etc.)
  const { data: dash, isLoading: loadingDash } = useDashboard('today')

  const { data: customersData, isLoading: loadingCustomers } = useGetCustomers({ client: { headers } })
  const { data: ordersData, isLoading: loadingOrders } = useGetOrders(undefined, {
    query: { enabled: canProducts }, client: { headers },
  })
  const { data: appointmentsData, isLoading: loadingAppts } = useGetScheduleAppointments(
    { month: thisMonth },
    { query: { enabled: canSchedule }, client: { headers } },
  )
  const { data: servicesData } = useGetScheduleServices({
    query: { enabled: canSchedule }, client: { headers },
  })
  const { data: gymFinanceData, isLoading: loadingGym } = useGetGymMensalidadeFinance(
    { period: thisMonth },
    { query: { enabled: canGym }, client: { headers } },
  )

  const appts = useMemo(() => (appointmentsData ?? []) as Appt[], [appointmentsData])
  const orders = useMemo(() => (ordersData?.rows ?? []) as OrderLike[], [ordersData])
  const services = useMemo(() => servicesData ?? [], [servicesData])
  const gymFin = gymFinanceData as GymFinance | undefined

  const colorOf = useMemo(() => {
    const m = new Map(services.map((s) => [s.serviceId, s.color || '#2A6FDB']))
    return (id?: string | null) => (id && m.get(id)) || '#2A6FDB'
  }, [services])

  // ── Today ──────────────────────────────────────────────────────────────
  const apptsToday = useMemo(() => appts.filter((a) => a.date === today), [appts, today])
  const pendingToday = apptsToday.filter((a) => a.status === 'pending').length

  // Receita de hoje agregada (agenda + loja + ginásio), dos dados reais do /dashboard.
  const revToday = (dash?.schedule?.period.revenue ?? 0) + (dash?.ecommerce?.period.revenue ?? 0) + (dash?.gym?.period.revenue ?? 0)
  const salesToday = dash?.ecommerce?.period.revenue ?? 0
  const stockAlerts = dash?.ecommerce?.stockAlerts ?? []
  const openOrders = useMemo(() => orders.filter((o) => o.status && OPEN_ORDER.has(o.status)).length, [orders])
  const recentOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()).slice(0, 6),
    [orders],
  )

  // Clientes (core): total + novos nos últimos 7 dias (quando há createdAt).
  const customers = (customersData?.rows ?? []) as { createdAt?: string }[]
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
    const hasRevenue = canSchedule || canProducts || canGym
    if (hasRevenue) list.push({ label: 'Receita de hoje', value: fmtEur(revToday), sub: 'agenda + loja + ginásio', icon: 'euro', tone: 'green', loading: loadingDash, href: '/financeiro' })
    if (canSchedule) list.push({ label: 'Marcações hoje', value: apptsToday.length, sub: pendingToday ? `${pendingToday} por confirmar` : apptsToday.length ? 'tudo confirmado' : 'dia livre', icon: 'calendar', tone: 'blue', loading: loadingAppts, href: `/agenda?data=${today}` })
    if (canGym) {
      list.push(gym.emAtraso > 0
        ? { label: 'Em atraso', value: gym.emAtraso, sub: 'mensalidades', icon: 'alertTriangle', tone: 'red', loading: loadingGym, href: '/financeiro/ginasio' }
        : { label: 'Por cobrar', value: fmtEur(gym.porCobrar), sub: `de ${fmtEur(gym.previsto)} previstos`, icon: 'card', tone: 'amber', loading: loadingGym, href: '/financeiro/ginasio' })
    }
    if (canProducts) {
      list.push(openOrders > 0
        ? { label: 'Por despachar', value: openOrders, sub: 'encomendas', icon: 'package', tone: 'amber', loading: loadingOrders, href: '/loja?tab=encomendas' }
        : { label: 'Vendas de hoje', value: fmtEur(salesToday), sub: 'loja', icon: 'cart', tone: 'blue', loading: loadingDash, href: '/loja?tab=encomendas' })
    }
    // Core + fillers (só para encher a faixa em tenants de uma só vertical).
    list.push({ label: 'Clientes', value: totalCustomers, sub: newCustomers ? `${newCustomers} novos esta semana` : 'no total', icon: 'users', tone: 'violet', loading: loadingCustomers, href: '/clientes' })
    if (canSchedule) list.push({ label: 'Marcações · 14 dias', value: weekCount, sub: 'últimos 7 dias', icon: 'trend', tone: 'violet', loading: loadingAppts, delta: weekDelta, spark: spark14, href: '/agenda' })
    if (canGym) list.push({ label: 'Sócios ativos', value: dash?.gym?.activeMembers ?? '—', sub: 'ginásio', icon: 'users', tone: 'violet', loading: loadingDash, href: '/financeiro/ginasio' })
    if (canProducts) list.push({ label: 'Ticket médio', value: fmtEur(dash?.ecommerce?.period.avgOrderValue ?? 0), sub: 'por encomenda', icon: 'cart', tone: 'blue', loading: loadingDash, href: '/loja?tab=encomendas' })
    return list.slice(0, 4)
  }, [canSchedule, canProducts, canGym, revToday, apptsToday.length, pendingToday, today, gym.emAtraso, gym.porCobrar, gym.previsto, openOrders, salesToday, totalCustomers, newCustomers, weekCount, weekDelta, spark14, dash, loadingDash, loadingAppts, loadingGym, loadingOrders, loadingCustomers])

  // ── Espinha (peça central) por prioridade operacional ─────────────────────
  const spine: 'agenda' | 'gym' | 'loja' | 'core' =
    canSchedule ? 'agenda' : canGym ? 'gym' : canProducts ? 'loja' : 'core'

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
  if (canProducts && spine !== 'loja') {
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
    if (stockAlerts.length > 0) rail.push(<StockAlerts key="stock" alerts={stockAlerts} />)
  }

  const hasRail = rail.length > 0

  return (
    <div className="space-y-6">
      <FirstValueChecklist />

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
        <p className="sm:ml-auto text-sm text-zinc-400">Olá, {username ?? '—'}</p>
      </div>

      {/* KPI band */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
        </div>
      )}

      {/* Main — spine adapts to the tenant's business */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
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

        {hasRail && <div className="lg:col-span-5 space-y-4">{rail}</div>}
      </div>
    </div>
  )
}
