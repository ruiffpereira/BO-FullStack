import { useState, useMemo, useEffect, useRef } from 'react'
import { format, addDays, startOfWeek, isSameDay, addWeeks, subWeeks } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import kubbFetch from '@kubb/plugin-client/clients/axios'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Button, IconButton, Badge, Avatar, Modal, Input, Select, PageHeader } from '../ui/ui.jsx'

import { useGetScheduleAppointments, getScheduleAppointmentsQueryKey } from '../gen/backoffice/hooks/useGetScheduleAppointments.js'
import { usePostScheduleAppointments } from '../gen/backoffice/hooks/usePostScheduleAppointments.js'
import { usePutScheduleAppointmentsId } from '../gen/backoffice/hooks/usePutScheduleAppointmentsId.js'
import { useDeleteScheduleAppointmentsId } from '../gen/backoffice/hooks/useDeleteScheduleAppointmentsId.js'
import { useGetScheduleServices, getScheduleServicesQueryKey } from '../gen/backoffice/hooks/useGetScheduleServices.js'
import { usePostScheduleServices } from '../gen/backoffice/hooks/usePostScheduleServices.js'
import { usePutScheduleServicesId } from '../gen/backoffice/hooks/usePutScheduleServicesId.js'
import { useDeleteScheduleServicesId } from '../gen/backoffice/hooks/useDeleteScheduleServicesId.js'
import { useGetScheduleWorkingHours, getScheduleWorkingHoursQueryKey } from '../gen/backoffice/hooks/useGetScheduleWorkingHours.js'
import { usePostScheduleWorkingHours } from '../gen/backoffice/hooks/usePostScheduleWorkingHours.js'
import { useGetScheduleBlockedSlots, getScheduleBlockedSlotsQueryKey } from '../gen/backoffice/hooks/useGetScheduleBlockedSlots.js'
import { usePostScheduleBlockedSlots } from '../gen/backoffice/hooks/usePostScheduleBlockedSlots.js'
import { useDeleteScheduleBlockedSlotsId } from '../gen/backoffice/hooks/useDeleteScheduleBlockedSlotsId.js'

import type { Appointment, AppointmentStatusEnum } from '../gen/backoffice/types/Appointment.js'
import type { Service } from '../gen/backoffice/types/Service.js'
import type { WorkingHours } from '../gen/backoffice/types/WorkingHours.js'

// ─── Constants ────────────────────────────────────────────────────────────────
const AG_H_START = 8
const AG_H_END = 20
const AG_ROW_H = 60

const STATUS_LABELS: Record<AppointmentStatusEnum, string> = {
  pending: 'Pendente', confirmed: 'Confirmada', completed: 'Concluída', cancelled: 'Cancelada',
}
const SERVICE_COLORS = ['#2A6FDB', '#1F8A5B', '#D97757', '#7C5CDB', '#E6B450', '#0EA5A4', '#DB2A6F', '#5C2ADB']
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const FULL_DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function colorForService(serviceId: string, services: Service[]) {
  const idx = services.findIndex((s) => s.serviceId === serviceId)
  const svc = services[idx]
  return svc?.color ?? SERVICE_COLORS[idx % SERVICE_COLORS.length] ?? '#2A6FDB'
}

// ─── Overlap layout ───────────────────────────────────────────────────────────
// 1px = 1min quando AG_ROW_H=60. O min-height de 24px equivale a 24min visuais —
// usamos isso como end mínimo para detectar sobreposições visuais de serviços curtos.
const MIN_VISUAL_MINS = Math.ceil((24 / AG_ROW_H) * 60) // = 24min

function apptMinutes(appt: Appointment) {
  const [h, m] = appt.time.split(':').map(Number)
  return h * 60 + m
}
function apptVisualEnd(appt: Appointment, services: Service[]) {
  const svc = services.find((s) => s.serviceId === appt.serviceId)
  return apptMinutes(appt) + Math.max(svc?.duration ?? 30, MIN_VISUAL_MINS)
}
function overlaps(a: Appointment, b: Appointment, services: Service[]) {
  return apptMinutes(a) < apptVisualEnd(b, services) && apptMinutes(b) < apptVisualEnd(a, services)
}

