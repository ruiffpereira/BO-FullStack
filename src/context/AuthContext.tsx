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
import { getCsrfToken } from "../gen/backoffice/hooks/useGetCsrfToken.js";
import { postUsersLogin } from "../gen/backoffice/hooks/usePostUsersLogin.js";
import { getUserpermissions } from "../gen/backoffice/hooks/useGetUserpermissions.js";
import type { GetUserpermissions200 } from "../gen/backoffice/types/GetUserpermissions.js";

type Permission = GetUserpermissions200[number];

interface AuthState {
  userId: string | null;
  username: string | null;
  accessToken: string | null;
  permissions: Permission[];
  isAuthenticated: boolean;
}

interface AuthCtx extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authHeader: () => Record<string, string>;
  hasPermission: (name: string) => boolean;
  loading: boolean;
  loggingOut: boolean;
  error: string | null;
  initializing: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

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

const emptyAuth: AuthState = {
  userId: null,
  username: null,
  accessToken: null,
  permissions: [],
  isAuthenticated: false,
};

function readStoredIdentity(): {
  userId: string | null;
  username: string | null;
} {
  if (typeof window === "undefined") return { userId: null, username: null };
  try {
    const raw = window.localStorage.getItem(AUTH_IDENTITY_STORAGE_KEY);
    if (!raw) return { userId: null, username: null };
    const parsed = JSON.parse(raw) as { userId?: unknown; username?: unknown };
    return {
      userId:
        typeof parsed.userId === "string" && parsed.userId.trim()
          ? parsed.userId
          : null,
      username:
        typeof parsed.username === "string" && parsed.username.trim()
          ? parsed.username
          : null,
    };
  } catch {
    return { userId: null, username: null };
  }
}

function writeStoredIdentity(identity: {
  userId: string | null;
  username: string | null;
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
} {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return { userId: null, username: null };

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
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const doRefreshRef = useRef<(() => Promise<string | null>) | null>(null);
  const authRef = useRef<AuthState>(emptyAuth);
  const authVersionRef = useRef(0);
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
  }, []);

  // Arms a single timer that funnels through doRefresh(), so the scheduled
  // refresh and a 401-triggered refresh can never hit /users/refresh at the
  // same time (which, with refresh-token rotation, would log the user out).
  const scheduleRefresh = useCallback((accessToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void doRefreshRef.current?.();
    }, getRefreshDelay(accessToken));
  }, []);

  // Single source of truth for refreshing the session. Guarded by
  // refreshPromiseRef so concurrent callers share one in-flight request.
  const doRefresh = useCallback((): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const refreshVersion = authVersionRef.current;
    refreshPromiseRef.current = (async () => {
      try {
        const nextAccessToken = await refreshSession();
        // Hard 401 → refresh token is dead, end the session for good.
        if (!nextAccessToken) {
          if (refreshVersion === authVersionRef.current) clearSession();
          return null;
        }
        // Session changed under us (login/logout) → discard this result.
        if (refreshVersion !== authVersionRef.current) return null;

        const permissions = await fetchPermissions(nextAccessToken);
        if (refreshVersion !== authVersionRef.current) return null;

        const identity = getIdentityFromJwt(nextAccessToken);
        const storedIdentity = readStoredIdentity();
        const nextIdentity = {
          userId: identity.userId ?? storedIdentity.userId,
          username: identity.username ?? storedIdentity.username,
        };
        writeStoredIdentity(nextIdentity);
        setAuth((prev) => ({
          ...prev,
          userId: prev.userId ?? nextIdentity.userId,
          username: prev.username ?? nextIdentity.username,
          accessToken: nextAccessToken,
          permissions,
          isAuthenticated: true,
        }));
        scheduleRefresh(nextAccessToken);
        return nextAccessToken;
      } catch {
        // Network/permissions hiccup (not a 401) — keep the session and
        // retry shortly instead of logging the user out.
        if (refreshVersion === authVersionRef.current) {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(() => {
            void doRefreshRef.current?.();
          }, REFRESH_RETRY_MS);
        }
        return null;
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

        if (is401 && !skipRefresh && !err.config?._retry) {
          const nextAccessToken = await doRefresh();
          if (nextAccessToken) {
            err.config._retry = true;
            err.config.withCredentials = true;
            err.config.headers = err.config.headers ?? {};
            err.config.headers.Authorization = `Bearer ${nextAccessToken}`;
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

        return Promise.reject(err);
      },
    );

    doRefresh().finally(() => setInitializing(false));

    return () => {
      axiosInstance.interceptors.request.eject(reqId);
      axiosInstance.interceptors.response.eject(resId);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [doRefresh]);

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
        const identity = {
          userId: loginRes?.userId ?? null,
          username: loginRes?.username ?? username,
        };
        writeStoredIdentity(identity);

        setAuth({
          userId: identity.userId,
          username: identity.username,
          accessToken,
          permissions,
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
  }, [clearSession, scheduleRefresh]);

  const authHeader = useCallback(() => {
    const token = authRef.current.accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const hasPermission = useCallback(
    (name: string) => auth.permissions.some((p) => p.name === name),
    [auth.permissions],
  );

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        login,
        logout,
        authHeader,
        hasPermission,
        loading,
        loggingOut,
        error,
        initializing,
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
