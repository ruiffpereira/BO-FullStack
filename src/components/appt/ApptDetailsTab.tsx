import { fmtEur } from "../../lib/money"
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Icon } from "../../ui/icons.jsx";
import { Combobox } from "../Combobox";
import { StaffField } from "../StaffSelect";
import { TimeField } from "../TimeField";
import type { ApptEditor } from "./useApptEditor";

/** Aba «Detalhes»: hora, data, serviço, profissional, duração e contactos. */
export function ApptDetailsTab({ ctx }: { ctx: ApptEditor }) {
  const { showMoney, editServiceId, setEditServiceId, editStaffId, setEditStaffId, svc, canEdit, editTime, setEditTime, setShowDatePicker, datePickerBtnRef, originalDuration, editDuration, setEditDuration, totalPaid, editedServicePrice, priceMismatch, parsedEditDate, appt, services } = ctx;
  return (
            <div className="space-y-3">
              {/* Alerta: serviço com preço diferente do já pago → é preciso acertar */}
              {showMoney && priceMismatch !== 0 && (
                <div role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/60 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  {priceMismatch > 0
                    ? `O novo serviço custa ${fmtEur(editedServicePrice)}; já foram pagos ${fmtEur(totalPaid)} → falta cobrar ${fmtEur(priceMismatch)}. Ao guardar, a vaga volta a Confirmada até saldares.`
                    : `O novo serviço custa ${fmtEur(editedServicePrice)}; já foram pagos ${fmtEur(totalPaid)} → ${fmtEur(Math.abs(priceMismatch))} a mais (devolver ou ficar como gorjeta).`}
                </div>
              )}
              {/* Date + time */}
              <div className="grid grid-cols-2 gap-2">
                {canEdit ? (
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Hora</p>
                    <TimeField value={editTime} onChange={setEditTime} />
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                    <p className="text-[11px] text-zinc-400">Hora</p>
                    <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5 text-sm">
                      {appt.time}
                    </p>
                  </div>
                )}

                {canEdit ? (
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Data</p>
                    <button
                      ref={datePickerBtnRef}
                      type="button"
                      onClick={() => setShowDatePicker((v) => !v)}
                      className="w-full flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 hover:border-accent focus:outline-none focus:border-accent transition-colors"
                    >
                      <Icon
                        name="calendar"
                        className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                      />
                      <span className="truncate">
                        {format(parsedEditDate, "dd MMM yyyy", { locale: pt })}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                    <p className="text-[11px] text-zinc-400">Data</p>
                    <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5 text-sm">
                      {appt.date}
                    </p>
                  </div>
                )}
              </div>

              {/* Service */}
              {canEdit ? (
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Serviço</p>
                  <Combobox
                    value={editServiceId}
                    onChange={setEditServiceId}
                    options={services
                      .filter((s) => s.active !== false)
                      .map((s) => ({
                        value: s.serviceId,
                        label: showMoney
                          ? `${s.name} (${s.duration}min — ${fmtEur(Number(s.price))})`
                          : `${s.name} (${s.duration}min)`,
                      }))}
                    placeholder="Escolher serviço…"
                    searchPlaceholder="Pesquisar serviço…"
                  />
                </div>
              ) : (
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                  <p className="text-[11px] text-zinc-400">Serviço</p>
                  <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5 text-sm">
                    {svc?.name || appt.serviceName || "—"}
                  </p>
                </div>
              )}

              {/* Profissional (só se o tenant tem profissionais) */}
              {canEdit ? (
                <StaffField
                  value={editStaffId}
                  onChange={setEditStaffId}
                  serviceId={editServiceId}
                  leaves={["agenda.marcacoes"]}
                />
              ) : (
                appt.staff?.name && (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                    <p className="text-[11px] text-zinc-400">Profissional</p>
                    <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5 text-sm">{appt.staff.name}</p>
                  </div>
                )
              )}

              {/* Duration */}
              {canEdit && (
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Duração</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditDuration((d) => Math.max(5, d - 5))}
                      className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold text-base leading-none shrink-0"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={5}
                      step={5}
                      value={editDuration}
                      onChange={(e) =>
                        setEditDuration(
                          Math.max(5, Number(e.target.value) || 5),
                        )
                      }
                      className="w-16 text-center border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setEditDuration((d) => d + 5)}
                      className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold text-base leading-none shrink-0"
                    >
                      +
                    </button>
                    <span className="text-sm text-zinc-500">min</span>
                    {editDuration !== originalDuration && (
                      <span className="text-xs text-zinc-400 ml-auto">
                        padrão: {originalDuration}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Contact info */}
              <div className="space-y-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                {appt.clientEmail && (
                  <div className="flex items-center gap-2">
                    <Icon
                      name="mail"
                      className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                    />
                    <span className="truncate">{appt.clientEmail}</span>
                  </div>
                )}
                {appt.clientPhone && (
                  <div className="flex items-center gap-2">
                    <Icon
                      name="phone"
                      className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                    />
                    <span>{appt.clientPhone}</span>
                  </div>
                )}
                {appt.notes && (
                  <div className="flex items-start gap-2">
                    <Icon
                      name="edit"
                      className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5"
                    />
                    <span className="text-zinc-600 dark:text-zinc-300">
                      {appt.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
  );
}
