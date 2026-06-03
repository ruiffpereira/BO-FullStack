import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
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
  password: string;
  permissionId: string;
};
const emptyUserForm: UserForm = {
  name: "",
  email: "",
  password: "",
  permissionId: "",
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
        label={
          isEdit
            ? "Nova palavra-passe (em branco para manter)"
            : "Palavra-passe"
        }
        type="password"
        value={form.password}
        onChange={(e: any) => setForm({ ...form, password: e.target.value })}
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
  const [rotateOpen, setRotateOpen] = useState(false);
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
      onError: () => toast.error("Erro ao criar"),
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
      onError: () => toast.error("Erro ao actualizar"),
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
      onError: () => toast.error("Erro ao eliminar"),
    },
  });
  const rotateM = usePutUsers({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Chave renovada");
        setRotateOpen(false);
      },
      onError: () => toast.error("Erro ao renovar"),
    },
  });

  const openEdit = (u: User) => {
    setSelected(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      permissionId: u.permissions?.[0]?.permissionId ?? "",
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
            <th className="px-4 py-3 hidden lg:table-cell">User ID</th>
            <th className="px-4 py-3">Permissão</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
          {isLoading ? (
            <SkeletonRows cols={5} />
          ) : users.length === 0 ? (
            <EmptyRow cols={5} />
          ) : null}
          {(users as User[]).map((u) => (
            <tr
              key={u.userId}
              className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition"
            >
              <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-white">
                {u.name}
              </td>
              <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell">
                {u.email}
              </td>
              <td className="px-4 py-3.5 hidden lg:table-cell">
                <CopyBtn value={u.userId} />
              </td>
              <td className="px-4 py-3.5">
                <div className="flex flex-wrap gap-1">
                  {u.permissions?.length
                    ? u.permissions.map((p) => (
                        <Badge key={p.permissionId} tone="blue">{p.name}</Badge>
                      ))
                    : <span className="text-xs text-zinc-400">—</span>}
                </div>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex justify-end gap-1">
                  <IconButton
                    title="Renovar chave API"
                    icon="star"
                    label="Renovar chave"
                    onClick={() => {
                      setSelected(u);
                      setRotateOpen(true);
                    }}
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
                if (
                  !form.name ||
                  !form.email ||
                  !form.password ||
                  !form.permissionId
                ) {
                  toast.error("Preenche todos os campos");
                  return;
                }
                createM.mutate({
                  data: {
                    name: form.name,
                    email: form.email,
                    password: form.password,
                    permissionId: form.permissionId,
                  },
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
                if (form.password) p.password = form.password;
                if (form.permissionId) p.permissionId = form.permissionId;
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

      <Modal
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        title="Renovar chave de API"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRotateOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={rotateM.isPending}
              onClick={() =>
                selected &&
                rotateM.mutate({
                  data: { userId: selected.userId, secretkeysite: true },
                })
              }
            >
              {rotateM.isPending ? "A renovar…" : "Renovar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Vai gerar uma nova chave de API para <strong>{selected?.name}</strong>
          . A chave anterior deixará de funcionar imediatamente.
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
      onError: () => toast.error("Erro ao criar"),
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
      onError: () => toast.error("Erro ao actualizar"),
    },
  });
  const deleteM = useDeletePermissionsId({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Eliminada");
        invalidate();
      },
      onError: () => toast.error("Erro ao eliminar"),
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
      onError: () => toast.error("Erro ao criar"),
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
      onError: () => toast.error("Erro ao actualizar"),
    },
  });
  const deleteM = useDeleteComponentsId({
    client: { headers },
    mutation: {
      onSuccess: () => {
        toast.success("Eliminado");
        invalidate();
      },
      onError: () => toast.error("Erro ao eliminar"),
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

// ─── Admin root ───────────────────────────────────────────────────────────────
const TABS = [
  ["utilizadores", "Utilizadores"],
  ["permissoes", "Permissões"],
  ["componentes", "Componentes"],
] as const;

export function Admin() {
  const { authHeader } = useAuth();
  const headers = authHeader();
  const [tab, setTab] = useState<"utilizadores" | "permissoes" | "componentes">(
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
    </div>
  );
}
