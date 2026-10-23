import { useMemo, useState } from "react";
import { Card, PageHeader, EmptyState } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { useAuth } from "../context/AuthContext";
import { useTeamAccess } from "../hooks/useTeamAccess";
import { usePageSubtitle } from "../context/PageMetaContext";
import { GuardButton } from "../components/GuardButton";
import { useNarrow } from "../hooks/useNarrow";
import { type TreeNode } from "../lib/teamTree";
import { SUPPORT_UNAVAILABLE_NOTE } from "../lib/supportSession";
import { teamErrorMessage } from "../lib/teamAccess";
import { useGetTeam } from "../gen/backoffice/hooks/useGetTeam";
import { useGetTeamCatalog } from "../gen/backoffice/hooks/useGetTeamCatalog";
import { Row, StatusBadge, createdByLabel, lastAccessLabel, memberStatus } from "./equipa/shared";
import { InviteModal } from "./equipa/InviteModal";
import { MemberModal } from "./equipa/MemberModal";

// Reexportados: `AdminTeamModal` e os testes importam daqui.
export { createdByLabel, lastAccessLabel, memberStatus, StatusBadge } from "./equipa/shared";
export { canGiveMailbox } from "./equipa/InviteModal";
export { removeGuestsNote } from "./equipa/MemberModal";

/**
 * Página `/equipa` (B41): o dono do tenant convida pessoas e escolhe, numa ÁRVORE de permissões, o que vêem ou editam.
 * Só o dono (a conta admin não tem equipa; um membro não a vê). A decisão final é sempre da API — aqui só
 * se apresenta o catálogo (`GET /team/catalog`) e se envia o que o utilizador marcou.
 *
 * Em sessão de suporte a página lê, mas todas as escritas ficam desactivadas com o motivo.
 */
