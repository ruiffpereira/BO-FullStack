import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { queryClient } from "../lib/queryClient";
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
  logout: () => void;
  authHeader: () => Record<string, string>;
  hasPermission: (name: string) => boolean;
  loading: boolean;
  error: string | null;
  initializing: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
const SKIP_401 = [
  "/csrf-token",
  "/users/login",
  "/users/refresh",
  "/users/logout",
  "/users/setup-password",
];

const REFRESH_FALLBACK_MS = 10 * 60 * 1000;
const REFRESH_SKEW_MS = 60 * 1000;

const emptyAuth: AuthState = {
  userId: null,
  username: null,
  accessToken: null,
  permissions: [],
  isAuthenticated: false,
};

function isAuthEndpoint(url = "") {
  return SKIP_401.some((path) => url.includes(path));
}

function getJwtExpiry(accessToken: string): number | null {
  const [, payload] = accessToken.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized));
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function getRefreshDelay(accessToken: string) {
  const expiry = getJwtExpiry(accessToken);
  if (!expiry) return REFRESH_FALLBACK_MS;
  return Math.max(expiry - Date.now() - REFRESH_SKEW_MS, 30 * 1000);
}

async function fetchCsrfToken(): Promise<string> {
  const csrf = await getCsrfToken();
  if (!csrf?.csrfToken) throw new Error("CSRF token em falta.");
  return csrf.csrfToken;
}

async function fetchPermissions(accessToken: string): Promise<Permission[]> {
  return getUserpermissions({
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function refreshSession(): Promise<string | null> {
  const csrfToken = await fetchCsrfToken();
  const res = await axiosInstance.post<{ accessToken?: string }>(
    "/users/refresh",
    undefined,
    {
      headers: { "x-csrf-token": csrfToken },
      validateStatus: (status) => (status >= 200 && status < 300) || status === 401,
      withCredentials: true,
    },
  );

  if (res.status === 401) return null;
  return res.data?.accessToken ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(emptyAuth);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const authRef = useRef<AuthState>(emptyAuth);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  const clearSession = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
    refreshPromiseRef.current = null;
    setAuth(emptyAuth);
    queryClient.clear();
  }, []);

  const scheduleRefresh = useCallback((accessToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const nextAccessToken = await refreshSession();
        if (!nextAccessToken) {
          clearSession();
          return;
        }
        const permissions = await fetchPermissions(nextAccessToken);
        setAuth((prev) => ({
          ...prev,
          accessToken: nextAccessToken,
          permissions,
          isAuthenticated: true,
        }));
        scheduleRefresh(nextAccessToken);
      } catch {
        clearSession();
      }
    }, getRefreshDelay(accessToken));
  }, [clearSession]);

  const doRefresh = useCallback((): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      try {
        const nextAccessToken = await refreshSession();
        if (!nextAccessToken) {
          clearSession();
          return null;
        }
        const permissions = await fetchPermissions(nextAccessToken);
        setAuth((prev) => ({
          ...prev,
          accessToken: nextAccessToken,
          permissions,
          isAuthenticated: true,
        }));
        scheduleRefresh(nextAccessToken);
        return nextAccessToken;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [clearSession, scheduleRefresh]);

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
        const loginRes = await postUsersLogin({ username, password });
        const accessToken = loginRes?.accessToken;
        if (!accessToken) throw new Error("Sem token de acesso.");

        const permissions = await fetchPermissions(accessToken);

        setAuth({
          userId: loginRes?.userId ?? null,
          username: loginRes?.username ?? username,
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
    clearSession();
    try {
      const csrfToken = await fetchCsrfToken();
      await axiosInstance.post(
        "/users/logout",
        undefined,
        {
          headers: {
            "x-csrf-token": csrfToken,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          withCredentials: true,
        },
      );
    } catch {
      // The client session is already cleared.
    }
  }, [clearSession]);

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
