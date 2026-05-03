'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, Key } from 'lucide-react'

import { useGetUsers, getUsersQueryKey } from '@/servers/backoffice/hooks/useGetUsers'
import { usePostUsersRegister } from '@/servers/backoffice/hooks/usePostUsersRegister'
import { usePutUsers } from '@/servers/backoffice/hooks/usePutUsers'
import { useDeleteUsersUserid } from '@/servers/backoffice/hooks/useDeleteUsersUserid'

import { useGetPermissions, getPermissionsQueryKey } from '@/servers/backoffice/hooks/useGetPermissions'
import { usePostPermissions } from '@/servers/backoffice/hooks/usePostPermissions'
import { usePutPermissionsId } from '@/servers/backoffice/hooks/usePutPermissionsId'
import { useDeletePermissionsId } from '@/servers/backoffice/hooks/useDeletePermissionsId'

import { useGetComponents, getComponentsQueryKey } from '@/servers/backoffice/hooks/useGetComponents'
import { usePostComponents } from '@/servers/backoffice/hooks/usePostComponents'
import { usePutComponentsId } from '@/servers/backoffice/hooks/usePutComponentsId'
import { useDeleteComponentsId } from '@/servers/backoffice/hooks/useDeleteComponentsId'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/ui/tabs'
import { Button } from '@/components/shadcn/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/shadcn/ui/dialog'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import { Textarea } from '@/components/shadcn/ui/textarea'
import { Checkbox } from '@/components/shadcn/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select'

type PermissionObj = { permissionId: string; name: string; description?: string }
type UserWithPermissions = {
  userId: string
  name: string
  email: string
  siteUrl?: string | null
  permissions?: PermissionObj[]
}
type ComponentWithPermissions = {
  componentId: string
  name: string
  description?: string
  permissions?: PermissionObj[]
}

