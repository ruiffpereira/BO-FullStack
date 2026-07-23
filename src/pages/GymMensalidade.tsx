import { useState, useEffect } from 'react'
import { useQueryClient, useMutation, keepPreviousData, type QueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { fmtEur } from '../lib/money'
import { colorFromName } from '../lib/avatarColor'
import { Icon } from '../ui/icons.jsx'
import { Card, Button, IconButton, Badge, Input, Toggle, Modal, EmptyState, Avatar, BADGE_TONES } from '../ui/ui.jsx'
import { GuardButton } from '../components/GuardButton'
import { Combobox } from '../components/Combobox'
import { DatePicker } from '../components/DatePicker'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PriceFillChip } from '../components/PriceFillChip'
import { LineChart, Waterfall } from '../ui/charts.jsx'
import { useGymAnalytics } from '../hooks/useGymAnalytics'
import { useAuth } from '../context/AuthContext'
import { useWriteGuard } from '../hooks/useWriteGuard'
import { gymBulkMarkPaid, gymRemind, gymSetPayOnly } from '../hooks/useFinanceiro'
import { InfoDot } from '../components/financeiro/kit'
import { INFO } from '../components/financeiro/info'
import { usePagination, Pagination } from '../components/Pagination'
import { PAY_METHODS, payMethodLabel, type PayMethod } from '../lib/gymPayMethod'
import { useGetGymSubscriptions } from '../gen/backoffice/hooks/useGetGymSubscriptions.js'
import { postGymSubscriptions } from '../gen/backoffice/hooks/usePostGymSubscriptions.js'
import { putGymSubscriptionsId } from '../gen/backoffice/hooks/usePutGymSubscriptionsId.js'
import { deleteGymSubscriptionsId } from '../gen/backoffice/hooks/useDeleteGymSubscriptionsId.js'
import { postGymMembersInvite } from '../gen/backoffice/hooks/usePostGymMembersInvite.js'
import { useGetGymMensalidadeFinance } from '../gen/backoffice/hooks/useGetGymMensalidadeFinance.js'
import { useGetGymMensalidadeCustomersCustomerid } from '../gen/backoffice/hooks/useGetGymMensalidadeCustomersCustomerid.js'
import { putGymMensalidadeCustomersCustomeridSubscription } from '../gen/backoffice/hooks/usePutGymMensalidadeCustomersCustomeridSubscription.js'
import { patchGymMensalidadeCustomersCustomeridBlock } from '../gen/backoffice/hooks/usePatchGymMensalidadeCustomersCustomeridBlock.js'
import { postGymMensalidadeCustomersCustomeridPayments } from '../gen/backoffice/hooks/usePostGymMensalidadeCustomersCustomeridPayments.js'
import type { GymSubscription } from '../gen/backoffice/types/GymSubscription.js'
import type { GymPayment } from '../gen/backoffice/types/GymPayment.js'
import type { GymMembership } from '../gen/backoffice/types/GymMembership.js'
import type { GymFinance } from '../gen/backoffice/types/GymFinance.js'
import type { PostGymMensalidadeCustomersCustomeridPaymentsMutationRequest } from '../gen/backoffice/types/PostGymMensalidadeCustomersCustomeridPayments.js'
import type { PostGymMembersInviteMutationRequest } from '../gen/backoffice/types/PostGymMembersInvite.js'

// ── Tipos: gerados pelo Kubb a partir do spec (fim dos contratos à mão) ──────
type Status = GymPayment['status']
export type Sub = GymSubscription
export type Payment = GymPayment
export type Membership = GymMembership
type FinanceRow = GymFinance['rows'][number]
type Finance = GymFinance

