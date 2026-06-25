import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '../ui/icons.jsx'
import { IconButton, Avatar } from '../ui/ui.jsx'
import { useAuth } from '../context/AuthContext'
import { NotificationBell } from './NotificationBell'
import { useSSE } from '../hooks/useSSE'

const PERM_TO_PATH: Record<string, string | string[]> = {
  VIEW_STATS:     '/financeiro',
  VIEW_EXPENSES:  '/despesas',
  VIEW_CUSTOMERS: '/clientes',
  VIEW_PRODUCTS:  '/loja',
  VIEW_SCHEDULE:  '/agenda',
  VIEW_GYM:       ['/ginasio', '/financeiro'],
  VIEW_CMS:       '/conteudos',
  VIEW_ADMIN:     '/admin',
}

const ROUTE_META: Record<string, { nome: string; icon: string }> = {
  '/dashboard':         { nome: 'Dashboard',  icon: 'dashboard' },
  '/financeiro':        { nome: 'Financeiro', icon: 'euro' },
  '/despesas':          { nome: 'Despesas',   icon: 'card' },
  '/clientes':          { nome: 'Clientes',   icon: 'users' },
  '/loja':              { nome: 'Loja',       icon: 'store' },
  '/agenda':            { nome: 'Agenda',     icon: 'calendar' },
  '/ginasio':           { nome: 'Ginásio',    icon: 'trend' },
  '/conteudos':         { nome: 'Conteúdos',  icon: 'layers' },
  '/admin':             { nome: 'Admin',      icon: 'shield' },
}

interface Props {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  children: React.ReactNode
}

function NavItem({ path, active, collapsed }: { path: string; active: boolean; collapsed: boolean }) {
  const meta = ROUTE_META[path]
  const navigate = useNavigate()
  if (!meta) return null
  return (
    <button
      onClick={() => navigate(path)}
      title={collapsed ? meta.nome : undefined}
      className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'} ${active ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-accent" />}
      <Icon name={meta.icon} className="w-[19px] h-[19px] shrink-0" strokeWidth={active ? 2 : 1.75} />
      {!collapsed && <span>{meta.nome}</span>}
    </button>
  )
}

function SidebarContent({ accessiblePaths, collapsed, onLogout }: {
  accessiblePaths: string[]
  collapsed: boolean
  onLogout: () => void
}) {
  const { userId, username, permissions, loggingOut } = useAuth()
  const location = useLocation()
  const permLabel = permissions.length > 0 ? permissions[0].name?.replace('VIEW_', '') : 'Admin'

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2.5 h-16 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
        {/* Logo RV — marca sem fundo, maior */}
        <img src="/icons/logo.svg" alt="Backoffice" className={`${collapsed ? 'h-7' : 'h-8'} w-auto shrink-0`} />
        {!collapsed && <span className="font-semibold text-[17px] tracking-tight text-zinc-900 dark:text-white">Backoffice</span>}
      </div>

      <div className={`mt-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Menu</p>}
        <nav className="space-y-1">
          {accessiblePaths.map((path) => (
            <NavItem key={path} path={path} active={location.pathname === path} collapsed={collapsed} />
          ))}
        </nav>
      </div>

      <div className={`mt-auto ${collapsed ? 'px-2' : 'px-3'} pb-3`}>
        {!collapsed && (
          <div className="mb-2 mx-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs font-medium text-zinc-500">Sessão activa</span>
            </div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-1">{username ?? userId ?? 'Sessão recuperada'}</p>
            <p className="text-xs text-zinc-400">{permLabel}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          disabled={loggingOut}
          title={collapsed ? 'Sair' : undefined}
          className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-wait disabled:hover:bg-transparent disabled:hover:text-zinc-600 dark:disabled:hover:text-zinc-400 transition-colors ${collapsed ? 'justify-center py-2.5' : 'px-3 py-2.5'}`}
        >
          <Icon name="logout" className="w-[19px] h-[19px] shrink-0" />
          {!collapsed && <span>{loggingOut ? 'A sair...' : 'Terminar sessão'}</span>}
        </button>
      </div>
    </div>
  )
}

function Topbar({ theme, onToggleTheme, onMenu, onCollapse }: {
  theme: string; onToggleTheme: () => void
  onMenu: () => void; onCollapse: () => void
}) {
  const { username } = useAuth()
  const location = useLocation()
  const title = ROUTE_META[location.pathname]?.nome ?? ''

  return (
    <header className="h-16 shrink-0 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6">
      <button onClick={onMenu} className="lg:hidden -ml-1">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Icon name="menu" className="w-[18px] h-[18px]" />
        </span>
      </button>
      <button onClick={onCollapse} className="hidden lg:inline-flex">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Icon name="menu" className="w-[18px] h-[18px]" />
        </span>
      </button>

      <div className="hidden sm:block">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white capitalize">{title}</h2>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <NotificationBell />
        <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} onClick={onToggleTheme} label="Tema" />
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-0.5 hidden sm:block" />
        <Avatar name={username ?? '?'} color="#2A6FDB" size={34} />
      </div>
    </header>
  )
}

function SwRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}

export function Shell({ theme, onToggleTheme, children }: Props) {
  const { logout, permissions } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Start SSE stream for real-time events
  useSSE()

  const handleLogout = () => {
    logout().catch((err: any) => {
      toast.error(
        err?.response?.data?.error ??
        err?.response?.data?.message ??
        err?.message ??
        'Nao foi possivel terminar sessao.',
      )
    })
  }

  const accessiblePaths = [
    '/dashboard',
    ...permissions
      .flatMap((p) => {
        const v = PERM_TO_PATH[p.name ?? '']
        return Array.isArray(v) ? v : v ? [v] : []
      })
      .filter((v, i, arr) => arr.indexOf(v) === i),
  ]

  // Fecha o drawer ao navegar
  useEffect(() => { setDrawer(false) }, [location.pathname])

  // Redirige para rota acessível se a actual não o for
  useEffect(() => {
    if (accessiblePaths.length && !accessiblePaths.includes(location.pathname)) {
      navigate(accessiblePaths[0], { replace: true })
    }
  }, [location.pathname, permissions]) // eslint-disable-line

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      <SwRegistrar />
      <aside className={`hidden lg:flex flex-col shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        <SidebarContent accessiblePaths={accessiblePaths} collapsed={collapsed} onLogout={handleLogout} />
      </aside>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <aside className="relative w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 animate-[slideIn_.2s_ease]">
            <IconButton
              icon="x"
              label="Fechar"
              onClick={() => setDrawer(false)}
              className="absolute top-4 right-3 z-10"
            />
            <SidebarContent accessiblePaths={accessiblePaths} collapsed={false} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          theme={theme}
          onToggleTheme={onToggleTheme}
          onMenu={() => setDrawer(true)}
          onCollapse={() => setCollapsed(!collapsed)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
