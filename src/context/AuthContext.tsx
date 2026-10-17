import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { API_BASE } from "../lib/env";
import { queryClient } from "../lib/queryClient";
import { notifyBillingReadOnly } from "../lib/billing402";
import {
  type StoredSupportSession,
  type SupportEndReason,
  type SupportSessionInfo,
  clearSupportSession,
  notifyImpersonationForbidden,
  readSupportSession,
  writeSupportSession,
} from "../lib/supportSession";
import type { PostAdminUsersUseridImpersonate200 } from "../gen/backoffice/types/PostAdminUsersUseridImpersonate.js";
import { getCsrfToken } from "../gen/backoffice/hooks/useGetCsrfToken.js";
import { postUsersLogin } from "../gen/backoffice/hooks/usePostUsersLogin.js";
import { getUserpermissions } from "../gen/backoffice/hooks/useGetUserpermissions.js";
import type { GetUserpermissions200 } from "../gen/backoffice/types/GetUserpermissions.js";
import { getUserpermissionsAccess } from "../gen/backoffice/hooks/useGetUserpermissionsAccess.js";
import type { GetUserpermissionsAccess200 } from "../gen/backoffice/types/GetUserpermissionsAccess.js";
import { notifyTeamForbidden } from "../lib/teamAccess";

type Permission = GetUserpermissions200[number];

/** Quem é o membro da equipa ligado (B41). `null` = o dono do tenant. */
export type AccessMember = NonNullable<GetUserpermissionsAccess200["member"]>;
/** Módulo da equipa que a sessão tem, com o nível dado pela API. */
export type AccessModule = { key: string; label: string; level: "view" | "edit" };
export type TeamLevel = "view" | "edit";
interface AccessState {
  member: AccessMember | null;
  modules: AccessModule[];
}
const ownerAccess: AccessState = { member: null, modules: [] };

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
type RefreshOutcome =
  | { kind: "authenticated"; accessToken: string }
  | { kind: "unauthenticated" }
  | { kind: "transient" }
  | { kind: "stale" };

interface AuthState {
  userId: string | null;
  username: string | null;
  email: string | null;
  accessToken: string | null;
  permissions: Permission[];
  /** B41 — quem está ligado (dono ou membro da equipa) e os módulos que tem. Vem da API, nunca se calcula aqui. */
  access: AccessState;
  isAuthenticated: boolean;
}

interface AuthCtx extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authHeader: () => Record<string, string>;
  hasPermission: (name: string) => boolean;
  /** Membro da equipa ligado (`null` = dono do tenant). */
  member: AccessMember | null;
  isMember: boolean;
  /**
   * Pode a sessão usar o módulo `key` (`agenda`, `loja`, …) com este nível? O dono do tenant pode sempre;
   * um membro só se a API lhe deu o módulo (`edit` implica `view`). A decisão final é sempre da API.
   */
  can: (key: string, level?: TeamLevel) => boolean;
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

const AuthContext = createContext<AuthCtx | null>(null);

/**
 * ⚠ EXCEPÇÃO DELIBERADA ao "Kubb everywhere" (2026-09-24). Os paths de auth
 * deste ficheiro ficam em strings, e não vêm dos clients gerados. Não é
 * esquecimento — não os migres.
 *
 * PORQUÊ. As funções geradas pelo Kubb devolvem `res.data` e **descartam o
 * status HTTP**. O bootstrap de sessão daqui ramifica precisamente por ele:
 *
 *     validateStatus: (s) => (s >= 200 && s < 300) || s === 401
 *     if (res.status === 401) return null;   // veredito DEFINITIVO
 *
 * Sem o status, a única alternativa seria deixar o 401 lançar e apanhá-lo — e
 * aí um **erro de rede** ficaria indistinguível de **sessão expirada**. Essa
 * distinção é o que sustenta tudo o resto: uma é transitória e faz retry
 * (`reconnecting`), a outra termina a sessão. Confundi-las dá logout a quem só
 * teve um soluço de rede, ou uma app presa a tentar renovar uma sessão morta.
 *
 * `SKIP_401` é, além disso, uma lista de POLÍTICA (onde um 401 não pode
 * disparar o interceptor de refresh, para não entrar em ciclo) — não é uma
 * lista de chamadas. Mesmo com clients gerados continuaria a existir.
 *
 * O resto do Backoffice está migrado; a excepção é só esta.
 */
