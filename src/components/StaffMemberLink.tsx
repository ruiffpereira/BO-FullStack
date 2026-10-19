import { useMemo } from "react";
import { Combobox } from "./Combobox";
import { useAuth } from "../context/AuthContext";
import { useTeamAccess } from "../hooks/useTeamAccess";
import { useStaffOptions } from "../hooks/useStaff";
import { useGetScheduleStaffLinkableMembers } from "../gen/backoffice/hooks/useGetScheduleStaffLinkableMembers.js";
import { memberLinkOptions } from "../lib/staffMemberLink";

/**
 * Campo «Ligar a um membro da equipa». A lista vem de `linkable-members` (só precisa de Editar em
 * `agenda.profissionais`, não da folha `equipa`). Sem poder (ou com «Só os meus», 403) fica só o texto.
 */
export function StaffMemberLink({
  staffId,
  value,
  onChange,
  currentMemberId,
  currentMemberName,
}: {
  staffId?: string;
  value: string;
  onChange: (memberId: string) => void;
  currentMemberId?: string | null;
  currentMemberName?: string | null;
}) {
  const { isAuthenticated } = useAuth();
  const { isMember, can } = useTeamAccess();
  const allowed = !isMember || can("agenda.profissionais", "edit");
  const q = useGetScheduleStaffLinkableMembers({ query: { enabled: isAuthenticated && allowed, retry: false } });
  const { staff } = useStaffOptions();
  const options = useMemo(
    () =>
      memberLinkOptions(q.data ?? [], {
        staffId,
        staffNames: Object.fromEntries(staff.map((s) => [s.staffId, s.name])),
        current: { memberId: currentMemberId, memberName: currentMemberName },
      }),
    [q.data, staff, staffId, currentMemberId, currentMemberName],
  );

  // 403 (ex.: STAFF_LINK_FORBIDDEN) ou sem Editar: só mostra a ligação actual.
  if (!allowed || q.isError) {
    return (
      <p className="text-xs text-zinc-500" data-testid="staff-member-link-readonly">
        Ligado a: {currentMemberName ?? "ninguém"}. Só quem gere os profissionais pode alterar a ligação.
      </p>
    );
  }
  return (
    <Combobox
      label="Ligar a um membro da equipa (opcional)"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Sem ligação"
      searchPlaceholder="Pesquisar membro…"
    />
  );
}
