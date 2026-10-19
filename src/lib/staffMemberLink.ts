/**
 * Ligar um membro a um profissional: opções do campo a partir de `GET /schedule/staff/linkable-members`.
 * Um membro já ligado a OUTRO profissional aparece indicado e desactivado (a API devolveria 409 STAFF_MEMBER_TAKEN).
 */
import type { StaffLinkableMember } from "../gen/backoffice/types/StaffLinkableMember.js";

export interface MemberLinkOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function memberLinkOptions(
  members: readonly Pick<StaffLinkableMember, "memberId" | "name" | "linkedStaffId">[],
  opts: {
    /** Profissional que se está a editar (`undefined` ao criar). */
    staffId?: string | null;
    /** Nomes dos profissionais, para dizer a quem o membro já está ligado. */
    staffNames?: Readonly<Record<string, string>>;
    /** Ligação actual (se o membro já não vem na lista, mantém-se visível). */
    current?: { memberId?: string | null; memberName?: string | null };
  } = {},
): MemberLinkOption[] {
  const out: MemberLinkOption[] = [{ value: "", label: "Sem ligação" }];
  for (const m of members) {
    const other = m.linkedStaffId && m.linkedStaffId !== opts.staffId ? m.linkedStaffId : null;
    if (other) {
      const who = opts.staffNames?.[other];
      out.push({ value: m.memberId, label: `${m.name} — já ligado${who ? ` a ${who}` : " a outro profissional"}`, disabled: true });
    } else {
      out.push({ value: m.memberId, label: m.name });
    }
  }
  const cur = opts.current?.memberId;
  if (cur && !out.some((o) => o.value === cur)) out.push({ value: cur, label: opts.current?.memberName || "Membro" });
  return out;
}