const SKIP_401 = [
  "/csrf-token",
  "/users/login",
  "/users/refresh",
  "/users/logout",
  "/users/setup-password",
];

const REFRESH_FALLBACK_MS = 10 * 60 * 1000;
const REFRESH_SKEW_MS = 60 * 1000;
const REFRESH_RETRY_MS = 30 * 1000;
const REFRESH_MIN_DELAY_MS = 30 * 1000;
const AUTH_REQUEST_TIMEOUT_MS = 5 * 1000;
const AUTH_IDENTITY_STORAGE_KEY = "backoffice.auth.identity";
// B12 — cadência e orçamento do "ainda sem veredicto" no arranque (ver
// `doRefresh` abaixo). Só se aplica ENQUANTO a sessão desta aba nunca chegou a
// um veredito definitivo (autenticada, 401 duro, ou desistência); uma vez
// resolvida, o refresh de fundo volta à cadência normal (REFRESH_RETRY_MS,
// 30s) — não há motivo para martelar o servidor de uma app já em uso.
// 3 tentativas a 2s dão um orçamento máximo de ~(15s + 2s) × 3 ≈ 51s no pior
// caso (cada tentativa pode gastar até AUTH_REQUEST_TIMEOUT_MS × 3 = 15s, a
// cadeia csrf→refresh→permissões) — o suficiente para engolir um soluço real
// de rede sem deixar o utilizador a fitar "a reconectar…" durante minutos.
const RECONNECT_RETRY_MS = 2 * 1000;
const MAX_RECONNECT_ATTEMPTS = 3;

const emptyAuth: AuthState = {
  userId: null,
  username: null,
  email: null,
  accessToken: null,
  permissions: [],
  access: ownerAccess,
  isAuthenticated: false,
};

function readStoredIdentity(): {
  userId: string | null;
  username: string | null;
  email: string | null;
} {
  if (typeof window === "undefined") return { userId: null, username: null, email: null };
  try {
    const raw = window.localStorage.getItem(AUTH_IDENTITY_STORAGE_KEY);
    if (!raw) return { userId: null, username: null, email: null };
    const parsed = JSON.parse(raw) as { userId?: unknown; username?: unknown; email?: unknown };
    return {
      userId:
        typeof parsed.userId === "string" && parsed.userId.trim()
          ? parsed.userId
          : null,
      username:
        typeof parsed.username === "string" && parsed.username.trim()
          ? parsed.username
          : null,
      email:
        typeof parsed.email === "string" && parsed.email.trim()
          ? parsed.email
          : null,
    };
  } catch {
    return { userId: null, username: null, email: null };
  }
}

function writeStoredIdentity(identity: {
  userId: string | null;
  username: string | null;
  email: string | null;
}) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AUTH_IDENTITY_STORAGE_KEY,
      JSON.stringify(identity),
    );
  } catch {
    // ignore storage errors
  }
}

function clearStoredIdentity() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_IDENTITY_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function isAuthEndpoint(url = "") {
  const path = url.split("?")[0];
  return SKIP_401.some((p) => path === p || path.endsWith(p));
}

