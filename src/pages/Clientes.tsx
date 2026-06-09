import { useState, useMemo, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { Icon } from '../ui/icons.jsx'
import { Card, Badge, Avatar, Modal, Input, Button, IconButton, PageHeader, EmptyState } from '../ui/ui.jsx'
import { useGetCustomers, getCustomersQueryKey } from '../gen/backoffice/hooks/useGetCustomers.js'
import { useGetScheduleServices } from '../gen/backoffice/hooks/useGetScheduleServices.js'
import { useGetCustomersIdHistory, getCustomersIdHistoryQueryKey } from '../gen/backoffice/hooks/useGetCustomersIdHistory.js'
import { postCustomers } from '../gen/backoffice/hooks/usePostCustomers.js'
import { patchCustomersId } from '../gen/backoffice/hooks/usePatchCustomersId.js'
import { putScheduleAppointmentsId } from '../gen/backoffice/hooks/usePutScheduleAppointmentsId.js'
import { postScheduleAppointmentsIdNotify } from '../gen/backoffice/hooks/usePostScheduleAppointmentsIdNotify.js'
import type { Customer } from '../gen/backoffice/types/Customer.js'
import type { Appointment } from '../gen/backoffice/types/Appointment.js'
import { ApptModal } from '../components/ApptModal.js'

function colorFromName(name: string) {
  const colors = ['#2A6FDB', '#1F8A5B', '#D97757', '#7C5CDB', '#E6B450', '#0EA5A4']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function SkeletonRow() {
  return (
    <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
      {[1, 2, 3].map((i) => (
        <td key={i} className="px-4 sm:px-5 py-3.5">
          <div className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" style={{ width: `${50 + i * 15}%` }} />
        </td>
      ))}
      <td />
    </tr>
  )
}

type CustomerForm = { name: string; email: string; contact: string; nif: string; birthday: string; notes: string }
const emptyForm: CustomerForm = { name: '', email: '', contact: '', nif: '', birthday: '', notes: '' }

type HistoryAppt = {
  appointmentId: string; serviceId: string; date: string; time: string; status: string
  clientName: string; clientEmail: string; clientPhone: string; notes?: string | null
  paymentCash?: number | null; paymentMbway?: number | null; paymentCard?: number | null; paidAt?: string | null
  service?: { name: string; price: number }
}
type CustomerHistory = {
  customer: Customer
  stats: { visitCount: number; totalSpent: number; lastVisit: string | null; favoriteServiceId: string | null }
  appointments: HistoryAppt[]
}

const STATUS_PT: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmada', completed: 'Concluída', cancelled: 'Cancelada' }
const STATUS_TONE: Record<string, string> = { pending: 'amber', confirmed: 'green', completed: 'green', cancelled: 'red' }

export function Clientes() {
  const { hasPermission } = useAuth()
  const canSchedule = hasPermission('VIEW_SCHEDULE')
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const returnToAppointment = (location.state as { returnToAppointment?: { appointmentId: string; date: string } } | null)?.returnToAppointment

  const [q, setQ] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm)
  const [selAppt, setSelAppt] = useState<HistoryAppt | null>(null)

  const { data, isLoading, isError } = useGetCustomers()
  const { data: svcData } = useGetScheduleServices({ query: { enabled: canSchedule } })
  const { data: history, isLoading: loadingHistory } = useGetCustomersIdHistory<CustomerHistory>(
    profileId ?? '',
    { query: { enabled: !!profileId && canSchedule } },
  )
  const services = svcData ?? []
  const customers = data?.rows ?? []

  useEffect(() => {
    const customerId = searchParams.get('cliente')
    if (customerId) setProfileId(customerId)
  }, [searchParams])

  const filtered = useMemo(() =>
    customers.filter((c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(q.toLowerCase()) ||
      (c.contact ?? '').includes(q),
    ),
  [customers, q])

  const createMut = useMutation({
    mutationFn: (data: CustomerForm) => postCustomers({
      name: data.name,
      email: data.email || undefined,
      contact: data.contact || undefined,
      nif: data.nif || undefined,
      birthday: data.birthday || undefined,
      notes: data.notes || undefined,
    } as any),
    onSuccess: () => {
      toast.success('Cliente criado')
      qc.invalidateQueries({ queryKey: getCustomersQueryKey() })
      setCreateOpen(false)
      setForm(emptyForm)
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomerForm> }) => patchCustomersId(id, data as any),
    onSuccess: () => {
      toast.success('Cliente actualizado')
      qc.invalidateQueries({ queryKey: getCustomersQueryKey() })
      if (profileId) qc.invalidateQueries({ queryKey: getCustomersIdHistoryQueryKey(profileId) })
      setEditCustomer(null)
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const updateApptMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      putScheduleAppointmentsId(id, data as any),
    onSuccess: () => {
      toast.success('Marcação actualizada')
      if (profileId) qc.invalidateQueries({ queryKey: getCustomersIdHistoryQueryKey(profileId) })
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const setStatusApptMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      putScheduleAppointmentsId(id, { status } as any),
    onSuccess: (_d, { status }) => {
      toast.success(status === 'cancelled' ? 'Marcação cancelada' : 'Marcação reativada')
      setSelAppt(null)
      if (profileId) qc.invalidateQueries({ queryKey: getCustomersIdHistoryQueryKey(profileId) })
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const reactivateAndNotifyMut = useMutation({
    mutationFn: async (id: string) => {
      await putScheduleAppointmentsId(id, { status: 'confirmed' } as any)
      await postScheduleAppointmentsIdNotify(id)
    },
    onSuccess: () => {
      toast.success('Marcação reativada e cliente notificado')
      setSelAppt(null)
      if (profileId) qc.invalidateQueries({ queryKey: getCustomersIdHistoryQueryKey(profileId) })
    },
    onError: (e: any) => {
      toast.success('Marcação reativada')
      toast.error(getApiError(e) || 'Erro ao enviar email ao cliente')
      setSelAppt(null)
      if (profileId) qc.invalidateQueries({ queryKey: getCustomersIdHistoryQueryKey(profileId) })
    },
  })

  const blockMut = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => patchCustomersId(id, { blocked } as any),
    onSuccess: (_d, { blocked }) => {
      toast.success(blocked ? 'Cliente bloqueado' : 'Cliente desbloqueado')
      qc.invalidateQueries({ queryKey: getCustomersQueryKey() })
      if (profileId) qc.invalidateQueries({ queryKey: getCustomersIdHistoryQueryKey(profileId) })
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const openProfile = (id: string) => {
    setProfileId(id)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('cliente', id)
      return next
    })
  }

  const closeProfile = () => {
    setProfileId(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('cliente')
      return next
    })
  }

  const openEdit = (c: Customer) => {
    setEditCustomer(c)
    setForm({ name: c.name, email: c.email ?? '', contact: c.contact ?? '', nif: c.nif ?? '', birthday: c.birthday ?? '', notes: c.notes ?? '' })
  }

  const set = (k: keyof CustomerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { toast.error('O nome é obrigatório'); return }
    createMut.mutate(form)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editCustomer) return
    updateMut.mutate({ id: editCustomer.customerId, data: form })
  }

  const profileCustomer = profileId ? (history?.customer ?? customers.find((c) => c.customerId === profileId)) : null
  const favoriteService = history?.appointments.find((a) => a.service && a.serviceId === history.stats.favoriteServiceId)?.service

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${data?.count ?? customers.length} clientes registados.`} />

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <Icon name="search" className="w-[18px] h-[18px]" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar por nome, email ou telefone…"
              className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-transparent rounded-lg text-sm pl-10 pr-3 py-2 focus:bg-white dark:focus:bg-zinc-900 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none text-zinc-800 dark:text-zinc-100"
            />
          </div>
          <Button icon="plus" size="sm" onClick={() => { setForm(emptyForm); setCreateOpen(true) }}>Novo cliente</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="font-medium px-4 sm:px-5 py-3">Cliente</th>
                <th className="font-medium px-4 py-3 hidden md:table-cell">Email</th>
                <th className="font-medium px-4 py-3 hidden sm:table-cell">Contacto</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              {isError && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-red-500 text-sm">Erro ao carregar clientes.</td></tr>
              )}
              {!isLoading && !isError && filtered.map((c) => (
                <tr
                  key={c.customerId}
                  onClick={() => openProfile(c.customerId)}
                  className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition cursor-pointer"
                >
                  <td className="px-4 sm:px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} color={colorFromName(c.name)} size={36} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-zinc-900 dark:text-white truncate">{c.name}</p>
                          {c.blocked && <Badge tone="red" className="shrink-0">Bloqueado</Badge>}
                        </div>
                        <p className="text-xs text-zinc-400 truncate md:hidden">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell truncate max-w-[200px]">{c.email}</td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell">{c.contact ?? '—'}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && !isError && filtered.length === 0 && (
            <EmptyState icon="users" title="Sem clientes" desc="Não há clientes que correspondam à pesquisa." />
          )}
        </div>
      </Card>

      {/* ── Customer profile modal ── */}
      {profileId && profileCustomer && (
        <Modal
          open
          onClose={closeProfile}
          title="Ficha de cliente"
          width="max-w-lg"
          footer={
            <>
              {returnToAppointment && (
                <Button
                  variant="outline"
                  icon="calendar"
                  onClick={() => navigate(`/agenda?marcacao=${encodeURIComponent(returnToAppointment.appointmentId)}&data=${encodeURIComponent(returnToAppointment.date)}`)}
                >
                  Voltar à marcação
                </Button>
              )}
              <Button variant="outline" icon="edit" onClick={() => openEdit(profileCustomer)}>Editar</Button>
              <Button
                variant="outline"
                disabled={blockMut.isPending}
                onClick={() => blockMut.mutate({ id: profileCustomer.customerId, blocked: !profileCustomer.blocked })}
                className={profileCustomer.blocked ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-50' : 'text-red-500 border-red-200 hover:bg-red-50'}
              >
                {blockMut.isPending ? '…' : profileCustomer.blocked ? 'Desbloquear' : 'Bloquear'}
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" onClick={closeProfile}>Fechar</Button>
            </>
          }
        >
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Avatar name={profileCustomer.name} color={colorFromName(profileCustomer.name)} size={56} />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{profileCustomer.name}</h3>
                  {profileCustomer.blocked && (
                    <Badge tone="red"><Icon name="ban" className="w-3 h-3 inline mr-0.5" />Bloqueado</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {profileCustomer.birthday && (
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <Icon name="star" className="w-3 h-3" />
                      {new Date(profileCustomer.birthday + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              {profileCustomer.email && <div className="flex items-center gap-2.5"><Icon name="mail" className="w-4 h-4 text-zinc-400" />{profileCustomer.email}</div>}
              {profileCustomer.contact && <div className="flex items-center gap-2.5"><Icon name="phone" className="w-4 h-4 text-zinc-400" />{profileCustomer.contact}</div>}
              {profileCustomer.nif && <div className="flex items-center gap-2.5"><Icon name="layers" className="w-4 h-4 text-zinc-400" />NIF {profileCustomer.nif}</div>}
            </div>

            {/* Notes */}
            {profileCustomer.notes && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl p-3 text-sm text-amber-900 dark:text-amber-200">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Notas</p>
                {profileCustomer.notes}
              </div>
            )}

            {/* Stats — only when schedule module is active */}
            {canSchedule && loadingHistory && (
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />)}
              </div>
            )}
            {canSchedule && !loadingHistory && history && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{history.stats.visitCount}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">visitas</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{history.stats.totalSpent.toFixed(0)}€</p>
                    <p className="text-xs text-zinc-400 mt-0.5">gasto total</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">{favoriteService?.name ?? '—'}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">serviço favorito</p>
                  </div>
                </div>
                {history.stats.lastVisit && (
                  <p className="text-xs text-zinc-400 text-center -mt-1">Última visita: {new Date(history.stats.lastVisit + 'T00:00:00').toLocaleDateString('pt-PT', { dateStyle: 'long' })}</p>
                )}

                {/* Appointment history */}
                {history.appointments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Histórico de marcações</p>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {history.appointments.map((a) => {
                        const paid = a.paidAt ? (Number(a.paymentCash || 0) + Number(a.paymentMbway || 0) + Number(a.paymentCard || 0)) : null
                        return (
                          <button
                            key={a.appointmentId}
                            onClick={() => setSelAppt(a)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-zinc-800 dark:text-zinc-100">{a.date} · {a.time}</p>
                              <p className="text-xs text-zinc-400 truncate">{a.service?.name ?? '—'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge tone={STATUS_TONE[a.status] as any ?? 'zinc'}>{STATUS_PT[a.status] ?? a.status}</Badge>
                              {paid != null && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">{paid.toFixed(2)} €</p>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {history.appointments.length === 0 && (
                  <p className="text-sm text-zinc-400 text-center py-2">Sem marcações registadas para este cliente.</p>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Create customer modal ── */}
      {createOpen && (
        <Modal
          open
          onClose={() => setCreateOpen(false)}
          title="Novo cliente"
          width="max-w-sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" form="create-customer-form" disabled={createMut.isPending}>
                {createMut.isPending ? 'A criar…' : 'Criar cliente'}
              </Button>
            </>
          }
        >
          <form id="create-customer-form" onSubmit={handleCreate} className="space-y-3">
            <Input label="Nome *" value={form.name} onChange={set('name')} placeholder="João Mendes" />
            <Input label="Email (opcional)" type="email" value={form.email} onChange={set('email')} placeholder="joao@email.com" />
            <Input label="Telefone (opcional)" value={form.contact} onChange={set('contact')} placeholder="912 345 678" />
            <Input label="NIF (opcional)" value={form.nif} onChange={set('nif')} placeholder="123456789" />
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Data de nascimento (opcional)</label>
              <input type="date" value={form.birthday} onChange={set('birthday')} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Notas internas (opcional)</label>
              <textarea
                value={form.notes}
                onChange={set('notes')}
                rows={2}
                placeholder="Preferências, alergias, observações…"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent resize-none"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ── Appointment detail modal — only when schedule is available ── */}
      {canSchedule && selAppt && (
        <ApptModal
          appt={selAppt as unknown as Appointment}
          services={services}
          onClose={() => setSelAppt(null)}
          onSave={(id, data) => updateApptMut.mutate({ id, data })}
          onSetStatus={(id, status) => setStatusApptMut.mutate({ id, status })}
          onReactivateAndNotify={(id) => reactivateAndNotifyMut.mutate(id)}
          isSaving={updateApptMut.isPending}
          isSettingStatus={setStatusApptMut.isPending || reactivateAndNotifyMut.isPending}
        />
      )}

      {/* ── Edit customer modal ── */}
      {editCustomer && (
        <Modal
          open
          onClose={() => setEditCustomer(null)}
          title="Editar cliente"
          width="max-w-sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditCustomer(null)}>Cancelar</Button>
              <Button type="submit" form="edit-customer-form" disabled={updateMut.isPending}>
                {updateMut.isPending ? 'A guardar…' : 'Guardar'}
              </Button>
            </>
          }
        >
          <form id="edit-customer-form" onSubmit={handleUpdate} className="space-y-3">
            <Input label="Nome" value={form.name} onChange={set('name')} />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} />
            <Input label="Telefone" value={form.contact} onChange={set('contact')} />
            <Input label="NIF" value={form.nif} onChange={set('nif')} />
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Data de nascimento</label>
              <input type="date" value={form.birthday} onChange={set('birthday')} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Notas internas</label>
              <textarea
                value={form.notes}
                onChange={set('notes')}
                rows={3}
                placeholder="Preferências, alergias, observações…"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent resize-none"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
