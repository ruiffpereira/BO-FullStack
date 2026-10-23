import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Input, Modal, SectionTitle } from "../../ui/ui.jsx";
import { PermissionTree } from "../../components/PermissionTree";
import { fullAccess, indexTree, serializeGrants, type GrantMap, type ScopeMap, type TreeNode } from "../../lib/teamTree";
import { mailboxErrorMessage, teamErrorMessage } from "../../lib/teamAccess";
import { MemberMailboxNotice } from "../../components/correio/MemberMailboxNotice";
import { getTeamQueryKey } from "../../gen/backoffice/hooks/useGetTeam";
import { usePostTeam } from "../../gen/backoffice/hooks/usePostTeam";
import { TeamButton } from "./shared";

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

/**
 * Correio (B55): o convite mostra o endereço que o membro vai receber (a caixa cria-se sozinha) se o tenant tem o módulo
 * (o nó `correio.caixa` está disponível no catálogo). Sai do catálogo da API — o BO não decide.
 */
export function canGiveMailbox(tree: TreeNode[]): boolean {
  return !!indexTree(tree).get("correio.caixa")?.node.available;
}

export function InviteModal({
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
  // Profissionais: âmbito [Todos | Só os meus] dos nós scoped (agenda.marcacoes, folhas do financeiro).
  const [scopes, setScopes] = useState<ScopeMap>({});
  const create = usePostTeam();
  const mailboxOffered = canGiveMailbox(tree);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setMode("tree");
      setGrants({});
      setScopes({});
    }
  }, [open]);

  const submit = () => {
    if (!name.trim()) return toast.error("Indica o nome.");
    if (!EMAIL_RE.test(email.trim())) return toast.error("Indica um email válido.");
    const toSend = serializeGrants(
      tree,
      mode === "total" && !isMember ? fullAccess(tree) : grants,
      mode === "total" && !isMember ? {} : scopes,
    );
    if (toSend.length === 0) return toast.error("Escolhe pelo menos uma permissão.");
    create.mutate(
      {
        data: {
          name: name.trim(),
          email: email.trim(),
          grants: toSend,
        },
      },
      {
        onSuccess: (res) => {
          qc.invalidateQueries({ queryKey: getTeamQueryKey() });
          if (res.emailSent === false) {
            toast.warning(`${name.trim()} foi adicionado, mas o email do convite não saiu. Usa «Reenviar convite».`);
          } else {
            toast.success(`Convite enviado para ${email.trim()}.`);
          }
          // O membro foi criado mas o endereço não: o convite segue; diz-se porquê, em PT.
          if (res.mailboxError) toast.warning(mailboxErrorMessage(res.mailboxError));
          else if (res.member?.mailbox?.address) toast.success(`Caixa criada: ${res.member.mailbox.address}`);
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
        {mailboxOffered && <MemberMailboxNotice name={name} disabled={inSupport} />}
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
              <PermissionTree tree={tree} value={grants} onChange={setGrants} scopes={scopes} onScopesChange={setScopes} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