function computeColumns(appts: Appointment[], services: Service[]) {
  const sorted = [...appts].sort((a, b) => apptMinutes(a) - apptMinutes(b))
  const result: { appt: Appointment; col: number; totalCols: number }[] = []

  // Group appointments that overlap with any member of the group
  const groups: Appointment[][] = []
  for (const appt of sorted) {
    const grp = groups.find((g) => g.some((x) => overlaps(x, appt, services)))
    if (grp) grp.push(appt)
    else groups.push([appt])
  }

  for (const group of groups) {
    const cols: Appointment[][] = []
    for (const appt of group) {
      let ci = cols.findIndex((col) => !col.some((x) => overlaps(x, appt, services)))
      if (ci === -1) { ci = cols.length; cols.push([]) }
      cols[ci].push(appt)
      result.push({ appt, col: ci, totalCols: 0 })
    }
    const n = cols.length
    for (const r of result) {
      if (group.includes(r.appt)) r.totalCols = n
    }
  }
  return result
}

// ─── Appointment detail modal ─────────────────────────────────────────────────
function ApptModal({ appt, services, onClose, onStatusChange, onDelete, isPendingUpdate, isPendingDelete }: {
  appt: Appointment; services: Service[]; onClose: () => void
  onStatusChange: (id: string, status: AppointmentStatusEnum) => void
  onDelete: (id: string) => void; isPendingUpdate: boolean; isPendingDelete: boolean
}) {
  const svc = services.find((s) => s.serviceId === appt.serviceId)
  const status = appt.status ?? 'pending'
  return (
    <Modal open onClose={onClose} title="Marcação" width="max-w-sm"
      footer={<><Button variant="danger" disabled={isPendingDelete} onClick={() => onDelete(appt.appointmentId)}>{isPendingDelete ? 'A eliminar…' : 'Eliminar'}</Button><div className="flex-1" /><Button variant="ghost" onClick={onClose}>Fechar</Button></>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={appt.clientName} color={colorForService(appt.serviceId, services)} size={44} />
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white">{appt.clientName}</p>
            <Badge tone={status === 'confirmed' || status === 'completed' ? 'green' : status === 'cancelled' ? 'red' : 'amber'} dot>{STATUS_LABELS[status]}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {[['Serviço', svc?.name ?? '—'], ['Data', appt.date], ['Hora', appt.time]].map(([k, v]) => (
            <div key={k} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
              <p className="text-xs text-zinc-400">{k}</p>
              <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5">{v}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
          <div className="flex items-center gap-2"><Icon name="mail" className="w-4 h-4 text-zinc-400" />{appt.clientEmail}</div>
          <div className="flex items-center gap-2"><Icon name="phone" className="w-4 h-4 text-zinc-400" />{appt.clientPhone}</div>
          {appt.notes && <div className="flex items-start gap-2"><Icon name="edit" className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />{appt.notes}</div>}
        </div>
        {status !== 'cancelled' && (
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-1.5">Alterar estado</p>
            <div className="flex flex-wrap gap-1.5">
              {(['pending', 'confirmed', 'completed', 'cancelled'] as AppointmentStatusEnum[]).map((s) => (
                <button key={s} disabled={isPendingUpdate || s === status} onClick={() => onStatusChange(appt.appointmentId, s)} className={`px-3 py-1 rounded-full text-xs font-medium border transition disabled:opacity-40 ${s === status ? 'bg-accent text-white border-accent cursor-default' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>{STATUS_LABELS[s]}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── New appointment modal ────────────────────────────────────────────────────
function NovaApptModal({ date, open, onClose, services, onCreate, isPending }: {
  date: Date; open: boolean; onClose: () => void
  services: Service[]; onCreate: (data: any) => void; isPending: boolean
}) {
  const [form, setForm] = useState({ time: '09:00', serviceId: '', clientName: '', clientEmail: '', clientPhone: '', notes: '' })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.serviceId || !form.clientName || !form.clientEmail || !form.clientPhone) { toast.error('Preenche todos os campos obrigatórios.'); return }
    onCreate({ ...form, date: format(date, 'yyyy-MM-dd') })
  }
  return (
    <Modal open={open} onClose={onClose} title={`Nova marcação — ${format(date, 'dd MMM', { locale: pt })}`} width="max-w-sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="nova-appt-form" disabled={isPending}>{isPending ? 'A guardar…' : 'Criar marcação'}</Button></>}
    >
      <form id="nova-appt-form" onSubmit={handleSubmit} className="space-y-3">
        <Select label="Serviço *" value={form.serviceId} onChange={set('serviceId')}>
          <option value="">Escolher serviço</option>
          {services.filter((s) => s.active !== false).map((s) => <option key={s.serviceId} value={s.serviceId}>{s.name} ({s.duration}min — {Number(s.price).toFixed(2)}€)</option>)}
        </Select>
        <Input label="Hora *" type="time" value={form.time} onChange={set('time')} />
        <Input label="Nome do cliente *" value={form.clientName} onChange={set('clientName')} placeholder="João Mendes" />
        <Input label="Email *" type="email" value={form.clientEmail} onChange={set('clientEmail')} placeholder="joao@email.com" />
        <Input label="Telefone *" value={form.clientPhone} onChange={set('clientPhone')} placeholder="912 345 678" />
        <Input label="Notas (opcional)" value={form.notes} onChange={set('notes')} />
      </form>
    </Modal>
  )
}

// ─── Calendar view ────────────────────────────────────────────────────────────
function CalendarioView() {
  const { authHeader } = useAuth()
  const qc = useQueryClient()
  const headers = authHeader()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selAppt, setSelAppt] = useState<Appointment | null>(null)
  const [novaDate, setNovaDate] = useState<Date | null>(null)

  const month = format(weekStart, 'yyyy-MM')
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: AG_H_END - AG_H_START }, (_, i) => AG_H_START + i)

  const { data: appointments = [], isLoading } = useGetScheduleAppointments({ month }, { client: { headers } })
  const { data: services = [] } = useGetScheduleServices({ client: { headers } })

  const invalidate = () => qc.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() })
  const createAppt = usePostScheduleAppointments({ client: { headers }, mutation: { onSuccess: () => { toast.success('Marcação criada'); invalidate() }, onError: (error) => toast.error(getApiError(error)) } })
  const updateAppt = usePutScheduleAppointmentsId({ client: { headers }, mutation: { onSuccess: () => { toast.success('Estado actualizado'); invalidate(); setSelAppt(null) }, onError: (error) => toast.error(getApiError(error)) } })
  const deleteAppt = useDeleteScheduleAppointmentsId({ client: { headers }, mutation: { onSuccess: () => { toast.success('Marcação eliminada'); invalidate(); setSelAppt(null) }, onError: (error) => toast.error(getApiError(error)) } })

  const pending = appointments.filter((a) => a.status === 'pending')

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 h-[calc(100vh-17rem)] min-h-[420px]">
      <Card className="overflow-hidden flex flex-col min-h-0">
        {/* ── Navegação ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-1">
            <IconButton icon="chevronLeft" label="Semana anterior" onClick={() => setWeekStart((d) => subWeeks(d, 1))} />
            <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Hoje</Button>
            <IconButton icon="chevronRight" label="Próxima semana" onClick={() => setWeekStart((d) => addWeeks(d, 1))} />
          </div>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 capitalize">{format(weekStart, 'MMMM yyyy', { locale: pt })}</span>
        </div>

        {/* ── Área com scroll ── */}
        <div className="overflow-auto flex-1 min-h-0">
          <div className="min-w-[600px]">
            {/* cabeçalho dos dias — sticky */}
            <div className="grid sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800" style={{ gridTemplateColumns: `48px repeat(6, 1fr)` }}>
              <div />
              {days.map((day) => {
                const isToday = isSameDay(day, new Date())
                return (
                  <div key={day.toISOString()} className="px-2 py-2 text-center border-l border-zinc-50 dark:border-zinc-800/50">
                    <p className="text-xs text-zinc-400 uppercase tracking-wide">{DAY_NAMES[day.getDay()]}</p>
                    <p className={`text-lg font-semibold leading-tight ${isToday ? 'text-accent' : 'text-zinc-800 dark:text-zinc-100'}`}>{day.getDate()}</p>
                  </div>
                )
              })}
            </div>

            {/* grelha de horas */}
            <div className="grid relative" style={{ gridTemplateColumns: `48px repeat(6, 1fr)` }}>
              <div>
                {hours.map((h) => (
                  <div key={h} className="text-right pr-2 text-[10px] text-zinc-400 tabular-nums" style={{ height: AG_ROW_H }}>
                    <span className="-translate-y-2 inline-block">{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>
              {days.map((day) => {
                const dayAppts = appointments.filter((a) => isSameDay(new Date(a.date + 'T00:00:00'), day) && a.status !== 'cancelled')
                const layout = computeColumns(dayAppts, services)
                return (
                  <div key={day.toISOString()} className="relative border-l border-zinc-50 dark:border-zinc-800/50">
                    {hours.map((h) => <div key={h} className="border-b border-zinc-50 dark:border-zinc-800/40" style={{ height: AG_ROW_H }} />)}
                    <button onClick={() => setNovaDate(day)} className="absolute inset-0 w-full opacity-0 hover:opacity-100 transition-opacity z-0" aria-label={`Nova marcação ${format(day, 'dd/MM')}`} />
                    {isLoading
                      ? <div className="absolute inset-2 top-2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 h-10" />
                      : layout.map(({ appt, col, totalCols }) => {
                          const svc = services.find((s) => s.serviceId === appt.serviceId)
                          const color = colorForService(appt.serviceId, services)
                          const [hh, mm] = appt.time.split(':').map(Number)
                          const top = ((hh + mm / 60) - AG_H_START) * AG_ROW_H
                          const height = ((svc?.duration ?? 30) / 60) * AG_ROW_H - 4
                          const leftPct = (col / totalCols) * 100
                          const widthPct = (1 / totalCols) * 100
                          return (
                            <button
                              key={appt.appointmentId}
                              onClick={(e) => { e.stopPropagation(); setSelAppt(appt) }}
                              className="absolute rounded-lg px-2 py-1 text-left overflow-hidden z-10 hover:shadow-md hover:z-20 transition-shadow"
                              style={{
                                top: top + 2,
                                height: Math.max(height, 24),
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${widthPct}% - 4px)`,
                                background: `${color}18`,
                                borderLeft: `3px solid ${color}`,
                                border: `1px solid ${color}30`,
                              }}
                            >
                              <p className="text-[10px] font-semibold leading-tight truncate text-zinc-800 dark:text-zinc-100">{appt.time} {appt.clientName}</p>
                              {svc && <p className="text-[9px] text-zinc-500 truncate">{svc.name}</p>}
                            </button>
                          )
                        })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4 overflow-y-auto min-h-0">
        <Card className="p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
            <Icon name="clock" className="w-4 h-4 text-amber-500" />Por confirmar{pending.length > 0 && <Badge tone="amber">{pending.length}</Badge>}
          </h3>
          <div className="mt-3 space-y-2">
            {pending.length === 0 ? <p className="text-sm text-zinc-400">Tudo confirmado ✓</p> :
              pending.map((a) => {
                const svc = services.find((s) => s.serviceId === a.serviceId)
                return (
                  <div key={a.appointmentId} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <span className="w-1.5 h-9 rounded-full shrink-0" style={{ background: colorForService(a.serviceId, services) }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{a.clientName}</p>
                      <p className="text-xs text-zinc-400">{a.date} · {a.time}{svc ? ` · ${svc.name}` : ''}</p>
                    </div>
                    <IconButton icon="check" label="Confirmar" onClick={() => updateAppt.mutate({ id: a.appointmentId, data: { status: 'confirmed' } })} className="text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" />
                  </div>
                )
              })}
          </div>
        </Card>
        <Card className="p-4">
          <Button className="w-full" icon="plus" onClick={() => setNovaDate(new Date())}>Nova marcação</Button>
        </Card>
      </div>

      {selAppt && <ApptModal appt={selAppt} services={services} onClose={() => setSelAppt(null)} onStatusChange={(id, status) => updateAppt.mutate({ id, data: { status } })} onDelete={(id) => deleteAppt.mutate({ id })} isPendingUpdate={updateAppt.isPending} isPendingDelete={deleteAppt.isPending} />}
      {novaDate && <NovaApptModal date={novaDate} open onClose={() => setNovaDate(null)} services={services} onCreate={(data) => createAppt.mutate({ data })} isPending={createAppt.isPending} />}
    </div>
  )

}

// ─── Services panel ───────────────────────────────────────────────────────────
type SvcForm = { name: string; duration: string; price: string; description: string; active: boolean; color: string }
const emptySvcForm: SvcForm = { name: '', duration: '30', price: '', description: '', active: true, color: '#2A6FDB' }

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api'

function ServicosPanel() {
  const { authHeader } = useAuth()
  const qc = useQueryClient()
  const headers = authHeader()
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState<SvcForm>(emptySvcForm)
  const [localOrder, setLocalOrder] = useState<string[]>([])
  const dragIndexRef = useRef<number | null>(null)

  const { data: services = [], isLoading } = useGetScheduleServices({ client: { headers } })
  const invalidate = () => qc.invalidateQueries({ queryKey: getScheduleServicesQueryKey() })

  useEffect(() => {
    if (services.length) setLocalOrder(services.map((s) => s.serviceId))
  }, [services])

  const orderedServices = localOrder
    .map((id) => services.find((s) => s.serviceId === id))
    .filter((s): s is Service => !!s)

  const reorder = useMutation({
    mutationFn: async (order: string[]) => {
      const res = await kubbFetch<unknown, Error, { order: string[] }>({
        method: 'PATCH', url: '/schedule/services/reorder', baseURL: API_BASE,
        data: { order }, headers: authHeader(),
      })
      return res.data
    },
    onSuccess: () => invalidate(),
    onError: () => { toast.error('Erro ao reordenar'); setLocalOrder(services.map((s) => s.serviceId)) },
  })

  const create = usePostScheduleServices({ client: { headers }, mutation: { onSuccess: () => { toast.success('Serviço criado'); invalidate(); setModal(false) }, onError: (error) => toast.error(getApiError(error)) } })
  const update = usePutScheduleServicesId({ client: { headers }, mutation: { onSuccess: () => { toast.success('Serviço actualizado'); invalidate(); setModal(false) }, onError: (error) => toast.error(getApiError(error)) } })
  const remove = useDeleteScheduleServicesId({ client: { headers }, mutation: { onSuccess: () => { toast.success('Serviço eliminado'); invalidate() }, onError: (error) => toast.error(getApiError(error)) } })

  const openEdit = (s: Service) => {
    setEditing(s)
    setForm({ name: s.name, duration: String(s.duration), price: String(s.price), description: s.description ?? '', active: s.active ?? true, color: s.color ?? '#2A6FDB' })
    setModal(true)
  }
  const handleSave = () => {
    const data = { name: form.name, duration: parseInt(form.duration), price: parseFloat(form.price), description: form.description || undefined, active: form.active, color: form.color }
    if (editing) update.mutate({ id: editing.serviceId, data })
    else create.mutate({ data })
  }

  const handleDragStart = (index: number) => { dragIndexRef.current = index }
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === index) return
    const next = [...localOrder]
    const [moved] = next.splice(from, 1)
    next.splice(index, 0, moved)
    setLocalOrder(next)
    dragIndexRef.current = index
  }
  const handleDrop = () => { reorder.mutate(localOrder); dragIndexRef.current = null }
  const handleDragEnd = () => { dragIndexRef.current = null }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{services.length} serviços · arrasta para reordenar</p>
        <Button icon="plus" size="sm" onClick={() => { setEditing(null); setForm(emptySvcForm); setModal(true) }}>Novo serviço</Button>
      </div>
      {isLoading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />) :
        services.length === 0 ? <Card className="p-8 text-center text-sm text-zinc-400">Ainda não há serviços.</Card> :
          <div className="space-y-2">
            {orderedServices.map((s, i) => (
              <Card
                key={s.serviceId}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e: React.DragEvent) => handleDragOver(e, i)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                className={`p-4 flex items-center gap-3 select-none ${!s.active ? 'opacity-50' : ''}`}
              >
                <Icon name="grip" className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0 cursor-grab active:cursor-grabbing" />
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color ?? SERVICE_COLORS[i % SERVICE_COLORS.length] }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-white text-sm">{s.name}</p>
                  <p className="text-xs text-zinc-400">{s.duration} min · {Number(s.price).toFixed(2)}€{s.description ? ` · ${s.description}` : ''}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => update.mutate({ id: s.serviceId, data: { active: !s.active } }, { onSuccess: invalidate })} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5"><Icon name={s.active ? 'check' : 'ban'} className="w-4 h-4" /></button>
                  <IconButton icon="edit" label="Editar" onClick={() => openEdit(s)} />
                  <IconButton icon="trash" label="Eliminar" onClick={() => confirm(`Eliminar "${s.name}"?`) && remove.mutate({ id: s.serviceId })} className="hover:text-red-500" />
                </div>
              </Card>
            ))}
          </div>}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar serviço' : 'Novo serviço'}
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={handleSave} disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'A guardar…' : 'Guardar'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(e: any) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Corte + Barba" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Duração (min)" type="number" min={5} value={form.duration} onChange={(e: any) => setForm((f) => ({ ...f, duration: e.target.value }))} />
            <Input label="Preço (€)" type="number" min={0} step={0.5} value={form.price} onChange={(e: any) => setForm((f) => ({ ...f, price: e.target.value }))} />
          </div>
          <Input label="Descrição (opcional)" value={form.description} onChange={(e: any) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Cor do serviço</label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer p-0.5 bg-white dark:bg-zinc-900 shrink-0"
              />
              <div className="flex flex-wrap gap-2">
                {SERVICE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-800' : 'hover:scale-110'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Settings panel ───────────────────────────────────────────────────────────
function ConfiguracoesPanel() {
  const { authHeader } = useAuth()
  const qc = useQueryClient()
  const headers = authHeader()
  const DEFAULT_HOURS: WorkingHours[] = FULL_DAY_NAMES.map((_, i) => ({ dayOfWeek: i, startTime: '09:00', endTime: '18:00', isActive: i !== 0 }))

  const { data: savedHours, isLoading: loadingHours } = useGetScheduleWorkingHours({ client: { headers } })
  const saveHours = usePostScheduleWorkingHours({ client: { headers }, mutation: { onSuccess: () => { toast.success('Horários guardados'); qc.invalidateQueries({ queryKey: getScheduleWorkingHoursQueryKey() }) }, onError: (error) => toast.error(getApiError(error)) } })
  const [hours, setHours] = useState<WorkingHours[]>(DEFAULT_HOURS)

  useEffect(() => {
    if (savedHours && savedHours.length > 0) setHours(DEFAULT_HOURS.map((def) => savedHours.find((h) => h.dayOfWeek === def.dayOfWeek) ?? def))
  }, [savedHours])

  const updateDay = (dayOfWeek: number, patch: Partial<WorkingHours>) => setHours((prev) => prev.map((h) => h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h))

  const { data: blockedSlots = [], isLoading: loadingSlots } = useGetScheduleBlockedSlots(undefined, { client: { headers } })
  const createSlot = usePostScheduleBlockedSlots({ client: { headers }, mutation: { onSuccess: () => { toast.success('Dia bloqueado'); qc.invalidateQueries({ queryKey: getScheduleBlockedSlotsQueryKey() }) }, onError: (error) => toast.error(getApiError(error)) } })
  const deleteSlot = useDeleteScheduleBlockedSlotsId({ client: { headers }, mutation: { onSuccess: () => { toast.success('Bloqueio removido'); qc.invalidateQueries({ queryKey: getScheduleBlockedSlotsQueryKey() }) }, onError: (error) => toast.error(getApiError(error)) } })
  const [newSlot, setNewSlot] = useState({ date: '', startTime: '', endTime: '', reason: '' })

  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white">Horário de trabalho</h3>
          <Button size="sm" onClick={() => saveHours.mutate({ data: { hours } })} disabled={saveHours.isPending || loadingHours}>{saveHours.isPending ? 'A guardar…' : 'Guardar horários'}</Button>
        </div>
        {loadingHours ? Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800 mb-2" />) :
          <div className="space-y-2">
            {hours.map((h) => (
              <Card key={h.dayOfWeek} className="p-3 flex items-center gap-3">
                <button onClick={() => updateDay(h.dayOfWeek, { isActive: !h.isActive })} className={`w-9 h-5 rounded-full transition-colors ${h.isActive ? 'bg-accent' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                  <span className={`block w-3.5 h-3.5 rounded-full bg-white mx-0.5 transition-transform ${h.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="w-16 text-sm font-medium text-zinc-700 dark:text-zinc-200">{FULL_DAY_NAMES[h.dayOfWeek]}</span>
                {h.isActive ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input type="time" value={h.startTime} onChange={(e) => updateDay(h.dayOfWeek, { startTime: e.target.value })} className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent" />
                    <span className="text-zinc-400 text-sm">até</span>
                    <input type="time" value={h.endTime} onChange={(e) => updateDay(h.dayOfWeek, { endTime: e.target.value })} className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent" />
                  </div>
                ) : <span className="flex-1 text-sm text-zinc-400">Fechado</span>}
              </Card>
            ))}
          </div>}
      </section>

      <section>
        <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">Dias / horas bloqueadas</h3>
        <p className="text-sm text-zinc-400 mb-4">Férias, feriados ou pausas. Deixa a hora em branco para bloquear o dia inteiro.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (!newSlot.date) return; createSlot.mutate({ data: { date: newSlot.date, startTime: newSlot.startTime || undefined, endTime: newSlot.endTime || undefined, reason: newSlot.reason || undefined } }) }} className="flex flex-wrap gap-3 mb-4">
          <div><p className="text-xs text-zinc-500 mb-1">Data *</p><input type="date" required value={newSlot.date} onChange={(e) => setNewSlot((s) => ({ ...s, date: e.target.value }))} className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent" /></div>
          <div><p className="text-xs text-zinc-500 mb-1">Início</p><input type="time" value={newSlot.startTime} onChange={(e) => setNewSlot((s) => ({ ...s, startTime: e.target.value }))} className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent" /></div>
          <div><p className="text-xs text-zinc-500 mb-1">Fim</p><input type="time" value={newSlot.endTime} onChange={(e) => setNewSlot((s) => ({ ...s, endTime: e.target.value }))} className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent" /></div>
          <div><p className="text-xs text-zinc-500 mb-1">Motivo</p><input value={newSlot.reason} onChange={(e) => setNewSlot((s) => ({ ...s, reason: e.target.value }))} placeholder="Ex: Férias" className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent" /></div>
          <div className="flex items-end"><Button type="submit" size="sm" icon="plus" disabled={createSlot.isPending}>Bloquear</Button></div>
        </form>
        {loadingSlots ? <div className="h-10 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" /> :
          blockedSlots.length === 0 ? <p className="text-sm text-zinc-400">Nenhum bloqueio activo.</p> :
            <div className="space-y-2">
              {blockedSlots.map((slot) => (
                <Card key={slot.blockedSlotId} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{slot.date}</span>
                    {slot.startTime && slot.endTime && <span className="ml-2 text-zinc-400">{slot.startTime} — {slot.endTime}</span>}
                    {!slot.startTime && <span className="ml-2 text-zinc-400">Dia inteiro</span>}
                    {slot.reason && <span className="ml-2 text-zinc-500">({slot.reason})</span>}
                  </div>
                  <IconButton icon="trash" label="Remover" onClick={() => deleteSlot.mutate({ id: slot.blockedSlotId })} className="hover:text-red-500" />
                </Card>
              ))}
            </div>}
      </section>
    </div>
  )
}

// ─── Agenda root ──────────────────────────────────────────────────────────────
const TABS = [['cal', 'Calendário', 'calendar'], ['servicos', 'Serviços', 'scissors'], ['config', 'Configurações', 'clock']] as const

export function Agenda() {
  const [vista, setVista] = useState<'cal' | 'servicos' | 'config'>('cal')
  return (
    <div>
      <PageHeader title="Agenda" subtitle="Marcações, serviços e horários." />
      <div className="flex items-center gap-1 p-1 mb-6 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl w-full sm:w-auto sm:inline-flex overflow-x-auto">
        {TABS.map(([id, label, icon]) => (
          <button key={id} onClick={() => setVista(id)} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${vista === id ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
            <Icon name={icon} className="w-4 h-4" />{label}
          </button>
        ))}
      </div>
      {vista === 'cal' && <CalendarioView />}
      {vista === 'servicos' && <ServicosPanel />}
      {vista === 'config' && <ConfiguracoesPanel />}
    </div>
  )
}
