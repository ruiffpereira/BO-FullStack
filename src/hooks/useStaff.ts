import { useTeamAccess } from "./useTeamAccess";
import { useAuth } from "../context/AuthContext";
import { useGetScheduleStaffOptions } from "../gen/backoffice/hooks/useGetScheduleStaffOptions.js";

/** Folhas que a API aceita para ler `/schedule/staff/options` (qualquer uma chega). */
const OPTIONS_LEAVES = [
  "agenda.marcacoes",
  "agenda.profissionais",
  "loja.encomendas",
  "financeiro.negocio",
  "financeiro.agenda",
  "financeiro.loja",
  "financeiro.despesas",
  "dashboard",
  "equipa",
] as const;

/**
 * Profissionais para selectores (marcação, venda, despesa, filtros). Tenant sem profissionais → lista vazia e o
 * Backoffice não mostra nenhum selector. Um membro sem nenhuma das folhas que usam o selector nem pede (evita 403).
 * Com `serviceId` (marcação) cada opção traz `doesService` e, a quem vê valores, o `price` efectivo.
 */
export function useStaffOptions(enabled = true, serviceId?: string | null) {
  const { isAuthenticated } = useAuth();
  const { isMember, canAny } = useTeamAccess();
  const allowed = !isMember || canAny(OPTIONS_LEAVES);
  const q = useGetScheduleStaffOptions(serviceId ? { serviceId } : undefined, {
    query: { enabled: enabled && isAuthenticated && allowed, staleTime: 60_000, retry: false },
  });
  const staff = q.data ?? [];
  return {
    staff,
    active: staff.filter((s) => s.active),
    hasStaff: staff.length > 0,
    isLoading: q.isLoading,
  };
}
