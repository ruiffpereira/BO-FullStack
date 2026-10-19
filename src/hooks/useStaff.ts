import { useTeamAccess } from "./useTeamAccess";
import { useAuth } from "../context/AuthContext";
import { useGetScheduleStaffOptions } from "../gen/backoffice/hooks/useGetScheduleStaffOptions.js";
import { useGetScheduleStaffId } from "../gen/backoffice/hooks/useGetScheduleStaffId.js";

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
 */
export function useStaffOptions(enabled = true) {
  const { isAuthenticated } = useAuth();
  const { isMember, canAny } = useTeamAccess();
  const allowed = !isMember || canAny(OPTIONS_LEAVES);
  const q = useGetScheduleStaffOptions({
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

/**
 * Preço próprio de um profissional num serviço (`null` = o normal). Lê a ficha do profissional, por isso só
 * quem tem `agenda.profissionais` (ou o dono) o vê — para os outros fica `undefined` e não se mostra nada.
 */
export function useStaffServicePrice(staffId: string | null | undefined, serviceId: string | null | undefined) {
  const { isAuthenticated } = useAuth();
  const { isMember, can } = useTeamAccess();
  const allowed = !isMember || can("agenda.profissionais", "view");
  const q = useGetScheduleStaffId(staffId ?? "", {
    query: { enabled: isAuthenticated && allowed && !!staffId && !!serviceId, staleTime: 30_000, retry: false },
  });
  const rule = q.data?.services?.find((r) => r.serviceId === serviceId);
  return { price: rule && !rule.excluded ? (rule.price ?? null) : undefined, excluded: !!rule?.excluded };
}
