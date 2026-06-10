import { useState } from "react";
import { toast } from "sonner";
import { getApiError } from "../lib/apiError";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
import { Icon } from "../ui/icons.jsx";
import {
  Card,
  Button,
  IconButton,
  Badge,
  Input,
  Modal,
  PageHeader,
} from "../ui/ui.jsx";

import {
  useGetUsers,
  getUsersQueryKey,
} from "../gen/backoffice/hooks/useGetUsers.js";
import { usePostUsersRegister } from "../gen/backoffice/hooks/usePostUsersRegister.js";
import { usePutUsers } from "../gen/backoffice/hooks/usePutUsers.js";
import { useDeleteUsersUserid } from "../gen/backoffice/hooks/useDeleteUsersUserid.js";
import {
  useGetPermissions,
  getPermissionsQueryKey,
} from "../gen/backoffice/hooks/useGetPermissions.js";
import { usePostPermissions } from "../gen/backoffice/hooks/usePostPermissions.js";
import { usePutPermissionsId } from "../gen/backoffice/hooks/usePutPermissionsId.js";
import { useDeletePermissionsId } from "../gen/backoffice/hooks/useDeletePermissionsId.js";
import {
  useGetComponents,
  getComponentsQueryKey,
} from "../gen/backoffice/hooks/useGetComponents.js";
import { usePostComponents } from "../gen/backoffice/hooks/usePostComponents.js";
import { usePutComponentsId } from "../gen/backoffice/hooks/usePutComponentsId.js";
import { useDeleteComponentsId } from "../gen/backoffice/hooks/useDeleteComponentsId.js";
import { useGetSiteTokens, getSiteTokensQueryKey } from "../gen/backoffice/hooks/useGetSiteTokens.js";
import { usePostSiteTokens } from "../gen/backoffice/hooks/usePostSiteTokens.js";
import { usePatchSiteTokensIdRevoke } from "../gen/backoffice/hooks/usePatchSiteTokensIdRevoke.js";
import { useDeleteSiteTokensId } from "../gen/backoffice/hooks/useDeleteSiteTokensId.js";

import type { User } from "../gen/backoffice/types/User.js";
import type { Permission } from "../gen/backoffice/types/Permission.js";
import type { Component } from "../gen/backoffice/types/Component.js";

