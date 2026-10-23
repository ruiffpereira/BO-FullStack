import { useState, useMemo, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { Icon } from '../ui/icons.jsx'
import { Card, Badge, Avatar, Modal, Input, Button, EmptyState, Toggle } from '../ui/ui.jsx';
import { usePageSubtitle } from '../context/PageMetaContext'
import { GuardButton } from '../components/GuardButton'
import { useTeamAccess } from '../hooks/useTeamAccess'
import { usePagination, Pagination } from '../components/Pagination'
import { DatePicker } from '../components/DatePicker'
import { useGetCustomers, getCustomersQueryKey } from '../gen/backoffice/hooks/useGetCustomers.js'
import { useGetScheduleServices } from '../gen/backoffice/hooks/useGetScheduleServices.js'
import { getCustomersIdHistoryQueryKey } from '../gen/backoffice/hooks/useGetCustomersIdHistory.js';
import { postCustomers } from '../gen/backoffice/hooks/usePostCustomers.js'
import { patchCustomersId } from '../gen/backoffice/hooks/usePatchCustomersId.js'
import { putScheduleAppointmentsId } from '../gen/backoffice/hooks/usePutScheduleAppointmentsId.js'
import type { Customer } from '../gen/backoffice/types/Customer.js'
import type { Appointment } from '../gen/backoffice/types/Appointment.js'
import { CustomerProfileModal } from '../components/customers/CustomerProfileModal'
import { ApptModal } from '../components/ApptModal.js'
import { LeadsInbox } from './clientes/LeadsInbox'
import { colorFromName } from '../lib/avatarColor'
import type { PutScheduleAppointmentsIdMutationRequestStatusEnum } from '../gen/backoffice/types/PutScheduleAppointmentsId.js'


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

type CustomerForm = { name: string; email: string; contact: string; nif: string; wantsInvoice: boolean; birthday: string; notes: string }
const emptyForm: CustomerForm = { name: '', email: '', contact: '', nif: '', wantsInvoice: false, birthday: '', notes: '' }

type HistoryAppt = Appointment

export type ClientesView = 'clientes' | 'leads'

/**
 * Página "Clientes" (core). Cada separador vive na sua própria rota (`/clientes`,
 * `/clientes/leads`, T2.2 — Fase 2 da sidebar com submenus) — a navegação entre
 * vistas já não é feita por `Tabs` de topo, é a sidebar (`NavItemGroup`/
 * `Shell.tsx`); a página só recebe a vista pedida via `view`. A FICHA do
 * cliente é `components/customers/CustomerProfileModal` (a mesma da Agenda; aqui `full`, com os
 * separadores Agenda/Ginásio/Emails como estado local da modal).
 */
export function Clientes({ view }: { view: ClientesView }) {
  const { hasPermission } = useAuth()
  // Equipa (B41 2b): a ficha de cliente resolve as suas próprias permissões (`customerAccess`); aqui só o que a página usa.
  const { can } = useTeamAccess()
  const canSchedule = hasPermission('VIEW_SCHEDULE') && can('agenda', 'view')
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
  const services = svcData ?? []
  const customers = useMemo(() => data?.rows ?? [], [data])
  const totalClientes = data?.count ?? customers.length
  usePageSubtitle(`${totalClientes} ${totalClientes === 1 ? 'cliente registado' : 'clientes registados'}.`)

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
  const pg = usePagination(filtered, { resetKey: q })

  const createMut = useMutation({
    mutationFn: (data: CustomerForm) => postCustomers({
      name: data.name,
      email: data.email || undefined,
      contact: data.contact || undefined,
      nif: data.nif || undefined,
      wantsInvoice: data.wantsInvoice,
      birthday: data.birthday || undefined,
      notes: data.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Cliente criado')
      qc.invalidateQueries({ queryKey: getCustomersQueryKey() })
      setCreateOpen(false)
      setForm(emptyForm)
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomerForm> }) => patchCustomersId(id, data),
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
      putScheduleAppointmentsId(id, data),
    onSuccess: () => {
      toast.success('Marcação actualizada')
      if (profileId) qc.invalidateQueries({ queryKey: getCustomersIdHistoryQueryKey(profileId) })
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const setStatusApptMut = useMutation({
    mutationFn: ({ id, status, data }: { id: string; status: string; data?: Record<string, unknown> }) =>
      putScheduleAppointmentsId(id, { ...data, status: status as PutScheduleAppointmentsIdMutationRequestStatusEnum }),
    onSuccess: (_d, { status }) => {
      toast.success(status === 'cancelled' ? 'Marcação cancelada' : 'Marcação reativada')
      setSelAppt(null)
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
    setForm({ name: c.name, email: c.email ?? '', contact: c.contact ?? '', nif: c.nif ?? '', wantsInvoice: c.wantsInvoice ?? false, birthday: c.birthday ?? '', notes: c.notes ?? '' })
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

  return (
    <div>
      {view === 'leads' && <LeadsInbox />}

      {view === 'clientes' && (
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
          <GuardButton icon="plus" size="sm" onClick={() => { setForm(emptyForm); setCreateOpen(true) }}>Novo cliente</GuardButton>
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
              {!isLoading && !isError && pg.pageItems.map((c) => (
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
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="px-4 sm:px-5 pb-1"><Pagination {...pg} /></div>
          )}
        </div>
      </Card>
      )}

      {/* ── Ficha de cliente (a mesma da Agenda; aqui a versão completa) ── */}
      {profileId && (
        <CustomerProfileModal
          full
          customerId={profileId}
          customers={customers}
          onClose={closeProfile}
          onOpenAppointment={(a) => setSelAppt(a)}
          onEdit={openEdit}
          footerLeading={
            returnToAppointment ? (
              <Button
                variant="outline"
                icon="calendar"
                onClick={() => navigate(`/agenda?marcacao=${encodeURIComponent(returnToAppointment.appointmentId)}&data=${encodeURIComponent(returnToAppointment.date)}`)}
              >
                Voltar à marcação
              </Button>
            ) : null
          }
        />
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
              <GuardButton type="submit" form="create-customer-form" disabled={createMut.isPending}>
                {createMut.isPending ? 'A criar…' : 'Criar cliente'}
              </GuardButton>
            </>
          }
        >
          <form id="create-customer-form" onSubmit={handleCreate} className="space-y-3">
            <Input label="Nome *" value={form.name} onChange={set('name')} placeholder="João Mendes" />
            <Input label="Email (opcional)" type="email" value={form.email} onChange={set('email')} placeholder="joao@email.com" />
            <Input label="Telefone (opcional)" value={form.contact} onChange={set('contact')} placeholder="912 345 678" />
            <Input label="NIF (opcional)" value={form.nif} onChange={set('nif')} placeholder="123456789" />
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <div>
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Quer contribuinte na fatura</div>
                <div className="text-xs text-zinc-400">Emite a fatura com o NIF do cliente.</div>
              </div>
              <Toggle checked={form.wantsInvoice} onChange={(v) => setForm((f) => ({ ...f, wantsInvoice: v }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Data de nascimento (opcional)</label>
              <DatePicker value={form.birthday} onChange={(v) => setForm((f) => ({ ...f, birthday: v }))} max={new Date().toISOString().slice(0, 10)} yearNav clearable />
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
          onSetStatus={(id, status, data) => setStatusApptMut.mutate({ id, status, data })}
          onReopen={(id) => updateApptMut.mutate({ id, data: { status: "confirmed" } })}
          isSaving={updateApptMut.isPending}
          isSettingStatus={setStatusApptMut.isPending}
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
              <GuardButton type="submit" form="edit-customer-form" disabled={updateMut.isPending}>
                {updateMut.isPending ? 'A guardar…' : 'Guardar'}
              </GuardButton>
            </>
          }
        >
          <form id="edit-customer-form" onSubmit={handleUpdate} className="space-y-3">
            <Input label="Nome" value={form.name} onChange={set('name')} />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} />
            <Input label="Telefone" value={form.contact} onChange={set('contact')} />
            <Input label="NIF" value={form.nif} onChange={set('nif')} />
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <div>
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Quer contribuinte na fatura</div>
                <div className="text-xs text-zinc-400">Emite a fatura com o NIF do cliente.</div>
              </div>
              <Toggle checked={form.wantsInvoice} onChange={(v) => setForm((f) => ({ ...f, wantsInvoice: v }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Data de nascimento</label>
              <DatePicker value={form.birthday} onChange={(v) => setForm((f) => ({ ...f, birthday: v }))} max={new Date().toISOString().slice(0, 10)} yearNav clearable />
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
