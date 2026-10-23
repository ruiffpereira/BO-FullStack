import { PaymentButton } from "./PaymentButton";
import { fmtEur } from "../../lib/money"
import { Icon } from "../../ui/icons.jsx";
import { Toggle } from "../../ui/ui.jsx";
import { GuardButton } from "../GuardButton";
import { PriceFillChip } from "../PriceFillChip";
import { PAYMENT_TONE_TEXT_CLASS } from "../../lib/paymentTone";
import { PaymentInputs, TipField } from "./PaymentInputs";
import type { ApptEditor } from "./useApptEditor";

/** Aba «Pagamento»: recibo, edição, novo pagamento e histórico. */
export function ApptPaymentTab({ ctx }: { ctx: ApptEditor }) {
  const { billingReadOnly, billingLockMsg, editMoney, svc, status, editMode, cash, setCash, mbway, setMbway, card, setCard, tip, setTip, wantsInvoice, setWantsInvoice, nifInput, setNifInput, isPaid, tipVal, payTotal, snapshotPrice, totalPaid, debtAmount, hasDebt, paymentHistory, fillPrice, fillMethod, payNoTip, targetPrice, payTone, payButtonNoValue, activeMethod, handleEditPayment, handlePay, handleCompleteWithoutPayment, handleCancelPayment, busy, appt, priorDebt, customer } = ctx;
  return (
            <div className="space-y-4">
              {priorDebt > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm font-semibold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-400">
                  <Icon name="alertCircle" className="w-4 h-4 shrink-0" />
                  <span>Este cliente tem {fmtEur(priorDebt)} em dívida de marcações anteriores.</span>
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-sm">
                <span className="text-zinc-500">{svc?.name || appt.serviceName || "Serviço"}</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {fmtEur(snapshotPrice)}
                </span>
              </div>

              {/* Contribuinte na fatura — editável ao pagar e ao "Editar pagamento". */}
              {editMoney && (!isPaid || editMode === "payment") && customer && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Contribuinte na fatura</p>
                      <p className="text-xs text-zinc-400">Emitir com o NIF do cliente.</p>
                    </div>
                    <Toggle checked={wantsInvoice} onChange={setWantsInvoice} />
                  </div>
                  {wantsInvoice && (
                    <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                      <input
                        value={nifInput}
                        onChange={(e) => setNifInput(e.target.value.replace(/\D/g, "").slice(0, 9))}
                        placeholder="NIF (9 dígitos)"
                        inputMode="numeric"
                        className="flex-1 px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none w-0"
                      />
                      <span className={`px-2 text-sm self-stretch flex items-center ${nifInput.length === 9 ? "text-emerald-500" : "text-amber-500 text-xs"}`}>
                        {nifInput.length === 9 ? "✓" : `${nifInput.length}/9`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {isPaid ? (
                <div className="space-y-3">
                  <div className="space-y-2 text-sm">
                    {appt.paymentCash != null &&
                      Number(appt.paymentCash) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Dinheiro</span>
                          <span className="font-medium">
                            {fmtEur(Number(appt.paymentCash))}
                          </span>
                        </div>
                      )}
                    {appt.paymentMbway != null &&
                      Number(appt.paymentMbway) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">MBway</span>
                          <span className="font-medium">
                            {fmtEur(Number(appt.paymentMbway))}
                          </span>
                        </div>
                      )}
                    {appt.paymentCard != null &&
                      Number(appt.paymentCard) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Cartão</span>
                          <span className="font-medium">
                            {fmtEur(Number(appt.paymentCard))}
                          </span>
                        </div>
                      )}
                    {(() => {
                      const paidTip = totalPaid - snapshotPrice;
                      return (
                        <>
                          {paidTip > 0.01 && (
                            <div className="flex justify-between text-zinc-500">
                              <span>Gorjeta</span>
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {fmtEur(paidTip)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700 font-semibold">
                            <span>Total recebido</span>
                            <span className={hasDebt ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                              {fmtEur(totalPaid)}
                            </span>
                          </div>
                          {hasDebt && (
                            <div className="flex justify-between font-semibold text-red-600 dark:text-red-400">
                              <span>Em dívida</span>
                              <span>{fmtEur(debtAmount)}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Registado em{" "}
                    {new Date(appt.paidAt!).toLocaleDateString("pt-PT", {
                      dateStyle: "medium",
                    })}
                  </p>
                  {/* Indicação (read-only) de contribuinte — só na vista; ao editar usa-se o toggle. */}
                  {customer && editMode !== "payment" && (
                    <p className="text-xs text-zinc-400">
                      Fatura {customer.wantsInvoice
                        ? `com contribuinte${customer.nif ? ` (NIF ${customer.nif})` : ""}`
                        : "sem contribuinte"}
                    </p>
                  )}

                  {/* Editor de pagamento (modo edição) OU ações (ver) */}
                  {editMode === "payment" ? (
                    <div className="space-y-3">
                      {hasDebt && (
                        <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-2.5 py-2">
                          Em dívida {fmtEur(debtAmount)}. Ajusta os valores recebidos.
                        </div>
                      )}
                      <PaymentInputs cash={cash} mbway={mbway} card={card} setCash={setCash} setMbway={setMbway} setCard={setCard} />
                      {/* Gorjeta — soma ao dinheiro recebido ao guardar */}
                      <TipField tip={tip} setTip={setTip} />
                      {/* Feedback de cor em tempo real — mesma fonte do botão único (payTone). */}
                      <p className={`text-xs font-medium px-0.5 ${PAYMENT_TONE_TEXT_CLASS[payTone.tone]}`}>
                        {payTone.hint}
                      </p>
                      <GuardButton
                        leaf="agenda.marcacoes.valores"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={handleCancelPayment}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        Anular pagamento
                      </GuardButton>
                    </div>
                  ) : (
                    /* Esteja paga ou com dívida → um só botão. A dívida vê-se no recibo. Só com `valores` (editar). */
                    editMoney ? (
                      <GuardButton wrapperClassName="block w-full" variant="outline" className="w-full" disabled={busy} onClick={handleEditPayment}>
                        Editar pagamento
                      </GuardButton>
                    ) : null
                  )}
                </div>
              ) : !editMoney ? (
                <p className="text-sm text-zinc-500">Ainda sem pagamento registado.</p>
              ) : (
                <div className="space-y-3">
                  {hasDebt && (
                    <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg text-sm font-semibold text-red-700 dark:text-red-400">
                      <span>Em dívida</span>
                      <span>{fmtEur(debtAmount)}</span>
                    </div>
                  )}
                  {fillPrice > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-400">
                        Recebeu o valor do serviço?
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <PriceFillChip
                          amount={fillPrice}
                          label="Dinheiro"
                          active={activeMethod === "cash"}
                          onClick={() => fillMethod("cash")}
                        />
                        <PriceFillChip
                          amount={fillPrice}
                          label="MBway"
                          active={activeMethod === "mbway"}
                          onClick={() => fillMethod("mbway")}
                        />
                        <PriceFillChip
                          amount={fillPrice}
                          label="Cartão"
                          active={activeMethod === "card"}
                          onClick={() => fillMethod("card")}
                        />
                      </div>
                    </div>
                  )}
                  <PaymentInputs cash={cash} mbway={mbway} card={card} setCash={setCash} setMbway={setMbway} setCard={setCard} />
                  {!hasDebt && (
                    <TipField tip={tip} setTip={setTip} labelClassName="flex items-center gap-1" />
                  )}

                  {payTotal > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm font-medium px-1">
                        <span className="text-zinc-500">Total</span>
                        <span className={PAYMENT_TONE_TEXT_CLASS[payTone.tone]}>
                          {fmtEur(payTotal)}{payTone.tone === "blue" && " ✓"}
                          {payTone.tone === "amber" &&
                            ` (faltam ${fmtEur((targetPrice - payNoTip))})`}
                          {payTone.tone === "green" &&
                            !tipVal &&
                            ` (+${fmtEur((payNoTip - targetPrice))} gorjeta)`}
                        </span>
                      </div>
                      {payTone.tone === "green" && !tipVal && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-2.5 py-2">
                          <Icon
                            name="alertCircle"
                            className="w-3.5 h-3.5 shrink-0"
                          />
                          O valor excede o preço em{" "}
                          {fmtEur((payNoTip - targetPrice))}. Se for
                          gorjeta, usa o campo acima.
                        </div>
                      )}
                    </div>
                  )}

                  {status !== "cancelled" && (
                    <div className="space-y-2">
                      <PaymentButton
                        label={busy ? "A guardar…" : "Guardar pagamento"}
                        tone={payTone.tone}
                        disabled={busy || billingReadOnly || payButtonNoValue}
                        title={
                          billingReadOnly
                            ? billingLockMsg
                            : payButtonNoValue
                              ? "Introduz um valor"
                              : undefined
                        }
                        onClick={handlePay}
                        className="w-full"
                      />
                      {payButtonNoValue && (
                        <button
                          type="button"
                          disabled={busy || billingReadOnly}
                          title={billingReadOnly ? billingLockMsg : undefined}
                          onClick={handleCompleteWithoutPayment}
                          className="w-full text-center text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline decoration-dotted underline-offset-2 disabled:opacity-50"
                        >
                          Concluir sem pagamento (dívida total)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Histórico de pagamentos ── */}
              {paymentHistory && paymentHistory.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Histórico</p>
                  {paymentHistory.map((entry, i) => {
                    const entryTotal = entry.cash + entry.mbway + entry.card;
                    const parts: string[] = [];
                    if (entry.cash > 0) parts.push(`dinheiro`);
                    if (entry.mbway > 0) parts.push(`MBway`);
                    if (entry.card > 0) parts.push(`cartão`);
                    if (entry.cash < 0 || entry.mbway < 0 || entry.card < 0) parts.push(`correção`);
                    return (
                      <div key={i} className="flex justify-between text-sm text-zinc-500">
                        <span>
                          {new Date(entry.at).toLocaleDateString("pt-PT", { dateStyle: "short" })}
                          {parts.length > 0 && ` · ${parts.join(", ")}`}
                        </span>
                        <span className={`font-medium ${entryTotal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {entryTotal >= 0 ? "+" : ""}{fmtEur(entryTotal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
  );
}
