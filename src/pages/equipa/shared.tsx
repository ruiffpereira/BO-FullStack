import { type ReactNode } from "react";
import { Badge, Button } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { serializeGrants, type GrantMap, type ScopeMap, type TreeNode } from "../../lib/teamTree";
import { SUPPORT_UNAVAILABLE_NOTE } from "../../lib/supportSession";
import { formatDatePt, formatTimePt } from "../../lib/supportLog";
import { MEMBER_STATUS_LABEL, MEMBER_STATUS_TONE, type TeamMemberStatus } from "../../lib/teamAccess";
import type { TeamMember } from "../../gen/backoffice/types/TeamMember";

/** Linha da lista: o dono (e o criador com Gerir, nos seus) recebe `TeamMember`; quem só vê recebe `TeamMemberBasic` (+ `isSelf`). */
export type Row = TeamMember & { isSelf?: boolean };

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
export function grantsSignature(tree: TreeNode[], map: GrantMap, scopes: ScopeMap = {}): string {
  return JSON.stringify(serializeGrants(tree, map, scopes));
}

export function StatusBadge({ status }: { status: TeamMemberStatus }) {
  return (
    <Badge tone={MEMBER_STATUS_TONE[status]} dot>
      {MEMBER_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Botão de escrita desta página: respeita o billing (GuardButton) e a sessão de suporte (só leitura). */
export function TeamButton({
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
  // EQ-03/EQ-04: /equipa não tem folha de rota — sem `leaf` o botão ficava activo para quem só tem Ver em `equipa`.
  return <GuardButton title={title} leaf="equipa" {...rest} />;
}
