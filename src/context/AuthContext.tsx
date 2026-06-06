import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { queryClient } from "../lib/queryClient";
import { postUsersLogin } from "../gen/backoffice/hooks/usePostUsersLogin.js";
import { postUsersRefresh } from "../gen/backoffice/hooks/usePostUsersRefresh.js";
import { postUsersLogout } from "../gen/backoffice/hooks/usePostUsersLogout.js";
import { getUserpermissions } from "../gen/backoffice/hooks/useGetUserpermissions.js";
import type { GetUserpermissions200 } from "../gen/backoffice/types/GetUserpermissions.js";

type Permission = GetUserpermissions200[number];

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  username: string | null;
  permissions: Permission[];
}

interface AuthCtx extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  authHeader: () => { Authorization: string };
  hasPermission: (name: string) => boolean;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthCtx | null>(null);

const STORAGE_KEY = "bo_auth";
const SKIP_401 = [
  "/users/login",
  "/users/refresh",
  "/users/logout",
  "/users/setup-password",
];

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    accessToken: null,
    refreshToken: null,
    userId: null,
    username: null,
    permissions: [],
  };
}

function saveToStorage(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function getJwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000;
  } catch {
    return 0;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadFromStorage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutRef = useRef<() => void>(() => {});
  const isRefreshingRef = useRef(false);

  const clearSession = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setAuth({
      accessToken: null,
      refreshToken: null,
      userId: null,
      username: null,
      permissions: [],
    });
    clearStorage();
    queryClient.clear();
  }, []);

  const logout = useCallback(() => {
    const refreshToken = auth.refreshToken;
    clearSession();
    if (refreshToken) postUsersLogout({ refreshToken }).catch(() => {});
  }, [auth.refreshToken, clearSession]);

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  // ─── Token refresh ─────────────────────────────────────────────────────────
  const scheduleRefresh = useCallback(
    (accessToken: string, refreshToken: string) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const expiry = getJwtExpiry(accessToken);
      const delay = expiry - Date.now() - 60_000;
      if (delay <= 0) return;

      refreshTimerRef.current = setTimeout(async () => {
        try {
          const res = await postUsersRefresh({ refreshToken });
          const newToken = res?.accessToken;
          if (!newToken) {
            clearSession();
            return;
          }
          setAuth((prev) => {
            const next = { ...prev, accessToken: newToken };
            saveToStorage(next);
            return next;
          });
          scheduleRefresh(newToken, refreshToken);
        } catch {
          clearSession();
        }
      }, delay);
    },
    [clearSession],
  );

  // Eagerly refresh when token is about to expire (handles mobile/background tabs)
  const tryRefreshNow = useCallback(async () => {
    if (isRefreshingRef.current) return;
    const stored = loadFromStorage();
    if (!stored.accessToken || !stored.refreshToken) return;
    const expiry = getJwtExpiry(stored.accessToken);
    if (expiry - Date.now() > 90_000) return; // Still fresh, no need

    isRefreshingRef.current = true;
    try {
      const res = await postUsersRefresh({ refreshToken: stored.refreshToken });
      const newToken = res?.accessToken;
      if (!newToken) {
        clearSession();
        return;
      }
      setAuth((prev) => {
        const next = { ...prev, accessToken: newToken };
        saveToStorage(next);
        return next;
      });
      scheduleRefresh(newToken, stored.refreshToken);
    } catch {
      clearSession();
    } finally {
      isRefreshingRef.current = false;
    }
  }, [clearSession, scheduleRefresh]);

  // Re-schedule on mount + handle page visibility (fixes mobile Chrome)
  useEffect(() => {
    if (auth.accessToken && auth.refreshToken) {
      scheduleRefresh(auth.accessToken, auth.refreshToken);
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tryRefreshNow();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [tryRefreshNow]);

  // ─── Axios 401 interceptor ─────────────────────────────────────────────────
  useEffect(() => {
    const id = axiosInstance.interceptors.response.use(
      (res) => res,
      async (err) => {
        const url: string = err?.config?.url ?? "";
        const is401 = err?.response?.status === 401;
        const isAuthEndpoint = SKIP_401.some((path) => url.includes(path));

        if (is401 && !isAuthEndpoint) {
          // Try to refresh before logging out
          if (!isRefreshingRef.current) {
            isRefreshingRef.current = true;
            try {
              const stored = loadFromStorage();
              if (stored.refreshToken) {
                const res = await postUsersRefresh({
                  refreshToken: stored.refreshToken,
                });
                const newToken = res?.accessToken;
                if (newToken) {
                  setAuth((prev) => {
                    const next = { ...prev, accessToken: newToken };
                    saveToStorage(next);
                    return next;
                  });
                  scheduleRefresh(newToken, stored.refreshToken);
                  // Retry original request with new token
                  err.config.headers.Authorization = `Bearer ${newToken}`;
                  isRefreshingRef.current = false;
                  return axiosInstance(err.config);
                }
              }
            } catch {
              // Fall through to logout
            } finally {
              isRefreshingRef.current = false;
            }
          }
          logoutRef.current();
        }
        return Promise.reject(err);
      },
    );
    return () => axiosInstance.interceptors.response.eject(id);
  }, [scheduleRefresh]);

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (username: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const loginRes = await postUsersLogin({ username, password });
        const {
          accessToken,
          refreshToken,
          userId,
          username: uname,
        } = loginRes ?? {};
        if (!accessToken) throw new Error("Sem token de acesso");

        const perms = await getUserpermissions({
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const next: AuthState = {
          accessToken,
          refreshToken: refreshToken ?? null,
          userId: userId ?? null,
          username: uname ?? null,
          permissions: perms ?? [],
        };
        setAuth(next);
        saveToStorage(next);
        scheduleRefresh(accessToken, refreshToken ?? "");
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          err?.message ??
          "Credenciais inválidas.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [scheduleRefresh],
  );

  const authHeader = useCallback(
    () => ({
      Authorization: `Bearer ${auth.accessToken}`,
    }),
    [auth.accessToken],
  );

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
