import { useMemo } from 'react'
import { format } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Badge, PageHeader, BADGE_TONES } from '../ui/ui.jsx'
import { useGetCustomers } from '../gen/backoffice/hooks/useGetCustomers.js'
import { useGetOrders } from '../gen/backoffice/hooks/useGetOrders.js'
import { useGetScheduleAppointments } from '../gen/backoffice/hooks/useGetScheduleAppointments.js'

const fmtEur = (n: number) =>
  '€' + n.toLocaleString('pt-PT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })

function KpiCard({ label, value, sub, icon, tone, loading }: {
  label: string; value: string | number; sub?: string
  icon: string; tone: keyof typeof BADGE_TONES; loading?: boolean
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${BADGE_TONES[tone]}`}>
          <Icon name={icon} className="w-[18px] h-[18px]" />
        </div>
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <p className="text-2xl font-semibold text-zinc-900 dark:text-white mt-3 tabular-nums tracking-tight">{value}</p>
      )}
      <div className="mt-1">
        <p className="text-[13px] text-zinc-500">{label}</p>
        {sub && <p className="text-xs text-zinc-400">{sub}</p>}
      </div>
    </Card>
  )
}

export function Dashboard() {
  const { authHeader, hasPermission, username } = useAuth()
  const headers = authHeader()
  const thisMonth = format(new Date(), 'yyyy-MM')

  const canCustomers = hasPermission('VIEW_CUSTOMERS')
  const canProducts  = hasPermission('VIEW_PRODUCTS')
  const canSchedule  = hasPermission('VIEW_SCHEDULE')

  const { data: customersData, isLoading: loadingCustomers } = useGetCustomers({
    query: { enabled: canCustomers },
    client: { headers },
  })
  const { data: ordersData, isLoading: loadingOrders } = useGetOrders({
    query: { enabled: canProducts },
    client: { headers },
  })
  const { data: appointmentsData, isLoading: loadingAppts } = useGetScheduleAppointments(
    { month: thisMonth },
    { query: { enabled: canSchedule }, client: { headers } },
  )

  const totalRevenue = useMemo(() =>
    (ordersData?.rows ?? []).reduce((sum, o) => sum + (Number(o.price) || 0), 0),
  [ordersData])

  const apptsPending = useMemo(() =>
    (appointmentsData ?? []).filter((a) => a.status === 'pending').length,
  [appointmentsData])

  const apptsConfirmed = useMemo(() =>
    (appointmentsData ?? []).filter((a) => a.status === 'confirmed').length,
  [appointmentsData])

  return (
    <div>
      <PageHeader title={`Olá, ${username ?? '—'} 👋`} subtitle="Resumo do teu negócio.">
        <Badge tone="blue">{format(new Date(), 'MMMM yyyy')}</Badge>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {canCustomers && (
          <KpiCard
            label="Clientes registados"
            value={customersData?.count ?? customersData?.rows?.length ?? 0}
            icon="users" tone="violet" loading={loadingCustomers}
          />
        )}
        {canProducts && (
          <>
            <KpiCard
              label="Encomendas"
              value={ordersData?.count ?? ordersData?.rows?.length ?? 0}
              icon="cart" tone="blue" loading={loadingOrders}
            />
            <KpiCard
              label="Receita total"
              value={fmtEur(totalRevenue)}
              icon="euro" tone="green" loading={loadingOrders}
            />
          </>
        )}
        {canSchedule && (
          <KpiCard
            label="Marcações este mês"
            value={(appointmentsData ?? []).length}
            sub={`${apptsPending} por confirmar · ${apptsConfirmed} confirmadas`}
            icon="calendar" tone="amber" loading={loadingAppts}
          />
        )}
      </div>

      {/*
        TODO: Gráficos e feed de actividade recente.
        Requerem endpoints de estatísticas na API que ainda não existem:
          GET /api/stats/revenue        → série temporal de receita por mês
          GET /api/stats/appointments   → contagem de marcações por dia/semana
          GET /api/stats/categories     → distribuição de vendas por categoria
          GET /api/activity             → feed de eventos recentes agregados
      */}
      <Card className="mt-6 p-8 flex flex-col items-center justify-center gap-3 text-center border-dashed">
        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Icon name="trend" className="w-6 h-6 text-zinc-400" />
        </div>
        <div>
          <p className="font-medium text-zinc-700 dark:text-zinc-200">Gráficos em breve</p>
          <p className="text-sm text-zinc-400 mt-1">
            Os gráficos ficam disponíveis quando os endpoints de estatísticas estiverem implementados na API.
          </p>
        </div>
      </Card>
    </div>
  )
}
