import { useState, useRef } from 'react'
import { format, startOfMonth, eachDayOfInterval, startOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Icon } from '../ui/icons.jsx'
import { Modal, Avatar, Badge, Button } from '../ui/ui.jsx'
import type { Appointment, AppointmentStatusEnum } from '../gen/backoffice/types/Appointment.js'
import type { Service } from '../gen/backoffice/types/Service.js'

export const STATUS_LABELS: Record<AppointmentStatusEnum, string> = {
  pending: 'Pendente', confirmed: 'Confirmada', completed: 'Concluída', cancelled: 'Cancelada',
}

const SERVICE_COLORS = ['#2A6FDB', '#1F8A5B', '#D97757', '#7C5CDB', '#E6B450', '#0EA5A4', '#DB2A6F', '#5C2ADB']

function stableColorForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return SERVICE_COLORS[h % SERVICE_COLORS.length]
}

export function colorForService(serviceId: string, services: Service[]): string {
  const svc = services.find((s) => s.serviceId === serviceId)
  return svc?.color ?? stableColorForId(serviceId)
}

const DAY_NAMES_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function ApptModal({ appt, services, onClose, onSave, onDelete, isSaving, isPendingDelete, rescheduledFrom, initialDate, initialTime, onSaveAndNotify, isNotifying, onOpenCustomer }: {
  appt: Appointment; services: Service[]; onClose: () => void
  onSave: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void; isSaving: boolean; isPendingDelete: boolean
  rescheduledFrom?: { date: string; time: string }
  initialDate?: string
  initialTime?: string
  onSaveAndNotify?: (id: string, data: Record<string, unknown>) => void
  isNotifying?: boolean
  onOpenCustomer?: () => void
}) {
  const [editServiceId, setEditServiceId] = useState(appt.serviceId)
  const svc = services.find((s) => s.serviceId === editServiceId)
  const status = appt.status ?? 'pending'
  const canEdit = status === 'pending' || status === 'confirmed'
  const [tab, setTab] = useState<'details' | 'payment'>('details')

  const [editTime, setEditTime] = useState(initialTime ?? appt.time)
  const [editDate, setEditDate] = useState(initialDate ?? appt.date)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(() => startOfMonth(parseISO(initialDate ?? appt.date)))
  const datePickerBtnRef = useRef<HTMLButtonElement>(null)

  const originalDuration = appt.duration ?? svc?.duration ?? 30
  const [editDuration, setEditDuration] = useState(originalDuration)

  const [cash, setCash] = useState(appt.paymentCash != null ? String(appt.paymentCash) : '')
  const [mbway, setMbway] = useState(appt.paymentMbway != null ? String(appt.paymentMbway) : '')
  const [card, setCard] = useState(appt.paymentCard != null ? String(appt.paymentCard) : '')
  const [tip, setTip] = useState('')

  const isPaid = !!appt.paidAt
  const tipVal = parseFloat(tip) || 0
  const payTotal = (parseFloat(cash) || 0) + (parseFloat(mbway) || 0) + (parseFloat(card) || 0) + tipVal
  const price = Number(svc?.price ?? 0)
  const isExact = payTotal > 0 && Math.abs(payTotal - price) < 0.01
  const isOver = payTotal > price + 0.01
  const detailsChanged =
    editTime !== appt.time ||
    editDate !== appt.date ||
    editServiceId !== appt.serviceId ||
    editDuration !== originalDuration

  const pickerGridStart = startOfWeek(startOfMonth(pickerMonth), { weekStartsOn: 1 })
  const pickerGridDays = eachDayOfInterval({ start: pickerGridStart, end: addDays(pickerGridStart, 41) })
  const parsedEditDate = parseISO(editDate)

  const handleSaveDetails = () => {
    const data: Record<string, unknown> = {}
    if (editTime !== appt.time) data.time = editTime
    if (editDate !== appt.date) data.date = editDate
    if (editServiceId !== appt.serviceId) data.serviceId = editServiceId
    if (editDuration !== originalDuration) data.duration = editDuration
    if (Object.keys(data).length) onSave(appt.appointmentId, data)
  }

  const handleSaveAndNotify = () => {
    const data: Record<string, unknown> = {}
    if (editTime !== appt.time) data.time = editTime
    if (editDate !== appt.date) data.date = editDate
    if (editServiceId !== appt.serviceId) data.serviceId = editServiceId
    if (editDuration !== originalDuration) data.duration = editDuration
    if (Object.keys(data).length && onSaveAndNotify) onSaveAndNotify(appt.appointmentId, data)
  }

  const handleStatusChange = (s: AppointmentStatusEnum) => onSave(appt.appointmentId, { status: s })

  const handleRegisterPayment = () => {
    onSave(appt.appointmentId, {
      paymentCash: (parseFloat(cash) || 0) + tipVal,
      paymentMbway: parseFloat(mbway) || 0,
      paymentCard: parseFloat(card) || 0,
    })
  }

  const handleCancelPayment = () => {
    if (confirm('Anular o pagamento registado?')) onSave(appt.appointmentId, { cancelPayment: true })
  }

  const btnRect = datePickerBtnRef.current?.getBoundingClientRect()

  return (
    <>
      <Modal open onClose={onClose} title="Marcação" width="max-w-sm"
        footer={
          <>
            <Button variant="danger" disabled={isPendingDelete} onClick={() => onDelete(appt.appointmentId)}>
              {isPendingDelete ? 'A eliminar…' : 'Eliminar'}
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={onClose}>Fechar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={appt.clientName} color={colorForService(appt.serviceId, services)} size={44} />
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">{appt.clientName}</p>
              <Badge tone={status === 'confirmed' || status === 'completed' ? 'green' : status === 'cancelled' ? 'red' : 'amber'} dot>
                {STATUS_LABELS[status]}
              </Badge>
            </div>
            {onOpenCustomer && (
              <button
                type="button"
                onClick={onOpenCustomer}
                className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:border-accent hover:text-accent transition"
              >
                <Icon name="users" className="w-3.5 h-3.5" />
                Cliente
              </button>
            )}
            {isPaid && (
              <span className={`${onOpenCustomer ? '' : 'ml-auto'} flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full`}>
                <Icon name="euro" className="w-3 h-3" /> Pago
              </span>
            )}
          </div>

          <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            {(['details', 'payment'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${tab === t ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                {t === 'details' ? 'Detalhes' : 'Pagamento'}
              </button>
            ))}
          </div>

          {tab === 'details' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {canEdit ? (
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Hora</p>
                    <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)}
                      className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent" />
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                    <p className="text-xs text-zinc-400">Hora</p>
                    <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5">{appt.time}</p>
                  </div>
                )}
                {canEdit ? (
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Data</p>
                    <button ref={datePickerBtnRef} type="button"
                      onClick={() => setShowDatePicker((v) => !v)}
                      className="w-full flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 hover:border-accent focus:outline-none focus:border-accent">
                      <Icon name="calendar" className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>{format(parsedEditDate, 'dd MMM yyyy', { locale: pt })}</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                    <p className="text-xs text-zinc-400">Data</p>
                    <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5">{appt.date}</p>
                  </div>
                )}
              </div>

              {canEdit ? (
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Serviço</p>
                  <select value={editServiceId} onChange={(e) => setEditServiceId(e.target.value)}
                    className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent">
                    {services.filter((s) => s.active !== false).map((s) => (
                      <option key={s.serviceId} value={s.serviceId}>{s.name} ({s.duration}min — {Number(s.price).toFixed(2)}€)</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                  <p className="text-xs text-zinc-400">Serviço</p>
                  <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5">{svc?.name ?? '—'}</p>
                </div>
              )}

              {canEdit && (
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Duração</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setEditDuration((d) => Math.max(5, d - 5))}
                      className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-base font-bold leading-none">−</button>
                    <input type="number" min={5} step={5} value={editDuration}
                      onChange={(e) => setEditDuration(Math.max(5, Number(e.target.value) || 5))}
                      className="w-16 text-center border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent" />
                    <button type="button" onClick={() => setEditDuration((d) => d + 5)}
                      className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-base font-bold leading-none">+</button>
                    <span className="text-sm text-zinc-500">min</span>
                    {editDuration !== originalDuration && (
                      <span className="text-xs text-zinc-400">(padrão: {originalDuration})</span>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="flex items-center gap-2"><Icon name="mail" className="w-4 h-4 text-zinc-400" />{appt.clientEmail}</div>
                <div className="flex items-center gap-2"><Icon name="phone" className="w-4 h-4 text-zinc-400" />{appt.clientPhone}</div>
                {appt.notes && <div className="flex items-start gap-2"><Icon name="edit" className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />{appt.notes}</div>}
              </div>

              {canEdit && detailsChanged && !rescheduledFrom && (
                <Button className="w-full" disabled={isSaving} onClick={handleSaveDetails}>
                  {isSaving ? 'A guardar…' : 'Guardar alterações'}
                </Button>
              )}

              {rescheduledFrom && (
                <div className="rounded-xl border border-accent/20 bg-accent/[0.05] dark:bg-accent/[0.08] p-3 space-y-2.5">
                  <div className="flex items-center gap-2 text-accent">
                    <Icon name="calendar" className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Reagendado</span>
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-0.5">
                    <p className="line-through text-zinc-400">{format(parseISO(rescheduledFrom.date), 'EEE d MMM', { locale: pt })} · {rescheduledFrom.time}</p>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-100">{format(parseISO(editDate), 'EEE d MMM', { locale: pt })} · {editTime}</p>
                  </div>
                  {canEdit && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" disabled={isSaving || isNotifying} onClick={handleSaveDetails}>
                        {isSaving ? 'A guardar…' : 'Guardar'}
                      </Button>
                      <Button disabled={isSaving || isNotifying} onClick={handleSaveAndNotify}>
                        {isSaving || isNotifying ? 'A enviar…' : 'Guardar e notificar'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1.5">Alterar estado</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['pending', 'confirmed', 'completed', 'cancelled'] as AppointmentStatusEnum[]).map((s) => (
                    <button key={s} disabled={isSaving || s === status} onClick={() => handleStatusChange(s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition disabled:opacity-40 ${s === status ? 'bg-accent text-white border-accent cursor-default' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'payment' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-sm">
                <span className="text-zinc-500">{svc?.name ?? 'Serviço'}</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{price.toFixed(2)} €</span>
              </div>

              {isPaid ? (
                <div className="space-y-3">
                  <div className="space-y-2 text-sm">
                    {appt.paymentCash != null && Number(appt.paymentCash) > 0 && (
                      <div className="flex justify-between"><span className="text-zinc-500">Dinheiro</span><span className="font-medium">{Number(appt.paymentCash).toFixed(2)} €</span></div>
                    )}
                    {appt.paymentMbway != null && Number(appt.paymentMbway) > 0 && (
                      <div className="flex justify-between"><span className="text-zinc-500">MBway</span><span className="font-medium">{Number(appt.paymentMbway).toFixed(2)} €</span></div>
                    )}
                    {appt.paymentCard != null && Number(appt.paymentCard) > 0 && (
                      <div className="flex justify-between"><span className="text-zinc-500">Cartão</span><span className="font-medium">{Number(appt.paymentCard).toFixed(2)} €</span></div>
                    )}
                    {(() => {
                      const paidTotal = Number(appt.paymentCash ?? 0) + Number(appt.paymentMbway ?? 0) + Number(appt.paymentCard ?? 0)
                      const paidTip = paidTotal - price
                      const hasTip = paidTip > 0.01
                      return (
                        <>
                          {hasTip && (
                            <div className="flex justify-between text-zinc-500">
                              <span>Gorjeta</span>
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">{paidTip.toFixed(2)} €</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700 font-semibold">
                            <span>Total recebido</span>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {paidTotal.toFixed(2)} €
                            </span>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                  <p className="text-xs text-zinc-400">Registado em {new Date(appt.paidAt!).toLocaleDateString('pt-PT', { dateStyle: 'medium' })}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[['Dinheiro', cash, setCash], ['MBway', mbway, setMbway], ['Cartão', card, setCard]].map(([label, val, setter]) => (
                      <div key={label as string}>
                        <p className="text-xs text-zinc-500 mb-1">{label as string}</p>
                        <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                          <input type="number" min={0} step={0.01} value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} placeholder="0.00"
                            className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none w-0" />
                          <span className="px-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 self-stretch flex items-center">€</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" disabled={isSaving} onClick={handleRegisterPayment}>
                      {isSaving ? 'A guardar…' : 'Actualizar pagamento'}
                    </Button>
                    <Button variant="outline" disabled={isSaving} onClick={handleCancelPayment} className="text-red-500 border-red-200 hover:bg-red-50">
                      Anular
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[['Dinheiro', cash, setCash], ['MBway', mbway, setMbway], ['Cartão', card, setCard]].map(([label, val, setter]) => (
                      <div key={label as string}>
                        <p className="text-xs text-zinc-500 mb-1">{label as string}</p>
                        <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                          <input type="number" min={0} step={0.01} value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} placeholder="0.00"
                            className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none w-0" />
                          <span className="px-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 self-stretch flex items-center">€</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                      Gorjeta <span className="text-zinc-300 dark:text-zinc-600">(opcional)</span>
                    </p>
                    <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden w-28">
                      <input type="number" min={0} step={0.01} value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0.00"
                        className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none w-0" />
                      <span className="px-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 self-stretch flex items-center">€</span>
                    </div>
                  </div>
                  {payTotal > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm font-medium px-1">
                        <span className="text-zinc-500">Total</span>
                        <span className={isExact ? 'text-emerald-600 dark:text-emerald-400' : isOver ? 'text-orange-500 dark:text-orange-400' : 'text-amber-500'}>
                          {payTotal.toFixed(2)} €
                          {isExact && ' ✓'}
                          {!isExact && !isOver && ` (faltam ${(price - payTotal).toFixed(2)} €)`}
                          {isOver && !tipVal && ` (+${(payTotal - price).toFixed(2)} € gorjeta)`}
                        </span>
                      </div>
                      {isOver && !tipVal && (
                        <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-lg px-2.5 py-2">
                          <Icon name="alertCircle" className="w-3.5 h-3.5 shrink-0" />
                          O valor excede o preço em {(payTotal - price).toFixed(2)} €. Se for gorjeta, usa o campo acima.
                        </div>
                      )}
                    </div>
                  )}
                  <Button className="w-full" disabled={isSaving || payTotal <= 0} onClick={handleRegisterPayment}>
                    {isSaving ? 'A registar…' : 'Registar pagamento'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {showDatePicker && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setShowDatePicker(false)} />
          <div className="fixed z-[200] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-3 w-64"
            style={{
              top: btnRect ? btnRect.bottom + 6 : 100,
              left: btnRect ? Math.min(btnRect.left, window.innerWidth - 268) : 100,
            }}>
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setPickerMonth((m) => subMonths(m, 1))}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
                <Icon name="chevronLeft" className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium capitalize">
                {format(pickerMonth, 'MMMM yyyy', { locale: pt })}
              </span>
              <button type="button" onClick={() => setPickerMonth((m) => addMonths(m, 1))}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
                <Icon name="chevronRight" className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES_SHORT.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-zinc-400 py-0.5">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {pickerGridDays.map((day) => {
                const isSelected = isSameDay(day, parsedEditDate)
                const inMonth = isSameMonth(day, pickerMonth)
                return (
                  <button key={day.toISOString()} type="button"
                    onClick={() => { setEditDate(format(day, 'yyyy-MM-dd')); setShowDatePicker(false) }}
                    className={`h-7 w-full rounded text-xs font-medium transition ${isSelected ? 'bg-accent text-white' : inMonth ? 'text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'text-zinc-300 dark:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
