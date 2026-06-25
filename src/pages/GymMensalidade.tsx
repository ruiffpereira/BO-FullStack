import { useState } from 'react'
import { useQueryClient, useMutation, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { Icon } from '../ui/icons.jsx'
import { Card, Button, IconButton, Badge, Input, Select, Toggle, Modal, EmptyState, Avatar, BADGE_TONES } from '../ui/ui.jsx'
import { useGetGymSubscriptions } from '../gen/backoffice/hooks/useGetGymSubscriptions.js'
import { postGymSubscriptions } from '../gen/backoffice/hooks/usePostGymSubscriptions.js'
import { putGymSubscriptionsId } from '../gen/backoffice/hooks/usePutGymSubscriptionsId.js'
import { deleteGymSubscriptionsId } from '../gen/backoffice/hooks/useDeleteGymSubscriptionsId.js'
import { useGetGymMensalidadeFinance } from '../gen/backoffice/hooks/useGetGymMensalidadeFinance.js'
import { useGetGymMensalidadeCustomersCustomerid } from '../gen/backoffice/hooks/useGetGymMensalidadeCustomersCustomerid.js'
import { putGymMensalidadeCustomersCustomeridSubscription } from '../gen/backoffice/hooks/usePutGymMensalidadeCustomersCustomeridSubscription.js'
import { patchGymMensalidadeCustomersCustomeridBlock } from '../gen/backoffice/hooks/usePatchGymMensalidadeCustomersCustomeridBlock.js'
import { postGymMensalidadeCustomersCustomeridPayments } from '../gen/backoffice/hooks/usePostGymMensalidadeCustomersCustomeridPayments.js'
import { deleteGymMensalidadePaymentsPaymentid } from '../gen/backoffice/hooks/useDeleteGymMensalidadePaymentsPaymentid.js'

// ── Tipos (espelham a API; PT só na UI) ──────────────────────────────────────
type Status = 'paid' | 'debt' | 'unpaid'
export type Sub = { subscriptionId: string; name: string; price: number; dueDay: number; active: boolean; clientCount?: number }
export type Payment = { paymentId: string; period: string; amount: number; dueDate: string; status: Status; paidAt: string | null; method: string | null; notes: string | null; paidAmount: number | null; debtSince: string | null; overdue: boolean }
export type Membership = { customerId: string; name: string; blocked: boolean; subscription: Sub | null; payments: Payment[]; currentPeriod: string; today: string }
type FinanceRow = { customerId: string; name: string; blocked: boolean; subscription: Sub | null; payment: Payment | null; status: Status; overdue: boolean }
type Finance = { period: string; today: string; kpis: { recebido: number; emDivida: number; emAtraso: number; mrr: number; blocked: number }; rows: FinanceRow[] }

// ── Helpers de apresentação ──────────────────────────────────────────────────
const EST: Record<Status, { t: string; tone: keyof typeof BADGE_TONES }> = {
  paid: { t: 'Pago', tone: 'green' },
  debt: { t: 'Em dívida', tone: 'amber' },
  unpaid: { t: 'Não pago', tone: 'neutral' },
}
const METODOS = ['Numerário', 'MB Way', 'Transferência', 'Multibanco', 'Cartão']
const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const fmtEur = (n: number) => eur.format(n ?? 0)
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmtPeriodo = (p?: string) => { if (!p) return '—'; const [y, m] = p.split('-'); return `${MES[+m - 1]} ${y}` }
const fmtData = (s?: string | null) => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${+d} ${MES[+m - 1]} ${y}` }
const AV_COLORS = ['#2A6FDB', '#1F8A5B', '#D97757', '#E6B450', '#7C5CDB', '#0EA5A4', '#DB2777']
const colorFromName = (name: string) => { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return AV_COLORS[Math.abs(h) % AV_COLORS.length] }

// Invalida tudo o que depende de mensalidades/subscrições.
const invalidateMens = (qc: QueryClient) =>
  qc.invalidateQueries({
    predicate: (q) => {
      const k = JSON.stringify(q.queryKey)
      return k.includes('/gym/mensalidade') || k.includes('/gym/subscriptions')
    },
  })
const dueInput = 'bg-white dark:bg-zinc-900 border rounded-lg px-2 py-1 text-[13px] tabular-nums'

// ── Catálogo: editor de subscrição ───────────────────────────────────────────
function SubscricaoModal({ subscricao, onClose, onSaved }: { subscricao: Sub | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(subscricao?.name ?? '')
  const [price, setPrice] = useState(subscricao ? String(subscricao.price) : '')
  const [dueDay, setDueDay] = useState(subscricao?.dueDay ?? 8)
  const [active, setActive] = useState(subscricao?.active ?? true)
  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), price: parseFloat(price) || 0, dueDay: +dueDay || 8, active } as any
      return subscricao ? putGymSubscriptionsId(subscricao.subscriptionId, body) : postGymSubscriptions(body)
    },
    onSuccess: () => { onSaved(); toast.success(subscricao ? 'Subscrição atualizada' : 'Subscrição criada'); onClose() },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Modal open onClose={onClose} width="max-w-md" title={subscricao ? 'Editar subscrição' : 'Nova subscrição'} subtitle="Mensalidade que podes atribuir aos clientes."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" isLoading={save.isPending} disabled={!name.trim() || price === ''} onClick={() => save.mutate()}>{subscricao ? 'Guardar' : 'Criar'}</Button></>}>
      <div className="space-y-4">
        <Input label="Nome" placeholder="Ex: 2x / semana" value={name} onChange={(e: any) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Preço (€/mês)" type="number" placeholder="28" value={price} onChange={(e: any) => setPrice(e.target.value)} />
          <label className="block"><span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Dia de vencimento</span>
            <Select value={String(dueDay)} onChange={(e: any) => setDueDay(+e.target.value)}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Dia {d}</option>)}
            </Select>
          </label>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
          <div><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Ativa</p><p className="text-xs text-zinc-400">Disponível para atribuir a clientes.</p></div>
          <Toggle checked={active} onChange={setActive} />
        </div>
      </div>
    </Modal>
  )
}

function SubscricoesTab() {
  const qc = useQueryClient()
  const { data } = useGetGymSubscriptions()
  const subs = (data ?? []) as Sub[]
  const [modal, setModal] = useState<{ sub: Sub | null } | null>(null)
  const [confirmDel, setConfirmDel] = useState<Sub | null>(null)
  const del = useMutation({
    mutationFn: (id: string) => deleteGymSubscriptionsId(id),
    onSuccess: () => { invalidateMens(qc); toast.success('Subscrição eliminada') },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">{subs.length} subscrições no catálogo</p>
        <Button icon="plus" size="sm" onClick={() => setModal({ sub: null })}>Nova subscrição</Button>
      </div>
      {subs.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subs.map((s) => (
            <Card key={s.subscriptionId} className="p-5 group">
              <div className="flex items-start justify-between">
                <span className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="euro" className="w-5 h-5" /></span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <IconButton icon="edit" label="Editar" onClick={() => setModal({ sub: s })} />
                  <IconButton icon="trash" label="Eliminar" className="hover:text-red-500" onClick={() => setConfirmDel(s)} />
                </div>
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mt-3">{s.name}</h3>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">{fmtEur(s.price)}</span>
                <span className="text-sm text-zinc-400">/mês</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800 text-[13px]">
                <span className="inline-flex items-center gap-1.5 text-zinc-500"><Icon name="user" className="w-3.5 h-3.5" /><span className="font-medium text-zinc-800 dark:text-zinc-100">{s.clientCount ?? 0}</span> clientes · vence dia {s.dueDay}</span>
                {s.active ? <Badge tone="green" dot>Ativa</Badge> : <Badge tone="neutral">Inativa</Badge>}
              </div>
            </Card>
          ))}
        </div>
      ) : <Card><EmptyState icon="euro" title="Sem subscrições" desc="Cria a primeira mensalidade do catálogo." action={<Button icon="plus" onClick={() => setModal({ sub: null })}>Nova subscrição</Button>} /></Card>}

      {modal && <SubscricaoModal subscricao={modal.sub} onClose={() => setModal(null)} onSaved={() => invalidateMens(qc)} />}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Eliminar subscrição?"
        footer={<><Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancelar</Button><Button variant="danger" isLoading={del.isPending} onClick={() => { if (confirmDel) del.mutate(confirmDel.subscriptionId); setConfirmDel(null) }}>Eliminar</Button></>}>
        <p className="text-sm text-zinc-500">Os clientes ligados ficam sem subscrição; os pagamentos mantêm-se. Continuar?</p>
      </Modal>
    </div>
  )
}

// ── Atribuir subscrição a um cliente ─────────────────────────────────────────
function AtribuirSubModal({ customerId, current, onClose, onSaved }: { customerId: string; current: string | null; onClose: () => void; onSaved: () => void }) {
  const { data } = useGetGymSubscriptions()
  const subs = ((data ?? []) as Sub[]).filter((s) => s.active || s.subscriptionId === current)
  const [sel, setSel] = useState<string | null>(current)
  const save = useMutation({
    mutationFn: () => putGymMensalidadeCustomersCustomeridSubscription(customerId, { subscriptionId: sel } as any),
    onSuccess: () => { onSaved(); toast.success('Subscrição atualizada'); onClose() },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Modal open onClose={onClose} width="max-w-md" title="Atribuir subscrição"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" isLoading={save.isPending} onClick={() => save.mutate()}>Guardar</Button></>}>
      <div className="space-y-2">
        {subs.map((s) => (
          <button key={s.subscriptionId} onClick={() => setSel(s.subscriptionId)} className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${sel === s.subscriptionId ? 'border-accent bg-accent/[0.04]' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}>
            <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="euro" className="w-[18px] h-[18px]" /></span>
            <div className="min-w-0 flex-1"><p className="font-medium text-zinc-900 dark:text-white">{s.name}</p><p className="text-xs text-zinc-400">{fmtEur(s.price)}/mês · vence dia {s.dueDay}</p></div>
            {sel === s.subscriptionId && <Icon name="check" className="w-5 h-5 text-accent" />}
          </button>
        ))}
        <button onClick={() => setSel(null)} className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${sel === null ? 'border-accent bg-accent/[0.04]' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}>
          <span className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0"><Icon name="x" className="w-[18px] h-[18px]" /></span>
          <span className="text-sm text-zinc-500 flex-1">Sem subscrição</span>
          {sel === null && <Icon name="check" className="w-5 h-5 text-accent" />}
        </button>
      </div>
    </Modal>
  )
}

// ── Registar pagamento (marcar paga) ─────────────────────────────────────────
function PagamentoModal({ customerId, period, amount, onClose, onSaved }: { customerId: string; period: string; amount: number; onClose: () => void; onSaved: () => void }) {
  const [valor, setValor] = useState(String(amount ?? ''))
  const [metodo, setMetodo] = useState(METODOS[1])
  const [pagoEm, setPagoEm] = useState(new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState('')
  const save = useMutation({
    mutationFn: () => postGymMensalidadeCustomersCustomeridPayments(customerId, { period, status: 'paid', amount: parseFloat(valor) || 0, paidAt: pagoEm, method: metodo, notes: notas.trim() || null } as any),
    onSuccess: () => { onSaved(); toast.success('Pagamento registado'); onClose() },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Modal open onClose={onClose} width="max-w-sm" title="Registar pagamento" subtitle={fmtPeriodo(period)}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" isLoading={save.isPending} onClick={() => save.mutate()}>Marcar paga</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor (€)" type="number" value={valor} onChange={(e: any) => setValor(e.target.value)} />
          <label className="block"><span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Data</span><input type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 px-3 py-2 focus:outline-none focus:border-accent" /></label>
        </div>
        <Select label="Método" value={metodo} onChange={(e: any) => setMetodo(e.target.value)}>{METODOS.map((m) => <option key={m}>{m}</option>)}</Select>
        <Input label="Notas (opcional)" value={notas} onChange={(e: any) => setNotas(e.target.value)} />
      </div>
    </Modal>
  )
}

// ── Painel de mensalidade de UM cliente (partilhado) ─────────────────────────
export function ClienteMensalidade({ customerId }: { customerId: string }) {
  const qc = useQueryClient()
  const { data, isLoading } = useGetGymMensalidadeCustomersCustomerid(customerId, { query: { enabled: !!customerId } })
  const mem = data as Membership | undefined
  const [atribuir, setAtribuir] = useState(false)
  const [pagModal, setPagModal] = useState<{ period: string; amount: number } | null>(null)

  const onSaved = () => invalidateMens(qc)
  const upsert = useMutation({
    mutationFn: (body: any) => postGymMensalidadeCustomersCustomeridPayments(customerId, body),
    onSuccess: onSaved, onError: (e) => toast.error(getApiError(e)),
  })
  const block = useMutation({
    mutationFn: (v: boolean) => patchGymMensalidadeCustomersCustomeridBlock(customerId, { blocked: v } as any),
    onSuccess: onSaved, onError: (e) => toast.error(getApiError(e)),
  })

  if (isLoading || !mem) return <Card className="p-6 text-center text-zinc-400">A carregar mensalidade…</Card>
  const sub = mem.subscription
  const period = mem.currentPeriod
  const pagAtual = mem.payments.find((p) => p.period === period) ?? null
  const estado: Status = pagAtual?.status ?? 'unpaid'
  const atraso = pagAtual?.overdue ?? false
  const setEstado = (st: Status) => {
    if (st === 'paid') { setPagModal({ period, amount: pagAtual?.amount ?? sub?.price ?? 0 }); return }
    upsert.mutate({ period, status: st })
  }

  return (
    <div className="space-y-4">
      {mem.blocked && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <Icon name="ban" className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">Cliente <strong>bloqueado</strong> por falta de pagamento. O acesso fica suspenso até desbloquear.</p>
          <Button variant="outline" size="sm" onClick={() => block.mutate(false)}>Desbloquear</Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Subscrição + bloqueio */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2"><Icon name="euro" className="w-4 h-4 text-zinc-400" />Subscrição</h3>
            <Button variant="ghost" size="sm" icon={sub ? 'edit' : 'plus'} onClick={() => setAtribuir(true)}>{sub ? 'Trocar' : 'Atribuir'}</Button>
          </div>
          {sub ? (
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="euro" className="w-5 h-5" /></span>
              <div><p className="font-medium text-zinc-900 dark:text-white">{sub.name}</p><p className="text-sm text-zinc-500"><span className="font-semibold text-zinc-800 dark:text-zinc-100">{fmtEur(sub.price)}</span>/mês · vence dia {sub.dueDay}</p></div>
            </div>
          ) : <p className="text-sm text-zinc-400 py-2">Sem subscrição atribuída.</p>}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800">
            <div><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Bloqueado</p><p className="text-xs text-zinc-400">Suspende o acesso do cliente.</p></div>
            <Toggle checked={mem.blocked} onChange={(v: boolean) => block.mutate(v)} />
          </div>
        </Card>

        {/* Mês atual */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2"><Icon name="calendar" className="w-4 h-4 text-zinc-400" />{fmtPeriodo(period)}</h3>
            <Badge tone={atraso ? 'red' : EST[estado].tone} dot>{atraso ? 'Em atraso' : EST[estado].t}</Badge>
          </div>
          {pagAtual ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Vencimento</span>
                <input type="date" value={pagAtual.dueDate} onChange={(e) => upsert.mutate({ period, dueDate: e.target.value })} className={`ml-auto ${dueInput} ${atraso ? 'border-red-300 text-red-600 dark:text-red-400' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'}`} />
              </div>
              {estado === 'paid' && <p className="text-xs text-zinc-400">Pago em {fmtData(pagAtual.paidAt)}{pagAtual.method ? ` · ${pagAtual.method}` : ''}</p>}
              {estado === 'debt' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-500">Em dívida desde</span>
                    <input type="date" value={pagAtual.debtSince ?? mem.today} onChange={(e) => upsert.mutate({ period, debtSince: e.target.value })} className={`ml-auto ${dueInput} border-amber-300 dark:border-amber-500/40 text-amber-600 dark:text-amber-400`} />
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-500">Já pagou</span>
                    <div className="ml-auto relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">€</span><input type="number" defaultValue={pagAtual.paidAmount ?? 0} onBlur={(e) => upsert.mutate({ period, paidAmount: e.target.value === '' ? 0 : +e.target.value })} className={`w-24 ${dueInput} pl-5 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100`} /></div>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-500">Em falta</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{fmtEur(Math.max(0, (pagAtual.amount || 0) - (pagAtual.paidAmount || 0)))}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setEstado('paid')} className={`py-2 rounded-lg text-[13px] font-medium border transition ${estado === 'paid' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-emerald-400 hover:text-emerald-600'}`}>Paga</button>
                <button onClick={() => setEstado('debt')} className={`py-2 rounded-lg text-[13px] font-medium border transition ${estado === 'debt' ? 'bg-amber-500 text-white border-amber-500' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-amber-400 hover:text-amber-600'}`}>Em dívida</button>
                <button onClick={() => setEstado('unpaid')} className={`py-2 rounded-lg text-[13px] font-medium border transition ${estado === 'unpaid' ? 'bg-zinc-700 text-white border-zinc-700' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400'}`}>Não pago</button>
              </div>
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-sm text-zinc-400 mb-3">Ainda não há registo para este mês.</p>
              <Button size="sm" icon="plus" disabled={!sub || upsert.isPending} onClick={() => upsert.mutate({ period, status: 'unpaid' })}>Gerar mês</Button>
              {!sub && <p className="text-xs text-zinc-400 mt-2">Atribui uma subscrição primeiro.</p>}
            </div>
          )}
        </Card>
      </div>

      {/* Histórico de pagamentos */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800"><h3 className="font-semibold text-zinc-900 dark:text-white">Histórico de pagamentos</h3></div>
        {mem.payments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="font-medium px-5 py-3">Mês</th><th className="font-medium px-4 py-3">Valor</th>
                <th className="font-medium px-4 py-3 hidden sm:table-cell">Vencimento</th><th className="font-medium px-4 py-3">Estado</th>
                <th className="font-medium px-4 py-3 hidden md:table-cell">Método</th>
              </tr></thead>
              <tbody>
                {mem.payments.map((p) => (
                  <tr key={p.paymentId} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                    <td className="px-5 py-3 font-medium text-zinc-900 dark:text-white">{fmtPeriodo(p.period)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 tabular-nums">{fmtEur(p.amount)}</td>
                    <td className={`px-4 py-3 tabular-nums hidden sm:table-cell ${p.overdue ? 'text-red-500 font-medium' : 'text-zinc-400'}`}>{fmtData(p.dueDate)}</td>
                    <td className="px-4 py-3"><Badge tone={p.overdue ? 'red' : EST[p.status].tone} dot>{p.overdue ? 'Em atraso' : EST[p.status].t}</Badge></td>
                    <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{p.status === 'paid' ? (p.method || '—') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="euro" title="Sem pagamentos" desc="Ainda não há registos de mensalidade para este cliente." />}
      </Card>

      {atribuir && <AtribuirSubModal customerId={customerId} current={sub?.subscriptionId ?? null} onClose={() => setAtribuir(false)} onSaved={onSaved} />}
      {pagModal && <PagamentoModal customerId={customerId} period={pagModal.period} amount={pagModal.amount} onClose={() => setPagModal(null)} onSaved={onSaved} />}
    </div>
  )
}

// ── Tab principal: Financeiro do ginásio (Mensalidades + Subscrições) ─────────
function StatCard({ icon, tone, label, value }: { icon: string; tone: keyof typeof BADGE_TONES; label: string; value: string | number }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${BADGE_TONES[tone]}`}><Icon name={icon} className="w-5 h-5" /></span>
      <div><p className="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">{value}</p><p className="text-[13px] text-zinc-500">{label}</p></div>
    </Card>
  )
}

export function MensalidadesTab() {
  const qc = useQueryClient()
  const [aba, setAba] = useState<'mensalidades' | 'subscricoes'>('mensalidades')
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null)
  const { data, isLoading } = useGetGymMensalidadeFinance()
  const fin = data as Finance | undefined

  const marcar = useMutation({
    mutationFn: ({ customerId, status }: { customerId: string; status: Status }) =>
      postGymMensalidadeCustomersCustomeridPayments(customerId, { status } as any),
    onSuccess: () => invalidateMens(qc), onError: (e) => toast.error(getApiError(e)),
  })

  if (sel) {
    return (
      <div>
        <button onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-5"><Icon name="chevronLeft" className="w-4 h-4" />Voltar ao financeiro</button>
        <div className="flex items-center gap-3 mb-5">
          <Avatar name={sel.name} color={colorFromName(sel.name)} size={48} />
          <div><h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{sel.name}</h2><p className="text-sm text-zinc-500">Mensalidade</p></div>
        </div>
        <ClienteMensalidade customerId={sel.id} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1 p-1 mb-5 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl w-full sm:w-auto sm:inline-flex">
        {([['mensalidades', 'Mensalidades', 'euro'], ['subscricoes', 'Subscrições', 'layers']] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setAba(id)} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${aba === id ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
            <Icon name={icon} className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {aba === 'subscricoes' && <SubscricoesTab />}

      {aba === 'mensalidades' && (
        isLoading || !fin ? <Card className="p-8 text-center text-zinc-400">A carregar…</Card> : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-zinc-500">Estado de {fmtPeriodo(fin.period)} · {fin.rows.length} clientes</p>
              {fin.kpis.blocked > 0 && <Badge tone="red" dot>{fin.kpis.blocked} bloqueado{fin.kpis.blocked !== 1 ? 's' : ''}</Badge>}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <StatCard icon="euro" tone="green" label="Recebido este mês" value={fmtEur(fin.kpis.recebido)} />
              <StatCard icon="clock" tone="amber" label="Em dívida" value={fmtEur(fin.kpis.emDivida)} />
              <StatCard icon="ban" tone="red" label="Em atraso" value={fin.kpis.emAtraso} />
              <StatCard icon="trend" tone="blue" label="MRR potencial" value={fmtEur(fin.kpis.mrr)} />
            </div>

            {fin.rows.length ? (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                      <th className="font-medium px-4 sm:px-5 py-3">Cliente</th>
                      <th className="font-medium px-4 py-3 hidden sm:table-cell">Subscrição</th>
                      <th className="font-medium px-4 py-3">Valor</th>
                      <th className="font-medium px-4 py-3 hidden md:table-cell">Vencimento</th>
                      <th className="font-medium px-4 py-3">Estado</th>
                      <th className="font-medium px-4 py-3 text-right">Ações</th>
                    </tr></thead>
                    <tbody>
                      {fin.rows.map((r) => (
                        <tr key={r.customerId} onClick={() => setSel({ id: r.customerId, name: r.name })} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 cursor-pointer">
                          <td className="px-4 sm:px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={r.name} color={colorFromName(r.name)} size={30} />
                              <div className="min-w-0"><p className="font-medium text-zinc-900 dark:text-white truncate">{r.name}</p>{r.blocked && <span className="text-[11px] text-red-500 font-medium">Bloqueado</span>}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">{r.subscription ? r.subscription.name : '—'}</td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 tabular-nums">{r.subscription ? fmtEur(r.payment ? r.payment.amount : r.subscription.price) : '—'}</td>
                          <td className={`px-4 py-3 tabular-nums hidden md:table-cell ${r.overdue ? 'text-red-500 font-medium' : 'text-zinc-400'}`}>{r.payment ? fmtData(r.payment.dueDate) : '—'}</td>
                          <td className="px-4 py-3"><Badge tone={r.overdue ? 'red' : EST[r.status].tone} dot>{r.overdue ? 'Em atraso' : EST[r.status].t}</Badge></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {r.status !== 'paid' && <button onClick={(e) => { e.stopPropagation(); marcar.mutate({ customerId: r.customerId, status: 'paid' }) }} className="px-2 py-1 rounded-md text-[12px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">Paga</button>}
                              {r.status !== 'debt' && <button onClick={(e) => { e.stopPropagation(); marcar.mutate({ customerId: r.customerId, status: 'debt' }) }} className="px-2 py-1 rounded-md text-[12px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10">Dívida</button>}
                              <Icon name="chevronRight" className="w-4 h-4 text-zinc-300" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : <Card><EmptyState icon="euro" title="Sem clientes com mensalidade" desc="Atribui uma subscrição a um cliente (na ficha do cliente) para aparecer aqui." /></Card>}
          </div>
        )
      )}
    </div>
  )
}
