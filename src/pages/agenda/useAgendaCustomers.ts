import { useTeamAccess } from "../../hooks/useTeamAccess";
import { useGetCustomers } from "../../gen/backoffice/hooks/useGetCustomers.js";

/** Folhas que dão leitura de `/customers` (a Agenda usa a lista, a ficha e o histórico). */
const CUSTOMER_READ_KEYS = ["agenda.marcacoes", "clientes.lista"] as const;
/** A lista de clientes da Agenda (preferências de fatura, abrir a ficha). UMA definição; o React Query junta os pedidos iguais. */
export function useAgendaCustomers() {
  const { canAny } = useTeamAccess();
  return useGetCustomers({ query: { enabled: canAny(CUSTOMER_READ_KEYS) } });
}