function getJwtExpiry(accessToken: string): number | null {
  const decoded = decodeJwtPayload(accessToken);
  return typeof decoded?.exp === "number" ? decoded.exp * 1000 : null;
}

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  const [, payload] = accessToken.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getIdentityFromJwt(accessToken: string): {
  userId: string | null;
  username: string | null;
  email: string | null;
} {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return { userId: null, username: null, email: null };

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    return null;
  };

  return {
    userId: pick("userId", "uid", "sub"),
    username: pick("username", "preferred_username", "name", "email"),
    // O access token do BO só carrega { userId, tokenVersion } (ver
    // `generateAccessToken` na API) — nunca vem daqui na prática hoje, mas
    // fica pronto caso o payload alguma vez ganhe o campo, sem mais um sítio
    // a mudar. A identidade real (login/reload) vem do `login()`/localStorage.
    email: pick("email"),
  };
}

function getRefreshDelay(accessToken: string) {
  const expiry = getJwtExpiry(accessToken);
  if (!expiry) return REFRESH_FALLBACK_MS;
  return Math.max(expiry - Date.now() - REFRESH_SKEW_MS, REFRESH_MIN_DELAY_MS);
}

async function fetchCsrfToken(): Promise<string> {
  const csrf = await getCsrfToken({ timeout: AUTH_REQUEST_TIMEOUT_MS } as any);
  if (!csrf?.csrfToken) throw new Error("CSRF token em falta.");
  return csrf.csrfToken;
}

async function fetchPermissions(accessToken: string): Promise<Permission[]> {
  return getUserpermissions({
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: AUTH_REQUEST_TIMEOUT_MS,
  } as any);
}

async function fetchAccess(accessToken: string): Promise<AccessState> {
  const res = await getUserpermissionsAccess({
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: AUTH_REQUEST_TIMEOUT_MS,
  } as any);
  return {
    member: res?.member ?? null,
    modules: (res?.modules ?? [])
      .filter((m) => !!m.key)
      .map((m) => ({
        key: m.key as string,
        label: m.label ?? (m.key as string),
        level: m.level === "edit" ? ("edit" as const) : ("view" as const),
      })),
  };
}

async function refreshSession(): Promise<string | null> {
  const csrfToken = await fetchCsrfToken();
  const res = await axiosInstance.post<{ accessToken?: string }>(
    "/users/refresh",
    undefined,
    {
      headers: { "x-csrf-token": csrfToken },
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 401,
      timeout: AUTH_REQUEST_TIMEOUT_MS,
      withCredentials: true,
    },
  );

  if (res.status === 401) return null;
  return res.data?.accessToken ?? null;
}

