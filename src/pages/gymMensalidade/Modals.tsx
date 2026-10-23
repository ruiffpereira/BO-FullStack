import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { fmtEur } from "../../lib/money";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, IconButton, Badge, Input, Toggle, Modal, EmptyState } from "../../ui/ui.jsx";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { Combobox } from "../../components/Combobox";
import { DatePicker } from "../../components/DatePicker";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PriceFillChip } from "../../components/PriceFillChip";
import { PAY_METHODS, type PayMethod } from "../../lib/gymPayMethod";
import { useGetGymSubscriptions } from "../../gen/backoffice/hooks/useGetGymSubscriptions.js";
import { postGymSubscriptions } from "../../gen/backoffice/hooks/usePostGymSubscriptions.js";
import { putGymSubscriptionsId } from "../../gen/backoffice/hooks/usePutGymSubscriptionsId.js";
import { deleteGymSubscriptionsId } from "../../gen/backoffice/hooks/useDeleteGymSubscriptionsId.js";
import { postGymMembersInvite } from "../../gen/backoffice/hooks/usePostGymMembersInvite.js";
import { putGymMensalidadeCustomersCustomeridSubscription } from "../../gen/backoffice/hooks/usePutGymMensalidadeCustomersCustomeridSubscription.js";
import { postGymMensalidadeCustomersCustomeridPayments } from "../../gen/backoffice/hooks/usePostGymMensalidadeCustomersCustomeridPayments.js";
import type { PostGymMembersInviteMutationRequest } from "../../gen/backoffice/types/PostGymMembersInvite.js";
import { Status, Sub, fmtPeriodo, invalidateMens } from "./format";

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
          <GuardButton icon="plus" size="sm" onClick={() => setModal({ sub: null })}>Nova subscrição</GuardButton>
        </div>
        {subs.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subs.map((s) => (
              <Card key={s.subscriptionId} className="p-5">
                <div className="flex items-start justify-between">
                  <span className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="euro" className="w-5 h-5" /></span>
                  <div className="flex gap-0.5">
                    <IconButton icon="edit" label="Editar" onClick={() => setModal({ sub: s })} />
                    <GuardIconButton icon="trash" label="Eliminar" className="hover:text-red-500" onClick={() => setConfirmDel(s)} />
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
        ) : <EmptyState icon="euro" title="Sem subscrições" desc="Cria a primeira mensalidade do catálogo." action={<GuardButton icon="plus" onClick={() => setModal({ sub: null })}>Nova subscrição</GuardButton>} />}
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
      // Sem domínio do site a API não tem link para pôr no email — não o envia.
      if (res?.appUrl === null) {
        toast.warning('Conta criada, mas o convite não foi enviado: define o domínio do site em Estatísticas.')
      } else if (res?.emailSent === false) {
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
export function AtribuirSubModal({ customerId, current, onClose, onSaved }: { customerId: string; current: string | null; onClose: () => void; onSaved: () => void }) {
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
export function PagamentoModal({ customerId, period, amount, onClose, onSaved, status, paidAmount }: { customerId: string; period: string; amount: number; status?: Status; paidAmount?: number; onClose: () => void; onSaved: () => void }) {
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
