import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { fmtEur } from "../../lib/money";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, Badge, Toggle } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { DatePicker } from "../../components/DatePicker";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import { gymSetPayOnly } from "../../hooks/useFinanceiro";
import { payMethodLabel } from "../../lib/gymPayMethod";
import { useGetGymMensalidadeCustomersCustomerid } from "../../gen/backoffice/hooks/useGetGymMensalidadeCustomersCustomerid.js";
import { patchGymMensalidadeCustomersCustomeridBlock } from "../../gen/backoffice/hooks/usePatchGymMensalidadeCustomersCustomeridBlock.js";
import { postGymMensalidadeCustomersCustomeridPayments } from "../../gen/backoffice/hooks/usePostGymMensalidadeCustomersCustomeridPayments.js";
import type { PostGymMensalidadeCustomersCustomeridPaymentsMutationRequest } from "../../gen/backoffice/types/PostGymMensalidadeCustomersCustomeridPayments.js";
import { EST, Membership, Payment, STATUS_VIEW, Status, dueForPeriod, dueInput, fmtData, fmtDateTime, fmtPeriodo, fmtPeriodoLong, invalidateMens } from "./format";
import { AtribuirSubModal, PagamentoModal } from "./Modals";

// ── Painel de mensalidade de UM cliente (partilhado) ─────────────────────────
// `dense` = contexto estreito (modal da ficha do cliente): empilha tudo numa
// coluna. Sem `dense` (página Mensalidades, larga) usa 2 colunas + tabela.
export function ClienteMensalidade({ customerId, dense = false }: { customerId: string; dense?: boolean }) {
  const qc = useQueryClient()
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
    mutationFn: (v: boolean) => gymSetPayOnly(customerId, v),
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
          <GuardButton variant="outline" size="sm" onClick={() => block.mutate(false)}>Desbloquear</GuardButton>
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
            <GuardButton className="mt-4" icon="plus" onClick={() => setAtribuir(true)}>Atribuir subscrição</GuardButton>
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
