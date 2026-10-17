import { useAuth, type AccessMember, type TeamLevel } from '../context/AuthContext'

/**
 * Acesso da equipa (B41) que NÃO exige o provider: sem ele (componentes renderizados isolados, testes) comporta-se
 * como o dono — tudo permitido. É o que o `useWriteGuard`/`useBillingReadOnly` (e logo o `GuardButton`) usam.
 * A decisão final é sempre da API; isto só serve para desactivar a UI antes de bater num 403.
 */
export function useTeamAccess(): {
  member: AccessMember | null
  isMember: boolean
  can: (key: string, level?: TeamLevel) => boolean
} {
  let ctx: ReturnType<typeof useAuth> | null = null
  try {
    ctx = useAuth()
  } catch {
    ctx = null
  }
  return {
    member: ctx?.member ?? null,
    isMember: !!ctx?.isMember,
    can: ctx?.can ?? (() => true),
  }
}