export function Equipa() {
  const { supportSession } = useAuth();
  const inSupport = !!supportSession;
  const narrow = useNarrow(760);
  const { isMember, member: me, can } = useTeamAccess();
  // Fase 3: o dono gere tudo; um membro só com `equipa` Ver lê (sem convidar nem abrir fichas); com Gerir convida e gere os que criou.
  const canManageTeam = !isMember || can("equipa", "edit");
  const viewer = { isMember, selfId: me?.memberId, ownerName: me?.tenantName };
  const { data, isLoading, isError, error } = useGetTeam();
  const members = useMemo(() => (data ?? []) as Row[], [data]);
  const showEmail = members.some((m) => !!m.email);
  const isManageable = (m: Row) => canManageTeam && !m.isSelf && (m.canManage ?? !isMember);
  const openRow = (m: Row) => {
    if (isManageable(m)) setSelectedId(m.memberId ?? null);
  };
  const { data: catalog } = useGetTeamCatalog();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => (selectedId ? (members.find((m) => m.memberId === selectedId) ?? null) : null),
    [members, selectedId],
  );

  const tree = useMemo(() => (catalog?.tree ?? []) as TreeNode[], [catalog?.tree]);
  const maxMembers = catalog?.maxMembers;
  const atLimit = maxMembers != null && members.length >= maxMembers;
  usePageSubtitle(
    !canManageTeam
      ? "Quem faz parte da equipa. Só podes ver."
      : isMember
        ? "Convidas e geres os utilizadores que criaste — só podes dar o que tens."
        : maxMembers != null
          ? `${members.length} de ${maxMembers} membros · quem convidas vê só o que lhe deres.`
          : "Quem convidas vê só o que lhe deres.",
  );

  const inviteDisabledReason = inSupport
    ? SUPPORT_UNAVAILABLE_NOTE
    : atLimit
      ? `Atingiste o máximo de ${maxMembers} membros.`
      : undefined;

  return (
    <div className="flex flex-col min-h-0 space-y-4">
      <PageHeader>
        {canManageTeam ? (
          <span title={inviteDisabledReason} className="inline-flex">
            <GuardButton icon="plus" leaf="equipa" onClick={() => setInviteOpen(true)} disabled={!!inviteDisabledReason}>
              Convidar utilizador
            </GuardButton>
          </span>
        ) : null}
      </PageHeader>

      {isLoading ? (
        <Card className="p-5 space-y-3" aria-busy="true">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </Card>
      ) : isError ? (
        <Card role="status" className="p-4 flex items-start gap-3 border-amber-200 dark:border-amber-900/50">
          <Icon name="alertTriangle" className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
          <div className="text-sm">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">Não foi possível carregar a equipa</p>
            <p className="text-zinc-500 mt-0.5">{teamErrorMessage(error, "Tenta novamente daqui a pouco.")}</p>
          </div>
        </Card>
      ) : members.length === 0 ? (
        <Card>
          <EmptyState
            icon="users"
            title="Ainda não tens equipa"
            desc="Convida a recepcionista, o barbeiro ou o treinador e escolhe o que cada um pode ver e editar."
            action={
              canManageTeam ? (
                <span title={inviteDisabledReason} className="inline-flex">
                  <GuardButton icon="plus" leaf="equipa" onClick={() => setInviteOpen(true)} disabled={!!inviteDisabledReason}>
                    Convidar utilizador
                  </GuardButton>
                </span>
              ) : undefined
            }
          />
        </Card>
      ) : narrow ? (
        <ul className="space-y-2" aria-label="Membros da equipa">
          {members.map((m) => {
            const body = (
              <Card className={`p-4 transition ${isManageable(m) ? "hover:border-accent/40" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate">
                      {m.name}
                      {m.isSelf && <span className="ml-1.5 text-xs font-normal text-zinc-400">(tu)</span>}
                    </p>
                    {m.email && <p className="text-sm text-zinc-500 truncate">{m.email}</p>}
                  </div>
                  <StatusBadge status={memberStatus(m)} />
                </div>
                <p className="text-xs text-zinc-400 mt-2">Último acesso: {lastAccessLabel(m)}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Criado por: {createdByLabel(m, viewer)}</p>
              </Card>
            );
            return (
              <li key={m.memberId}>
                {isManageable(m) ? (
                  <button type="button" onClick={() => openRow(m)} className="w-full text-left" aria-label={`Abrir ${m.name}`}>
                    {body}
                  </button>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  {showEmail && <th className="px-4 py-3">Email</th>}
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Último acesso</th>
                  <th className="px-4 py-3">Criado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                {members.map((m) => {
                  const manageable = isManageable(m);
                  return (
                    <tr
                      key={m.memberId}
                      onClick={manageable ? () => openRow(m) : undefined}
                      onKeyDown={
                        manageable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openRow(m);
                              }
                            }
                          : undefined
                      }
                      tabIndex={manageable ? 0 : undefined}
                      aria-label={manageable ? `Abrir ${m.name}` : undefined}
                      className={
                        manageable
                          ? "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition cursor-pointer focus:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-800/40"
                          : undefined
                      }
                    >
                      <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-white">
                        {m.name}
                        {m.isSelf && <span className="ml-1.5 text-xs font-normal text-zinc-400">(tu)</span>}
                      </td>
                      {showEmail && <td className="px-4 py-3.5 text-zinc-500">{m.email}</td>}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={memberStatus(m)} />
                      </td>
                      <td className="px-4 py-3.5 text-zinc-500 whitespace-nowrap">{lastAccessLabel(m)}</td>
                      <td className="px-4 py-3.5 text-zinc-500 whitespace-nowrap">{createdByLabel(m, viewer)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        tree={tree}
        inSupport={inSupport}
        isMember={isMember}
      />
      <MemberModal
        member={selected}
        rows={members}
        onClose={() => setSelectedId(null)}
        tree={tree}
        inSupport={inSupport}
        isMember={isMember}
      />
    </div>
  );
}
