import { useState, useEffect } from 'react'
import { Icon } from '../ui/icons.jsx'
import { IconButton, Avatar } from '../ui/ui.jsx'
import { useAuth } from '../context/AuthContext'

const ROUTE_META: Record<string, { nome: string; icon: string }> = {
  dashboard: { nome: 'Dashboard', icon: 'dashboard' },
  clientes:  { nome: 'Clientes',  icon: 'users' },
  loja:      { nome: 'Loja',      icon: 'store' },
  agenda:    { nome: 'Agenda',    icon: 'calendar' },
  admin:     { nome: 'Admin',     icon: 'shield' },
}

interface Props {
  route: string
  setRoute: (r: string) => void
  accessibleRoutes: string[]
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  children: React.ReactNode
}

function NavItem({ id, active, onClick, collapsed }: { id: string; active: boolean; onClick: () => void; collapsed: boolean }) {
  const meta = ROUTE_META[id]
  if (!meta) return null
  return (
    <button
      onClick={onClick}
      title={collapsed ? meta.nome : undefined}
      className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'} ${active ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-accent" />}
      <Icon name={meta.icon} className="w-[19px] h-[19px] shrink-0" strokeWidth={active ? 2 : 1.75} />
      {!collapsed && <span>{meta.nome}</span>}
    </button>
  )
}

function SidebarContent({ route, setRoute, accessibleRoutes, collapsed, onLogout }: {
  route: string; setRoute: (r: string) => void; accessibleRoutes: string[]
  collapsed: boolean; onLogout: () => void
}) {
  const { username, permissions } = useAuth()
  const permLabel = permissions.length > 0 ? permissions[0].name?.replace('VIEW_', '') : 'Admin'

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2.5 h-16 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-white shrink-0">
          <Icon name="layers" className="w-5 h-5" />
        </div>
        {!collapsed && <span className="font-semibold text-[17px] tracking-tight text-zinc-900 dark:text-white">Backoffice</span>}
      </div>

      <div className={`mt-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Menu</p>}
        <nav className="space-y-1">
          {accessibleRoutes.map((id) => (
            <NavItem key={id} id={id} active={route === id} onClick={() => setRoute(id)} collapsed={collapsed} />
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
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-1">{username ?? '—'}</p>
            <p className="text-xs text-zinc-400">{permLabel}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          title={collapsed ? 'Sair' : undefined}
          className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors ${collapsed ? 'justify-center py-2.5' : 'px-3 py-2.5'}`}
        >
          <Icon name="logout" className="w-[19px] h-[19px] shrink-0" />
          {!collapsed && <span>Terminar sessão</span>}
        </button>
      </div>
    </div>
  )
}

function Topbar({ title, theme, onToggleTheme, onMenu, onCollapse }: {
  title: string; theme: string; onToggleTheme: () => void
  onMenu: () => void; onCollapse: () => void; collapsed?: boolean
}) {
  const { username } = useAuth()
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
        <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} onClick={onToggleTheme} label="Tema" />
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-0.5 hidden sm:block" />
        <Avatar name={username ?? '?'} color="#2A6FDB" size={34} />
      </div>
    </header>
  )
}

export function Shell({ route, setRoute, accessibleRoutes, theme, onToggleTheme, children }: Props) {
  const { logout } = useAuth()
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => { setDrawer(false) }, [route])

  const activeTitle = ROUTE_META[route]?.nome ?? ''

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      <aside className={`hidden lg:flex flex-col shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        <SidebarContent route={route} setRoute={setRoute} accessibleRoutes={accessibleRoutes} collapsed={collapsed} onLogout={logout} />
      </aside>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <aside className="relative w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 animate-[slideIn_.2s_ease]">
            <button onClick={() => setDrawer(false)} className="absolute top-4 right-3 z-10">
              <IconButton icon="x" label="Fechar" />
            </button>
            <SidebarContent route={route} setRoute={setRoute} accessibleRoutes={accessibleRoutes} collapsed={false} onLogout={logout} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={activeTitle}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onMenu={() => setDrawer(true)}
          onCollapse={() => setCollapsed(!collapsed)}
          collapsed={collapsed}
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
