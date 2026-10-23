import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge, Button, Input, Modal, SectionTitle, Tabs } from "../../ui/ui.jsx";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PermissionTree } from "../../components/PermissionTree";
import { cascadeWarning, grantsToMap, indexTree, scopesToMap, type GrantEntry, serializeGrants, type GrantMap, type ScopeMap, type TreeNode } from "../../lib/teamTree";
import { OWNER_DISABLED_MESSAGE, teamErrorMessage } from "../../lib/teamAccess";
import { getTeamQueryKey } from "../../gen/backoffice/hooks/useGetTeam";
import { usePutTeamMemberid } from "../../gen/backoffice/hooks/usePutTeamMemberid";
import { usePostTeamMemberidResendInvite } from "../../gen/backoffice/hooks/usePostTeamMemberidResendInvite";
import { usePostTeamMemberidSendReset } from "../../gen/backoffice/hooks/usePostTeamMemberidSendReset";
import { usePostTeamMemberidDisable } from "../../gen/backoffice/hooks/usePostTeamMemberidDisable";
import { usePostTeamMemberidEnable } from "../../gen/backoffice/hooks/usePostTeamMemberidEnable";
import { usePostTeamMemberidRevokeSessions } from "../../gen/backoffice/hooks/usePostTeamMemberidRevokeSessions";
import { useDeleteTeamMemberid } from "../../gen/backoffice/hooks/useDeleteTeamMemberid";
import { usePostTeamMemberidGrantsPreview } from "../../gen/backoffice/hooks/usePostTeamMemberidGrantsPreview";
import type { TeamMember } from "../../gen/backoffice/types/TeamMember";
import { Row, StatusBadge, TeamButton, grantsSignature, lastAccessLabel, memberStatus } from "./shared";
import { ActivityTab, StaffLinkTab } from "./MemberTabs";

/** Aviso ao remover um membro que convidou outros: eles NÃO saem, passam para o dono (com as permissões que têm). */
export function removeGuestsNote(count: number, viewerIsMember: boolean): string | null {
  if (count <= 0) return null;
  const to = viewerIsMember ? "o dono" : "ti";
  return count === 1
    ? `O utilizador que este membro convidou passa para ${to}, com as permissões que tem.`
    : `Os ${count} utilizadores que este membro convidou passam para ${to}, com as permissões que têm.`;
}

// ── Ficha do membro ─────────────────────────────────────────────────────────

