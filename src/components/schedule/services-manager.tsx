'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  Service,
} from './useScheduleApi'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'

function ServiceForm({
  initial,
  onSubmit,
  isPending,
}: {
  initial?: Partial<Service>
  onSubmit: (data: Omit<Service, 'serviceId'>) => void
  isPending: boolean
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    duration: initial?.duration ?? 30,
    price: initial?.price ?? 0,
    description: initial?.description ?? '',
    active: initial?.active ?? true,
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
      className="space-y-3 text-sm"
    >
      <div>
        <Label>Nome do serviço</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="border-slate-700 bg-slate-800 text-white"
          required
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Label>Duração (min)</Label>
          <Input
            type="number"
            min={5}
            value={form.duration}
            onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
            className="border-slate-700 bg-slate-800 text-white"
            required
          />
        </div>
        <div className="flex-1">
          <Label>Preço (€)</Label>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
            className="border-slate-700 bg-slate-800 text-white"
            required
          />
        </div>
      </div>
      <div>
        <Label>Descrição (opcional)</Label>
        <Input
          value={form.description ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="border-slate-700 bg-slate-800 text-white"
        />
      </div>
      <Button
        type="submit"
        className="w-full bg-amber-500 text-black hover:bg-amber-600"
        disabled={isPending}
      >
        {isPending ? 'A guardar...' : 'Guardar'}
      </Button>
    </form>
  )
}

export default function ServicesManager() {
  const { data: services = [], isLoading } = useServices()
  const create = useCreateService()
  const update = useUpdateService()
  const remove = useDeleteService()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)

  const handleCreate = async (data: Omit<Service, 'serviceId'>) => {
    try {
      await create.mutateAsync(data)
      toast.success('Serviço criado')
      setCreating(false)
    } catch {
      toast.error('Erro ao criar serviço')
    }
  }

  const handleUpdate = async (data: Omit<Service, 'serviceId'>) => {
    if (!editing) return
    try {
      await update.mutateAsync({ id: editing.serviceId, ...data })
      toast.success('Serviço atualizado')
      setEditing(null)
    } catch {
      toast.error('Erro ao atualizar serviço')
    }
  }

  const handleToggleActive = async (service: Service) => {
    try {
      await update.mutateAsync({ id: service.serviceId, active: !service.active })
      toast.success(service.active ? 'Serviço desativado' : 'Serviço ativado')
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este serviço?')) return
    try {
      await remove.mutateAsync(id)
      toast.success('Serviço eliminado')
    } catch {
      toast.error('Erro ao eliminar')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-800" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Serviços</h2>
        <Button
          size="sm"
          className="bg-amber-500 text-black hover:bg-amber-600"
          onClick={() => setCreating(true)}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo serviço
        </Button>
      </div>

      {services.length === 0 ? (
        <p className="py-8 text-center text-slate-400">Ainda não há serviços. Cria o primeiro.</p>
      ) : (
        <div className="space-y-2">
          {services.map((svc) => (
            <div
              key={svc.serviceId}
              className={`flex items-center justify-between rounded-xl border p-4 ${svc.active ? 'border-slate-700 bg-slate-800' : 'border-slate-800 bg-slate-900 opacity-60'}`}
            >
              <div>
                <p className="font-semibold">{svc.name}</p>
                <p className="text-sm text-slate-400">
                  {svc.duration} min &middot; {Number(svc.price).toFixed(2)}€
                  {svc.description && ` &middot; ${svc.description}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(svc)}
                  className="text-slate-400 hover:text-white"
                  title={svc.active ? 'Desativar' : 'Ativar'}
                >
                  {svc.active ? (
                    <ToggleRight className="h-5 w-5 text-green-400" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => setEditing(svc)}
                  className="text-slate-400 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(svc.serviceId)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-sm bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Novo serviço</DialogTitle>
          </DialogHeader>
          <ServiceForm onSubmit={handleCreate} isPending={create.isPending} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null) }}>
        <DialogContent className="max-w-sm bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Editar serviço</DialogTitle>
          </DialogHeader>
          {editing && (
            <ServiceForm initial={editing} onSubmit={handleUpdate} isPending={update.isPending} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
