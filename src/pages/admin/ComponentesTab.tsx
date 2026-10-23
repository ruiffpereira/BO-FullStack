import { useState } from "react";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, IconButton, Badge, Input, Modal } from "../../ui/ui.jsx";
import { confirmDialog } from "../../components/confirm";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { useGetPermissions } from "../../gen/backoffice/hooks/useGetPermissions.js";
import { useGetComponents, getComponentsQueryKey } from "../../gen/backoffice/hooks/useGetComponents.js";
import { usePostComponents } from "../../gen/backoffice/hooks/usePostComponents.js";
import { usePutComponentsId } from "../../gen/backoffice/hooks/usePutComponentsId.js";
import { useDeleteComponentsId } from "../../gen/backoffice/hooks/useDeleteComponentsId.js";
import type { Component } from "../../gen/backoffice/types/Component.js";
import { REVEAL_ON_HOVER } from "../../ui/reveal";

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

export function ComponentesTab() {
  const qc = useQueryClient();
  const { data: components = [], isLoading } = useGetComponents({
  });
  const { data: permissions = [] } = useGetPermissions();
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
                checked={!!p.protected || form.selectedPermissions.includes(p.permissionId)}
                disabled={!!p.protected}
                onChange={() => togglePerm(p.permissionId)}
                className="rounded border-zinc-300 text-accent focus:ring-accent/20"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-200 flex-1">
                {p.name}
              </span>
              {p.protected ? (
                <span className="text-xs text-zinc-400">O Admin tem sempre acesso</span>
              ) : (
                p.description && (
                  <span className="text-xs text-zinc-400">— {p.description}</span>
                )
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
                {c.protected ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 shrink-0"
                    title="Componente do sistema: não se edita nem se elimina."
                  >
                    <Icon name="lock" className="w-3.5 h-3.5" />
                    Só leitura
                  </span>
                ) : (
                  <div className={`flex gap-0.5 transition ${REVEAL_ON_HOVER}`}>
                    <IconButton
                      icon="edit"
                      label="Editar"
                      onClick={() => openEdit(c)}
                    />
                    <GuardIconButton
                      icon="trash"
                      label="Eliminar"
                      onClick={async () => {
                        if (await confirmDialog({ title: `Eliminar "${c.name}"?`, danger: true }))
                          deleteM.mutate({ id: c.componentId });
                      }}
                      className="hover:text-red-500"
                    />
                  </div>
                )}
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
                    selectPermissions: form.selectedPermissions,
                  },
                });
              }}
            >
              {createM.isPending ? "A criar…" : "Criar"}
            </GuardButton>
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
            <GuardButton
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
            </GuardButton>
          </>
        }
      >
        <FormFields />
      </Modal>
    </div>
  );
}
