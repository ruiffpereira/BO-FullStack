import { useAuth, type AccessMember, type TeamLevel } from '../context/AuthContext'
import type { TeamScope } from '../lib/teamTree'

/**
 * Acesso da equipa (B41) que NÃO exige o provider: sem ele (componentes renderizados isolados, testes) comporta-se
 * como o dono — tudo permitido. É o que o `useWriteGuard`/`useBillingReadOnly` (e logo o `GuardButton`) usam.
 * A decisão final é sempre da API; isto só serve para desactivar a UI antes de bater num 403.
 */
export function useTeamAccess(): {
  member: AccessMember | null
  isMember: boolean
  can: (key: string, level?: TeamLevel) => boolean
  /** Alguma das chaves (OU). */
  canAny: (keys: readonly string[], level?: TeamLevel) => boolean
  /** Âmbito da folha: `meus` = «Só os meus» (o dono, e sem provider, é sempre `todos`). */
  scopeOf: (leaf: string) => TeamScope
  /** `meus` só quando todas as folhas que a sessão tem entre estas são «Só os meus». */
  scopeOfAll: (leaves: readonly string[]) => TeamScope
  /** Profissional ligado ao membro da sessão (`null` = dono ou sem ligação). */
  staffId: string | null
} {
  let ctx: ReturnType<typeof useAuth> | null = null
  try {
    // `useAuth` chama sempre `useContext` antes de lançar sem provider → a ordem dos hooks não muda; o try/catch
    // só dá o «dono» como fallback. (Os testes mockam `useAuth` para controlar o acesso da equipa.)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ctx = useAuth()
  } catch {
    ctx = null
  }
  const can = ctx?.can ?? (() => true)
  return {
    member: ctx?.member ?? null,
    isMember: !!ctx?.isMember,
    can,
    canAny: (keys, level = 'view') => keys.some((k) => can(k, level)),
    scopeOf: ctx?.scopeOf ?? (() => 'todos'),
    scopeOfAll: ctx?.scopeOfAll ?? (() => 'todos'),
    staffId: ctx?.staffId ?? null,
  }
}
