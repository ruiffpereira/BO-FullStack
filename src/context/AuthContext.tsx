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
  initializing: boolean;
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

// Treats unparseable tokens as expired. 5s margin to avoid using a token
// that's about to die mid-request.
function isExpired(token: string): boolean {
  return Date.now() >= getJwtExpiry(token) - 5_000;
}

// True only when the token is a JWT whose exp is already in the past.
// Opaque (non-JWT) tokens return false — we can't tell, so a refresh is worth trying.
// Used to skip a pointless silent-refresh (and its loading flash) when the
// refresh token is provably dead.
function isRefreshTokenDead(token: string): boolean {
  const exp = getJwtExpiry(token);
  if (!exp) return false; // not a JWT / no exp claim → can't decide
  return Date.now() >= exp;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // If the stored access token is already expired, don't expose it — otherwise
  // the app renders the authenticated UI and fires requests that all 401.
  const [auth, setAuth] = useState<AuthState>(() => {
    const stored = loadFromStorage();
    if (stored.accessToken && isExpired(stored.accessToken)) {
      return { ...stored, accessToken: null };
    }
    return stored;
  });
  // True while we attempt a silent refresh on startup (expired access token but
  // a refresh token is present). Prevents flashing the login screen.
  const [initializing, setInitializing] = useState<boolean>(() => {
    const stored = loadFromStorage();
    if (stored.accessToken && !isExpired(stored.accessToken)) return false;
    // Only show the loading state if there's a refresh token that might still work.
    // A provably-dead JWT refresh token goes straight to login (no flash).
    return !!stored.refreshToken && !isRefreshTokenDead(stored.refreshToken);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutRef = useRef<() => void>(() => {});
  // Shared refresh promise — deduplicates concurrent refresh attempts (fixes mobile race condition)
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

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

  // Shared refresh execution — all concurrent callers await the same promise
  const doRefresh = useCallback(
    (refreshToken: string): Promise<string | null> => {
      if (refreshPromiseRef.current) return refreshPromiseRef.current;

      refreshPromiseRef.current = (async () => {
        try {
          const res = await postUsersRefresh({ refreshToken });
          const newToken = res?.accessToken ?? null;
          if (!newToken) return null;
          setAuth((prev) => {
            const next = { ...prev, accessToken: newToken };
            saveToStorage(next);
            return next;
          });
          scheduleRefresh(newToken, refreshToken);
          return newToken;
        } catch {
          return null;
        } finally {
          refreshPromiseRef.current = null;
        }
      })();

      return refreshPromiseRef.current;
    },
    [scheduleRefresh],
  );

  // Eagerly refresh when token is about to expire (handles mobile/background tabs)
  const tryRefreshNow = useCallback(async () => {
    const stored = loadFromStorage();
    if (!stored.accessToken || !stored.refreshToken) return;
    const expiry = getJwtExpiry(stored.accessToken);
    if (expiry - Date.now() > 90_000) return; // Still fresh, no need

    const newToken = await doRefresh(stored.refreshToken);
    if (!newToken) clearSession();
  }, [clearSession, doRefresh]);

  // Re-schedule on mount + handle page visibility (fixes mobile Chrome)
  useEffect(() => {
    const stored = loadFromStorage();

    // Healthy session — just keep refreshing.
    if (
      stored.accessToken &&
      !isExpired(stored.accessToken) &&
      stored.refreshToken
    ) {
      scheduleRefresh(stored.accessToken, stored.refreshToken);
      setInitializing(false);
      return () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      };
    }

    // Access token expired/missing — try a silent refresh before showing any UI.
    if (stored.refreshToken && !isRefreshTokenDead(stored.refreshToken)) {
      doRefresh(stored.refreshToken)
        .then((tok) => {
          if (!tok) clearSession();
        })
        .finally(() => setInitializing(false));
    } else if (stored.accessToken || stored.userId || stored.refreshToken) {
      // Stale leftovers with no usable refresh token — wipe them and show login.
      clearSession();
      setInitializing(false);
    } else {
      setInitializing(false);
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

  // ─── Axios interceptors ────────────────────────────────────────────────────
  useEffect(() => {
    // Request: fix hardcoded baseURL in Kubb-generated hooks + attach token
    const reqId = axiosInstance.interceptors.request.use((config) => {
      config.baseURL =
        import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
      const url: string = config.url ?? "";
      const isAuthEndpoint = SKIP_401.some((path) => url.includes(path));
      if (!isAuthEndpoint && !config.headers.Authorization) {
        const stored = loadFromStorage();
        if (stored.accessToken) {
          config.headers.Authorization = `Bearer ${stored.accessToken}`;
        }
      }
      return config;
    });

    // Response: on 401 all concurrent requests await the same refresh promise,
    // then retry — none of them trigger logout prematurely
    const resId = axiosInstance.interceptors.response.use(
      (res) => res,
      async (err) => {
        const url: string = err?.config?.url ?? "";
        const is401 = err?.response?.status === 401;
        const isAuthEndpoint = SKIP_401.some((path) => url.includes(path));

        if (is401 && !isAuthEndpoint) {
          const stored = loadFromStorage();
          if (stored.refreshToken) {
            const newToken = await doRefresh(stored.refreshToken);
            if (newToken) {
              err.config.headers.Authorization = `Bearer ${newToken}`;
              return axiosInstance(err.config);
            }
          }
          logoutRef.current();
        }
        return Promise.reject(err);
      },
    );

    return () => {
      axiosInstance.interceptors.request.eject(reqId);
      axiosInstance.interceptors.response.eject(resId);
    };
  }, [doRefresh]);

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
