import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Badge, Button, Input, Modal, PageHeader, EmptyState, SectionTitle } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { useAuth } from "../context/AuthContext";
import { usePageSubtitle } from "../context/PageMetaContext";
import { GuardButton } from "../components/GuardButton";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useNarrow } from "../hooks/useNarrow";
import { PermissionTree } from "../components/PermissionTree";
import {
  fullAccess,
  grantsToMap,
  serializeGrants,
  type GrantMap,
  type TreeNode,
} from "../lib/teamTree";
import { SUPPORT_UNAVAILABLE_NOTE } from "../lib/supportSession";
import { formatDatePt, formatTimePt } from "../lib/supportLog";
import {
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_TONE,
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
import type { TeamMember } from "../gen/backoffice/types/TeamMember";

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
  const { data: members = [], isLoading, isError, error } = useGetTeam();
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
    maxMembers != null
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
        <span title={inviteDisabledReason} className="inline-flex">
          <GuardButton icon="plus" onClick={() => setInviteOpen(true)} disabled={!!inviteDisabledReason}>
            Convidar utilizador
          </GuardButton>
        </span>
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
              <span title={inviteDisabledReason} className="inline-flex">
                <GuardButton icon="plus" onClick={() => setInviteOpen(true)} disabled={!!inviteDisabledReason}>
                  Convidar utilizador
                </GuardButton>
              </span>
            }
          />
        </Card>
      ) : narrow ? (
        <ul className="space-y-2" aria-label="Membros da equipa">
          {members.map((m) => (
            <li key={m.memberId}>
              <button
                type="button"
                onClick={() => setSelectedId(m.memberId ?? null)}
                className="w-full text-left"
                aria-label={`Abrir ${m.name}`}
              >
                <Card className="p-4 hover:border-accent/40 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-white truncate">{m.name}</p>
                      <p className="text-sm text-zinc-500 truncate">{m.email}</p>
                    </div>
                    <StatusBadge status={memberStatus(m)} />
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">Último acesso: {lastAccessLabel(m)}</p>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Último acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                {members.map((m) => (
                  <tr
                    key={m.memberId}
                    onClick={() => setSelectedId(m.memberId ?? null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(m.memberId ?? null);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Abrir ${m.name}`}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition cursor-pointer focus:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-800/40"
                  >
                    <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-white">{m.name}</td>
                    <td className="px-4 py-3.5 text-zinc-500">{m.email}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={memberStatus(m)} />
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 whitespace-nowrap">{lastAccessLabel(m)}</td>
                  </tr>
                ))}
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
      />
      <MemberModal
        member={selected}
        onClose={() => setSelectedId(null)}
        tree={tree}
        inSupport={inSupport}
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
    return (
      <span className="inline-flex" title={SUPPORT_UNAVAILABLE_NOTE}>
        <Button {...rest} disabled aria-disabled="true" title={SUPPORT_UNAVAILABLE_NOTE} />
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
}: {
  open: boolean;
  onClose: () => void;
  tree: TreeNode[];
  inSupport: boolean;
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
    const toSend = serializeGrants(tree, mode === "total" ? fullAccess(tree) : grants);
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
            <AccessOption
              checked={mode === "total"}
              onSelect={() => setMode("total")}
              title="Acesso total"
              help="Dá tudo o que existe hoje. Partes novas que apareçam no futuro ficam fechadas até as dares."
            />
            <AccessOption
              checked={mode === "tree"}
              onSelect={() => setMode("tree")}
              title="Escolher na árvore"
              help="Marca só o que esta pessoa pode ver ou editar."
            />
          </div>
          {mode === "tree" && (
            <div className="mt-3">
              <PermissionTree tree={tree} value={grants} onChange={setGrants} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Ficha do membro ─────────────────────────────────────────────────────────

function MemberModal({
  member,
  onClose,
  tree,
  inSupport,
}: {
  member: TeamMember | null;
  onClose: () => void;
  tree: TreeNode[];
  inSupport: boolean;
}) {
  const qc = useQueryClient();
  const memberId = member?.memberId ?? "";
  const status = member ? memberStatus(member) : "invited";
  const [name, setName] = useState("");
  const [grants, setGrants] = useState<GrantMap>({});
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Semeia o formulário quando se abre outro membro (ou o servidor devolve dados novos e o form está limpo).
  const serverGrants = useMemo(() => grantsToMap(tree, member?.grants), [tree, member?.grants]);
  // O catálogo pode chegar depois do membro: só semeia quando há árvore (senão as folhas seriam descartadas).
  const treeReady = tree.length > 0;
  useEffect(() => {
    if (!member) return;
    setName(member.name ?? "");
    setGrants(serverGrants);
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

  const dirty =
    !!member && (name.trim() !== (member.name ?? "") || grantsSignature(tree, grants) !== grantsSignature(tree, serverGrants));

  const save = () => {
    if (!member) return;
    if (!name.trim()) return toast.error("O nome não pode ficar vazio.");
    const toSend = serializeGrants(tree, grants);
    if (toSend.length === 0) return toast.error("Escolhe pelo menos uma permissão.");
    update.mutate(
      { memberId, data: { name: name.trim(), grants: toSend } },
      {
        onSuccess: () => {
          refresh();
          toast.success("Permissões guardadas. Valem no próximo pedido do membro.");
        },
        onError: onError("Não foi possível guardar."),
      },
    );
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
            <TeamButton inSupport={inSupport} onClick={save} disabled={!dirty} isLoading={update.isPending}>
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
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Remover ${member?.name ?? "membro"}?`}
        description="O acesso termina de imediato e o email fica livre. O nome continua no registo de auditoria. Não dá para desfazer."
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
