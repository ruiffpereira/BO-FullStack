import { type SupportEndReason, type SupportSessionInfo } from "../../lib/supportSession";
import type { PostAdminUsersUseridImpersonate200 } from "../../gen/backoffice/types/PostAdminUsersUseridImpersonate.js";
import type { GetUserPermissions200 } from "../../gen/backoffice/types/GetUserPermissions.js";
import type { GetUserPermissionsAccess200 } from "../../gen/backoffice/types/GetUserPermissionsAccess.js";
import { type GrantEntry, type TeamScope } from "../../lib/teamTree";

export type Permission = GetUserPermissions200[number];

/** Quem é o membro da equipa ligado (B41). `null` = o dono do tenant. */
export type AccessMember = NonNullable<GetUserPermissionsAccess200["member"]>;
/** Módulo da equipa que a sessão tem, com o nível dado pela API. */
export type AccessModule = { key: string; label: string; level: "view" | "edit" };
export type TeamLevel = "view" | "edit";
export interface AccessState {
  member: AccessMember | null;
  modules: AccessModule[];
  /** Folhas efectivas da árvore (B41 2b), dadas pela API; o dono tem todas as disponíveis. */
  grants: GrantEntry[];
  /** Profissional ligado ao membro da sessão (`null` = dono ou sem ligação). */
  staffId: string | null;
}

/**
 * B12 — resultado de `doRefresh`, explícito sobre QUAL ramo ocorreu (antes
 * disto, `string | null` confundia "401 duro" com "soluço transitório": os
 * dois casos de falha eram indistinguíveis para quem chamava).
 * - `authenticated`: sessão confirmada, token novo pronto a usar.
 * - `unauthenticated`: 401 duro — refresh token morto, sessão terminada
 *   (`clearSession()` já correu). Veredito definitivo.
 * - `transient`: erro de rede/servidor (timeout, 5xx, 429…) — a sessão em
 *   memória não foi tocada; um retry já está agendado. NÃO é um veredito.
 * - `stale`: esta chamada foi ultrapassada por um login/logout concorrente
 *   (`authVersionRef` mudou a meio) — o resultado não interessa a ninguém.
 */
export type RefreshOutcome =
  | { kind: "authenticated"; accessToken: string }
  | { kind: "unauthenticated" }
  | { kind: "transient" }
  | { kind: "stale" };

export interface AuthState {
  userId: string | null;
  username: string | null;
  email: string | null;
  accessToken: string | null;
  permissions: Permission[];
  /** B41 — quem está ligado (dono ou membro da equipa) e os módulos que tem. Vem da API, nunca se calcula aqui. */
  access: AccessState;
  isAuthenticated: boolean;
}

export interface AuthCtx extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (name: string) => boolean;
  /** Membro da equipa ligado (`null` = dono do tenant). */
  member: AccessMember | null;
  isMember: boolean;
  /**
   * Pode a sessão `key` com este nível? `key` é uma folha (`agenda.servicos`) ou um topo/agrupador (`agenda` = alguma folha
   * debaixo). O dono do tenant pode sempre; um membro só o que a API lhe deu (`edit` implica `view`). A decisão final é sempre da API.
   */
  can: (key: string, level?: TeamLevel) => boolean;
  /** Âmbito da folha na sessão: `meus` = «Só os meus» (dado pela API); o dono é sempre `todos`. */
  scopeOf: (leaf: string) => TeamScope;
  /** `meus` só quando todas as folhas que a sessão tem entre estas são «Só os meus». */
  scopeOfAll: (leaves: readonly string[]) => TeamScope;
  /** Profissional ligado ao membro da sessão (`null` = dono ou sem ligação). */
  staffId: string | null;
  /**
   * Volta a pedir `GET /user-permissions/access` (folhas do membro) sem tocar no resto da sessão. Usado pelo SSE
   * quando o servidor fecha a ligação de um membro (mudou de folhas, foi desactivado, mudou de password): um 401
   * passa pelo interceptor → refresh → login, como qualquer pedido; senão as folhas novas entram sem recarregar.
   */
  refreshAccess: () => Promise<void>;
  loading: boolean;
  loggingOut: boolean;
  error: string | null;
  initializing: boolean;
  /**
   * B12 — verdadeiro quando o arranque ainda NÃO tem veredito definitivo
   * (nem sessão confirmada, nem 401 duro) porque a última tentativa de
   * `doRefresh` falhou por um motivo transitório (timeout, rede, 5xx, 429) e
   * um retry já está agendado. Só existe enquanto `initializing` já é falso
   * (o `doRefresh` inicial já resolveu, de alguma forma) e `isAuthenticated`
   * ainda é falso — nunca fica verdadeiro depois de uma sessão já ter sido
   * estabelecida nesta aba (um soluço do refresh agendado em fundo continua
   * silencioso, como sempre foi). É só sobre O QUE SE MOSTRA: enquanto for
   * verdadeiro, a UI não deve mostrar `<Login/>` — mas também não concede
   * acesso a conteúdo autenticado, isso continua a ser só `isAuthenticated`.
   */
  reconnecting: boolean;
  /**
   * Adota um accessToken NOVO na sessão atual sem passar por login/refresh —
   * usado pelo `PUT /users/me/password` (T3.2/T3.3, `Perfil.tsx`), que bump
   * o `tokenVersion` (invalida o token antigo de imediato) mas já devolve, na
   * mesma resposta, um par de tokens novo para a sessão que pediu a mudança.
   * Sem isto, o próximo pedido autenticado usaria o token antigo (já inválido)
   * e levava um 401 — recuperável pelo interceptor de refresh, mas só depois
   * de uma volta extra. Também realinha o temporizador de refresh automático
   * (`scheduleRefresh`) com a validade real do token novo.
   */
  setAccessToken: (accessToken: string) => void;
  /**
   * Atualiza `username`/`email` em memória + no cache de identidade
   * (localStorage) sem round-trip ao servidor — usado pelo `Perfil.tsx` depois
   * de um `PUT /users/me` bem-sucedido, para o nome/email mostrados no avatar
   * do topbar (e num eventual reload) ficarem coerentes com a edição sem
   * precisar de um logout/login.
   */
  updateIdentity: (patch: { username?: string; email?: string }) => void;
  /**
   * Sessão de suporte (admin dentro da conta de um tenant). `null` fora dela.
   * Nunca expõe o token. Neste modo NUNCA há `/users/refresh`, `/users/logout`,
   * `/push/unsubscribe` nem escritas em `localStorage` (ver o bloco "Sessão de
   * suporte" no provider).
   */
  supportSession: SupportSessionInfo | null;
  /** Motivo pelo qual a sessão de suporte deste separador terminou (ecrã final). */
  supportEnded: SupportEndReason | null;
  /** Adopta a resposta do `POST /admin/users/:userId/impersonate` e passa a agir como o tenant. */
  startImpersonation: (res: PostAdminUsersUseridImpersonate200) => Promise<void>;
  /** Termina a sessão de suporte só localmente (nada vai ao servidor). */
  endImpersonation: (reason: SupportEndReason) => void;
  /** "Ir para o meu backoffice": limpa o ecrã final e refaz o arranque pelo cookie (o do admin). */
  dismissSupportEnded: () => void;
}
