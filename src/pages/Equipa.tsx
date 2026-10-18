import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Badge, Button, Input, Modal, PageHeader, EmptyState, SectionTitle, Tabs } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { useAuth } from "../context/AuthContext";
import { useTeamAccess } from "../hooks/useTeamAccess";
import { Pagination } from "../components/Pagination";
import { usePageSubtitle } from "../context/PageMetaContext";
import { GuardButton } from "../components/GuardButton";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useNarrow } from "../hooks/useNarrow";
import { PermissionTree } from "../components/PermissionTree";
import {
  cascadeWarning,
  fullAccess,
  grantsToMap,
  type GrantEntry,
  serializeGrants,
  type GrantMap,
  type TreeNode,
} from "../lib/teamTree";
import { SUPPORT_UNAVAILABLE_NOTE } from "../lib/supportSession";
import { formatDatePt, formatTimePt } from "../lib/supportLog";
import {
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_TONE,
  OWNER_DISABLED_MESSAGE,
  teamErrorMessage,
  type TeamMemberStatus,
} from "../lib/teamAccess";
import { useGetTeam, getTeamQueryKey } from "../gen/backoffice/hooks/useGetTeam";
import { useGetTeamCatalog } from "../gen/backoffice/hooks/useGetTeamCatalog";
import { usePostTeam } from "../gen/backoffice/hooks/usePostTeam";
import { usePutTeamMemberid } from "../gen/backoffice/hooks/usePutTeamMemberid";
import { usePostTeamMemberidResendInvite } from "../gen/backoffice/hooks/usePostTeamMemberidResendInvite";
import { usePostTeamMemberidSendReset } from "../gen/backoffice/hooks/usePostTeamMemberidSendReset";
import { usePostTeamMemberidDisable } from "../gen/backoffice/hooks/usePostTeamMemberidDisable";
import { usePostTeamMemberidEnable } from "../gen/backoffice/hooks/usePostTeamMemberidEnable";
import { usePostTeamMemberidRevokeSessions } from "../gen/backoffice/hooks/usePostTeamMemberidRevokeSessions";
import { useDeleteTeamMemberid } from "../gen/backoffice/hooks/useDeleteTeamMemberid";
import { usePostTeamMemberidGrantsPreview } from "../gen/backoffice/hooks/usePostTeamMemberidGrantsPreview";
import { useGetTeamMemberidActivity } from "../gen/backoffice/hooks/useGetTeamMemberidActivity";
import type { TeamMember } from "../gen/backoffice/types/TeamMember";

/** Linha da lista: o dono (e o criador com Gerir, nos seus) recebe `TeamMember`; quem só vê recebe `TeamMemberBasic` (+ `isSelf`). */
type Row = TeamMember & { isSelf?: boolean };

/** Quem criou o membro, em texto: para o dono, `null` lê-se "Tu"; para um membro, o nome do negócio (dono). */
export function createdByLabel(
  m: Pick<Row, "createdBy">,
  viewer: { isMember: boolean; selfId?: string; ownerName?: string },
): string {
  if (!m.createdBy) return viewer.isMember ? viewer.ownerName || "Dono" : "Tu";
  if (viewer.selfId && m.createdBy.memberId === viewer.selfId) return "Tu";
  return m.createdBy.name || "—";
}

export function lastAccessLabel(m: Pick<TeamMember, "lastLoginAt">): string {
  if (!m.lastLoginAt) return "Nunca";
  return `${formatDatePt(m.lastLoginAt)} ${formatTimePt(m.lastLoginAt)}`;
}

export function memberStatus(m: Pick<TeamMember, "status">): TeamMemberStatus {
  return (m.status ?? "invited") as TeamMemberStatus;
}

/** Assinatura estável das folhas (só nós guardáveis) — para saber se o formulário mudou. */
function grantsSignature(tree: TreeNode[], map: GrantMap): string {
  return JSON.stringify(serializeGrants(tree, map));
}

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
  const members = (data ?? []) as Row[];
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

