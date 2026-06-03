import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
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

// Parse JWT expiry (epoch ms)
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

  const scheduleRefresh = useCallback((accessToken: string, refreshToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const expiry = getJwtExpiry(accessToken)
    const delay = expiry - Date.now() - 60_000 // 1 min before expiry
    if (delay <= 0) return

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await postUsersRefresh({ refreshToken })
        const newToken = res?.accessToken
        if (!newToken) return
        setAuth((prev) => {
          const next = { ...prev, accessToken: newToken }
          saveToStorage(next)
          return next
        })
        scheduleRefresh(newToken, refreshToken)
      } catch {
        // Refresh failed silently — user stays logged in until a 401 forces logout
      }
    }, delay)
  }, [])

  // On mount — re-schedule refresh if we have stored tokens
  useEffect(() => {
    if (auth.accessToken && auth.refreshToken) {
      scheduleRefresh(auth.accessToken, auth.refreshToken)
    }
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      // Use Kubb-generated function — no direct axios
      const loginRes = await postUsersLogin({ username, password })
      const { accessToken, refreshToken, userId, username: uname } = loginRes ?? {}
      if (!accessToken) throw new Error('Sem token de acesso')

      // Fetch permissions using Kubb-generated function
      const perms = await getUserpermissions({
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const permissions: Permission[] = perms ?? []

      const next: AuthState = {
        accessToken,
        refreshToken: refreshToken ?? null,
        userId: userId ?? null,
        username: uname ?? null,
        permissions,
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

  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    // Best-effort server logout using Kubb-generated function
    if (auth.accessToken) {
      postUsersLogout({
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      }).catch(() => {})
    }
    setAuth({ accessToken: null, refreshToken: null, userId: null, username: null, permissions: [] })
    clearStorage()
  }, [auth.accessToken])

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
