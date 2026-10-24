import { useState } from "react";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../ui/icons.jsx";
import { Button, IconButton, Badge, Input, Modal } from "../../ui/ui.jsx";
import { useGetUsers, getUsersQueryKey } from "../../gen/backoffice/hooks/useGetUsers.js";
import { usePagination, Pagination } from "../../components/Pagination";
import { usePostUsersRegister } from "../../gen/backoffice/hooks/usePostUsersRegister.js";
import { usePutUsers } from "../../gen/backoffice/hooks/usePutUsers.js";
import { useDeleteUsersUserid } from "../../gen/backoffice/hooks/useDeleteUsersUserid.js";
import { usePutAdminUsersUseridSiteDomain } from "../../gen/backoffice/hooks/usePutAdminUsersUseridSiteDomain.js";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { usePostUsersUseridSendReset } from "../../gen/backoffice/hooks/usePostUsersUseridSendReset.js";
import { useGetPermissions } from "../../gen/backoffice/hooks/useGetPermissions.js";
import { AdminTeamModal } from "../../components/AdminTeamModal";
import { AdminEmailModal } from "../../components/AdminEmailModal";
import { CopyBtn, EmptyRow, SkeletonRows, TableWrapper } from "./shared";
import { ImpersonateButton, UserRow, supportUntilLabel } from "./ImpersonateButton";
import { UserForm, UserFormFields, emptyUserForm } from "./UserFormFields";

