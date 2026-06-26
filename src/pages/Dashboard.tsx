import { useEffect, useMemo, useState } from 'react'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { pt } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Badge, EmptyState, SectionTitle, BADGE_TONES } from '../ui/ui.jsx'
import { Sparkline } from '../ui/charts.jsx'
import { useGetCustomers } from '../gen/backoffice/hooks/useGetCustomers.js'
import { useGetOrders } from '../gen/backoffice/hooks/useGetOrders.js'
import { useGetScheduleAppointments } from '../gen/backoffice/hooks/useGetScheduleAppointments.js'
import { useGetScheduleServices } from '../gen/backoffice/hooks/useGetScheduleServices.js'

const fmtEur = (n: number) =>
  '€' + n.toLocaleString('pt-PT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })

const STATUS_PT: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmada', completed: 'Concluída', cancelled: 'Cancelada',
}
const STATUS_TONE: Record<string, string> = {
  pending: 'amber', confirmed: 'blue', completed: 'green', cancelled: 'red',
}
const DONE = new Set(['completed', 'cancelled'])

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
function KpiCard({ label, value, sub, icon, tone, loading, delta, spark, accent }: {
  label: string; value: string | number; sub?: string
  icon: string; tone: keyof typeof BADGE_TONES; loading?: boolean
  delta?: number; spark?: number[]; accent?: string
}) {
  return (
    <Card className="p-4 flex flex-col">
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
          <Sparkline data={spark} color={accent} width={64} height={26} up={delta === undefined || delta >= 0} />
        )}
      </div>
    </Card>
  )
}

// ── Signature: the day as a spine ───────────────────────────────────────────
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