// ── Helpers de apresentação ──────────────────────────────────────────────────
const EST: Record<Status, { t: string; tone: keyof typeof BADGE_TONES }> = {
  paid: { t: 'Pago', tone: 'green' },
  debt: { t: 'Em dívida', tone: 'amber' },
  unpaid: { t: 'Não pago', tone: 'neutral' },
}
// Tema visual por estado do mês (inclui "overdue", que é derivado na API e não persistido).
const STATUS_VIEW: Record<'paid' | 'debt' | 'unpaid' | 'overdue', {
  label: string; tone: keyof typeof BADGE_TONES; icon: string; tint: string; fg: string; bar: string
}> = {
  paid: { label: 'Pago', tone: 'green', icon: 'check', tint: 'bg-emerald-50 dark:bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  debt: { label: 'Em dívida', tone: 'amber', icon: 'clock', tint: 'bg-amber-50 dark:bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
  overdue: { label: 'Em atraso', tone: 'red', icon: 'alertTriangle', tint: 'bg-red-50 dark:bg-red-500/10', fg: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' },
  unpaid: { label: 'Não pago', tone: 'neutral', icon: 'euro', tint: 'bg-zinc-100 dark:bg-zinc-800', fg: 'text-zinc-500 dark:text-zinc-400', bar: 'bg-zinc-300 dark:bg-zinc-600' },
}
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmtPeriodo = (p?: string) => { if (!p) return '—'; const [y, m] = p.split('-'); return `${MES[+m - 1]} ${y}` }
const MES_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const fmtPeriodoLong = (p?: string) => { if (!p) return '—'; const [y, m] = p.split('-'); return `${MES_LONG[+m - 1]} ${y}` }
const fmtData = (s?: string | null) => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${+d} ${MES[+m - 1]} ${y}` }
const pad2 = (n: number) => String(n).padStart(2, '0')
const shiftPeriod = (period: string, delta: number) => { const [y, m] = period.split('-').map(Number); const d = new Date(y, (m - 1) + delta, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` }
const dueForPeriod = (period: string, dueDay = 8) => `${period}-${pad2(Math.min(28, Math.max(1, dueDay)))}`
const daysUntil = (iso: string, today: string) => Math.round((Date.parse(iso) - Date.parse(today)) / 86400000)
const fmtDateTime = (iso?: string | null) => { if (!iso) return '—'; return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
const currentPeriod = () => format(new Date(), 'yyyy-MM')

// Invalida tudo o que depende de mensalidades/subscrições + agregados do dashboard e financeiro.
const invalidateMens = (qc: QueryClient) =>
  qc.invalidateQueries({
    predicate: (q) => {
      const k = JSON.stringify(q.queryKey)
      return k.includes('/gym/mensalidade') || k.includes('/gym/subscriptions') || k.includes('dashboard') || k.includes('financeiro')
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
      const body = { name: name.trim(), price: parseFloat(price) || 0, dueDay: +dueDay || 8, active }
      return subscricao ? putGymSubscriptionsId(subscricao.subscriptionId, body) : postGymSubscriptions(body)
    },
    onSuccess: () => { onSaved(); toast.success(subscricao ? 'Subscrição atualizada' : 'Subscrição criada'); onClose() },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Modal open onClose={onClose} width="max-w-md" title={subscricao ? 'Editar subscrição' : 'Nova subscrição'} subtitle="Mensalidade que podes atribuir aos clientes."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><GuardButton icon="check" isLoading={save.isPending} disabled={!name.trim() || price === ''} onClick={() => save.mutate()}>{subscricao ? 'Guardar' : 'Criar'}</GuardButton></>}>
      <div className="space-y-4">
        <Input label="Nome" placeholder="Ex: 2x / semana" value={name} onChange={(e: any) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Preço (€/mês)" type="number" placeholder="28" value={price} onChange={(e: any) => setPrice(e.target.value)} />
          <Combobox label="Dia de vencimento" value={String(dueDay)} onChange={(v) => { setDueDay(Number(v)) }} options={Array.from({ length: 28 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: `Dia ${d}` }))} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
          <div><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Ativa</p><p className="text-xs text-zinc-400">Disponível para atribuir a clientes.</p></div>
          <Toggle checked={active} onChange={setActive} />
        </div>
      </div>
    </Modal>
  )
}

// Catálogo de subscrições numa MODAL (ver lista; criar/editar abre a SubscricaoModal).
export function SubscricoesModal({ onClose }: { onClose: () => void }) {
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
  const setDefault = useMutation({
    mutationFn: (id: string) => putGymSubscriptionsId(id, { isDefault: true }),
    onSuccess: () => { invalidateMens(qc); toast.success('Plano predefinido atualizado') },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Modal open onClose={onClose} width="max-w-3xl" title="Subscrições"
      subtitle="O catálogo de mensalidades que atribuis aos alunos."
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">{subs.length} subscriç{subs.length === 1 ? 'ão' : 'ões'} no catálogo</p>
          <Button icon="plus" size="sm" onClick={() => setModal({ sub: null })}>Nova subscrição</Button>
        </div>
        {subs.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subs.map((s) => (
              <Card key={s.subscriptionId} className="p-5">
                <div className="flex items-start justify-between">
                  <span className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="euro" className="w-5 h-5" /></span>
                  <div className="flex gap-0.5">
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
                  <div className="flex items-center gap-1.5">
                    {s.isDefault
                      ? <Badge tone="violet" dot>★ Predefinido</Badge>
                      : <GuardButton variant="ghost" size="sm" onClick={() => setDefault.mutate(s.subscriptionId)}>Tornar predefinido</GuardButton>}
                    {s.active ? <Badge tone="green" dot>Ativa</Badge> : <Badge tone="neutral">Inativa</Badge>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : <EmptyState icon="euro" title="Sem subscrições" desc="Cria a primeira mensalidade do catálogo." action={<Button icon="plus" onClick={() => setModal({ sub: null })}>Nova subscrição</Button>} />}
      </div>

      {modal && <SubscricaoModal subscricao={modal.sub} onClose={() => setModal(null)} onSaved={() => invalidateMens(qc)} />}
      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => { if (confirmDel) del.mutate(confirmDel.subscriptionId); setConfirmDel(null) }}
        variant="danger"
        title="Eliminar subscrição?"
        description="Os clientes ligados ficam sem subscrição; os pagamentos mantêm-se. Continuar?"
        confirmLabel="Eliminar"
        pendingLabel="A eliminar…"
      />
    </Modal>
  )
}

// ── Convidar sócio por email (Customer + GymMembership "pending") ───────────
export function ConvidarSocioModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const { data: subsData } = useGetGymSubscriptions()
  const subs = (subsData ?? []) as Sub[]
  const activeSubs = subs.filter((s) => s.active)
  const defaultSub = activeSubs.find((s) => s.isDefault) ?? null
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subscriptionId, setSubscriptionId] = useState('')

  // Pré-seleciona o plano predefinido do tenant assim que o catálogo carrega.
  useEffect(() => {
    if (!subscriptionId && defaultSub) setSubscriptionId(defaultSub.subscriptionId)
  }, [defaultSub, subscriptionId])

  const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

  const invite = useMutation({
    mutationFn: () => {
      const body: PostGymMembersInviteMutationRequest = { name: name.trim(), email: email.trim() }
      if (subscriptionId) body.subscriptionId = subscriptionId
      return postGymMembersInvite(body)
    },
    onSuccess: (res) => {
      onInvited()
      if (res?.emailSent === false) {
        toast.warning('Conta criada, mas o email não seguiu. Verifica a configuração de email.')
      } else {
        toast.success(res?.alreadyInvited ? 'Sócio já tinha sido convidado' : 'Convite enviado por email')
      }
      onClose()
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const options = activeSubs.map((s) => ({ value: s.subscriptionId, label: s.isDefault ? `${s.name} · Predefinido` : s.name }))

  return (
    <Modal open onClose={onClose} width="max-w-md" title="Convidar sócio" subtitle="Cria a ficha e envia um email para o sócio definir a palavra-passe."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><GuardButton icon="mail" isLoading={invite.isPending} disabled={!name.trim() || !isEmailValid(email) || !activeSubs.length} onClick={() => invite.mutate()}>Convidar</GuardButton></>}>
      <div className="space-y-4">
        <Input label="Nome" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Nome do sócio" />
        <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="email@exemplo.pt" aria-invalid={email.trim() && !isEmailValid(email) ? 'true' : 'false'} />
        <Combobox label="Plano" value={subscriptionId} onChange={setSubscriptionId} options={options}
          placeholder={activeSubs.length ? 'Selecionar plano…' : 'Sem planos ativos'} disabled={!activeSubs.length} />
        {!activeSubs.length && <p className="text-xs text-amber-600 dark:text-amber-400">Cria uma subscrição ativa primeiro (em Subscrições).</p>}
      </div>
    </Modal>
  )
}

// ── Atribuir subscrição a um cliente ─────────────────────────────────────────
function AtribuirSubModal({ customerId, current, onClose, onSaved }: { customerId: string; current: string | null; onClose: () => void; onSaved: () => void }) {
  const { data } = useGetGymSubscriptions()
  const subs = ((data ?? []) as Sub[]).filter((s) => s.active || s.subscriptionId === current)
  const [sel, setSel] = useState<string | null>(current)
  const save = useMutation({
    mutationFn: () => putGymMensalidadeCustomersCustomeridSubscription(customerId, { subscriptionId: sel }),
    onSuccess: () => { onSaved(); toast.success('Subscrição atualizada'); onClose() },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Modal open onClose={onClose} width="max-w-md" title="Atribuir subscrição"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><GuardButton icon="check" isLoading={save.isPending} onClick={() => save.mutate()}>Guardar</GuardButton></>}>
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
function PagamentoModal({ customerId, period, amount, onClose, onSaved, status, paidAmount }: { customerId: string; period: string; amount: number; status?: Status; paidAmount?: number; onClose: () => void; onSaved: () => void }) {
  const isDebt = status === 'debt'
  const falta = Math.max(0, (amount || 0) - (paidAmount || 0))
  const defaultValor = isDebt ? falta : amount
  const [valor, setValor] = useState(String(defaultValor ?? ''))
  const [metodo, setMetodo] = useState<PayMethod>(PAY_METHODS[1].value)
  const [pagoEm, setPagoEm] = useState(new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState('')
  const pagoFloat = parseFloat(valor) || 0
  const isValidValue = pagoFloat > 0
  const isAbaixoEsperado = pagoFloat > 0 && pagoFloat < (amount || 0)

  const save = useMutation({
    mutationFn: () => postGymMensalidadeCustomersCustomeridPayments(customerId, { period, status: 'paid', amount: pagoFloat, paidAt: pagoEm, method: metodo, notes: notas.trim() || null }),
    onSuccess: () => { onSaved(); toast.success('Pagamento registado'); onClose() },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Modal open onClose={onClose} width="max-w-sm" title="Registar pagamento" subtitle={fmtPeriodo(period)}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><GuardButton icon="check" isLoading={save.isPending} disabled={!isValidValue} onClick={() => save.mutate()}>Marcar paga</GuardButton></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input label="Valor (€)" type="number" value={valor} onChange={(e: any) => setValor(e.target.value)} autoFocus />
            <div className="mt-1.5 space-y-1.5">
              {isDebt && falta > 0 && (
                <PriceFillChip amount={falta} label="Em falta" active={pagoFloat === falta} onClick={() => setValor(String(falta))} />
              )}
              {amount > 0 && (
                <PriceFillChip amount={amount} label="Subscrição" active={pagoFloat === amount} onClick={() => setValor(String(amount))} />
              )}
            </div>
            {isAbaixoEsperado && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Valor abaixo do esperado — fica registado como pago por {fmtEur(pagoFloat)}. Para dívida parcial usa 'Em dívida'.</p>
            )}
          </div>
          <label className="block"><span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Data</span><DatePicker value={pagoEm} onChange={setPagoEm} max={new Date().toISOString().slice(0, 10)} /></label>
        </div>
        <Combobox label="Método" value={metodo} onChange={(v: string) => { setMetodo(v as PayMethod) }} options={PAY_METHODS} />
        <Input label="Notas (opcional)" value={notas} onChange={(e: any) => setNotas(e.target.value)} />
      </div>
    </Modal>
  )
}

// ── Painel de mensalidade de UM cliente (partilhado) ─────────────────────────
// `dense` = contexto estreito (modal da ficha do cliente): empilha tudo numa
// coluna. Sem `dense` (página Mensalidades, larga) usa 2 colunas + tabela.
export function ClienteMensalidade({ customerId, dense = false }: { customerId: string; dense?: boolean }) {
  const qc = useQueryClient()
  const { authHeader } = useAuth()
  const writeGuard = useWriteGuard()
  const { data, isLoading, isError, refetch } = useGetGymMensalidadeCustomersCustomerid(customerId, { query: { enabled: !!customerId } })
  const mem: Membership | undefined = data
  const [atribuir, setAtribuir] = useState(false)
  const [pagModal, setPagModal] = useState<{ period: string; amount: number; status?: Status; paidAmount?: number } | null>(null)
  const [downgrade, setDowngrade] = useState<Exclude<Status, 'paid'> | null>(null)
  const [paidAmountLocal, setPaidAmountLocal] = useState<Record<string, number>>({})

  const onSaved = () => invalidateMens(qc)
  const upsert = useMutation({
    mutationFn: (body: PostGymMensalidadeCustomersCustomeridPaymentsMutationRequest) => postGymMensalidadeCustomersCustomeridPayments(customerId, body),
    onSuccess: onSaved, onError: (e) => toast.error(getApiError(e)),
  })
  const block = useMutation({
    mutationFn: (v: boolean) => patchGymMensalidadeCustomersCustomeridBlock(customerId, { blocked: v }),
    onSuccess: onSaved, onError: (e) => toast.error(getApiError(e)),
  })
  const payOnlyMut = useMutation({
    mutationFn: (v: boolean) => gymSetPayOnly(authHeader, customerId, v),
    onSuccess: onSaved, onError: (e) => toast.error(getApiError(e)),
  })

  if (isError) return (
    <Card className="p-6 text-center space-y-3">
      <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar mensalidade</p>
      <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar de novo</Button>
    </Card>
  )
  if (isLoading || !mem) return <Card className="p-6 text-center text-sm text-zinc-400">A carregar mensalidade…</Card>
  const sub = mem.subscription
  const period = mem.currentPeriod
  const realPay = mem.payments.find((p) => p.period === period) ?? null
  // Mês corrente "automático": sem registo ainda → usa um efémero "por pagar".
  // Marcar paga/dívida cria o registo via upsert (sem botão "Gerar mês").
  const dueDefault = dueForPeriod(period, sub?.dueDay ?? 8)
  const eff: Payment = realPay ?? {
    paymentId: '', period, amount: sub?.price ?? 0, dueDate: dueDefault,
    status: 'unpaid', paidAt: null, method: null, notes: null, paidAmount: null, debtSince: null,
    overdue: mem.today > dueDefault, updatedAt: null, createdAt: null,
  }
  const estado: Status = eff.status
  const atraso = eff.overdue
  const view = STATUS_VIEW[atraso ? 'overdue' : estado]
  const falta = Math.max(0, (eff.amount || 0) - (eff.paidAmount || 0))
  const setEstado = (st: Status) => {
    if (st === 'paid') { setPagModal({ period, amount: eff.amount || sub?.price || 0 }); return }
    // Baixar de "pago" para dívida/não pago apaga o registo do pagamento → confirmar.
    if (estado === 'paid') { setDowngrade(st); return }
    upsert.mutate({ period, status: st })
  }

  // Linha "Bloqueado" reutilizada (com e sem subscrição).
  const blockRow = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Bloqueado</p><p className="text-xs text-zinc-400">Suspende o acesso à app do ginásio.</p></div>
        <span title={writeGuard.readOnly ? writeGuard.message : undefined} className={writeGuard.readOnly ? 'opacity-50 cursor-not-allowed' : ''}>
          <Toggle checked={mem.blocked} onChange={(v: boolean) => !writeGuard.readOnly && block.mutate(v)} disabled={block.isPending || writeGuard.readOnly} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Só paga (sem app)</p><p className="text-xs text-zinc-400">Cliente presencial que não usa a app — fora das estatísticas de assiduidade.</p></div>
        <span title={writeGuard.readOnly ? writeGuard.message : undefined} className={writeGuard.readOnly ? 'opacity-50 cursor-not-allowed' : ''}>
          <Toggle checked={!!mem.payOnly} onChange={(v: boolean) => !writeGuard.readOnly && payOnlyMut.mutate(v)} disabled={payOnlyMut.isPending || writeGuard.readOnly} />
        </span>
      </div>
    </div>
  )

  // ── Corpo "mês corrente" (vive dentro do cartão da subscrição) ──
  const monthBody = (
    <div className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Mês corrente</p>
          <p className="font-semibold text-zinc-900 dark:text-white leading-tight truncate">{fmtPeriodoLong(period)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums leading-none">{fmtEur(eff.amount)}</p>
          <Badge tone={view.tone} dot className="mt-2">{view.label}</Badge>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-zinc-500">Vencimento</span>
          <div className="w-40 shrink-0"><DatePicker value={eff.dueDate} onChange={(iso) => upsert.mutate({ period, dueDate: iso })} /></div>
        </div>
        {estado === 'paid' && (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-zinc-500">Pago</span>
            <span className="text-zinc-700 dark:text-zinc-200">{fmtData(eff.paidAt)}{eff.method ? ` · ${payMethodLabel(eff.method)}` : ''}</span>
          </div>
        )}
        {estado === 'debt' && (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-500">Em dívida desde</span>
              <div className="w-40 shrink-0"><DatePicker value={eff.debtSince ?? mem.today} onChange={(iso) => !writeGuard.readOnly && upsert.mutate({ period, debtSince: iso })} /></div>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-500">Já pagou</span>
              <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">€</span><input type="number" min="0" value={paidAmountLocal[period] ?? eff.paidAmount ?? 0} onChange={(e) => setPaidAmountLocal({ ...paidAmountLocal, [period]: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })} onBlur={(e) => { const newVal = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0; if (newVal !== (eff.paidAmount ?? 0) && !writeGuard.readOnly) upsert.mutate({ period, paidAmount: newVal }) }} disabled={upsert.isPending || writeGuard.readOnly} className={`w-24 ${dueInput} pl-5 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 disabled:opacity-50`} /></div>
            </div>
            <div className="flex items-center justify-between text-sm pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500">Em falta</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{fmtEur(falta)}</span>
            </div>
          </>
        )}
        {realPay?.updatedAt
          ? <p className="text-[11px] text-zinc-400 pt-0.5">Registado a {fmtDateTime(realPay.updatedAt)}</p>
          : <p className="text-[11px] text-zinc-400 pt-0.5">Sem registo ainda — marca o estado para registar.</p>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1.5">
        <button onClick={() => setEstado('paid')} disabled={upsert.isPending || writeGuard.readOnly} title={writeGuard.readOnly ? writeGuard.message : undefined} className={`py-2 rounded-lg text-[13px] font-medium border transition disabled:opacity-50 disabled:cursor-not-allowed ${estado === 'paid' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-emerald-400 hover:text-emerald-600'}`}>Paga</button>
        <button onClick={() => setEstado('debt')} disabled={upsert.isPending || writeGuard.readOnly} title={writeGuard.readOnly ? writeGuard.message : undefined} className={`py-2 rounded-lg text-[13px] font-medium border transition disabled:opacity-50 disabled:cursor-not-allowed ${estado === 'debt' ? 'bg-amber-500 text-white border-amber-500' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-amber-400 hover:text-amber-600'}`}>Em dívida</button>
        <button onClick={() => setEstado('unpaid')} disabled={upsert.isPending || writeGuard.readOnly} title={writeGuard.readOnly ? writeGuard.message : undefined} className={`py-2 rounded-lg text-[13px] font-medium border transition disabled:opacity-50 disabled:cursor-not-allowed ${estado === 'unpaid' ? 'bg-zinc-700 text-white border-zinc-700' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400'}`}>Não pago</button>
      </div>
    </div>
  )

  return (
    <div className={dense ? 'space-y-3' : 'space-y-4'}>
      {mem.status === 'pending' && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
          <Icon name="mail" className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300 flex-1">Sócio convidado — ainda não definiu a palavra-passe.</p>
          <Badge tone="blue" dot>Convidado</Badge>
        </div>
      )}
      {mem.blocked && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <Icon name="ban" className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">Cliente <strong>bloqueado</strong>. O acesso à app do ginásio fica suspenso até desbloquear.</p>
          <Button variant="outline" size="sm" onClick={() => block.mutate(false)}>Desbloquear</Button>
        </div>
      )}

      {sub ? (
        // Um só cartão: subscrição (cabeçalho) → mês corrente → bloqueio (rodapé),
        // com a barra de estado a percorrer a lateral.
        <Card className="overflow-hidden">
          <div className="flex items-stretch">
            <div className={`w-1 shrink-0 ${view.bar}`} aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="euro" className="w-5 h-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">{sub.name}</p>
                  <p className="text-sm text-zinc-500"><span className="font-medium text-zinc-700 dark:text-zinc-200 tabular-nums">{fmtEur(sub.price)}</span>/mês · vence dia {sub.dueDay}</p>
                </div>
                <Button variant="ghost" size="sm" icon="edit" onClick={() => setAtribuir(true)}>Trocar</Button>
              </div>
              {monthBody}
              <div className="px-4 sm:px-5 py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">{blockRow}</div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6 border-dashed">
          <div className="flex flex-col items-center text-center">
            <span className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-3"><Icon name="euro" className="w-6 h-6" /></span>
            <h3 className="font-semibold text-zinc-900 dark:text-white">Sem mensalidade</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-xs">Atribui uma subscrição para começar a cobrar a mensalidade deste cliente.</p>
            <Button className="mt-4" icon="plus" onClick={() => setAtribuir(true)}>Atribuir subscrição</Button>
          </div>
          <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">{blockRow}</div>
        </Card>
      )}

      {/* Histórico de pagamentos */}
      {(sub || mem.payments.length > 0) && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Histórico de pagamentos</h3>
            {mem.payments.length > 0 && <span className="text-xs text-zinc-400">{mem.payments.length} registo{mem.payments.length !== 1 ? 's' : ''}</span>}
          </div>
          {mem.payments.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Sem pagamentos ainda</p>
              <p className="text-xs text-zinc-400 mt-1">Os registos de mensalidade aparecem aqui.</p>
            </div>
          ) : dense ? (
            <ul>
              {mem.payments.map((p) => {
                const pv = STATUS_VIEW[p.overdue ? 'overdue' : p.status]
                return (
                  <li key={p.paymentId} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pv.bar}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{fmtPeriodo(p.period)}</p>
                      <p className="text-xs text-zinc-400 truncate">{p.status === 'paid' ? (p.method ? payMethodLabel(p.method) : 'Pago') : p.overdue ? `Venceu ${fmtData(p.dueDate)}` : 'Por pagar'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-zinc-700 dark:text-zinc-200 tabular-nums">{fmtEur(p.amount)}</p>
                      <span className={`text-xs font-medium ${pv.fg}`}>{pv.label}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="font-medium px-5 py-3">Mês</th><th className="font-medium px-4 py-3">Valor</th>
                  <th className="font-medium px-4 py-3 hidden sm:table-cell">Vencimento</th><th className="font-medium px-4 py-3">Estado</th>
                  <th className="font-medium px-4 py-3 hidden md:table-cell">Método</th>
                  <th className="font-medium px-4 py-3 hidden lg:table-cell">Registado</th>
                </tr></thead>
                <tbody>
                  {mem.payments.map((p) => (
                    <tr key={p.paymentId} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                      <td className="px-5 py-3 font-medium text-zinc-900 dark:text-white">{fmtPeriodo(p.period)}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 tabular-nums">{fmtEur(p.amount)}</td>
                      <td className={`px-4 py-3 tabular-nums hidden sm:table-cell ${p.overdue ? 'text-red-500 font-medium' : 'text-zinc-400'}`}>{fmtData(p.dueDate)}</td>
                      <td className="px-4 py-3"><Badge tone={p.overdue ? 'red' : EST[p.status].tone} dot>{p.overdue ? 'Em atraso' : EST[p.status].t}</Badge></td>
                      <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{p.status === 'paid' ? (p.method ? payMethodLabel(p.method) : '—') : '—'}</td>
                      <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell whitespace-nowrap">{fmtDateTime(p.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {atribuir && <AtribuirSubModal customerId={customerId} current={sub?.subscriptionId ?? null} onClose={() => setAtribuir(false)} onSaved={onSaved} />}
      {pagModal && <PagamentoModal customerId={customerId} period={pagModal.period} amount={pagModal.amount} status={pagModal.status} paidAmount={pagModal.paidAmount} onClose={() => setPagModal(null)} onSaved={onSaved} />}
      <ConfirmDialog
        open={!!downgrade}
        onClose={() => setDowngrade(null)}
        onConfirm={() => { if (downgrade) upsert.mutate({ period, status: downgrade }); setDowngrade(null) }}
        variant="warning"
        title="Alterar pagamento?"
        description={<>Este mês está marcado como <strong>pago</strong>. Ao mudar para <strong>{downgrade === 'debt' ? 'em dívida' : 'não pago'}</strong>, o registo do pagamento (data, método e valor) é apagado. Tens a certeza?</>}
        confirmLabel="Sim, alterar"
        pendingLabel="A alterar…"
      />
    </div>
  )
}

// ── Cockpit de Cobranças: "quem falta cobrar este mês", cobra num clique ──────
function CobrancasView({ period, filter, q, onPeriodChange, onFilterChange, onQChange, onOpen, onOpenConfirmBulk }: { period: string; filter: 'cobrar' | 'pago' | 'todos'; q: string; onPeriodChange: (p: string) => void; onFilterChange: (f: 'cobrar' | 'pago' | 'todos') => void; onQChange: (q: string) => void; onOpen: (c: { id: string; name: string }) => void; onOpenConfirmBulk?: () => void }) {
  const qc = useQueryClient()
  const [pag, setPag] = useState<{ customerId: string; period: string; amount: number; status?: Status; paidAmount?: number } | null>(null)
  const { data, isLoading, isError, refetch } = useGetGymMensalidadeFinance({ period }, { query: { placeholderData: keepPreviousData } })
  const fin: Finance | undefined = data
  const { authHeader } = useAuth()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)

  // Limpar seleção quando period/filter/q mudam
  useEffect(() => { setSel(new Set()) }, [period, filter, q])

  const toggleSel = (id: string) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n) }

  const onLembrar = async (ids?: string[]) => {
    try { const r = await gymRemind(authHeader, ids?.length ? { customerIds: ids, period } : { period }); toast.success(`${r.sent} lembrete${r.sent === 1 ? '' : 's'} enviado${r.sent === 1 ? '' : 's'}`) }
    catch (e) { toast.error(getApiError(e)) }
  }

  const onBulkPay = async () => {
    try {
      const r = await gymBulkMarkPaid(authHeader, { customerIds: [...sel], period })
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
        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-white dark:bg-zinc-900">
          {([['cobrar', 'Por cobrar'], ['pago', 'Pagos'], ['todos', 'Todos']] as const).map(([id, label]) => (
            <button key={id} onClick={() => onFilterChange(id)} className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${filter === id ? 'bg-accent text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
              {label} <span className={filter === id ? 'opacity-80' : 'text-zinc-400'}>{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:max-w-xs flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" className="w-[18px] h-[18px]" /></span>
          <input value={q} onChange={(e) => onQChange(e.target.value)} placeholder="Procurar cliente…" className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-transparent rounded-lg text-sm pl-10 pr-3 py-2 focus:bg-white dark:focus:bg-zinc-900 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none text-zinc-800 dark:text-zinc-100" />
        </div>
      </div>

      {/* Lista de cobrança */}
      {billable.length === 0 ? (
        <Card><EmptyState icon="euro" title="Sem clientes com plano" desc="Convida um sócio ou atribui uma subscrição na ficha do cliente para começar a cobrar." action={<Button icon="mail" size="sm" onClick={() => onOpenConfirmBulk?.()}>Convidar sócio</Button>} /></Card>
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
                  <GuardButton size="sm" icon="check" onClick={(e?: any) => { e?.stopPropagation(); setPag({ customerId: r.customerId, period, amount, status: r.status as Status, paidAmount: r.payment?.paidAmount }) }}>Marcar pago</GuardButton>
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

function AnaliseView() {
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

// ── Tab principal: Financeiro do ginásio (Cobranças + Subscrições + Análise) ───
export function MensalidadesTab() {
  const qc = useQueryClient()
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null)
  const [period, setPeriod] = useState(currentPeriod())
  const [filter, setFilter] = useState<'cobrar' | 'pago' | 'todos'>('cobrar')
  const [q, setQ] = useState('')
  const [subsOpen, setSubsOpen] = useState(false)
  const [analiseOpen, setAnaliseOpen] = useState(false)
  const [conviteOpen, setConviteOpen] = useState(false)

  if (sel) {
    return (
      <div>
        <button onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-5"><Icon name="chevronLeft" className="w-4 h-4" />Voltar</button>
        <div className="flex items-center gap-3 mb-5">
          <Avatar name={sel.name} color={colorFromName(sel.name)} size={48} />
          <div><h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{sel.name}</h2><p className="text-sm text-zinc-500">Mensalidade</p></div>
        </div>
        <ClienteMensalidade customerId={sel.id} />
      </div>
    )
  }

  // Página = cockpit de Cobranças (pulso no topo + lista). Análise e Subscrições
  // vivem em modais, para a lista (que pode ser enorme) não enterrar nada.
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">Cobranças das mensalidades.</p>
        <div className="flex items-center gap-2">
          <Button size="sm" icon="mail" onClick={() => setConviteOpen(true)}>Convidar sócio</Button>
          <Button variant="outline" size="sm" icon="trend" onClick={() => setAnaliseOpen(true)}>Análise</Button>
          <Button variant="outline" size="sm" icon="layers" onClick={() => setSubsOpen(true)}>Subscrições</Button>
        </div>
      </div>

      <CobrancasView period={period} filter={filter} q={q} onPeriodChange={setPeriod} onFilterChange={setFilter} onQChange={setQ} onOpen={setSel} onOpenConfirmBulk={() => setConviteOpen(true)} />

      {conviteOpen && <ConvidarSocioModal onClose={() => setConviteOpen(false)} onInvited={() => invalidateMens(qc)} />}
      {subsOpen && <SubscricoesModal onClose={() => setSubsOpen(false)} />}
      {analiseOpen && (
        <Modal open onClose={() => setAnaliseOpen(false)} width="max-w-4xl" title="Análise"
          subtitle="Saúde das mensalidades: recorrência, retenção e movimento do MRR."
          footer={<Button variant="ghost" onClick={() => setAnaliseOpen(false)}>Fechar</Button>}>
          <AnaliseView />
        </Modal>
      )}
    </div>
  )
}
