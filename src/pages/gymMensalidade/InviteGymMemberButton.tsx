import { Button } from "../../ui/ui.jsx";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import { useGetGymSubscriptions } from "../../gen/backoffice/hooks/useGetGymSubscriptions.js";
import { Sub } from "./format";

/**
 * Hook para guardar o convite de sócio: retorna um objeto com `readOnly`,
 * `reason`, e `message` (em PT-PT) a apontar para o CTA de resolver.
 *
 * Verifica 2 condições (prioridade):
 * 1. Sem subscrições ativas → "cria uma subscrição primeiro"
 * 2. Write-guard de billing → "subscrição da plataforma em atraso"
 *
 * Já teve um 3.º motivo (aviso de subdomínio em falta) — saiu no B35 com o
 * site-engine: o link do convite usa agora o `User.websiteDomain` do lado da
 * API, esta página não precisa de avisar nada sobre isso.
 */
function useInviteGuard() {
  const { data: subsData } = useGetGymSubscriptions()
  const writeGuard = useWriteGuard()

  const subs = (subsData ?? []) as Sub[]
  const activeSubs = subs.filter((s) => s.active)

  // Sem plano nenhum no catálogo o convite não tem o que atribuir.
  if (!activeSubs.length) {
    return {
      readOnly: true,
      reason: 'subscriptions',
      message: 'Cria uma subscrição ativa no catálogo antes de convidar sócios.',
    }
  }

  if (writeGuard.readOnly) {
    return {
      readOnly: true,
      reason: 'billing',
      message: writeGuard.message,
    }
  }

  return { readOnly: false, reason: null as string | null, message: '' }
}

/**
 * Botão "Convidar sócio" com guard: subscrições ativas + billing.
 * Usa o mesmo padrão do `GuardButton`, mas com múltiplos motivos de bloqueio.
 */
export function InviteGymMemberButton({
  onInviteClick,
  disabled = false,
}: {
  onInviteClick: () => void
  disabled?: boolean
}) {
  const guard = useInviteGuard()

  if (!guard.readOnly) {
    return (
      <Button size="sm" icon="mail" onClick={onInviteClick} disabled={disabled}>
        Convidar sócio
      </Button>
    )
  }

  return (
    <span title={guard.message} className="inline-flex">
      <Button size="sm" icon="mail" onClick={() => {}} disabled aria-disabled="true" title={guard.message}>
        Convidar sócio
      </Button>
    </span>
  )
}