export function UtilizadoresTab({
  currentUserId,
}: {
  currentUserId: string | null;
}) {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useGetUsers();
  const pgUsers = usePagination(users as UserRow[]);
  const { data: permissions = [] } = useGetPermissions();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getUsersQueryKey() });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUserForm);
  // Mudar o email pede a password ACTUAL de quem está ligado (CT-18, B59 F1).
  const [currentPassword, setCurrentPassword] = useState("");
  // Confirmação forte do apagar tenant (B8, hard delete): o admin tem de
  // escrever o email do tenant para o botão destrutivo ficar activo.
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  // Domínio do site do tenant (só o dono da plataforma o define, aqui).
  const [domainOpen, setDomainOpen] = useState(false);
  const [domainValue, setDomainValue] = useState("");
  // Equipa do tenant (B41), só leitura — para suporte.
  const [teamOf, setTeamOf] = useState<{ userId: string; name: string } | null>(null);
  // Domínio de email do tenant (B42 · fase 4), modal ao lado do "Domínio do site".
  const [emailOf, setEmailOf] = useState<{ userId: string; name: string } | null>(null);

  const domainM = usePutAdminUsersUseridSiteDomain({
    mutation: {
      onSuccess: () => {
        toast.success("Domínio guardado");
        setDomainOpen(false);
        invalidate();
      },
      onError: (error) => {
        const status = error?.response?.status;
        if (status === 409) toast.error("Esse domínio já pertence a outro cliente.");
        else if (status === 400) toast.error("Domínio inválido.");
        else toast.error(getApiError(error));
      },
    },
  });

  const openDomain = (u: UserRow) => {
    setSelected(u);
    setDomainValue(u.websiteDomain ?? "");
    setDomainOpen(true);
  };

  const createM = usePostUsersRegister({
    mutation: {
      onSuccess: () => {
        toast.success(
          "Utilizador criado. Enviámos um email ao cliente para ele definir a password.",
        );
        setCreateOpen(false);
        setForm(emptyUserForm);
        invalidate();
      },
      onError: (error) => {
        // O 409 também é "email/telefone em uso" — só o `DOMAIN_TAKEN` é do website.
        if ((error?.response?.data as any)?.code === "DOMAIN_TAKEN")
          toast.error("Esse website já pertence a outro cliente.");
        else toast.error(getApiError(error));
      },
    },
  });
  const updateM = usePutUsers({
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
    mutation: {
      onSuccess: () => {
        toast.success("Tenant eliminado definitivamente");
        // Só fecha o modal (e limpa o estado da confirmação) no sucesso — em
        // erro fica aberto, para o admin poder tentar de novo sem reabrir.
        setDeleteOpen(false);
        setSelected(null);
        setDeleteConfirmEmail("");
        invalidate();
      },
      onError: (error) => {
        const status = error?.response?.status;
        if (status === 400) {
          // O admin tentou apagar-se a si próprio (a API bloqueia mesmo que a
          // UI já esconda essa ação — cinto e suspensórios).
          toast.error("Não podes apagar a tua própria conta.");
        } else if (status === 502) {
          // Cancelamento no Stripe falhou → a API garante que nada foi
          // apagado (o commit da BD só corre depois do Stripe confirmar).
          toast.error("Falha no Stripe — nada foi apagado. Tenta novamente.");
        } else {
          toast.error(
            getApiError(error, "Não foi possível eliminar o tenant. Tenta novamente."),
          );
        }
      },
    },
  });
  const sendResetM = usePostUsersUseridSendReset({
    mutation: {
      onSuccess: () => toast.success('Email de reset enviado'),
      onError: (error) => toast.error(getApiError(error)),
    },
  })

  const openEdit = (u: UserRow) => {
    setSelected(u);
    setForm({
      name: u.name,
      ownerName: u.ownerName ?? "",
      email: u.email,
      phone: u.phone ?? "",
      permissionId: u.permissions?.[0]?.permissionId ?? "",
      websiteDomain: "",
    });
    setCurrentPassword("");
    setEditOpen(true);
  };

  const emailChanged = !!selected && form.email.trim() !== selected.email;

  // Comparação case-insensitive (com trim) do email de confirmação: o que
  // interessa é provar que o admin sabe qual é o tenant que vai desaparecer,
  // não testar se ele escreveu a caixa exacta das letras — copiar/colar de
  // sítios diferentes (a tabela, um email, o Stripe) já basta para variar
  // maiúsculas, e isso não deve bloquear uma ação já de si difícil de repetir.
  const isDeleteConfirmed =
    !!selected &&
    deleteConfirmEmail.trim().toLowerCase() === selected.email.trim().toLowerCase();

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
            <th className="px-4 py-3 hidden lg:table-cell">Site</th>
            <th className="px-4 py-3 hidden md:table-cell">Equipa</th>
            <th className="px-4 py-3">Permissão</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
          {isLoading ? (
            <SkeletonRows cols={8} />
          ) : users.length === 0 ? (
            <EmptyRow cols={8} />
          ) : null}
          {pgUsers.pageItems.map((u) => (
            <tr
              key={u.userId}
              onClick={() => openEdit(u)}
              className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition cursor-pointer"
            >
              <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-white">
                {u.name}
                {supportUntilLabel(u) && (
                  <span className="block text-xs font-normal text-zinc-400">
                    {supportUntilLabel(u)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell">
                {u.email}
              </td>
              <td className="px-4 py-3.5 text-zinc-500 hidden xl:table-cell">
                {u.phone ?? "—"}
              </td>
              <td className="px-4 py-3.5 hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                <CopyBtn value={u.userId} />
              </td>
              <td className="px-4 py-3.5 text-zinc-500 hidden lg:table-cell">
                {u.websiteDomain ?? "—"}
              </td>
              <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell" data-testid="team-count">
                {u.isPlatformAdmin ? "—" : (u.teamCount ?? 0)}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex flex-wrap gap-1">
                  {u.isPlatformAdmin ? (
                    <Badge tone="violet" className="whitespace-nowrap">
                      <Icon name="lock" className="w-3 h-3" />
                      Acesso total
                    </Badge>
                  ) : u.permissions?.length ? (
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
                  {u.userId !== currentUserId && <ImpersonateButton user={u} />}
                  {/* A conta admin não tem equipa (B41): sem acção. */}
                  {!u.isPlatformAdmin && (
                    <IconButton
                      icon="users"
                      label={`Equipa de ${u.name}`}
                      title="Equipa"
                      onClick={() => setTeamOf({ userId: u.userId, name: u.name })}
                    />
                  )}
                  <GuardIconButton
                    title="Enviar email de reset de password"
                    icon="key"
                    label="Reset password"
                    onClick={() => sendResetM.mutate({ userId: u.userId })}
                  />
                  <IconButton
                    icon="globe"
                    label="Domínio do site"
                    title="Domínio do site"
                    onClick={() => openDomain(u)}
                  />
                  {/* A conta admin não tem domínio de email por tenant: sem acção. */}
                  {!u.isPlatformAdmin && (
                    <IconButton
                      icon="mail"
                      label={`Email de ${u.name}`}
                      title="Email"
                      onClick={() => setEmailOf({ userId: u.userId, name: u.name })}
                    />
                  )}
                  <IconButton
                    icon="edit"
                    label="Editar"
                    onClick={() => openEdit(u)}
                  />
                  {/* A conta admin é intocável: sem botão (não apenas desactivado). O espaço
                      vazio mantém os ícones alinhados com as outras linhas. */}
                  {u.isPlatformAdmin ? (
                    <span className="w-9 h-9 shrink-0" aria-hidden="true" />
                  ) : (
                    <GuardIconButton
                      icon="trash"
                      label="Eliminar"
                      title={
                        u.userId === currentUserId
                          ? "Não podes eliminar a tua própria conta."
                          : "Eliminar tenant"
                      }
                      disabled={u.userId === currentUserId}
                      onClick={() => {
                        if (u.userId === currentUserId) return;
                        setSelected(u);
                        setDeleteConfirmEmail("");
                        setDeleteOpen(true);
                      }}
                      className={`hover:text-red-500 ${u.userId === currentUserId ? "opacity-40 cursor-not-allowed" : ""}`}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>
      <Pagination {...pgUsers} />

      <AdminTeamModal tenant={teamOf} onClose={() => setTeamOf(null)} />
      <AdminEmailModal tenant={emailOf} onClose={() => setEmailOf(null)} />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo utilizador"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <GuardButton
              disabled={createM.isPending}
              onClick={() => {
                if (!form.name || !form.email || !form.permissionId) {
                  toast.error("Nome, email e permissão são obrigatórios");
                  return;
                }
                createM.mutate({
                  data: {
                    name: form.name,
                    ownerName: form.ownerName.trim() || undefined,
                    email: form.email,
                    phone: form.phone || undefined,
                    permissionId: form.permissionId,
                    websiteDomain: form.websiteDomain.trim() || undefined,
                  },
                });
              }}
            >
              {createM.isPending ? "A criar…" : "Criar"}
            </GuardButton>
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
            <GuardButton
              disabled={updateM.isPending || (emailChanged && !currentPassword)}
              onClick={() => {
                if (!selected) return;
                const p: any = { userId: selected.userId };
                if (form.name) p.name = form.name;
                if (form.email) p.email = form.email;
                if (emailChanged) p.currentPassword = currentPassword;
                p.phone = form.phone || null;
                p.ownerName = form.ownerName.trim() || null;
                // Na conta admin a role é fixa: não se envia `permissionId`.
                if (form.permissionId && !selected.isPlatformAdmin)
                  p.permissionId = form.permissionId;
                updateM.mutate({ data: p });
              }}
            >
              {updateM.isPending ? "A guardar…" : "Guardar"}
            </GuardButton>
          </>
        }
      >
        <UserFormFields
          form={form}
          setForm={setForm}
          permissions={permissions}
          isEdit
          isPlatformAdmin={!!selected?.isPlatformAdmin}
        />
        {emailChanged && (
          <div className="mt-4">
            <Input
              label="A tua password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e: any) => setCurrentPassword(e.target.value)}
              hint="Para mudar o email pedimos a tua password actual."
            />
          </div>
        )}
      </Modal>

      <Modal
        open={domainOpen}
        onClose={() => setDomainOpen(false)}
        title="Domínio do site"
        subtitle={selected?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDomainOpen(false)}>
              Cancelar
            </Button>
            <GuardButton
              isLoading={domainM.isPending}
              disabled={!domainValue.trim() || domainM.isPending}
              onClick={() =>
                selected &&
                domainM.mutate({ userId: selected.userId, data: { domain: domainValue.trim() } })
              }
            >
              Guardar
            </GuardButton>
          </>
        }
      >
        <Input
          label="Domínio do site"
          value={domainValue}
          onChange={(e: any) => setDomainValue(e.target.value)}
          placeholder="www.exemplo.pt"
          hint="O endereço onde o site deste cliente vive. Liga as estatísticas e os links dos emails."
          autoComplete="off"
        />
      </Modal>


      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={
          selected
            ? `Eliminar "${selected.name}" definitivamente?`
            : "Eliminar tenant"
        }
        subtitle={selected?.email}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteM.isPending}
            >
              Cancelar
            </Button>
            <GuardButton
              variant="danger"
              isLoading={deleteM.isPending}
              disabled={!isDeleteConfirmed || deleteM.isPending}
              onClick={() =>
                selected && deleteM.mutate({ userId: selected.userId })
              }
            >
              Apagar definitivamente
            </GuardButton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Vais eliminar definitivamente este tenant e tudo o que lhe pertence:
          </p>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300 list-disc list-inside">
            <li>Todos os dados deste tenant, em todos os módulos</li>
            <li>Os clientes deste tenant</li>
            <li>O domínio do site e as estatísticas (Umami)</li>
            <li>As fotos e vídeos enviados</li>
            <li>A subscrição — é cancelada no Stripe</li>
          </ul>
          <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/30 p-3.5">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Isto é irreversível. Não há recuperação.
            </p>
          </div>
          <Input
            label="Escreve o email do tenant para confirmar"
            value={deleteConfirmEmail}
            onChange={(e: any) => setDeleteConfirmEmail(e.target.value)}
            placeholder={selected?.email}
            autoComplete="off"
          />
        </div>
      </Modal>

    </div>
  );
}
