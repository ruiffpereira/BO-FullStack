import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { axiosInstance } from '@kubb/plugin-client/clients/axios'
import { queryClient } from '../lib/queryClient'
import { postUsersLogin } from '../gen/backoffice/hooks/usePostUsersLogin.js'
import { postUsersRefresh } from '../gen/backoffice/hooks/usePostUsersRefresh.js'
import { postUsersLogout } from '../gen/backoffice/hooks/usePostUsersLogout.js'
import { getUserpermissions } from '../gen/backoffice/hooks/useGetUserpermissions.js'
import type { GetUserpermissions200 } from '../gen/backoffice/types/GetUserpermissions.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type Permission = GetUserpermissions200[number]

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  userId: string | null
  username: string | null
  permissions: Permission[]
}

interface AuthCtx extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  authHeader: () => { Authorization: string }
  hasPermission: (name: string) => boolean
  loading: boolean
  error: string | null
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthCtx | null>(null)

const STORAGE_KEY = 'bo_auth'
const SKIP_401 = ['/users/login', '/users/refresh', '/users/logout']

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { accessToken: null, refreshToken: null, userId: null, username: null, permissions: [] }
}

function saveToStorage(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

function getJwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000
  } catch { return 0 }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadFromStorage)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref so the axios interceptor always has the latest logout without re-registering
  const logoutRef = useRef<() => void>(() => {})

  const clearSession = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    setAuth({ accessToken: null, refreshToken: null, userId: null, username: null, permissions: [] })
    clearStorage()
    queryClient.clear()
  }, [])

  const logout = useCallback(() => {
    const token = auth.accessToken
    clearSession()
    if (token) {
      postUsersLogout({ headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
  }, [auth.accessToken, clearSession])

  // Keep the ref in sync so the interceptor always calls the latest logout
  useEffect(() => { logoutRef.current = logout }, [logout])

  // ─── Axios 401 interceptor ─────────────────────────────────────────────────
  useEffect(() => {
    const id = axiosInstance.interceptors.response.use(
      (res) => res,
      (err) => {
        const url: string = err?.config?.url ?? ''
        const is401 = err?.response?.status === 401
        const isAuthEndpoint = SKIP_401.some((path) => url.includes(path))
        if (is401 && !isAuthEndpoint) {
          logoutRef.current()
        }
        return Promise.reject(err)
      },
    )
    return () => axiosInstance.interceptors.response.eject(id)
  }, [])

  // ─── Token refresh scheduler ───────────────────────────────────────────────
  const scheduleRefresh = useCallback((accessToken: string, refreshToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const expiry = getJwtExpiry(accessToken)
    const delay = expiry - Date.now() - 60_000
    if (delay <= 0) return

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await postUsersRefresh({ refreshToken })
        const newToken = res?.accessToken
        if (!newToken) { clearSession(); return }
        setAuth((prev) => {
          const next = { ...prev, accessToken: newToken }
          saveToStorage(next)
          return next
        })
        scheduleRefresh(newToken, refreshToken)
      } catch {
        // Refresh token inválido → terminar sessão
        clearSession()
      }
    }, delay)
  }, [clearSession])

  // Re-schedule on mount if stored tokens exist
  useEffect(() => {
    if (auth.accessToken && auth.refreshToken) {
      scheduleRefresh(auth.accessToken, auth.refreshToken)
    }
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (username: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const loginRes = await postUsersLogin({ username, password })
      const { accessToken, refreshToken, userId, username: uname } = loginRes ?? {}
      if (!accessToken) throw new Error('Sem token de acesso')

      const perms = await getUserpermissions({
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const next: AuthState = {
        accessToken,
        refreshToken: refreshToken ?? null,
        userId: userId ?? null,
        username: uname ?? null,
        permissions: perms ?? [],
      }
      setAuth(next)
      saveToStorage(next)
      scheduleRefresh(accessToken, refreshToken ?? '')
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Credenciais inválidas.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [scheduleRefresh])

  const authHeader = useCallback(() => ({
    Authorization: `Bearer ${auth.accessToken}`,
  }), [auth.accessToken])

  const hasPermission = useCallback((name: string) =>
    auth.permissions.some((p) => p.name === name),
  [auth.permissions])

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, authHeader, hasPermission, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