export function StatusBadge({ status }: { status: TeamMemberStatus }) {
  return (
    <Badge tone={MEMBER_STATUS_TONE[status]} dot>
      {MEMBER_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Botão de escrita desta página: respeita o billing (GuardButton) e a sessão de suporte (só leitura). */
function TeamButton({
  inSupport,
  title,
  ...rest
}: { inSupport: boolean; title?: string; children?: ReactNode; [key: string]: unknown }) {
  if (inSupport) {
    const { leaf: _leaf, ...btn } = rest;
    return (
      <span className="inline-flex" title={SUPPORT_UNAVAILABLE_NOTE}>
        <Button {...btn} disabled aria-disabled="true" title={SUPPORT_UNAVAILABLE_NOTE} />
      </span>
    );
  }
  return <GuardButton title={title} {...rest} />;
}

// ── Convidar ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Opção do convite (radio com explicação por baixo). */
function AccessOption({
  checked,
  onSelect,
  title,
  help,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  help: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 cursor-pointer transition ${
        checked
          ? "border-accent/50 bg-accent/[0.04] dark:bg-accent/[0.08]"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}
    >
      <input
        type="radio"
        name="team-access-mode"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-hex,#2A6FDB)]"
        checked={checked}
        onChange={onSelect}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">{title}</span>
        <span className="block text-xs text-zinc-500 mt-0.5">{help}</span>
      </span>
    </label>
  );
}

function InviteModal({
  open,
  onClose,
  tree,
  inSupport,
  isMember,
}: {
  open: boolean;
  onClose: () => void;
  tree: TreeNode[];
  inSupport: boolean;
  /** Um membro (com Gerir) só escolhe na árvore — "Acesso total" é do dono. */
  isMember: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Só dois modelos: "Acesso total" (tudo o que existe hoje) ou "Escolher na árvore" (parte da árvore vazia).
  const [mode, setMode] = useState<"total" | "tree">("tree");
  const [grants, setGrants] = useState<GrantMap>({});
  const create = usePostTeam();

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setMode("tree");
      setGrants({});
    }
  }, [open]);

  const submit = () => {
    if (!name.trim()) return toast.error("Indica o nome.");
    if (!EMAIL_RE.test(email.trim())) return toast.error("Indica um email válido.");
    const toSend = serializeGrants(tree, mode === "total" && !isMember ? fullAccess(tree) : grants);
    if (toSend.length === 0) return toast.error("Escolhe pelo menos uma permissão.");
    create.mutate(
      { data: { name: name.trim(), email: email.trim(), grants: toSend } },
      {
        onSuccess: (res) => {
          qc.invalidateQueries({ queryKey: getTeamQueryKey() });
          if (res.emailSent === false) {
            toast.warning(`${name.trim()} foi adicionado, mas o email do convite não saiu. Usa «Reenviar convite».`);
          } else {
            toast.success(`Convite enviado para ${email.trim()}.`);
          }
          onClose();
        },
        onError: (error) => toast.error(teamErrorMessage(error, "Não foi possível convidar.")),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convidar utilizador"
      subtitle="Recebe um email para definir a password e entra no mesmo Backoffice."
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <TeamButton inSupport={inSupport} onClick={submit} isLoading={create.isPending}>
            Enviar convite
          </TeamButton>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Nome" value={name} onChange={(e: any) => setName(e.target.value)} autoComplete="off" />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e: any) => setEmail(e.target.value)}
          autoComplete="off"
        />
        <div>
          <SectionTitle>O que pode usar</SectionTitle>
          <div role="radiogroup" aria-label="Tipo de acesso" className="space-y-2">
            {!isMember && (
              <AccessOption
                checked={mode === "total"}
                onSelect={() => setMode("total")}
                title="Acesso total"
                help="Dá tudo o que existe hoje, menos gerir a equipa. Partes novas que apareçam no futuro ficam fechadas até as dares."
              />
            )}
            <AccessOption
              checked={mode === "tree"}
              onSelect={() => setMode("tree")}
              title="Escolher na árvore"
              help="Marca só o que esta pessoa pode ver ou editar."
            />
          </div>
          {(mode === "tree" || isMember) && (
            <div className="mt-3">
              <PermissionTree tree={tree} value={grants} onChange={setGrants} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Aviso ao remover um membro que convidou outros: eles NÃO saem, passam para o dono (com as permissões que têm). */
export function removeGuestsNote(count: number, viewerIsMember: boolean): string | null {
  if (count <= 0) return null;
  const to = viewerIsMember ? "o dono" : "ti";
  return count === 1
    ? `O utilizador que este membro convidou passa para ${to}, com as permissões que tem.`
    : `Os ${count} utilizadores que este membro convidou passam para ${to}, com as permissões que têm.`;
}

// ── Ficha do membro ─────────────────────────────────────────────────────────

function MemberModal({
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
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [tab, setTab] = useState<"perms" | "activity">("perms");
  const [cascade, setCascade] = useState<{ text: string; toSend: GrantEntry[] } | null>(null);

  // Semeia o formulário quando se abre outro membro (ou o servidor devolve dados novos e o form está limpo).
  const serverGrants = useMemo(() => grantsToMap(tree, member?.grants), [tree, member?.grants]);
  // O catálogo pode chegar depois do membro: só semeia quando há árvore (senão as folhas seriam descartadas).
  const treeReady = tree.length > 0;
  useEffect(() => {
    if (!member) return;
    setName(member.name ?? "");
    setGrants(serverGrants);
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
    !!member && (name.trim() !== (member.name ?? "") || grantsSignature(tree, grants) !== grantsSignature(tree, serverGrants));

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
    const toSend = serializeGrants(tree, grants);
    if (toSend.length === 0) return toast.error("Escolhe pelo menos uma permissão.");
    const grantsChanged = grantsSignature(tree, grants) !== grantsSignature(tree, serverGrants);
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
                { id: "activity", label: "Actividade" },
              ]}
              value={tab}
              onChange={(id: string) => setTab(id as "perms" | "activity")}
            />

            {tab === "activity" ? (
              <ActivityTab key={memberId} memberId={memberId} />
            ) : (
              <>
            <Input label="Nome" value={name} onChange={(e: any) => setName(e.target.value)} disabled={inSupport} />

            <div>
              <SectionTitle>O que pode usar</SectionTitle>
              <PermissionTree tree={tree} value={grants} onChange={setGrants} disabled={inSupport} />
            </div>

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

// ── Actividade do membro (fase 3) ───────────────────────────────────────────

const ACTIVITY_PAGE_SIZE = 15;

/** O que o membro fez (registo de auditoria): data/hora · acção · área · ok/falhou. Lista paginada pelo servidor. */
function ActivityTab({ memberId }: { memberId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useGetTeamMemberidActivity(memberId, {
    page,
    limit: ACTIVITY_PAGE_SIZE,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }
  if (isError) {
    return (
      <p role="status" className="text-sm text-red-600 dark:text-red-400">
        {teamErrorMessage(error, "Não foi possível carregar a actividade.")}
      </p>
    );
  }
  if (items.length === 0) {
    return <EmptyState icon="clock" title="Ainda sem actividade" desc="Quando este membro fizer alguma coisa, aparece aqui." />;
  }
  return (
    <div>
      <ul
        aria-label="Actividade do membro"
        className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800"
      >
        {items.map((it) => (
          <li key={it.id} className="px-3.5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{it.actionLabel}</p>
              <p className="text-xs text-zinc-500 truncate">{it.area}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
              <span className="whitespace-nowrap tabular-nums">
                {formatDatePt(it.at)} {formatTimePt(it.at)}
              </span>
              <Badge tone={it.ok ? "green" : "red"} dot>
                {it.ok ? "Ok" : "Falhou"}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        setPage={setPage}
        pageCount={Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE))}
        total={total}
        start={(page - 1) * ACTIVITY_PAGE_SIZE}
        end={Math.min(page * ACTIVITY_PAGE_SIZE, total)}
      />
    </div>
  );
}
