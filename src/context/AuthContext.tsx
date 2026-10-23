import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { queryClient } from "../lib/queryClient";
import { type StoredSupportSession, type SupportEndReason, type SupportSessionInfo, clearSupportSession, readSupportSession, writeSupportSession } from "../lib/supportSession";
import type { PostAdminUsersUseridImpersonate200 } from "../gen/backoffice/types/PostAdminUsersUseridImpersonate.js";
import { postUsersLogin } from "../gen/backoffice/hooks/usePostUsersLogin.js";
import { canFromGrants, grantScope, grantScopeAll, type TeamScope } from "../lib/teamTree";
import { AuthCtx, AuthState, Permission, RefreshOutcome, TeamLevel } from "./auth/types";
import { AUTH_REQUEST_TIMEOUT_MS, MAX_RECONNECT_ATTEMPTS, RECONNECT_RETRY_MS, REFRESH_RETRY_MS, emptyAuth, ownerAccess } from "./auth/constants";
import { clearStoredIdentity, readStoredIdentity, writeStoredIdentity } from "./auth/identity";
import { getIdentityFromJwt, getRefreshDelay } from "./auth/jwt";
import { installAuthInterceptors } from "./auth/interceptors";
import { fetchAccess, fetchCsrfToken, fetchPermissions, getBrowserPushSubscription, refreshSession } from "./auth/api";

// Tipos da equipa: continuam a sair daqui (useTeamAccess e outros importam-nos).
export type { AccessMember, AccessModule, TeamLevel } from "./auth/types";

const AuthContext = createContext<AuthCtx | null>(null);

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
    const uninstall = installAuthInterceptors({ authRef, supportActiveRef, navigateRef, doRefresh, endImpersonation });

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
      uninstall();
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

  const hasPermission = useCallback(
    (name: string) => auth.permissions.some((p) => p.name === name),
    [auth.permissions],
  );

  const can = useCallback(
    (key: string, level: TeamLevel = "view") => {
      // O dono pode sempre; um membro só o que a API lhe deu (folhas; um topo/agrupador = alguma folha debaixo).
      if (!auth.access.member) return true;
      return canFromGrants(auth.access.grants, key, level);
    },
    [auth.access],
  );

  const scopeOf = useCallback(
    (leaf: string): TeamScope => (auth.access.member ? grantScope(auth.access.grants, leaf) : "todos"),
    [auth.access],
  );
  const scopeOfAll = useCallback(
    (leaves: readonly string[]): TeamScope => (auth.access.member ? grantScopeAll(auth.access.grants, leaves) : "todos"),
    [auth.access],
  );

  const refreshAccess = useCallback(async () => {
    const token = authRef.current.accessToken;
    if (!token || supportActiveRef.current) return;
    const access = await fetchAccess(token);
    setAuth((prev) => (prev.accessToken ? { ...prev, access } : prev));
  }, []);

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
        hasPermission,
        member: auth.access.member,
        isMember: !!auth.access.member,
        can,
        scopeOf,
        scopeOfAll,
        staffId: auth.access.staffId,
        refreshAccess,
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
