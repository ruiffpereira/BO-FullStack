import { useMemo } from 'react'
import { format, isThisWeek } from 'date-fns'
import { pt } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Badge, PageHeader, BADGE_TONES } from '../ui/ui.jsx'
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

function KpiCard({ label, value, sub, icon, tone, loading, delta }: {
  label: string; value: string | number; sub?: string
  icon: string; tone: keyof typeof BADGE_TONES; loading?: boolean; delta?: number
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${BADGE_TONES[tone]}`}>
          <Icon name={icon} className="w-[18px] h-[18px]" />
        </div>
        {delta !== undefined && delta !== 0 && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} className="w-3 h-3" />
            {Math.abs(delta)}
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <p className="text-2xl font-semibold text-zinc-900 dark:text-white mt-3 tabular-nums tracking-tight">{value}</p>
      )}
      <div className="mt-1">
        <p className="text-[13px] text-zinc-500">{label}</p>
        {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">{children}</h2>
}

export function Dashboard() {
  const { authHeader, hasPermission, username } = useAuth()
  const headers = authHeader()
  const thisMonth = format(new Date(), 'yyyy-MM')
  const today = format(new Date(), 'yyyy-MM-dd')

  const canCustomers = hasPermission('VIEW_CUSTOMERS')
  const canProducts  = hasPermission('VIEW_PRODUCTS')
  const canSchedule  = hasPermission('VIEW_SCHEDULE')

  const { data: customersData, isLoading: loadingCustomers } = useGetCustomers({
    query: { enabled: canCustomers },
    client: { headers },
  })
  const { data: ordersData, isLoading: loadingOrders } = useGetOrders(
    undefined,
    {
      query: { enabled: canProducts },
      client: { headers },
    },
  )
  const { data: appointmentsData, isLoading: loadingAppts } = useGetScheduleAppointments(
    { month: thisMonth },
    { query: { enabled: canSchedule }, client: { headers } },
  )
  const { data: servicesData } = useGetScheduleServices({
    query: { enabled: canSchedule },
    client: { headers },
  })

  const appts   = useMemo(() => appointmentsData ?? [], [appointmentsData])
  const orders  = useMemo(() => ordersData?.rows ?? [], [ordersData])
  const services = useMemo(() => servicesData ?? [], [servicesData])

  // ── Schedule computed stats ───────────────────────────────────────────────
  const apptsToday    = useMemo(() => appts.filter((a) => a.date === today), [appts, today])
  const apptsThisWeek = useMemo(() => appts.filter((a) => isThisWeek(new Date(a.date + 'T00:00:00'), { weekStartsOn: 1 })), [appts])
  const apptsPending  = useMemo(() => appts.filter((a) => a.status === 'pending'), [appts])
  const apptsCompleted = useMemo(() => appts.filter((a) => a.status === 'completed'), [appts])
  const apptsCancelled = useMemo(() => appts.filter((a) => a.status === 'cancelled'), [appts])
  const apptsConfirmed = useMemo(() => appts.filter((a) => a.status === 'confirmed'), [appts])

  const apptRevenue = useMemo(() =>
    apptsCompleted.reduce((sum, a) => {
      const cash = Number((a as any).paymentCash || 0)
      const mbway = Number((a as any).paymentMbway || 0)
      const card  = Number((a as any).paymentCard || 0)
      return sum + cash + mbway + card
    }, 0),
  [apptsCompleted])

  // ── Ecommerce stats ───────────────────────────────────────────────────────
  const ordersRevenue = useMemo(() =>
    orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0),
  [orders])

  // ── Activity feeds ────────────────────────────────────────────────────────
  const recentAppts = useMemo(() =>
    [...appts]
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
      .slice(0, 6),
  [appts])

  const recentOrders = useMemo(() =>
    [...orders]
      .sort((a, b) => new Date((b as any).createdAt ?? 0).getTime() - new Date((a as any).createdAt ?? 0).getTime())
      .slice(0, 5),
  [orders])

  const serviceMap = useMemo(() =>
    Object.fromEntries(services.map((s) => [s.serviceId, s.name])),
  [services])

  return (
    <div className="space-y-6">
      <PageHeader title={`Olá, ${username ?? '—'}`} subtitle={`Resumo de ${format(new Date(), 'MMMM yyyy', { locale: pt })}.`}>
        <Badge tone="blue">{format(new Date(), 'EEEE, d MMM', { locale: pt })}</Badge>
      </PageHeader>

      {/* ── KPI grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {canCustomers && (
          <KpiCard
            label="Clientes registados"
            value={customersData?.count ?? customersData?.rows?.length ?? 0}
            icon="users" tone="violet" loading={loadingCustomers}
          />
        )}
        {canSchedule && (
          <>
            <KpiCard
              label="Marcações hoje"
              value={apptsToday.length}
              sub={apptsToday.length === 0 ? 'Nenhuma marcação hoje' : `${apptsToday.filter(a => a.status === 'pending').length} por confirmar`}
              icon="clock" tone="amber" loading={loadingAppts}
            />
            <KpiCard
              label="Esta semana"
              value={apptsThisWeek.length}
              sub={`${appts.length} no total este mês`}
              icon="calendar" tone="blue" loading={loadingAppts}
            />
            {apptRevenue > 0 && (
              <KpiCard
                label="Receita marcações"
                value={fmtEur(apptRevenue)}
                sub={`${apptsCompleted.length} concluídas`}
                icon="euro" tone="green" loading={loadingAppts}
              />
            )}
          </>
        )}
        {canProducts && (
          <>
            <KpiCard
              label="Encomendas"
              value={ordersData?.count ?? orders.length}
              icon="cart" tone="blue" loading={loadingOrders}
            />
            <KpiCard
              label="Receita loja"
              value={fmtEur(ordersRevenue)}
              icon="euro" tone="green" loading={loadingOrders}
            />
          </>
        )}
      </div>

      {/* ── Schedule breakdown + recent ── */}
      {canSchedule && !loadingAppts && appts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Status breakdown */}
          <Card className="p-5">
            <SectionTitle>Estado das marcações</SectionTitle>
            <div className="space-y-3">
              {[
                { key: 'pending',   label: STATUS_PT.pending,   count: apptsPending.length,  color: 'bg-amber-400' },
                { key: 'confirmed', label: STATUS_PT.confirmed, count: apptsConfirmed.length, color: 'bg-blue-500' },
                { key: 'completed', label: STATUS_PT.completed, count: apptsCompleted.length, color: 'bg-emerald-500' },
                { key: 'cancelled', label: STATUS_PT.cancelled, count: apptsCancelled.length, color: 'bg-red-400' },
              ].map(({ key, label, count, color }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
                  <span className="text-sm text-zinc-600 dark:text-zinc-300 flex-1">{label}</span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white tabular-nums w-6 text-right">{count}</span>
                  <div className="w-16 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all`}
                      style={{ width: appts.length > 0 ? `${Math.round((count / appts.length) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                {appts.length} marcações em {format(new Date(), 'MMMM', { locale: pt })}
              </p>
            </div>
          </Card>

          {/* Recent appointments */}
          <Card className="p-5 lg:col-span-2">
            <SectionTitle>Últimas marcações</SectionTitle>
            {recentAppts.length === 0 ? (
              <p className="text-sm text-zinc-400">Sem marcações este mês.</p>
            ) : (
              <div className="space-y-1">
                {recentAppts.map((a) => (
                  <div key={a.appointmentId} className="flex items-center gap-3 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{a.clientName}</p>
                      <p className="text-xs text-zinc-400 truncate">{serviceMap[a.serviceId] ?? '—'} · {a.date} {a.time.slice(0, 5)}</p>
                    </div>
                    <Badge tone={STATUS_TONE[a.status] as any ?? 'zinc'}>
                      {STATUS_PT[a.status] ?? a.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Agenda hoje ── */}
      {canSchedule && !loadingAppts && apptsToday.length > 0 && (
        <Card className="p-5">
          <SectionTitle>Agenda de hoje</SectionTitle>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[...apptsToday]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((a) => (
                <div key={a.appointmentId} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm font-mono font-medium text-zinc-500 dark:text-zinc-400 w-12 shrink-0">{a.time.slice(0, 5)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{a.clientName}</p>
                    <p className="text-xs text-zinc-400">{serviceMap[a.serviceId] ?? '—'}</p>
                  </div>
                  <Badge tone={STATUS_TONE[a.status] as any ?? 'zinc'}>{STATUS_PT[a.status] ?? a.status}</Badge>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* ── Últimas encomendas ── */}
      {canProducts && !loadingOrders && recentOrders.length > 0 && (
        <Card className="p-5">
          <SectionTitle>Últimas encomendas</SectionTitle>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentOrders.map((o, i) => (
              <div key={(o as any).orderId ?? i} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {(o as any).customerName ?? (o as any).clientName ?? `Encomenda #${String((o as any).orderId ?? i).slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {(o as any).createdAt ? format(new Date((o as any).createdAt), 'd MMM yyyy', { locale: pt }) : '—'}
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {fmtEur(Number(o.price) || 0)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Empty / no permissions ── */}
      {!canCustomers && !canProducts && !canSchedule && (
        <Card className="p-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Icon name="dashboard" className="w-6 h-6 text-zinc-400" />
          </div>
          <div>
            <p className="font-medium text-zinc-700 dark:text-zinc-200">Sem permissões activas</p>
            <p className="text-sm text-zinc-400 mt-1">Contacta o administrador para ter acesso aos módulos.</p>
          </div>
        </Card>
      )}
    </div>
  )
}
