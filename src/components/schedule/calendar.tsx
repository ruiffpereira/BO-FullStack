'use client'

import { useState } from 'react'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Phone, Mail } from 'lucide-react'
import { toast } from 'sonner'
import {
  useAppointments,
  useUpdateAppointment,
  useDeleteAppointment,
  useCreateAppointmentBO,
  useServices,
  Appointment,
  AppointmentStatus,
} from './useScheduleApi'
import { Button } from '@/components/shadcn/ui/button'
import { Badge } from '@/components/shadcn/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
}

function AppointmentCard({
  appt,
  onStatusChange,
  onDelete,
}: {
  appt: Appointment
  onStatusChange: (id: string, status: AppointmentStatus) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full rounded-lg border p-2 text-left text-xs transition-opacity hover:opacity-80 ${STATUS_COLORS[appt.status]}`}
      >
        <p className="font-semibold">{appt.time} — {appt.clientName}</p>
        <p className="mt-0.5 opacity-75">{appt.service?.name}</p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Marcação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-slate-400">Cliente</p>
              <p className="font-medium">{appt.clientName}</p>
            </div>
            <div className="flex gap-4">
              <a href={`tel:${appt.clientPhone}`} className="flex items-center gap-1 text-slate-300 hover:text-white">
                <Phone className="h-3 w-3" />{appt.clientPhone}
              </a>
              <a href={`mailto:${appt.clientEmail}`} className="flex items-center gap-1 text-slate-300 hover:text-white">
                <Mail className="h-3 w-3" />{appt.clientEmail}
              </a>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-slate-400">Serviço</p>
                <p className="font-medium">{appt.service?.name}</p>
              </div>
              <div>
                <p className="text-slate-400">Hora</p>
                <p className="font-medium">{appt.date} {appt.time}</p>
              </div>
            </div>
            {appt.notes && (
              <div>
                <p className="text-slate-400">Notas</p>
                <p>{appt.notes}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-slate-400">Estado</p>
              <Select
                value={appt.status}
                onValueChange={(v) => {
                  onStatusChange(appt.appointmentId, v as AppointmentStatus)
                  setOpen(false)
                }}
              >
                <SelectTrigger className="border-slate-700 bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 text-white">
                  {(Object.keys(STATUS_LABELS) as AppointmentStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => { onDelete(appt.appointmentId); setOpen(false) }}
            >
              Eliminar marcação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function NewAppointmentDialog({
  date,
  open,
  onOpenChange,
}: {
  date: Date
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data: services = [] } = useServices()
  const create = useCreateAppointmentBO()
  const [form, setForm] = useState({
    time: '09:00',
    serviceId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await create.mutateAsync({ ...form, date: format(date, 'yyyy-MM-dd') })
      toast.success('Marcação criada')
      onOpenChange(false)
      setForm({ time: '09:00', serviceId: '', clientName: '', clientEmail: '', clientPhone: '', notes: '' })
    } catch {
      toast.error('Erro ao criar marcação')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-slate-900 text-white">
        <DialogHeader>
          <DialogTitle>Nova marcação — {format(date, 'dd MMM', { locale: pt })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <Label>Serviço</Label>
            <Select value={form.serviceId} onValueChange={(v) => setForm((f) => ({ ...f, serviceId: v }))}>
              <SelectTrigger className="border-slate-700 bg-slate-800">
                <SelectValue placeholder="Escolher serviço" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 text-white">
                {services.filter((s) => s.active).map((s) => (
                  <SelectItem key={s.serviceId} value={s.serviceId}>
                    {s.name} ({s.duration}min — {s.price}€)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Hora</Label>
            <Input type="time" value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="border-slate-700 bg-slate-800 text-white" required />
          </div>
          <div>
            <Label>Nome do cliente</Label>
            <Input value={form.clientName}
              onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
              className="border-slate-700 bg-slate-800 text-white" required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.clientEmail}
              onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
              className="border-slate-700 bg-slate-800 text-white" required />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.clientPhone}
              onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))}
              className="border-slate-700 bg-slate-800 text-white" required />
          </div>
          <div>
            <Label>Notas (opcional)</Label>
            <Input value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="border-slate-700 bg-slate-800 text-white" />
          </div>
          <Button type="submit" className="w-full bg-amber-500 text-black hover:bg-amber-600" disabled={create.isPending}>
            {create.isPending ? 'A guardar...' : 'Criar marcação'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ScheduleCalendar() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )
  const [newApptDate, setNewApptDate] = useState<Date | null>(null)

  const month = format(weekStart, 'yyyy-MM')
  const { data: appointments = [], isLoading } = useAppointments({ month })
  const updateAppt = useUpdateAppointment()
  const deleteAppt = useDeleteAppointment()

  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i))

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    try {
      await updateAppt.mutateAsync({ id, status })
      toast.success('Estado atualizado')
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAppt.mutateAsync(id)
      toast.success('Marcação eliminada')
    } catch {
      toast.error('Erro ao eliminar')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setWeekStart((d) => addDays(d, -7))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold capitalize">
          {format(weekStart, 'MMMM yyyy', { locale: pt })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setWeekStart((d) => addDays(d, 7))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {days.map((day) => {
          const dayAppts = appointments.filter((a) =>
            isSameDay(new Date(a.date + 'T00:00:00'), day),
          )
          const isToday = isSameDay(day, new Date())

          return (
            <div
              key={day.toISOString()}
              className={`flex min-h-40 flex-col rounded-xl border p-2 ${isToday ? 'border-amber-500' : 'border-slate-700'} bg-slate-800`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xs capitalize text-slate-400">
                    {format(day, 'EEE', { locale: pt })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-amber-400' : 'text-white'}`}>
                    {format(day, 'd')}
                  </p>
                </div>
                <button
                  onClick={() => setNewApptDate(day)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {isLoading ? (
                <div className="flex-1 animate-pulse rounded bg-slate-700" />
              ) : (
                <div className="flex flex-col gap-1">
                  {dayAppts
                    .filter((a) => a.status !== 'cancelled')
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map((appt) => (
                      <AppointmentCard
                        key={appt.appointmentId}
                        appt={appt}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))}
                  {dayAppts.filter((a) => a.status === 'cancelled').length > 0 && (
                    <p className="mt-1 text-center text-xs text-slate-600">
                      {dayAppts.filter((a) => a.status === 'cancelled').length} cancelada(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(STATUS_LABELS) as AppointmentStatus[]).map((s) => (
          <span key={s} className={`rounded-full border px-2 py-0.5 ${STATUS_COLORS[s]}`}>
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>

      {newApptDate && (
        <NewAppointmentDialog
          date={newApptDate}
          open={!!newApptDate}
          onOpenChange={(v) => { if (!v) setNewApptDate(null) }}
        />
      )}
    </div>
  )
}
