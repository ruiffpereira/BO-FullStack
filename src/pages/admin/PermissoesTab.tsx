import { useState } from "react";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../ui/icons.jsx";
import { Button, IconButton, Input, Modal } from "../../ui/ui.jsx";
import { confirmDialog } from "../../components/confirm";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { useGetPermissions, getPermissionsQueryKey } from "../../gen/backoffice/hooks/useGetPermissions.js";
import { usePostPermissions } from "../../gen/backoffice/hooks/usePostPermissions.js";
import { usePutPermissionsId } from "../../gen/backoffice/hooks/usePutPermissionsId.js";
import { useDeletePermissionsId } from "../../gen/backoffice/hooks/useDeletePermissionsId.js";
import type { Permission } from "../../gen/backoffice/types/Permission.js";
import { EmptyRow, SkeletonRows, TableWrapper } from "./shared";

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

export function PermissoesTab() {
  const qc = useQueryClient();
  const { data: permissions = [], isLoading } = useGetPermissions({
  });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getPermissionsQueryKey() });
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Permission | null>(null);
  const [form, setForm] = useState<PermForm>(emptyPermForm);
  const createM = usePostPermissions({
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
                  {p.protected ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-400"
                      title="O Admin é fixo: não se edita nem se elimina."
                    >
                      <Icon name="lock" className="w-3.5 h-3.5" />
                      Só leitura
                    </span>
                  ) : (
                    <>
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
                      <GuardIconButton
                        icon="trash"
                        label="Eliminar"
                        onClick={async () => {
                          if (await confirmDialog({ title: `Eliminar "${p.name}"?`, danger: true }))
                            deleteM.mutate({ id: p.permissionId });
                        }}
                        className="hover:text-red-500"
                      />
                    </>
                  )}
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
            <GuardButton
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
            </GuardButton>
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
            <GuardButton
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
            </GuardButton>
          </>
        }
      >
        <PermFormFields form={form} setForm={setForm} />
      </Modal>
    </div>
  );
}