export function Dashboard() {
  const { authHeader, hasPermission, username } = useAuth()
  const headers = authHeader()
  const now = useNow()
  const thisMonth = format(now, 'yyyy-MM')
  const today = format(now, 'yyyy-MM-dd')

  const canCustomers = hasPermission('VIEW_CUSTOMERS')
  const canProducts  = hasPermission('VIEW_PRODUCTS')
  const canSchedule  = hasPermission('VIEW_SCHEDULE')

  const { data: customersData, isLoading: loadingCustomers } = useGetCustomers({
    query: { enabled: canCustomers },
    client: { headers },
  })
  const { data: ordersData, isLoading: loadingOrders } = useGetOrders(undefined, {
    query: { enabled: canProducts },
    client: { headers },
  })
  const { data: appointmentsData, isLoading: loadingAppts } = useGetScheduleAppointments(
    { month: thisMonth },
    { query: { enabled: canSchedule }, client: { headers } },
  )
  const { data: servicesData } = useGetScheduleServices({
    query: { enabled: canSchedule }, client: { headers },
  })

  const appts    = useMemo(() => (appointmentsData ?? []) as Appt[], [appointmentsData])
  const orders   = useMemo(() => ordersData?.rows ?? [], [ordersData])
  const services = useMemo(() => servicesData ?? [], [servicesData])

  const colorOf = useMemo(() => {
    const m = new Map(services.map((s) => [s.serviceId, s.color || '#2A6FDB']))
    return (id?: string | null) => (id && m.get(id)) || '#2A6FDB'
  }, [services])

  // ── Today ──────────────────────────────────────────────────────────────
  const apptsToday = useMemo(() => appts.filter((a) => a.date === today), [appts, today])
  const revenueToday = useMemo(
    () => apptsToday.reduce((s, a: any) => s + (Number(a.paymentCash) || 0) + (Number(a.paymentMbway) || 0) + (Number(a.paymentCard) || 0), 0),
    [apptsToday],
  )
  const pendingToday = apptsToday.filter((a) => a.status === 'pending').length

  // ── Real 14-day series + 7d-over-7d delta (from this month's data) ────────
  const { spark14, weekDelta, weekCount } = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(now, 13), end: now })
    const counts: Record<string, number> = {}
    for (const a of appts) counts[a.date] = (counts[a.date] ?? 0) + 1
    const series = days.map((d) => counts[format(d, 'yyyy-MM-dd')] ?? 0)
    const last7 = series.slice(7).reduce((s, v) => s + v, 0)
    const prev7 = series.slice(0, 7).reduce((s, v) => s + v, 0)
    return { spark14: series, weekDelta: last7 - prev7, weekCount: last7 }
  }, [appts, now])

  // ── Status breakdown ──────────────────────────────────────────────────────
  const breakdown = useMemo(() => {
    const c = (st: string) => appts.filter((a) => a.status === st).length
    return [
      { key: 'pending',   label: STATUS_PT.pending,   count: c('pending'),   color: 'bg-amber-400' },
      { key: 'confirmed', label: STATUS_PT.confirmed, count: c('confirmed'), color: 'bg-blue-500' },
      { key: 'completed', label: STATUS_PT.completed, count: c('completed'), color: 'bg-emerald-500' },
      { key: 'cancelled', label: STATUS_PT.cancelled, count: c('cancelled'), color: 'bg-red-400' },
    ]
  }, [appts])

  const recentOrders = useMemo(
    () => [...orders]
      .sort((a, b) => new Date((b as any).createdAt ?? 0).getTime() - new Date((a as any).createdAt ?? 0).getTime())
      .slice(0, 6),
    [orders],
  )

  // ── KPI specs (only real metrics, gated by permission) ────────────────────
  const kpis = useMemo(() => {
    const list: any[] = []
    if (canSchedule) {
      list.push({ label: 'Marcações hoje', value: apptsToday.length, sub: pendingToday ? `${pendingToday} por confirmar` : apptsToday.length ? 'tudo confirmado' : 'dia livre', icon: 'calendar', tone: 'blue', loading: loadingAppts })
      list.push({ label: 'Receita de hoje', value: fmtEur(revenueToday), sub: 'marcações pagas', icon: 'euro', tone: 'green', loading: loadingAppts })
      list.push({ label: 'Marcações · 14 dias', value: weekCount, sub: 'últimos 7 dias', icon: 'trend', tone: 'violet', loading: loadingAppts, delta: weekDelta, spark: spark14 })
    }
    if (canCustomers) list.push({ label: 'Clientes', value: customersData?.count ?? customersData?.rows?.length ?? 0, icon: 'users', tone: 'violet', loading: loadingCustomers })
    if (canProducts) list.push({ label: 'Encomendas', value: ordersData?.count ?? orders.length, icon: 'cart', tone: 'blue', loading: loadingOrders })
    return list.slice(0, 4)
  }, [canSchedule, canCustomers, canProducts, apptsToday.length, pendingToday, revenueToday, weekCount, weekDelta, spark14, customersData, ordersData, orders.length, loadingAppts, loadingCustomers, loadingOrders])

  const noAccess = !canCustomers && !canProducts && !canSchedule

  return (
    <div className="space-y-6">
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

      {noAccess && (
        <Card className="p-2">
          <EmptyState icon="dashboard" title="Sem permissões activas" desc="Contacta o administrador para teres acesso aos módulos." />
        </Card>
      )}

      {/* KPI band */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => <KpiCard key={k.label} {...k} accent="#2A6FDB" />)}
        </div>
      )}

      {/* Main — the day is the spine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {canSchedule && (
          <Card className="p-5 lg:col-span-7">
            <SectionTitle right={<span className="text-xs text-zinc-400 tabular-nums">{apptsToday.length} hoje</span>}>
              Hoje
            </SectionTitle>
            {loadingAppts
              ? <div className="space-y-3 py-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />)}</div>
              : <DayRail appts={apptsToday} colorOf={colorOf} now={now} />}
          </Card>
        )}

        {/* Right rail: status breakdown + recent orders */}
        <div className={`space-y-4 ${canSchedule ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {canSchedule && appts.length > 0 && (
            <Card className="p-5">
              <SectionTitle>Estado das marcações · {format(now, 'MMMM', { locale: pt })}</SectionTitle>
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
            </Card>
          )}

          {canProducts && !loadingOrders && recentOrders.length > 0 && (
            <Card className="p-5">
              <SectionTitle>Últimas encomendas</SectionTitle>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recentOrders.map((o, i) => (
                  <div key={(o as any).orderId ?? i} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {(o as any).customerName ?? (o as any).clientName ?? `Encomenda #${String((o as any).orderId ?? i).slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {(o as any).createdAt ? format(new Date((o as any).createdAt), 'd MMM yyyy', { locale: pt }) : '—'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtEur(Number(o.price) || 0)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {canProducts && !canSchedule && !loadingOrders && recentOrders.length === 0 && (
            <Card className="p-2"><EmptyState icon="cart" title="Sem encomendas" desc="As encomendas mais recentes aparecem aqui." /></Card>
          )}
        </div>
      </div>
    </div>
  )
}