export default function ManagementPanel() {
  const { data: session } = useSession()
  const headers = { Authorization: `Bearer ${session?.accessToken}` }
  const qc = useQueryClient()

  const { data: rawUsers = [], isLoading: loadingUsers } = useGetUsers({ client: { headers } })
  const { data: rawPermissions = [], isLoading: loadingPerms } = useGetPermissions({ client: { headers } })
  const { data: rawComponents = [], isLoading: loadingComps } = useGetComponents({ client: { headers } })

  const users = rawUsers as unknown as UserWithPermissions[]
  const permissions = rawPermissions as PermissionObj[]
  const components = rawComponents as unknown as ComponentWithPermissions[]

  return (
    <Tabs defaultValue="users">
      <TabsList className="mb-6">
        <TabsTrigger value="users">Utilizadores</TabsTrigger>
        <TabsTrigger value="permissions">Permissões</TabsTrigger>
        <TabsTrigger value="components">Componentes</TabsTrigger>
      </TabsList>

      <TabsContent value="users">
        <UsersTab
          users={users}
          permissions={permissions}
          headers={headers}
          loading={loadingUsers}
          onMutate={() => qc.invalidateQueries({ queryKey: getUsersQueryKey() })}
        />
      </TabsContent>

      <TabsContent value="permissions">
        <PermissionsTab
          permissions={permissions}
          headers={headers}
          loading={loadingPerms}
          onMutate={() => qc.invalidateQueries({ queryKey: getPermissionsQueryKey() })}
        />
      </TabsContent>

      <TabsContent value="components">
        <ComponentsTab
          components={components}
          permissions={permissions}
          headers={headers}
          loading={loadingComps}
          onMutate={() => qc.invalidateQueries({ queryKey: getComponentsQueryKey() })}
        />
      </TabsContent>
    </Tabs>
  )
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

type UserForm = { name: string; email: string; password: string; permissionId: string; siteUrl: string }
const emptyUserForm: UserForm = { name: '', email: '', password: '', permissionId: '', siteUrl: '' }

function UsersTab({
  users,
  permissions,
  headers,
  loading,
  onMutate,
}: {
  users: UserWithPermissions[]
  permissions: PermissionObj[]
  headers: Record<string, string>
  loading: boolean
  onMutate: () => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [selected, setSelected] = useState<UserWithPermissions | null>(null)
  const [form, setForm] = useState<UserForm>(emptyUserForm)

  const createM = usePostUsersRegister({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Utilizador criado'); setCreateOpen(false); setForm(emptyUserForm); onMutate() },
      onError: () => toast.error('Erro ao criar utilizador'),
    },
  })
  const updateM = usePutUsers({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Utilizador atualizado'); setEditOpen(false); onMutate() },
      onError: () => toast.error('Erro ao atualizar'),
    },
  })
  const deleteM = useDeleteUsersUserid({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Utilizador eliminado'); setDeleteOpen(false); onMutate() },
      onError: () => toast.error('Erro ao eliminar'),
    },
  })
  const rotateM = usePutUsers({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Chave renovada'); setRotateOpen(false) },
      onError: () => toast.error('Erro ao renovar chave'),
    },
  })

  const openEdit = (u: UserWithPermissions) => {
    setSelected(u)
    setForm({ name: u.name, email: u.email, password: '', permissionId: u.permissions?.[0]?.permissionId ?? '', siteUrl: u.siteUrl ?? '' })
    setEditOpen(true)
  }

  if (loading) return <SkeletonRows />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setForm(emptyUserForm); setCreateOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Novo utilizador
        </Button>
      </div>

      <TableWrapper>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Permissão</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.length === 0 && <EmptyRow cols={4} />}
          {users.map((u) => (
            <tr key={u.userId} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{u.name}</td>
              <td className="px-4 py-3 text-slate-500">{u.email}</td>
              <td className="px-4 py-3">
                {u.permissions?.map((p) => (
                  <Badge key={p.permissionId}>{p.name}</Badge>
                ))}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <IconBtn title="Renovar chave API" onClick={() => { setSelected(u); setRotateOpen(true) }}>
                    <Key className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="Editar" onClick={() => openEdit(u)}>
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="Eliminar" className="text-red-500 hover:text-red-600" onClick={() => { setSelected(u); setDeleteOpen(true) }}>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo utilizador</DialogTitle></DialogHeader>
          <UserFormFields form={form} setForm={setForm} permissions={permissions} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              disabled={createM.isPending}
              onClick={() => {
                if (!form.name || !form.email || !form.password || !form.permissionId) return toast.error('Preenche todos os campos')
                createM.mutate({ data: form })
              }}
            >
              {createM.isPending ? 'A criar...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar utilizador</DialogTitle></DialogHeader>
          <UserFormFields form={form} setForm={setForm} permissions={permissions} isEdit />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              disabled={updateM.isPending}
              onClick={() => {
                if (!selected) return
                const payload: Record<string, unknown> = { userId: selected.userId }
                if (form.name) payload.name = form.name
                if (form.email) payload.email = form.email
                if (form.password) payload.password = form.password
                if (form.permissionId) payload.permissionId = form.permissionId
                payload.siteUrl = form.siteUrl || null
                updateM.mutate({ data: payload as Parameters<typeof updateM.mutate>[0]['data'] })
              }}
            >
              {updateM.isPending ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar utilizador"
        description={`Tens a certeza que queres eliminar ${selected?.name}? Esta ação não pode ser desfeita.`}
        onConfirm={() => selected && deleteM.mutate({ userId: selected.userId })}
        isPending={deleteM.isPending}
        confirmLabel="Eliminar"
        confirmVariant="destructive"
      />

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Renovar chave de API"
        description={`Vai gerar uma nova chave de API para ${selected?.name}. A chave antiga deixará de funcionar imediatamente.`}
        onConfirm={() => selected && rotateM.mutate({ data: { userId: selected.userId, secretkeysite: true } })}
        isPending={rotateM.isPending}
        confirmLabel="Renovar"
      />
    </div>
  )
}

function UserFormFields({
  form, setForm, permissions, isEdit = false,
}: {
  form: UserForm
  setForm: (f: UserForm) => void
  permissions: PermissionObj[]
  isEdit?: boolean
}) {
  return (
    <div className="space-y-4">
      <Field label="Nome">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome" />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
      </Field>
      <Field label={isEdit ? 'Nova password (em branco para não alterar)' : 'Password'}>
        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" />
      </Field>
      <Field label="Permissão">
        <Select value={form.permissionId} onValueChange={(v) => setForm({ ...form, permissionId: v })}>
          <SelectTrigger><SelectValue placeholder="Seleciona uma permissão" /></SelectTrigger>
          <SelectContent>
            {permissions.map((p) => (
              <SelectItem key={p.permissionId} value={p.permissionId}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {isEdit && (
        <Field label="URL do website (para links de cancelamento nos emails)">
          <Input
            value={form.siteUrl}
            onChange={(e) => setForm({ ...form, siteUrl: e.target.value })}
            placeholder="https://exemplo.pt"
          />
        </Field>
      )}
    </div>
  )
}

// ─── Permissions Tab ──────────────────────────────────────────────────────────

type PermForm = { name: string; description: string }
const emptyPermForm: PermForm = { name: '', description: '' }

function PermissionsTab({
  permissions,
  headers,
  loading,
  onMutate,
}: {
  permissions: PermissionObj[]
  headers: Record<string, string>
  loading: boolean
  onMutate: () => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<PermissionObj | null>(null)
  const [form, setForm] = useState<PermForm>(emptyPermForm)

  const createM = usePostPermissions({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Permissão criada'); setCreateOpen(false); setForm(emptyPermForm); onMutate() },
      onError: () => toast.error('Erro ao criar permissão'),
    },
  })
  const updateM = usePutPermissionsId({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Permissão atualizada'); setEditOpen(false); onMutate() },
      onError: () => toast.error('Erro ao atualizar'),
    },
  })
  const deleteM = useDeletePermissionsId({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Permissão eliminada'); setDeleteOpen(false); onMutate() },
      onError: () => toast.error('Erro ao eliminar'),
    },
  })

  if (loading) return <SkeletonRows />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setForm(emptyPermForm); setCreateOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Nova permissão
        </Button>
      </div>

      <TableWrapper>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Descrição</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {permissions.length === 0 && <EmptyRow cols={3} />}
          {permissions.map((p) => (
            <tr key={p.permissionId} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3 text-slate-500">{p.description ?? '—'}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <IconBtn title="Editar" onClick={() => { setSelected(p); setForm({ name: p.name, description: p.description ?? '' }); setEditOpen(true) }}>
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="Eliminar" className="text-red-500 hover:text-red-600" onClick={() => { setSelected(p); setDeleteOpen(true) }}>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova permissão</DialogTitle></DialogHeader>
          <PermFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              disabled={createM.isPending}
              onClick={() => {
                if (!form.name) return toast.error('O nome é obrigatório')
                createM.mutate({ data: { name: form.name, description: form.description || undefined } })
              }}
            >
              {createM.isPending ? 'A criar...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar permissão</DialogTitle></DialogHeader>
          <PermFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              disabled={updateM.isPending}
              onClick={() => {
                if (!selected) return
                updateM.mutate({ id: selected.permissionId, data: { name: form.name, description: form.description || undefined } })
              }}
            >
              {updateM.isPending ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar permissão"
        description={`Tens a certeza que queres eliminar a permissão "${selected?.name}"? Os utilizadores com esta permissão perderão o acesso.`}
        onConfirm={() => selected && deleteM.mutate({ id: selected.permissionId })}
        isPending={deleteM.isPending}
        confirmLabel="Eliminar"
        confirmVariant="destructive"
      />
    </div>
  )
}

function PermFormFields({ form, setForm }: { form: PermForm; setForm: (f: PermForm) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Nome">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Cabeleireiro" />
      </Field>
      <Field label="Descrição (opcional)">
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição da permissão" rows={2} />
      </Field>
    </div>
  )
}

// ─── Components Tab ───────────────────────────────────────────────────────────

type CompForm = { name: string; description: string; selectedPermissions: string[] }
const emptyCompForm: CompForm = { name: '', description: '', selectedPermissions: [] }

function ComponentsTab({
  components,
  permissions,
  headers,
  loading,
  onMutate,
}: {
  components: ComponentWithPermissions[]
  permissions: PermissionObj[]
  headers: Record<string, string>
  loading: boolean
  onMutate: () => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<ComponentWithPermissions | null>(null)
  const [form, setForm] = useState<CompForm>(emptyCompForm)

  const createM = usePostComponents({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Componente criado'); setCreateOpen(false); setForm(emptyCompForm); onMutate() },
      onError: () => toast.error('Erro ao criar componente'),
    },
  })
  const updateM = usePutComponentsId({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Componente atualizado'); setEditOpen(false); onMutate() },
      onError: () => toast.error('Erro ao atualizar'),
    },
  })
  const deleteM = useDeleteComponentsId({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Componente eliminado'); setDeleteOpen(false); onMutate() },
      onError: () => toast.error('Erro ao eliminar'),
    },
  })

  const openEdit = (c: ComponentWithPermissions) => {
    setSelected(c)
    setForm({
      name: c.name,
      description: c.description ?? '',
      selectedPermissions: c.permissions?.map((p) => p.permissionId) ?? [],
    })
    setEditOpen(true)
  }

  if (loading) return <SkeletonRows />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setForm(emptyCompForm); setCreateOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Novo componente
        </Button>
      </div>

      <TableWrapper>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Permissões com acesso</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {components.length === 0 && <EmptyRow cols={3} />}
          {components.map((c) => (
            <tr key={c.componentId} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-sm font-medium">{c.name}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {c.permissions?.length
                    ? c.permissions.map((p) => <Badge key={p.permissionId}>{p.name}</Badge>)
                    : <span className="text-sm text-slate-400">Nenhuma</span>}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <IconBtn title="Editar" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="Eliminar" className="text-red-500 hover:text-red-600" onClick={() => { setSelected(c); setDeleteOpen(true) }}>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo componente</DialogTitle></DialogHeader>
          <CompFormFields form={form} setForm={setForm} permissions={permissions} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              disabled={createM.isPending}
              onClick={() => {
                if (!form.name) return toast.error('O nome é obrigatório')
                createM.mutate({ data: { name: form.name, description: form.description || undefined, selectPermissions: form.selectedPermissions } })
              }}
            >
              {createM.isPending ? 'A criar...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar componente</DialogTitle></DialogHeader>
          <CompFormFields form={form} setForm={setForm} permissions={permissions} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              disabled={updateM.isPending}
              onClick={() => {
                if (!selected) return
                updateM.mutate({ id: selected.componentId, data: { name: form.name, selectPermissions: form.selectedPermissions } })
              }}
            >
              {updateM.isPending ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar componente"
        description={`Tens a certeza que queres eliminar "${selected?.name}"? Todas as permissões associadas a este componente serão removidas.`}
        onConfirm={() => selected && deleteM.mutate({ id: selected.componentId })}
        isPending={deleteM.isPending}
        confirmLabel="Eliminar"
        confirmVariant="destructive"
      />
    </div>
  )
}

function CompFormFields({
  form, setForm, permissions,
}: {
  form: CompForm
  setForm: (f: CompForm) => void
  permissions: PermissionObj[]
}) {
  const toggle = (id: string) => {
    setForm({
      ...form,
      selectedPermissions: form.selectedPermissions.includes(id)
        ? form.selectedPermissions.filter((p) => p !== id)
        : [...form.selectedPermissions, id],
    })
  }

  return (
    <div className="space-y-4">
      <Field label="Nome (ex: VIEW_SCHEDULE)">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VIEW_NOME" />
      </Field>
      <Field label="Permissões com acesso">
        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          {permissions.length === 0 && (
            <p className="text-sm text-slate-400">Nenhuma permissão criada ainda</p>
          )}
          {permissions.map((p) => (
            <div key={p.permissionId} className="flex items-center gap-2">
              <Checkbox
                id={`perm-${p.permissionId}`}
                checked={form.selectedPermissions.includes(p.permissionId)}
                onCheckedChange={() => toggle(p.permissionId)}
              />
              <label htmlFor={`perm-${p.permissionId}`} className="cursor-pointer text-sm">
                {p.name}
                {p.description && <span className="ml-1 text-slate-400">— {p.description}</span>}
              </label>
            </div>
          ))}
        </div>
      </Field>
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-slate-400">Nenhum registo encontrado</td>
    </tr>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{children}</span>
  )
}

function IconBtn({ children, className = '', title, onClick }: { children: React.ReactNode; className?: string; title?: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded p-1.5 transition-colors hover:bg-slate-100 ${className}`}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-200" />
      ))}
    </div>
  )
}

function ConfirmDialog({
  open, onOpenChange, title, description, onConfirm, isPending, confirmLabel, confirmVariant = 'default',
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  isPending: boolean
  confirmLabel: string
  confirmVariant?: 'default' | 'destructive'
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-600">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={isPending}>
            {isPending ? 'A processar...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
