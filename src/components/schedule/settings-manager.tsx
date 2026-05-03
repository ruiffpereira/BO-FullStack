'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Trash2, Plus } from 'lucide-react'
import {
  useWorkingHours,
  useSaveWorkingHours,
  useBlockedSlots,
  useCreateBlockedSlot,
  useDeleteBlockedSlot,
  WorkingHoursEntry,
} from './useScheduleApi'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Switch } from '@/components/shadcn/ui/switch'
import { Label } from '@/components/shadcn/ui/label'

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const DEFAULT_HOURS: WorkingHoursEntry[] = DAY_NAMES.map((_, i) => ({
  dayOfWeek: i,
  startTime: '09:00',
  endTime: '18:00',
  isActive: i !== 0,
}))

export default function SettingsManager() {
  const { data: savedHours, isLoading: loadingHours } = useWorkingHours()
  const saveHours = useSaveWorkingHours()
  const [hours, setHours] = useState<WorkingHoursEntry[]>(DEFAULT_HOURS)

  const currentMonth = format(new Date(), 'yyyy-MM')
  const { data: blockedSlots = [], isLoading: loadingSlots } = useBlockedSlots(currentMonth)
  const createSlot = useCreateBlockedSlot()
  const deleteSlot = useDeleteBlockedSlot()
  const [newSlot, setNewSlot] = useState({ date: '', startTime: '', endTime: '', reason: '' })

  useEffect(() => {
    if (savedHours && savedHours.length > 0) {
      const merged = DEFAULT_HOURS.map((def) => {
        const saved = savedHours.find((h) => h.dayOfWeek === def.dayOfWeek)
        return saved ?? def
      })
      setHours(merged)
    }
  }, [savedHours])

  const updateDay = (dayOfWeek: number, patch: Partial<WorkingHoursEntry>) => {
    setHours((prev) => prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h)))
  }

  const handleSaveHours = async () => {
    try {
      await saveHours.mutateAsync(hours)
      toast.success('Horários guardados')
    } catch {
      toast.error('Erro ao guardar horários')
    }
  }

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSlot.date) return
    try {
      await createSlot.mutateAsync({
        date: newSlot.date,
        startTime: newSlot.startTime || null,
        endTime: newSlot.endTime || null,
        reason: newSlot.reason || null,
      })
      toast.success('Dia bloqueado')
      setNewSlot({ date: '', startTime: '', endTime: '', reason: '' })
    } catch {
      toast.error('Erro ao bloquear')
    }
  }

  const handleDeleteSlot = async (id: string) => {
    try {
      await deleteSlot.mutateAsync(id)
      toast.success('Bloqueio removido')
    } catch {
      toast.error('Erro ao remover')
    }
  }

  return (
    <div className="space-y-8">
      {/* Working Hours */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Horário de trabalho</h2>
          <Button
            size="sm"
            className="bg-amber-500 text-black hover:bg-amber-600"
            onClick={handleSaveHours}
            disabled={saveHours.isPending || loadingHours}
          >
            {saveHours.isPending ? 'A guardar...' : 'Guardar horários'}
          </Button>
        </div>

        {loadingHours ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-800" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {hours.map((h) => (
              <div
                key={h.dayOfWeek}
                className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
              >
                <Switch
                  checked={h.isActive}
                  onCheckedChange={(v) => updateDay(h.dayOfWeek, { isActive: v })}
                />
                <span className="w-20 text-sm font-medium">{DAY_NAMES[h.dayOfWeek]}</span>
                {h.isActive ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      type="time"
                      value={h.startTime}
                      onChange={(e) => updateDay(h.dayOfWeek, { startTime: e.target.value })}
                      className="w-28 border-slate-600 bg-slate-700 text-sm text-white"
                    />
                    <span className="text-slate-400">até</span>
                    <Input
                      type="time"
                      value={h.endTime}
                      onChange={(e) => updateDay(h.dayOfWeek, { endTime: e.target.value })}
                      className="w-28 border-slate-600 bg-slate-700 text-sm text-white"
                    />
                  </div>
                ) : (
                  <span className="flex-1 text-sm text-slate-500">Fechado</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Blocked Slots */}
      <section>
        <h2 className="mb-4 text-lg font-bold">Dias / horas bloqueadas</h2>
        <p className="mb-4 text-sm text-slate-400">
          Bloqueia dias de férias, feriados ou pausas (ex: almoço). Deixa a hora em branco para bloquear o dia inteiro.
        </p>

        <form onSubmit={handleCreateSlot} className="mb-4 flex flex-wrap gap-2">
          <div>
            <Label className="text-xs text-slate-400">Data</Label>
            <Input
              type="date"
              value={newSlot.date}
              onChange={(e) => setNewSlot((s) => ({ ...s, date: e.target.value }))}
              className="border-slate-700 bg-slate-800 text-white"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Início (opcional)</Label>
            <Input
              type="time"
              value={newSlot.startTime}
              onChange={(e) => setNewSlot((s) => ({ ...s, startTime: e.target.value }))}
              className="border-slate-700 bg-slate-800 text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Fim (opcional)</Label>
            <Input
              type="time"
              value={newSlot.endTime}
              onChange={(e) => setNewSlot((s) => ({ ...s, endTime: e.target.value }))}
              className="border-slate-700 bg-slate-800 text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Motivo (opcional)</Label>
            <Input
              value={newSlot.reason}
              onChange={(e) => setNewSlot((s) => ({ ...s, reason: e.target.value }))}
              placeholder="ex: Férias"
              className="border-slate-700 bg-slate-800 text-white"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" size="sm" className="bg-amber-500 text-black hover:bg-amber-600" disabled={createSlot.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Bloquear
            </Button>
          </div>
        </form>

        {loadingSlots ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-800" />
            ))}
          </div>
        ) : blockedSlots.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum dia bloqueado este mês.</p>
        ) : (
          <div className="space-y-2">
            {blockedSlots.map((slot) => (
              <div
                key={slot.blockedSlotId}
                className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{slot.date}</span>
                  {slot.startTime && slot.endTime && (
                    <span className="ml-2 text-slate-400">
                      {slot.startTime} — {slot.endTime}
                    </span>
                  )}
                  {!slot.startTime && <span className="ml-2 text-slate-400">Dia inteiro</span>}
                  {slot.reason && <span className="ml-2 text-slate-500">({slot.reason})</span>}
                </div>
                <button
                  onClick={() => handleDeleteSlot(slot.blockedSlotId)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
