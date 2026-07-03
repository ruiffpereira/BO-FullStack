import { useGetBillingSubscription } from '../gen/backoffice/hooks/useGetBillingSubscription'

/**
 * Conveniência: `true` quando a subscrição da plataforma do tenant está em
 * read-only (gestão bloqueada; as escritas devolvem 402). Pensado para páginas
 * poderem, no futuro, desativar botões primários de forma **proativa**.
 *
 * NÃO está ligado a nenhuma página ainda (fora de âmbito desta tarefa) — fica só
 * disponível. O feedback **reativo** (toast ao tentar escrever) vive no
 * interceptor do `AuthContext` (ver `src/lib/billing402.ts`).
 */
export function useBillingReadOnly(): boolean {
  const { data } = useGetBillingSubscription()
  return data?.readOnly ?? false
}