// ─── Shared helpers ───────────────────────────────────────────────────────────
function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td
        colSpan={cols}
        className="px-4 py-8 text-center text-zinc-400 text-sm"
      >
        Nenhum registo encontrado.
      </td>
    </tr>
  );
}
function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800/50">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3.5">
              <div
                className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"
                style={{ width: `${60 + j * 10}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 font-mono text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
    >
      {value.slice(0, 8)}…
      <Icon name={copied ? "check" : "image"} className="w-3 h-3" />
    </button>
  );
}

// ─── Utilizadores tab ─────────────────────────────────────────────────────────
type UserForm = {
  name: string;
  email: string;
  phone: string;
  permissionId: string;
  emailSenderName: string;
  fromEmail: string;
  siteUrl: string;
};
const emptyUserForm: UserForm = {
  name: "",
  email: "",
  phone: "",
  permissionId: "",
  emailSenderName: "",
  fromEmail: "",
  siteUrl: "",
};

function UserFormFields({
  form,
  setForm,
  permissions,
  isEdit = false,
}: {
  form: UserForm;
  setForm: (f: UserForm) => void;
  permissions: Permission[];
  isEdit?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Nome"
        value={form.name}
        onChange={(e: any) => setForm({ ...form, name: e.target.value })}
        placeholder="Nome"
      />
      <Input
        label="Email"
        type="email"
        value={form.email}
        onChange={(e: any) => setForm({ ...form, email: e.target.value })}
        placeholder="email@exemplo.com"
      />
      <Input
        label="Telemóvel"
        type="tel"
        value={form.phone}
        onChange={(e: any) => setForm({ ...form, phone: e.target.value })}
        placeholder="912 345 678"
      />
      {!isEdit && (
        <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-3.5 py-3">
          <Icon name="mail" className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            O utilizador receberá um email para criar a sua palavra-passe.
          </p>
        </div>
      )}
      <Input
        label="Nome de remetente nos emails"
        value={form.emailSenderName}
        onChange={(e: any) =>
          setForm({ ...form, emailSenderName: e.target.value })
        }
        placeholder="Ex: Barbearia Tiago (deixar em branco para usar o Nome)"
      />
      <Input
        label="Email de envio (deve ser de domínio verificado no Resend)"
        type="email"
        value={form.fromEmail}
        onChange={(e: any) => setForm({ ...form, fromEmail: e.target.value })}
        placeholder="noreply@teudominio.com"
      />
      <Input
        label="URL do site"
        value={form.siteUrl}
        onChange={(e: any) => setForm({ ...form, siteUrl: e.target.value })}
        placeholder="https://google.com"
      />
      <div>
        <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Permissão
        </p>
        <select
          value={form.permissionId}
          onChange={(e) => setForm({ ...form, permissionId: e.target.value })}
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-accent"
        >
          <option value="">Seleccionar permissão</option>
          {permissions.map((p) => (
            <option key={p.permissionId} value={p.permissionId}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function UtilizadoresTab({ headers }: { headers: Record<string, string> }) {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useGetUsers({ client: { headers } });
  const { data: permissions = [] } = useGetPermissions({ client: { headers } });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getUsersQueryKey() });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUserForm);

  const createM = usePostUsersRegister({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Utilizador criado");
        setCreateOpen(false);
        setForm(emptyUserForm);
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const updateM = usePutUsers({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Actualizado");
        setEditOpen(false);
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const deleteM = useDeleteUsersUserid({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Eliminado");
        setDeleteOpen(false);
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const sendResetM = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`${API_BASE}/users/${userId}/send-reset`, { method: 'POST', headers })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Erro') }
    },
    onSuccess: () => toast.success('Email de reset enviado'),
    onError: (e: any) => toast.error(e.message),
  })

  const openEdit = (u: User) => {
    setSelected(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: (u as any).phone ?? "",
      permissionId: u.permissions?.[0]?.permissionId ?? "",
      emailSenderName: (u as any).emailSenderName ?? "",
      fromEmail: (u as any).fromEmail ?? "",
      siteUrl: (u as any).siteUrl ?? "",
    });
    setEditOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          icon="plus"
          size="sm"
          onClick={() => {
            setForm(emptyUserForm);
            setCreateOpen(true);
          }}
        >
          Novo utilizador
        </Button>
      </div>
      <TableWrapper>
        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3 hidden md:table-cell">Email</th>
            <th className="px-4 py-3 hidden xl:table-cell">Telemóvel</th>
            <th className="px-4 py-3 hidden lg:table-cell">User ID</th>
            <th className="px-4 py-3">Permissão</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
          {isLoading ? (
            <SkeletonRows cols={6} />
          ) : users.length === 0 ? (
            <EmptyRow cols={6} />
          ) : null}
          {(users as User[]).map((u) => (
            <tr
              key={u.userId}
              onClick={() => openEdit(u)}
              className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition cursor-pointer"
            >
              <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-white">
                {u.name}
              </td>
              <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell">
                {u.email}
              </td>
              <td className="px-4 py-3.5 text-zinc-500 hidden xl:table-cell">
                {(u as any).phone ?? "—"}
              </td>
              <td className="px-4 py-3.5 hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                <CopyBtn value={u.userId} />
              </td>
              <td className="px-4 py-3.5">
                <div className="flex flex-wrap gap-1">
                  {u.permissions?.length ? (
                    u.permissions.map((p) => (
                      <Badge key={p.permissionId} tone="blue">
                        {p.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <IconButton
                    title="Enviar email de reset de password"
                    icon="key"
                    label="Reset password"
                    onClick={() => sendResetM.mutate(u.userId)}
                  />
                  <IconButton
                    icon="edit"
                    label="Editar"
                    onClick={() => openEdit(u)}
                  />
                  <IconButton
                    icon="trash"
                    label="Eliminar"
                    onClick={() => {
                      setSelected(u);
                      setDeleteOpen(true);
                    }}
                    className="hover:text-red-500"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo utilizador"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={createM.isPending}
              onClick={() => {
                if (!form.name || !form.email || !form.permissionId) {
                  toast.error("Nome, email e permissão são obrigatórios");
                  return;
                }
                createM.mutate({
                  data: {
                    name: form.name,
                    email: form.email,
                    phone: form.phone || undefined,
                    permissionId: form.permissionId,
                  } as any,
                });
              }}
            >
              {createM.isPending ? "A criar…" : "Criar"}
            </Button>
          </>
        }
      >
        <UserFormFields
          form={form}
          setForm={setForm}
          permissions={permissions}
        />
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar utilizador"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={updateM.isPending}
              onClick={() => {
                if (!selected) return;
                const p: any = { userId: selected.userId };
                if (form.name) p.name = form.name;
                if (form.email) p.email = form.email;
                p.phone = form.phone || null;
                if (form.permissionId) p.permissionId = form.permissionId;
                p.emailSenderName = form.emailSenderName || null;
                p.fromEmail = form.fromEmail || null;
                p.siteUrl = form.siteUrl || null;
                updateM.mutate({ data: p });
              }}
            >
              {updateM.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </>
        }
      >
        <UserFormFields
          form={form}
          setForm={setForm}
          permissions={permissions}
          isEdit
        />
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar utilizador"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={deleteM.isPending}
              onClick={() =>
                selected && deleteM.mutate({ userId: selected.userId })
              }
            >
              {deleteM.isPending ? "A eliminar…" : "Eliminar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Tens a certeza que queres eliminar <strong>{selected?.name}</strong>?
          Esta acção não pode ser desfeita.
        </p>
      </Modal>

    </div>
  );
}

// ─── Permissões tab ───────────────────────────────────────────────────────────
type PermForm = { name: string; description: string };
const emptyPermForm: PermForm = { name: "", description: "" };

function PermFormFields({
  form,
  setForm,
}: {
  form: PermForm;
  setForm: (f: PermForm) => void;
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Nome (ex: VIEW_SCHEDULE)"
        value={form.name}
        onChange={(e: any) => setForm({ ...form, name: e.target.value })}
        placeholder="VIEW_NOME"
      />
      <div>
        <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Descrição (opcional)
        </p>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-accent resize-none"
        />
      </div>
    </div>
  );
}

function PermissoesTab({ headers }: { headers: Record<string, string> }) {
  const qc = useQueryClient();
  const { data: permissions = [], isLoading } = useGetPermissions({
    client: { headers },
  });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getPermissionsQueryKey() });
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Permission | null>(null);
  const [form, setForm] = useState<PermForm>(emptyPermForm);
  const createM = usePostPermissions({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Permissão criada");
        setCreateOpen(false);
        setForm(emptyPermForm);
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const updateM = usePutPermissionsId({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Actualizada");
        setEditOpen(false);
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const deleteM = useDeletePermissionsId({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Eliminada");
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          icon="plus"
          size="sm"
          onClick={() => {
            setForm(emptyPermForm);
            setCreateOpen(true);
          }}
        >
          Nova permissão
        </Button>
      </div>
      <TableWrapper>
        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3 hidden md:table-cell">Descrição</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
          {isLoading ? (
            <SkeletonRows cols={3} />
          ) : permissions.length === 0 ? (
            <EmptyRow cols={3} />
          ) : null}
          {permissions.map((p) => (
            <tr
              key={p.permissionId}
              className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition"
            >
              <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-white">
                {p.name}
              </td>
              <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell">
                {p.description ?? "—"}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex justify-end gap-1">
                  <IconButton
                    icon="edit"
                    label="Editar"
                    onClick={() => {
                      setSelected(p);
                      setForm({
                        name: p.name,
                        description: p.description ?? "",
                      });
                      setEditOpen(true);
                    }}
                  />
                  <IconButton
                    icon="trash"
                    label="Eliminar"
                    onClick={() =>
                      confirm(`Eliminar "${p.name}"?`) &&
                      deleteM.mutate({ id: p.permissionId })
                    }
                    className="hover:text-red-500"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nova permissão"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={createM.isPending}
              onClick={() => {
                if (!form.name) {
                  toast.error("O nome é obrigatório");
                  return;
                }
                createM.mutate({
                  data: {
                    name: form.name,
                    description: form.description || undefined,
                  },
                });
              }}
            >
              {createM.isPending ? "A criar…" : "Criar"}
            </Button>
          </>
        }
      >
        <PermFormFields form={form} setForm={setForm} />
      </Modal>
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar permissão"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={updateM.isPending}
              onClick={() => {
                if (!selected) return;
                updateM.mutate({
                  id: selected.permissionId,
                  data: {
                    name: form.name,
                    description: form.description || undefined,
                  },
                });
              }}
            >
              {updateM.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </>
        }
      >
        <PermFormFields form={form} setForm={setForm} />
      </Modal>
    </div>
  );
}

// ─── Componentes tab ──────────────────────────────────────────────────────────
type CompForm = {
  name: string;
  description: string;
  selectedPermissions: string[];
};
const emptyCompForm: CompForm = {
  name: "",
  description: "",
  selectedPermissions: [],
};

function ComponentesTab({ headers }: { headers: Record<string, string> }) {
  const qc = useQueryClient();
  const { data: components = [], isLoading } = useGetComponents({
    client: { headers },
  });
  const { data: permissions = [] } = useGetPermissions({ client: { headers } });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getComponentsQueryKey() });
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Component | null>(null);
  const [form, setForm] = useState<CompForm>(emptyCompForm);
  const togglePerm = (id: string) =>
    setForm((f) => ({
      ...f,
      selectedPermissions: f.selectedPermissions.includes(id)
        ? f.selectedPermissions.filter((x) => x !== id)
        : [...f.selectedPermissions, id],
    }));
  const openEdit = (c: Component) => {
    setSelected(c);
    setForm({
      name: c.name,
      description: c.description ?? "",
      selectedPermissions: c.permissions?.map((p) => p.permissionId) ?? [],
    });
    setEditOpen(true);
  };
  const createM = usePostComponents({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Componente criado");
        setCreateOpen(false);
        setForm(emptyCompForm);
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const updateM = usePutComponentsId({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Actualizado");
        setEditOpen(false);
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const deleteM = useDeleteComponentsId({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Eliminado");
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });

  const FormFields = () => (
    <div className="space-y-4">
      <Input
        label="Nome (ex: VIEW_SCHEDULE)"
        value={form.name}
        onChange={(e: any) => setForm({ ...form, name: e.target.value })}
        placeholder="VIEW_NOME"
      />
      <div>
        <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Descrição (opcional)
        </p>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-accent resize-none"
        />
      </div>
      <div>
        <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Permissões com acesso
        </p>
        <div className="space-y-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
          {permissions.length === 0 && (
            <p className="text-sm text-zinc-400">
              Nenhuma permissão criada ainda.
            </p>
          )}
          {permissions.map((p) => (
            <label
              key={p.permissionId}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={form.selectedPermissions.includes(p.permissionId)}
                onChange={() => togglePerm(p.permissionId)}
                className="rounded border-zinc-300 text-accent focus:ring-accent/20"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-200 flex-1">
                {p.name}
              </span>
              {p.description && (
                <span className="text-xs text-zinc-400">— {p.description}</span>
              )}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          icon="plus"
          size="sm"
          onClick={() => {
            setForm(emptyCompForm);
            setCreateOpen(true);
          }}
        >
          Novo componente
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {components.length === 0 && (
            <Card className="p-8 col-span-full text-center text-sm text-zinc-400">
              Nenhum componente criado.
            </Card>
          )}
          {(components as Component[]).map((c) => (
            <Card key={c.componentId} className="p-5 group">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Icon name="layers" className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-zinc-900 dark:text-white font-mono text-sm">
                    {c.name}
                  </h3>
                  {c.description && (
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {c.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <IconButton
                    icon="edit"
                    label="Editar"
                    onClick={() => openEdit(c)}
                  />
                  <IconButton
                    icon="trash"
                    label="Eliminar"
                    onClick={() =>
                      confirm(`Eliminar "${c.name}"?`) &&
                      deleteM.mutate({ id: c.componentId })
                    }
                    className="hover:text-red-500"
                  />
                </div>
              </div>
              {c.permissions && c.permissions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800">
                  {c.permissions.map((perm) => (
                    <Badge key={perm.permissionId} tone="neutral">
                      {perm.name}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo componente"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={createM.isPending}
              onClick={() => {
                if (!form.name) {
                  toast.error("O nome é obrigatório");
                  return;
                }
                createM.mutate({
                  data: {
                    name: form.name,
                    description: form.description || undefined,
                    selectPermissions: form.selectedPermissions,
                  },
                });
              }}
            >
              {createM.isPending ? "A criar…" : "Criar"}
            </Button>
          </>
        }
      >
        <FormFields />
      </Modal>
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar componente"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={updateM.isPending}
              onClick={() => {
                if (!selected) return;
                updateM.mutate({
                  id: selected.componentId,
                  data: {
                    name: form.name,
                    selectPermissions: form.selectedPermissions,
                  },
                });
              }}
            >
              {updateM.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </>
        }
      >
        <FormFields />
      </Modal>
    </div>
  );
}

// ─── Tokens tab ───────────────────────────────────────────────────────────────
type SiteTokenRecord = {
  tokenId: string
  userId: string
  label: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("pt-PT", { dateStyle: "medium" })
}

function TokensTab({ headers }: { headers: Record<string, string> }) {
  const qc = useQueryClient()

  const { data: users = [] } = useGetUsers({ client: { headers } })
  const [selectedUserId, setSelectedUserId] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: tokens = [], isLoading } = useGetSiteTokens(selectedUserId ? { userId: selectedUserId } : undefined)

  const createMut = usePostSiteTokens({
    mutation: {
      onSuccess: (data: any) => {
        qc.invalidateQueries({ queryKey: getSiteTokensQueryKey() })
        setCreateOpen(false)
        setLabel("")
        setNewToken(data.token ?? null)
        setCopied(false)
      },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  const revokeMut = usePatchSiteTokensIdRevoke({
    mutation: {
      onSuccess: () => { toast.success("Token revogado"); qc.invalidateQueries({ queryKey: getSiteTokensQueryKey() }) },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  const deleteMut = useDeleteSiteTokensId({
    mutation: {
      onSuccess: () => { toast.success("Token eliminado"); qc.invalidateQueries({ queryKey: getSiteTokensQueryKey() }) },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  const copy = async () => {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 shrink-0">Utilizador:</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            {(users as User[]).map((u) => (
              <option key={u.userId} value={u.userId}>{u.name}</option>
            ))}
          </select>
        </div>
        <Button
          icon="plus"
          size="sm"
          onClick={() => { setLabel(""); setCreateOpen(true) }}
          disabled={!selectedUserId}
        >
          Novo token
        </Button>
      </div>

      <TableWrapper>
        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3 hidden md:table-cell">Utilizador</th>
            <th className="px-4 py-3 hidden sm:table-cell">Criado</th>
            <th className="px-4 py-3 hidden lg:table-cell">Último uso</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
          {isLoading ? <SkeletonRows cols={6} /> : null}
          {!isLoading && tokens.length === 0 && <EmptyRow cols={6} />}
          {tokens.map((t) => {
            const owner = (users as User[]).find((u) => u.userId === t.userId)
            return (
              <tr key={t.tokenId}>
                <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-white">{t.label}</td>
                <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell text-xs">{owner?.name ?? t.userId.slice(0, 8) + "…"}</td>
                <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell text-xs">{formatDate(t.createdAt)}</td>
                <td className="px-4 py-3.5 text-zinc-500 hidden lg:table-cell text-xs">{formatDate(t.lastUsedAt)}</td>
                <td className="px-4 py-3.5">
                  {t.revokedAt ? <Badge tone="red">Revogado</Badge> : <Badge tone="green">Activo</Badge>}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex justify-end gap-1">
                    {!t.revokedAt && (
                      <IconButton
                        icon="x"
                        label="Revogar"
                        title="Revogar token"
                        onClick={() => window.confirm(`Revogar "${t.label}"?`) && revokeMut.mutate({ id: t.tokenId })}
                        className="hover:text-amber-500"
                      />
                    )}
                    <IconButton
                      icon="trash"
                      label="Eliminar"
                      onClick={() => window.confirm(`Eliminar "${t.label}"?`) && deleteMut.mutate({ id: t.tokenId })}
                      className="hover:text-red-500"
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableWrapper>

      {/* Modal: criar token */}
      {createOpen && (
        <Modal
          open
          onClose={() => setCreateOpen(false)}
          title="Novo token de site"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button
                disabled={createMut.isPending}
                onClick={() => {
                  if (!label.trim()) { toast.error("Introduz um nome para o token"); return }
                  createMut.mutate({ data: { label: label.trim(), userId: selectedUserId } })
                }}
              >
                {createMut.isPending ? "A gerar…" : "Gerar token"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Input
              label="Nome do token"
              value={label}
              onChange={(e: any) => setLabel(e.target.value)}
              placeholder="Barber Tiago — Produção"
            />
            <p className="text-xs text-zinc-400">
              O valor do token só é mostrado uma vez, imediatamente após a criação. Copia-o para o <code>.env</code> do site.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal: mostrar token gerado */}
      {newToken && (
        <Modal
          open
          onClose={() => setNewToken(null)}
          title="Token gerado"
          footer={
            <>
              <Button onClick={copy} icon={copied ? "check" : "copy"}>{copied ? "Copiado!" : "Copiar"}</Button>
              <Button variant="ghost" onClick={() => setNewToken(null)}>Fechar</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Copia agora — não voltarás a ver este valor</p>
              <p className="text-xs text-amber-600 dark:text-amber-300">Este token não é guardado em claro. Se o perderes, revoga e gera um novo.</p>
            </div>
            <div
              onClick={copy}
              className="cursor-pointer bg-zinc-900 dark:bg-zinc-950 rounded-xl p-4 font-mono text-xs text-emerald-400 break-all select-all border border-zinc-700 hover:border-accent transition"
            >
              {newToken}
            </div>
            <p className="text-xs text-zinc-400">Adiciona ao <code>.env</code> do site: <code className="text-zinc-600">VITE_SITE_TOKEN=&lt;valor&gt;</code></p>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Admin root ───────────────────────────────────────────────────────────────
const TABS = [
  ["utilizadores", "Utilizadores"],
  ["permissoes", "Permissões"],
  ["componentes", "Componentes"],
  ["tokens", "Tokens de site"],
] as const;

export function Admin() {
  const { authHeader } = useAuth();
  const headers = authHeader();
  const [tab, setTab] = useState<"utilizadores" | "permissoes" | "componentes" | "tokens">(
    "utilizadores",
  );
  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="Gere utilizadores, permissões e componentes."
      />
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-6 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${tab === id ? "border-accent text-accent" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "utilizadores" && <UtilizadoresTab headers={headers} />}
      {tab === "permissoes" && <PermissoesTab headers={headers} />}
      {tab === "componentes" && <ComponentesTab headers={headers} />}
      {tab === "tokens" && <TokensTab headers={headers} />}
    </div>
  );
}
