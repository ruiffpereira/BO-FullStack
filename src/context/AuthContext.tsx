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
import { postUsersLogin } from "../gen/backoffice/hooks/usePostUsersLogin.js";
import { postUsersLogout } from "../gen/backoffice/hooks/usePostUsersLogout.js";
import { getUserpermissions } from "../gen/backoffice/hooks/useGetUserpermissions.js";
import type { GetUserpermissions200 } from "../gen/backoffice/types/GetUserpermissions.js";

type Permission = GetUserpermissions200[number];

interface AuthState {
  userId: string | null;
  username: string | null;
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
  "/users/login",
  "/users/refresh",
  "/users/logout",
  "/users/setup-password",
];

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const emptyAuth: AuthState = {
  userId: null,
  username: null,
  permissions: [],
  isAuthenticated: false,
};

async function fetchPermissions(): Promise<Permission[]> {
  return getUserpermissions();
}

async function refreshSession(): Promise<boolean> {
  const res = await axiosInstance.post(
    "/users/refresh",
    undefined,
    {
      validateStatus: (status) => (status >= 200 && status < 300) || status === 401,
      withCredentials: true,
    },
  );
  return res.status >= 200 && res.status < 300;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(emptyAuth);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);
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

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const refreshed = await refreshSession();
        if (!refreshed) {
          clearSession();
          return;
        }
        const permissions = await fetchPermissions();
        setAuth((prev) => ({ ...prev, permissions, isAuthenticated: true }));
        scheduleRefresh();
      } catch {
        clearSession();
      }
    }, REFRESH_INTERVAL_MS);
  }, [clearSession]);

  const doRefresh = useCallback((): Promise<boolean> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      try {
        const refreshed = await refreshSession();
        if (!refreshed) {
          clearSession();
          return false;
        }
        const permissions = await fetchPermissions();
        setAuth((prev) => ({
          ...prev,
          permissions,
          isAuthenticated: true,
        }));
        scheduleRefresh();
        return true;
      } catch {
        clearSession();
        return false;
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
      return config;
    });

    const resId = axiosInstance.interceptors.response.use(
      (res) => res,
      async (err) => {
        const url = err?.config?.url ?? "";
        const is401 = err?.response?.status === 401;
        const isAuthEndpoint = SKIP_401.some((path) => url.includes(path));

        if (is401 && !isAuthEndpoint && !err.config?._retry) {
          const refreshed = await doRefresh();
          if (refreshed) {
            err.config._retry = true;
            err.config.withCredentials = true;
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
        const permissions = await fetchPermissions();

        setAuth({
          userId: loginRes?.userId ?? null,
          username: loginRes?.username ?? username,
          permissions,
          isAuthenticated: true,
        });
        scheduleRefresh();
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

  const logout = useCallback(() => {
    clearSession();
    postUsersLogout().catch(() => {});
  }, [clearSession]);

  const authHeader = useCallback(() => ({}), []);

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
