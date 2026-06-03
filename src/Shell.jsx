import React from 'react';
import { Icon } from './icons.jsx';
import { IconButton, Avatar } from './ui.jsx';

// ----------------------------------------------------------------------------
// Shell — sidebar (desktop) / drawer (mobile) + topbar. Permission-aware nav.
// ----------------------------------------------------------------------------
const { useState: useStateShell, useEffect: useEffectShell } = React;

function NavItem({ comp, active, onClick, collapsed }) {
  return (
    <button onClick={onClick} title={collapsed ? comp.nome : undefined}
      className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'} ${active ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-accent" />}
      <Icon name={comp.icon} className="w-[19px] h-[19px] shrink-0" strokeWidth={active ? 2 : 1.75} />
      {!collapsed && <span>{comp.nome}</span>}
    </button>
  );
}

function SidebarContent({ comps, route, setRoute, perfil, collapsed, onLogout }) {
  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2.5 h-16 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-white shrink-0"><Icon name="layers" className="w-5 h-5" /></div>
        {!collapsed && <span className="font-semibold text-[17px] tracking-tight text-zinc-900 dark:text-white">Backoffice</span>}
      </div>

      <div className={`mt-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Menu</p>}
        <nav className="space-y-1">
          {comps.map((c) => <NavItem key={c.id} comp={c} active={route === c.id} onClick={() => setRoute(c.id)} collapsed={collapsed} />)}
        </nav>
      </div>

      <div className={`mt-auto ${collapsed ? 'px-2' : 'px-3'} pb-3`}>
        {!collapsed && (
          <div className="mb-2 mx-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: perfil.cor }} />
              <span className="text-xs font-medium text-zinc-500">Permissão ativa</span>
            </div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-1">{perfil.nome}</p>
          </div>
        )}
        <button onClick={onLogout} title={collapsed ? 'Sair' : undefined}
          className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors ${collapsed ? 'justify-center py-2.5' : 'px-3 py-2.5'}`}>
          <Icon name="logout" className="w-[19px] h-[19px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}

function Topbar({ title, perfil, perfis, onSwitchPerfil, theme, onToggleTheme, onMenu, onCollapse, collapsed }) {
  const [open, setOpen] = useStateShell(false);
  const [menuOpen, setMenuOpen] = useStateShell(false);
  useEffectShell(() => {
    const h = () => { setOpen(false); setMenuOpen(false); };
    if (open || menuOpen) { window.addEventListener('click', h); return () => window.removeEventListener('click', h); }
  }, [open, menuOpen]);

  return (
    <header className="h-16 shrink-0 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6">
      <button onClick={onMenu} className="lg:hidden -ml-1"><span className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Icon name="menu" className="w-[18px] h-[18px]" /></span></button>
      <button onClick={onCollapse} className="hidden lg:inline-flex"><span className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Icon name="menu" className="w-[18px] h-[18px]" /></span></button>

      <div className="hidden sm:block">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white capitalize">{title}</h2>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <div className="relative hidden md:block">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" className="w-[18px] h-[18px]" /></span>
          <input placeholder="Procurar…" className="w-40 lg:w-56 bg-zinc-100 dark:bg-zinc-800/70 rounded-lg text-sm pl-9 pr-3 py-2 border border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400" />
        </div>

        {/* Ver como (perfil switcher) */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-sm">
            <Icon name="eye" className="w-4 h-4 text-zinc-400" />
            <span className="hidden sm:inline text-zinc-600 dark:text-zinc-300">Ver como</span>
            <span className="w-2 h-2 rounded-full" style={{ background: perfil.cor }} />
            <Icon name="chevronDown" className="w-3.5 h-3.5 text-zinc-400" />
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg p-1.5 animate-[pop_.15s_ease] z-40">
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Pré-visualizar permissão</p>
              {perfis.map((p) => (
                <button key={p.id} onClick={() => { onSwitchPerfil(p); setOpen(false); }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition ${p.id === perfil.id ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}`}>
                  <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs shrink-0" style={{ background: p.cor }}><Icon name="user" className="w-3.5 h-3.5" /></span>
                  <span className="text-left min-w-0">
                    <span className="block text-zinc-800 dark:text-zinc-100 font-medium truncate">{p.nome}</span>
                    <span className="block text-xs text-zinc-400">{p.componentes.length} componentes</span>
                  </span>
                  {p.id === perfil.id && <Icon name="check" className="w-4 h-4 text-accent ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} onClick={onToggleTheme} label="Tema" />
        <button className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Notificações"><Icon name="bell" className="w-[18px] h-[18px]" /><span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent ring-2 ring-white dark:ring-zinc-950" /></button>
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-0.5 hidden sm:block" />
        <Avatar name={perfil.nome} color={perfil.cor} size={34} />
      </div>
    </header>
  );
}

function Shell({ comps, route, setRoute, perfil, perfis, onSwitchPerfil, theme, onToggleTheme, onLogout, children }) {
  const [drawer, setDrawer] = useStateShell(false);
  const [collapsed, setCollapsed] = useStateShell(false);
  useEffectShell(() => { setDrawer(false); }, [route]);
  const activeComp = comps.find((c) => c.id === route);

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        <SidebarContent comps={comps} route={route} setRoute={setRoute} perfil={perfil} collapsed={collapsed} onLogout={onLogout} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <aside className="relative w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 animate-[slideIn_.2s_ease]">
            <button onClick={() => setDrawer(false)} className="absolute top-4 right-3 z-10"><IconButton icon="x" label="Fechar" /></button>
            <SidebarContent comps={comps} route={route} setRoute={setRoute} perfil={perfil} collapsed={false} onLogout={onLogout} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={activeComp ? activeComp.nome : ''} perfil={perfil} perfis={perfis} onSwitchPerfil={onSwitchPerfil} theme={theme} onToggleTheme={onToggleTheme} onMenu={() => setDrawer(true)} onCollapse={() => setCollapsed(!collapsed)} collapsed={collapsed} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export { Shell };