export function MemberModal({
  member,
  rows,
  onClose,
  tree,
  inSupport,
  isMember,
}: {
  member: TeamMember | null;
  /** A lista toda — para saber se o membro criou outros (cascata). */
  rows: Row[];
  onClose: () => void;
  tree: TreeNode[];
  inSupport: boolean;
  /** Quem vê é um membro (delegado) e não o dono — muda a quem passam os convidados e se pode reactivar. */
  isMember: boolean;
}) {
  const qc = useQueryClient();
  const memberId = member?.memberId ?? "";
  const status = member ? memberStatus(member) : "invited";
  const [name, setName] = useState("");
  const [grants, setGrants] = useState<GrantMap>({});
  const [scopes, setScopes] = useState<ScopeMap>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [tab, setTab] = useState<"perms" | "staff" | "activity">("perms");
  const [cascade, setCascade] = useState<{ text: string; toSend: GrantEntry[] } | null>(null);

  // Semeia o formulário quando se abre outro membro (ou o servidor devolve dados novos e o form está limpo).
  const serverGrants = useMemo(() => grantsToMap(tree, member?.grants), [tree, member?.grants]);
  const serverScopes = useMemo(() => scopesToMap(tree, member?.grants), [tree, member?.grants]);
  // O separador Profissional só existe se o tenant tem a Agenda (o nó agenda.profissionais está disponível).
  const hasStaffNode = useMemo(() => !!indexTree(tree).get("agenda.profissionais")?.node.available, [tree]);
  // O catálogo pode chegar depois do membro: só semeia quando há árvore (senão as folhas seriam descartadas).
  const treeReady = tree.length > 0;
  useEffect(() => {
    if (!member) return;
    setName(member.name ?? "");
    setGrants(serverGrants);
    setScopes(serverScopes);
    setTab("perms");
    setCascade(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, treeReady]);

  const refresh = () => qc.invalidateQueries({ queryKey: getTeamQueryKey() });
  const onError = (fallback: string) => (error: unknown) => toast.error(teamErrorMessage(error, fallback));

  const update = usePutTeamMemberid();
  const resend = usePostTeamMemberidResendInvite();
  const sendReset = usePostTeamMemberidSendReset();
  const disable = usePostTeamMemberidDisable();
  const enable = usePostTeamMemberidEnable();
  const revoke = usePostTeamMemberidRevokeSessions();
  const remove = useDeleteTeamMemberid();
  const preview = usePostTeamMemberidGrantsPreview();

  const dirty =
    !!member &&
    (name.trim() !== (member.name ?? "") ||
      grantsSignature(tree, grants, scopes) !== grantsSignature(tree, serverGrants, serverScopes));

  const guestCount = rows.filter((r) => r.createdBy?.memberId === memberId).length;
  const hasCreated = guestCount > 0;
  const removeNote = removeGuestsNote(guestCount, isMember);
  // Desactivado pelo dono: um delegado não reactiva (a API recusa com TEAM_OWNER_DISABLED; aqui mostra-se o motivo).
  const ownerLocked = isMember && !!member?.disabledByOwner;

  const doSave = (toSend: GrantEntry[]) =>
    update.mutate(
      { memberId, data: { name: name.trim(), grants: toSend } },
      {
        onSuccess: (res) => {
          setCascade(null);
          refresh();
          toast.success("Permissões guardadas. Valem no próximo pedido do membro.");
          const w = cascadeWarning((res as { cascadeAffected?: number } | undefined)?.cascadeAffected);
          if (w) toast.warning(w);
        },
        onError: onError("Não foi possível guardar."),
      },
    );

  const save = () => {
    if (!member) return;
    if (!name.trim()) return toast.error("O nome não pode ficar vazio.");
    const toSend = serializeGrants(tree, grants, scopes);
    if (toSend.length === 0) return toast.error("Escolhe pelo menos uma permissão.");
    const grantsChanged = grantsSignature(tree, grants, scopes) !== grantsSignature(tree, serverGrants, serverScopes);
    // Fase 3: retirar permissões a quem convidou outros tira-as também a eles — avisar ANTES de escrever.
    if (hasCreated && grantsChanged) {
      preview.mutate(
        { memberId, data: { grants: toSend } },
        {
          onSuccess: (res) => {
            const w = cascadeWarning(res?.affected);
            if (w) setCascade({ text: w, toSend });
            else doSave(toSend);
          },
          onError: onError("Não foi possível verificar o efeito nas permissões."),
        },
      );
      return;
    }
    doSave(toSend);
  };

  return (
    <>
      <Modal
        open={!!member}
        onClose={onClose}
        title={member?.name ?? ""}
        subtitle={member?.email}
        width="max-w-xl"
        footer={
          <>
            <TeamButton
              inSupport={inSupport}
              variant="ghost"
              className="mr-auto text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
              icon="trash"
              onClick={() => setConfirmRemove(true)}
            >
              Remover
            </TeamButton>
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <TeamButton
              inSupport={inSupport}
              leaf="equipa"
              onClick={save}
              disabled={!dirty || tab !== "perms"}
              isLoading={update.isPending || preview.isPending}
            >
              Guardar permissões
            </TeamButton>
          </>
        }
      >
        {member && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
              <StatusBadge status={status} />
              <span>Último acesso: {lastAccessLabel(member)}</span>
            </div>

            <Tabs
              tabs={[
                { id: "perms", label: "Permissões" },
                ...(hasStaffNode ? [{ id: "staff", label: "Profissional" }] : []),
                { id: "activity", label: "Actividade" },
              ]}
              value={tab}
              onChange={(id: string) => setTab(id as "perms" | "staff" | "activity")}
            />

            {tab === "activity" ? (
              <ActivityTab key={memberId} memberId={memberId} />
            ) : tab === "staff" ? (
              <StaffLinkTab key={memberId} member={member} inSupport={inSupport} />
            ) : (
              <>
            <Input label="Nome" value={name} onChange={(e: any) => setName(e.target.value)} disabled={inSupport} />

            <div>
              <SectionTitle>O que pode usar</SectionTitle>
              <PermissionTree tree={tree} value={grants} onChange={setGrants} disabled={inSupport} scopes={scopes} onScopesChange={setScopes} />
            </div>

            {member.mailbox && (
              <div data-testid="member-mailbox">
                <SectionTitle>Endereço de email</SectionTitle>
                <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                  <span className="font-mono break-all" data-testid="member-mailbox-address">{member.mailbox.address}</span>
                  <Badge tone={member.mailbox.status === "active" ? "green" : "neutral"}>
                    {member.mailbox.status === "active" ? "Activo" : "Desactivado"}
                  </Badge>
                </p>
                <p className="mt-1 text-xs text-zinc-500">Criada sozinha ao convidar. Só o próprio a lê.</p>
              </div>
            )}

            <div>
              <SectionTitle>Conta</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {status === "invited" && (
                  <TeamButton
                    inSupport={inSupport}
                    variant="outline"
                    size="sm"
                    icon="send"
                    isLoading={resend.isPending}
                    onClick={() =>
                      resend.mutate(
                        { memberId },
                        {
                          onSuccess: (res) =>
                            res?.emailSent === false
                              ? toast.warning("O email do convite não saiu. Tenta de novo daqui a pouco.")
                              : toast.success("Convite reenviado."),
                          onError: onError("Não foi possível reenviar o convite."),
                        },
                      )
                    }
                  >
                    Reenviar convite
                  </TeamButton>
                )}
                {status === "active" && (
                  <TeamButton
                    inSupport={inSupport}
                    variant="outline"
                    size="sm"
                    icon="key"
                    isLoading={sendReset.isPending}
                    onClick={() =>
                      sendReset.mutate(
                        { memberId },
                        {
                          onSuccess: () => toast.success("Email para definir nova password enviado."),
                          onError: onError("Não foi possível enviar o email."),
                        },
                      )
                    }
                  >
                    Enviar reset de password
                  </TeamButton>
                )}
                {status !== "disabled" ? (
                  <TeamButton
                    inSupport={inSupport}
                    variant="outline"
                    size="sm"
                    icon="ban"
                    isLoading={disable.isPending}
                    onClick={() =>
                      disable.mutate(
                        { memberId },
                        {
                          onSuccess: () => {
                            refresh();
                            toast.success("Membro desactivado. A sessão termina no próximo pedido.");
                          },
                          onError: onError("Não foi possível desactivar."),
                        },
                      )
                    }
                  >
                    Desactivar
                  </TeamButton>
                ) : (
                  <TeamButton
                    inSupport={inSupport}
                    variant="outline"
                    size="sm"
                    icon="check"
                    disabled={ownerLocked}
                    title={ownerLocked ? OWNER_DISABLED_MESSAGE : undefined}
                    isLoading={enable.isPending}
                    onClick={() =>
                      enable.mutate(
                        { memberId },
                        {
                          onSuccess: () => {
                            refresh();
                            toast.success("Membro reactivado.");
                          },
                          onError: onError("Não foi possível reactivar."),
                        },
                      )
                    }
                  >
                    Reactivar
                  </TeamButton>
                )}
                {ownerLocked && status === "disabled" && (
                  <p data-testid="owner-disabled-note" className="basis-full text-xs text-zinc-500">
                    {OWNER_DISABLED_MESSAGE} Só ele o pode reactivar.
                  </p>
                )}
                <TeamButton
                  inSupport={inSupport}
                  variant="outline"
                  size="sm"
                  icon="logout"
                  isLoading={revoke.isPending}
                  onClick={() =>
                    revoke.mutate(
                      { memberId },
                      {
                        onSuccess: () => toast.success("Sessões terminadas."),
                        onError: onError("Não foi possível terminar as sessões."),
                      },
                    )
                  }
                >
                  Terminar sessões
                </TeamButton>
              </div>
            </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!cascade}
        onClose={() => setCascade(null)}
        leaf="equipa"
        title="Retirar permissões?"
        description={cascade?.text ?? ""}
        variant="warning"
        confirmLabel="Guardar e retirar"
        pendingLabel="A guardar…"
        isPending={update.isPending}
        onConfirm={() => cascade && doSave(cascade.toSend)}
      />

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        leaf="equipa"
        title={`Remover ${member?.name ?? "membro"}?`}
        description={
          <>
            O acesso termina de imediato e o email fica livre. O nome continua no registo de auditoria. Não dá para desfazer.
            {removeNote && (
              <span data-testid="remove-guests-note" className="mt-2 block font-medium text-amber-700 dark:text-amber-400">
                {removeNote}
              </span>
            )}
          </>
        }
        confirmLabel="Remover"
        pendingLabel="A remover…"
        isPending={remove.isPending}
        onConfirm={() =>
          remove.mutate(
            { memberId },
            {
              onSuccess: () => {
                setConfirmRemove(false);
                refresh();
                toast.success("Membro removido.");
                onClose();
              },
              onError: onError("Não foi possível remover."),
            },
          )
        }
      />
    </>
  );
}