async function getBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(emptyAuth);
  const [initializing, setInitializing] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPromiseRef = useRef<Promise<RefreshOutcome> | null>(null);
  const doRefreshRef = useRef<(() => Promise<RefreshOutcome>) | null>(null);
  const authRef = useRef<AuthState>(emptyAuth);
  const authVersionRef = useRef(0);
  // B12 — só existem enquanto o arranque desta aba não teve um veredito
  // definitivo. `bootstrapSettledRef` liga para sempre assim que esse
  // veredito chega (autenticado, 401 duro, ou desistência do reconnect); a
  // partir daí `doRefresh` volta a ser silencioso em falhas transitórias,
  // como sempre foi para uma sessão já em uso.
  const bootstrapSettledRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  // Sessão de suporte (bloco mais abaixo). `supportActiveRef` é o interruptor
  // lido pelos interceptors/timers (que não podem depender de estado React);
  // `supportSession` é o que a UI vê.
  const [supportSession, setSupportSession] = useState<SupportSessionInfo | null>(null);
  const [supportEnded, setSupportEnded] = useState<SupportEndReason | null>(null);
  const supportActiveRef = useRef(false);
  const supportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lido UMA vez e de forma pura (sem remover nada): quem actua é o efeito de
  // arranque, que em StrictMode corre duas vezes.
  const initialSupportRef = useRef<ReturnType<typeof readSupportSession> | null>(null);
  if (initialSupportRef.current === null) initialSupportRef.current = readSupportSession();
  // Ref estável para navegar a partir do interceptor de resposta (o toast do
  // gate de billing aponta para /faturacao) sem re-registar o interceptor.
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const clearSession = useCallback(() => {
    authVersionRef.current += 1;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
    refreshPromiseRef.current = null;
    clearStoredIdentity();
    setAuth(emptyAuth);
    queryClient.clear();
    // B12 — uma sessão limpa é sempre um veredito definitivo (401 duro,
    // logout, ou uma tentativa de login que falhou): nunca deve deixar a UI
    // presa em "a reconectar…".
    bootstrapSettledRef.current = true;
    setReconnecting(false);
  }, []);

  // Arms a single timer that funnels through doRefresh(), so the scheduled
  // refresh and a 401-triggered refresh can never hit /users/refresh at the
  // same time (which, with refresh-token rotation, would log the user out).
  const scheduleRefresh = useCallback((accessToken: string) => {
    // Em sessão de suporte NUNCA se agenda refresh: o cookie é o do ADMIN.
    if (supportActiveRef.current) return;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void doRefreshRef.current?.();
    }, getRefreshDelay(accessToken));
  }, []);

  // Single source of truth for refreshing the session. Guarded by
  // refreshPromiseRef so concurrent callers share one in-flight request.
  //
  // B12 — devolve um RefreshOutcome (não `string | null`) para o chamador
  // saber QUAL ramo ocorreu, e mantém `reconnecting`/`bootstrapSettledRef`
  // alinhados com esse veredito. A distinção só importa ENQUANTO o arranque
  // desta aba ainda não resolveu (`!bootstrapSettledRef.current`): depois
  // disso, uma falha transitória de um refresh em fundo continua 100%
  // silenciosa, como sempre foi — não faz `reconnecting` reaparecer por cima
  // de uma app já autenticada.
  const doRefresh = useCallback((): Promise<RefreshOutcome> => {
    // Invariante da sessão de suporte: o `/users/refresh` usa o cookie do ADMIN
    // (partilhado por todos os separadores) — chamá-lo aqui gravaria o token do
    // admin por cima da sessão do cliente. Em modo suporte, nunca.
    if (supportActiveRef.current) return Promise.resolve({ kind: "stale" });
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const refreshVersion = authVersionRef.current;
    refreshPromiseRef.current = (async (): Promise<RefreshOutcome> => {
      try {
        const nextAccessToken = await refreshSession();
        // Hard 401 → refresh token is dead, end the session for good. This
        // IS a definitive verdict — settle the bootstrap even if it hadn't
        // exhausted its reconnect budget yet.
        if (!nextAccessToken) {
          if (refreshVersion === authVersionRef.current) clearSession();
          return { kind: "unauthenticated" };
        }
        // Session changed under us (login/logout) → discard this result.
        if (refreshVersion !== authVersionRef.current) return { kind: "stale" };

        const permissions = await fetchPermissions(nextAccessToken);
        const access = await fetchAccess(nextAccessToken);
        if (refreshVersion !== authVersionRef.current) return { kind: "stale" };

        const identity = getIdentityFromJwt(nextAccessToken);
        const storedIdentity = readStoredIdentity();
        const nextIdentity = {
          userId: identity.userId ?? storedIdentity.userId,
          username: identity.username ?? storedIdentity.username,
          email: identity.email ?? storedIdentity.email,
        };
        writeStoredIdentity(nextIdentity);
        setAuth((prev) => ({
          ...prev,
          userId: prev.userId ?? nextIdentity.userId,
          username: prev.username ?? nextIdentity.username,
          email: prev.email ?? nextIdentity.email,
          accessToken: nextAccessToken,
          permissions,
          access,
          isAuthenticated: true,
        }));
        scheduleRefresh(nextAccessToken);
        // Autenticado é sempre um veredito definitivo — também limpa um
        // eventual "a reconectar…" deixado por tentativas anteriores.
        bootstrapSettledRef.current = true;
        setReconnecting(false);
        return { kind: "authenticated", accessToken: nextAccessToken };
      } catch {
        // Network/permissions hiccup (not a 401) — keep the session and
        // retry shortly instead of logging the user out.
        if (refreshVersion === authVersionRef.current) {
          let retryDelay = REFRESH_RETRY_MS;

          if (!bootstrapSettledRef.current) {
            reconnectAttemptsRef.current += 1;
            if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
              // Orçamento de reconexão esgotado: desiste do bootstrap e
              // mostra <Login/> — mas o retry por baixo continua a correr
              // (agora à cadência normal): se a rede recuperar sozinha, o
              // próximo sucesso autentica sem o utilizador tocar em nada.
              bootstrapSettledRef.current = true;
              setReconnecting(false);
            } else {
              setReconnecting(true);
              retryDelay = RECONNECT_RETRY_MS;
            }
          }

          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(() => {
            void doRefreshRef.current?.();
          }, retryDelay);
        }
        return { kind: "transient" };
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [clearSession, scheduleRefresh]);

  // Keep the ref pointing at the latest doRefresh so the timers above can
  // call it without creating a scheduleRefresh ↔ doRefresh dependency cycle.
  useEffect(() => {
    doRefreshRef.current = doRefresh;
  }, [doRefresh]);

  // ── Sessão de suporte ──────────────────────────────────────────────────────
  //
  // O admin entra na conta de um tenant com um access token de 60 min, SEM
  // refresh token. O cookie de refresh do BO é HttpOnly e partilhado por todos
  // os separadores — e é o cookie do ADMIN. Daí as invariantes (todas
  // verificadas por tests/unit/AuthContextSupport.test.tsx):
  //   1. Em modo suporte nunca se chama `/users/refresh`: nem o timer
  //      (`scheduleRefresh`), nem o `doRefresh`, nem o interceptor de 401. Um 401
  //      termina a sessão de suporte e NUNCA repete o pedido (repetir com o
  //      token do admin gravaria na conta do admin).
  //   2. `logout()` em modo suporte nunca chama `/users/logout` nem
  //      `/push/unsubscribe`: só termina a sessão localmente.
  //   3. Nada se escreve no `localStorage` (identidade; o tema é tratado em
  //      `useThemeSync`). Por isso aqui nunca se usa `clearSession`, que limpa
  //      a identidade do admin guardada para os outros separadores.
  //   4. O estado vive em `sessionStorage` (por separador).

  const clearSupportTimer = useCallback(() => {
    if (supportTimerRef.current) clearTimeout(supportTimerRef.current);
    supportTimerRef.current = null;
  }, []);

  const endImpersonation = useCallback(
    (reason: SupportEndReason) => {
      if (!supportActiveRef.current) return;
      supportActiveRef.current = false;
      clearSupportTimer();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
      refreshPromiseRef.current = null;
      authVersionRef.current += 1;
      clearSupportSession();
      queryClient.clear();
      authRef.current = emptyAuth;
      setAuth(emptyAuth);
      setSupportSession(null);
      setSupportEnded(reason);
      bootstrapSettledRef.current = true;
      setReconnecting(false);
      setInitializing(false);
    },
    [clearSupportTimer],
  );

  const armSupportTimer = useCallback(
    (expiresAt: string) => {
      clearSupportTimer();
      const delay = Math.min(
        Math.max(new Date(expiresAt).getTime() - Date.now(), 0),
        2 ** 31 - 1,
      );
      supportTimerRef.current = setTimeout(() => endImpersonation("expired"), delay);
    },
    [clearSupportTimer, endImpersonation],
  );

  const applySupport = useCallback(
    (s: StoredSupportSession, permissions: Permission[]) => {
      const next: AuthState = {
        userId: s.tenant.userId,
        username: s.tenant.name,
        email: s.tenant.email,
        accessToken: s.accessToken,
        permissions,
        // O admin entra como o DONO do tenant (nunca como um membro).
        access: ownerAccess,
        isAuthenticated: true,
      };
      authRef.current = next;
      setAuth(next);
      setSupportSession({ tenantName: s.tenant.name, expiresAt: s.expiresAt });
      setSupportEnded(null);
      bootstrapSettledRef.current = true;
      setReconnecting(false);
      armSupportTimer(s.expiresAt);
    },
    [armSupportTimer],
  );

  const startImpersonation = useCallback(
    async (res: PostAdminUsersUseridImpersonate200) => {
      const stored: StoredSupportSession = {
        accessToken: res.accessToken,
        expiresAt: res.expiresAt,
        tenant: {
          userId: res.tenant?.userId ?? "",
          name: res.tenant?.name ?? "",
          email: res.tenant?.email ?? "",
        },
      };
      const previousToken = authRef.current.accessToken;
      authVersionRef.current += 1;
      const version = authVersionRef.current;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
      refreshPromiseRef.current = null;
      // Ligado ANTES do pedido de permissões: um 401 aí já termina a sessão.
      supportActiveRef.current = true;
      queryClient.clear();

      let permissions: Permission[];
      try {
        permissions = await fetchPermissions(stored.accessToken);
      } catch (err) {
        if (supportActiveRef.current && version === authVersionRef.current) {
          // Falha que não foi 401 (rede/5xx): nada foi aplicado, volta ao admin.
          supportActiveRef.current = false;
          if (previousToken) scheduleRefresh(previousToken);
        }
        throw err;
      }
      if (version !== authVersionRef.current || !supportActiveRef.current) return;

      writeSupportSession(stored);
      applySupport(stored, permissions);
      navigateRef.current("/", { replace: true });
    },
    [applySupport, scheduleRefresh],
  );

  // Arranque (incluindo reload do separador) com uma sessão de suporte válida:
  // retoma-a SEM nunca passar pelo `doRefresh`.
  const resumeSupport = useCallback(
    async (s: StoredSupportSession) => {
      supportActiveRef.current = true;
      authVersionRef.current += 1;
      const version = authVersionRef.current;
      try {
        const permissions = await fetchPermissions(s.accessToken);
        if (version !== authVersionRef.current || !supportActiveRef.current) return;
        applySupport(s, permissions);
      } catch {
        // 401: o interceptor já a terminou (`supportActiveRef` a falso). Outra
        // falha (rede/5xx): não dá para confirmar o acesso, termina também —
        // reentrar a partir do admin é barato, retomar às cegas não é.
        if (version === authVersionRef.current && supportActiveRef.current) {
          endImpersonation("ended");
        }
      }
    },
    [applySupport, endImpersonation],
  );

  const dismissSupportEnded = useCallback(() => {
    setSupportEnded(null);
    setInitializing(true);
    bootstrapSettledRef.current = false;
    reconnectAttemptsRef.current = 0;
    navigateRef.current("/", { replace: true });
    const bootstrap = doRefreshRef.current?.() ?? Promise.resolve();
    void bootstrap.finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    axiosInstance.defaults.baseURL = API_BASE;
    axiosInstance.defaults.withCredentials = true;

    const reqId = axiosInstance.interceptors.request.use((config) => {
      config.baseURL = API_BASE;
      config.withCredentials = true;
      const token = authRef.current.accessToken;
      const url = config.url ?? "";
      if (token && !isAuthEndpoint(url)) {
        const headers = (config.headers ?? {}) as Record<string, string>;
        if (!headers.Authorization) {
          headers.Authorization = `Bearer ${token}`;
        }
        config.headers = headers as any;
      }
      return config;
    });

    const resId = axiosInstance.interceptors.response.use(
      (res) => res,
      async (err) => {
        const url = err?.config?.url ?? "";
        const is401 = err?.response?.status === 401;
        const skipRefresh = isAuthEndpoint(url);

        // Sessão de suporte: um 401 (ex.: `SUPPORT_SESSION_ENDED` — o cliente
        // revogou) termina a sessão e rejeita. NUNCA refresca nem repete: o
        // cookie de refresh é o do admin e repetir gravaria na conta dele.
        if (supportActiveRef.current) {
          if (is401) endImpersonation("ended");
          notifyImpersonationForbidden(err?.response?.status, err?.response?.data);
          return Promise.reject(err);
        }

        if (is401 && !skipRefresh && !err.config?._retry) {
          const outcome = await doRefresh();
          if (outcome.kind === "authenticated") {
            err.config._retry = true;
            err.config.withCredentials = true;
            err.config.headers = err.config.headers ?? {};
            err.config.headers.Authorization = `Bearer ${outcome.accessToken}`;
            return axiosInstance(err.config);
          }
        }

        // Gate read-only do platform billing: uma escrita bloqueada devolve 402
        // com `reason`. Mostra um toast (coalescido) a apontar para /faturacao —
        // só ADICIONA feedback, não engole o erro (a promise segue rejeitada, as
        // mutations veem o 402). No-op para qualquer outro erro/status.
        notifyBillingReadOnly(err?.response?.status, err?.response?.data, (to) =>
          navigateRef.current(to),
        );
        // Backstop das permissões da equipa (B41): a UI já esconde/desactiva, mas se uma escrita
        // escapar e a API disser 403 TEAM_*, o membro vê porquê. No-op para qualquer outro erro.
        notifyTeamForbidden(err?.response?.status, err?.response?.data);

        return Promise.reject(err);
      },
    );

    // B12 — `initializing` só cobre a 1ª tentativa (qualquer que seja o
    // desfecho); `doRefresh` já decidiu, internamente, se esse desfecho é um
    // veredito definitivo ou um "ainda sem veredito" (`reconnecting`).
    // Sessão de suporte retomada do sessionStorage: NUNCA passa pelo doRefresh.
    const initialSupport = initialSupportRef.current;
    if (initialSupport?.status === "valid") {
      void resumeSupport(initialSupport.session).finally(() => setInitializing(false));
    } else if (initialSupport?.status === "expired") {
      clearSupportSession();
      setSupportEnded("expired");
      setInitializing(false);
    } else {
      doRefresh().finally(() => setInitializing(false));
    }

    return () => {
      axiosInstance.interceptors.request.eject(reqId);
      axiosInstance.interceptors.response.eject(resId);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      clearSupportTimer();
    };
  }, [doRefresh, endImpersonation, resumeSupport, clearSupportTimer]);

  const login = useCallback(
    async (username: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        authVersionRef.current += 1;
        queryClient.clear();
        clearStoredIdentity();
        const loginRes = await postUsersLogin({ username, password }, {
          timeout: AUTH_REQUEST_TIMEOUT_MS,
        } as any);
        const accessToken = loginRes?.accessToken;
        if (!accessToken) throw new Error("Sem token de acesso.");

        const permissions = await fetchPermissions(accessToken);
        const access = await fetchAccess(accessToken);
        const identity = {
          userId: loginRes?.userId ?? null,
          username: loginRes?.username ?? username,
          email: loginRes?.email ?? null,
        };
        writeStoredIdentity(identity);

        setAuth({
          userId: identity.userId,
          username: identity.username,
          email: identity.email,
          accessToken,
          permissions,
          access,
          isAuthenticated: true,
        });
        scheduleRefresh(accessToken);
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          err?.message ??
          "Credenciais invalidas.";
        setError(msg);
        clearSession();
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [clearSession, scheduleRefresh],
  );

  const logout = useCallback(async () => {
    // Sessão de suporte: só termina localmente. `/users/logout` revogaria o
    // refresh token do ADMIN (cookie partilhado) e `/push/unsubscribe` tiraria
    // a subscrição push do dispositivo do admin.
    if (supportActiveRef.current) {
      endImpersonation("exit");
      return;
    }
    const accessToken = authRef.current.accessToken;
    setLoggingOut(true);
    setError(null);
    authVersionRef.current += 1;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
    refreshPromiseRef.current = null;
    try {
      const pushSubscription = await getBrowserPushSubscription();
      if (pushSubscription) {
        if (accessToken) {
          await axiosInstance
            .post(
              "/push/unsubscribe",
              { endpoint: pushSubscription.endpoint },
              {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: AUTH_REQUEST_TIMEOUT_MS,
                withCredentials: true,
              },
            )
            .catch(() => {});
        }
        await pushSubscription.unsubscribe().catch(() => {});
      }

      const csrfToken = await fetchCsrfToken();
      const res = await axiosInstance.post("/users/logout", undefined, {
        headers: {
          "x-csrf-token": csrfToken,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        timeout: AUTH_REQUEST_TIMEOUT_MS,
        withCredentials: true,
        validateStatus: (status) =>
          (status >= 200 && status < 300) || status === 401,
      });
      if ((res.status >= 200 && res.status < 300) || res.status === 401) {
        clearSession();
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.response?.data?.message ??
        err?.message ??
        "Nao foi possivel terminar sessao no servidor.";
      setError(msg);
      if (accessToken) scheduleRefresh(accessToken);
      throw err;
    } finally {
      setLoggingOut(false);
    }
  }, [clearSession, scheduleRefresh, endImpersonation]);

  const authHeader = useCallback(() => {
    const token = authRef.current.accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const hasPermission = useCallback(
    (name: string) => auth.permissions.some((p) => p.name === name),
    [auth.permissions],
  );

  const can = useCallback(
    (key: string, level: TeamLevel = "view") => {
      if (!auth.access.member) return true;
      const m = auth.access.modules.find((x) => x.key === key);
      if (!m) return false;
      return level === "view" || m.level === "edit";
    },
    [auth.access],
  );

  // Ver docstring em `AuthCtx.setAccessToken` — adota o token devolvido por
  // `PUT /users/me/password` sem passar por login/refresh, e realinha o
  // temporizador de refresh automático com a validade real do token novo.
  const setAccessToken = useCallback(
    (accessToken: string) => {
      setAuth((prev) => ({ ...prev, accessToken, isAuthenticated: true }));
      scheduleRefresh(accessToken);
    },
    [scheduleRefresh],
  );

  // Ver docstring em `AuthCtx.updateIdentity` — sincroniza username/email em
  // memória + localStorage depois de um `PUT /users/me` bem-sucedido.
  const updateIdentity = useCallback(
    (patch: { username?: string; email?: string }) => {
      setAuth((prev) => ({
        ...prev,
        username: patch.username !== undefined ? patch.username : prev.username,
        email: patch.email !== undefined ? patch.email : prev.email,
        // Um membro que muda o nome no Perfil: o topo ("Ana · equipa de …") acompanha.
        access:
          prev.access.member && patch.username !== undefined
            ? { ...prev.access, member: { ...prev.access.member, name: patch.username } }
            : prev.access,
      }));
      // Sessão de suporte: a identidade é a do cliente — não vai para o
      // localStorage (os separadores do admin herdavam-na).
      if (supportActiveRef.current) return;
      const stored = readStoredIdentity();
      writeStoredIdentity({
        userId: stored.userId,
        username: patch.username !== undefined ? patch.username : stored.username,
        email: patch.email !== undefined ? patch.email : stored.email,
      });
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        login,
        logout,
        authHeader,
        hasPermission,
        member: auth.access.member,
        isMember: !!auth.access.member,
        can,
        loading,
        loggingOut,
        error,
        initializing,
        reconnecting,
        setAccessToken,
        updateIdentity,
        supportSession,
        supportEnded,
        startImpersonation,
        endImpersonation,
        dismissSupportEnded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/**
 * Leitura da sessão de suporte que NÃO exige o provider (devolve `null` sem
 * ele). Para componentes que também são renderizados isolados (testes, páginas
 * sem `useAuth` por outro motivo) e só precisam de saber se estão em suporte.
 */
export function useSupportSession(): SupportSessionInfo | null {
  return useContext(AuthContext)?.supportSession ?? null;
}
