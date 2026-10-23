import { PaymentButton } from "./PaymentButton";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { Icon } from "../../ui/icons.jsx";
import { Button } from "../../ui/ui.jsx";
import { GuardButton } from "../GuardButton";
import type { ApptEditor } from "./useApptEditor";

/** Rodapé da modal: banners (reagendado / alterações) e as acções por modo/aba. */
export function ApptFooter({ ctx }: { ctx: ApptEditor }) {
  const { billingReadOnly, billingLockMsg, editMoney, editServiceId, svc, status, editMode, tab, confirmCancel, setConfirmCancel, editTime, editDate, originalDuration, editDuration, payTone, detailsChanged, hasChanges, parsedEditDate, buildSaveData, handleEditAppointment, handleCancelEdit, handleSave, handleCompleteWithoutPayment, busy, appt, services, onSetStatus, isSaving, isSettingStatus, rescheduledFrom } = ctx;
  return (
          <div className="flex flex-col gap-3 w-full">
            {/* Blue banner — Reagendado */}
            {rescheduledFrom && (
              <div className="rounded-xl border border-accent/20 bg-accent/[0.05] dark:bg-accent/[0.08] px-3 py-2.5 flex items-start gap-2.5">
                <Icon
                  name="calendar"
                  className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5"
                />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-accent uppercase tracking-wide text-[10px]">
                    Reagendado
                  </p>
                  <p className="line-through text-zinc-400">
                    {format(parseISO(rescheduledFrom.date), "EEE d MMM", {
                      locale: pt,
                    })}{" "}
                    · {rescheduledFrom.time}
                  </p>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                    {format(parsedEditDate, "EEE d MMM", { locale: pt })} ·{" "}
                    {editTime}
                  </p>
                </div>
              </div>
            )}
            {/* Blue banner — Alterações manuais */}
            {!rescheduledFrom && detailsChanged && (
              <div className="rounded-xl border border-accent/20 bg-accent/[0.05] dark:bg-accent/[0.08] px-3 py-2.5 flex items-start gap-2.5">
                <Icon
                  name="edit"
                  className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5"
                />
                <div className="text-xs space-y-1.5">
                  <p className="font-semibold text-accent uppercase tracking-wide text-[10px]">
                    Alterações
                  </p>
                  {(editDate !== appt.date || editTime !== appt.time) && (
                    <div className="space-y-0.5">
                      <p className="line-through text-zinc-400">
                        {format(parseISO(appt.date), "EEE d MMM", {
                          locale: pt,
                        })}{" "}
                        · {appt.time}
                      </p>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {format(parsedEditDate, "EEE d MMM", { locale: pt })} ·{" "}
                        {editTime}
                      </p>
                    </div>
                  )}
                  {editServiceId !== appt.serviceId && (
                    <div className="space-y-0.5">
                      <p className="line-through text-zinc-400">
                        {services.find((s) => s.serviceId === appt.serviceId)?.name || appt.serviceName || "—"}
                      </p>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {svc?.name ?? "—"}
                      </p>
                    </div>
                  )}
                  {editDuration !== originalDuration && (
                    <div className="space-y-0.5">
                      <p className="line-through text-zinc-400">
                        {originalDuration} min
                      </p>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {editDuration} min
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Ações — modo edição (Guardar/Cancelar) ou ações de ver, por aba. */}
            {editMode ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" disabled={busy} onClick={handleCancelEdit}>
                  Cancelar
                </Button>
                <div className="flex-1" />
                {editMode === "payment" ? (
                  // Botão único de pagamento (mesmo aspeto do fluxo novo): cor
                  // pelo tom (falta/certo/a mais), sem o "sem valor desativa"
                  // do fluxo novo — baixar a 0 aqui é reverter/anular, ação válida.
                  <PaymentButton
                    label={isSaving ? "A guardar…" : "Guardar pagamento"}
                    tone={payTone.tone}
                    disabled={!hasChanges || busy || billingReadOnly}
                    title={billingReadOnly ? billingLockMsg : undefined}
                    onClick={handleSave}
                  />
                ) : (
                  <GuardButton disabled={!hasChanges || busy} onClick={handleSave}>
                    {isSaving ? "A guardar…" : "Guardar"}
                  </GuardButton>
                )}
              </div>
            ) : tab === "details" ? (
              <>
                {status === "completed" ? (
                  /* Concluída (ver): destrancar para editar os detalhes. */
                  <GuardButton wrapperClassName="block w-full"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={handleEditAppointment}
                  >
                    Editar marcação
                  </GuardButton>
                ) : status !== "cancelled" ? (
                  <GuardButton
                    className="w-full"
                    wrapperClassName="block w-full"
                    disabled={!hasChanges || busy}
                    onClick={handleSave}
                  >
                    {isSaving ? "A guardar…" : "Guardar"}
                  </GuardButton>
                ) : null}
                {/* Equipa (B41 2b): sem `valores` (edit) não há aba Pagamento onde concluir — conclui-se aqui, com o
                    pagamento por registar (fica em dívida para quem tem a folha registar depois). */}
                {!editMoney && status !== "completed" && status !== "cancelled" && (
                  <GuardButton wrapperClassName="block w-full"
                    variant="outline"
                    className="w-full"
                    disabled={isSettingStatus || hasChanges}
                    title={hasChanges ? "Guarda as alterações antes de concluir" : undefined}
                    onClick={handleCompleteWithoutPayment}
                  >
                    {isSettingStatus ? "A concluir…" : "Concluir marcação"}
                  </GuardButton>
                )}
                {/* Cancelar marcação / Reativar / Confirmar — só na aba Detalhes */}
                {status === "cancelled" ? (
                  <GuardButton wrapperClassName="block w-full"
                    variant="outline"
                    className="w-full"
                    disabled={isSettingStatus}
                    onClick={() => onSetStatus(appt.appointmentId, "confirmed", buildSaveData())}
                  >
                    {isSettingStatus ? "A reativar…" : "Reativar"}
                  </GuardButton>
                ) : status === "completed" ? null : confirmCancel ? (
                  <GuardButton wrapperClassName="block w-full"
                    variant="outline"
                    className="w-full border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-300 dark:hover:border-red-700"
                    disabled={isSettingStatus}
                    onClick={() => onSetStatus(appt.appointmentId, "cancelled")}
                  >
                    {isSettingStatus ? "A cancelar…" : "Confirmar cancelamento"}
                  </GuardButton>
                ) : (
                  <GuardButton wrapperClassName="block w-full"
                    variant="outline"
                    className="w-full border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-300 dark:hover:border-red-700"
                    disabled={isSettingStatus}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancelar marcação
                  </GuardButton>
                )}
              </>
            ) : null /* Aba Pagamento: ações no conteúdo (Pagar / Pagar dívida / Editar) */}
          </div>
  );
}
