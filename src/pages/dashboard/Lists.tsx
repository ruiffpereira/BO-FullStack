import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../ui/icons.jsx";
import { Card, Badge, EmptyState, SectionTitle } from "../../ui/ui.jsx";
import { fmtEur } from "../../lib/money";
import { OPEN_ORDER, RowLink } from "./shared";

// ── Loja: encomendas por despachar + últimas ─────────────────────────────────
export type OrderLike = { orderId?: string; status?: string; price?: number | string; createdAt?: string; customerName?: string; clientName?: string }

export function OrdersList({ orders }: { orders: OrderLike[] }) {
  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {orders.map((o, i) => (
        <RowLink key={o.orderId ?? i} to="/loja/encomendas" ariaLabel={`Abrir encomendas`}>
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

export function FulfillmentSpine({ orders, openCount, salesToday, alerts, loading }: {
  orders: OrderLike[]; openCount: number; salesToday: number; alerts: { name: string; reference: string | null; stock: number }[]; loading?: boolean
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
        onClick={() => navigate('/loja/encomendas')}
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

export function StockAlerts({ alerts, bare = false }: { alerts: { name: string; reference: string | null; stock: number }[]; bare?: boolean }) {
  const navigate = useNavigate()
  const inner = (
    <>
      <SectionTitle right={<span className="text-xs text-zinc-400">{alerts.length}</span>}>Stock baixo</SectionTitle>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {alerts.slice(0, 6).map((s) => (
          <button
            key={s.reference || s.name}
            type="button"
            onClick={() => navigate('/loja')}
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
export function CustomersWelcome({ total, newCount, loading }: { total: number; newCount: number; loading?: boolean }) {
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
