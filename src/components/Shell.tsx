import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '../ui/icons.jsx'
import { IconButton, Avatar } from '../ui/ui.jsx'
import { useAuth } from '../context/AuthContext'
import { NotificationBell } from './NotificationBell'
import { ChatLauncher } from './chat/ChatLauncher'
import { ChatFab } from './chat/ChatFab'
import { BillingBanner } from './BillingBanner'
import { NavBadge } from './NavBadge'
import { useSSE } from '../hooks/useSSE'
import { useChatUnread } from '../hooks/useChat'
import { SUBMENU, allowedSubitems, findRoot, type SubmenuItem } from '../lib/navigation'

// Core: todos os tenants têm (sem permissão). Módulos: por permissão.
const CORE_PATHS = ['/clientes', '/mensagens', '/financeiro', '/conteudos', '/estatisticas', '/faturacao', '/website']
const MODULE_PERM_TO_PATH: Record<string, string> = {
  VIEW_SCHEDULE:  '/agenda',
  VIEW_PRODUCTS:  '/loja',
  VIEW_GYM:       '/ginasio',
}

// Ordem fixa de apresentação na sidebar (independente de core/módulos/admin).
// Cada item só aparece se for acessível ao tenant (permissões + admin).
const MENU_ORDER = ['/dashboard', '/estatisticas', '/admin', '/clientes', '/mensagens', '/conteudos', '/website', '/loja', '/agenda', '/ginasio', '/financeiro', '/faturacao']

const ROUTE_META: Record<string, { nome: string; icon: string }> = {
  '/dashboard':         { nome: 'Dashboard',  icon: 'dashboard' },
  '/estatisticas':      { nome: 'Estatísticas', icon: 'trend' },
  '/financeiro':        { nome: 'Financeiro', icon: 'euro' },
  '/faturacao':         { nome: 'Faturação',  icon: 'card' },
  '/despesas':          { nome: 'Despesas',   icon: 'card' },
  '/clientes':          { nome: 'Clientes',   icon: 'users' },
  '/mensagens':         { nome: 'Mensagens',  icon: 'message' },
  '/loja':              { nome: 'Loja',       icon: 'store' },
  '/agenda':            { nome: 'Agenda',     icon: 'calendar' },
  '/ginasio':           { nome: 'Ginásio',    icon: 'trend' },
  '/conteudos':         { nome: 'Conteúdos',  icon: 'layers' },
  '/website':           { nome: 'Website',    icon: 'globe' },
  '/admin':             { nome: 'Admin',      icon: 'shield' },
  // Fora da sidebar (acede-se pelo menu do avatar, AvatarMenu) — entrada só
  // para o título do topbar (resolveTopbarTitle) reconhecer a rota.
  '/perfil':            { nome: 'Perfil',     icon: 'user' },
}

interface Props {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  children: React.ReactNode
}

function NavItem({ path, active, collapsed, badge }: { path: string; active: boolean; collapsed: boolean; badge?: number }) {
  const meta = ROUTE_META[path]
  const navigate = useNavigate()
  if (!meta) return null
  const unread = badge ?? 0
  // Com não-lidas, o aria-label passa a incluir a contagem (lido pelo leitor de
  // ecrã em vez do texto visível) — nos dois modos, colapsado e expandido.
  const accessibleLabel = unread > 0 ? `${meta.nome}, ${unread} não lida${unread === 1 ? '' : 's'}` : undefined
  return (
    <button
      data-nav-focusable="true"
      onClick={() => navigate(path)}
      title={collapsed ? (accessibleLabel ?? meta.nome) : undefined}
      aria-label={accessibleLabel}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'} ${active ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-accent" />}
      <span className="relative inline-flex shrink-0">
        <Icon name={meta.icon} className="w-[19px] h-[19px]" strokeWidth={active ? 2 : 1.75} />
        {collapsed && <NavBadge count={unread} collapsed />}
      </span>
      {!collapsed && <span>{meta.nome}</span>}
      {!collapsed && <NavBadge count={unread} collapsed={false} />}
    </button>
  )
}

/**
 * Subitem partilhado entre o acordeão (sidebar expandida) e o flyout (sidebar
 * colapsada) — mesmo render, classes diferentes por `variant`. Centraliza a
 * política de acessibilidade: **só o subitem folha tem `aria-current="page"`**
 * (o botão-pai do grupo nunca tem — ver `NavItemGroup`).
 */
function SubmenuLink({
  item,
  active,
  onClick,
  variant,
  focusable,
}: {
  item: SubmenuItem
  active: boolean
  onClick: () => void
  variant: 'accordion' | 'flyout'
  /** Só usado no modo acordeão: focável (roving `[data-nav-focusable]`) só quando o pai está expandido. */
  focusable?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      data-nav-focusable={variant === 'accordion' && focusable ? 'true' : undefined}
      tabIndex={variant === 'accordion' ? (focusable ? 0 : -1) : undefined}
      className={
        variant === 'accordion'
          ? `w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${active ? 'text-accent bg-accent/10' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/70'}`
          : `w-full text-left px-3 py-2 text-sm transition-colors ${active ? 'text-accent bg-accent/10' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70'}`
      }
    >
      {item.label}
    </button>
  )
}

/**
 * Item de navegação expansível (T1.1) para páginas que absorveram as tabs de
 * topo para dentro do menu (piloto: Financeiro, T1.2). Dois modos distintos:
 *
 * - **Expandido** (`collapsed=false`, inclui o drawer mobile): `expanded` é
 *   derivado da rota ativa por omissão (`SidebarContent`, `expandedPath`),
 *   mas pode ser **manualmente colapsado** sem navegar — clicar num pai
 *   FECHADO navega para o 1.º subitem permitido (como sempre); clicar num pai
 *   EXPANDIDO chama `onToggleExpanded` (que a `SidebarContent` traduz num
 *   `collapsedOverride`) e fica fechado até a rota ativa mudar de grupo. Os
 *   subitens ficam indentados por baixo, e só existem no DOM quando
 *   `expanded` (render condicional, não CSS) — caso contrário os
 *   `SubmenuLink` de grupos fechados ficariam acessíveis via
 *   `getByRole`/roving tabindex ao mesmo tempo que os `NavItem` de módulo
 *   homónimos (ex.: "Loja"/"Agenda"/"Ginásio" dentro do Financeiro),
 *   duplicando o nome acessível na sidebar inteira.
 * - **Colapsado** (sidebar só-ícones, desktop): clicar OU passar o rato abre um
 *   flyout em portal (mesmo padrão do `Combobox`/`useAnchoredMenu`, mas
 *   ancorado à direita do ícone em vez de por baixo) — nunca navega ao clicar
 *   no próprio pai, só ao escolher um subitem. Fecha ao navegar, Esc, Tab ou
 *   clique fora; o foco volta ao botão do pai ao fechar por Esc. Abrir por
 *   Enter/Espaço foca o 1.º subitem; abrir por hover ou clique de rato não
 *   rouba o foco.
 */
function NavItemGroup({
  path,
  items,
  collapsed,
  expanded,
  activePathname,
  onToggleExpanded,
}: {
  path: string
  items: SubmenuItem[]
  collapsed: boolean
  expanded: boolean
  activePathname: string
  /** Só relevante no modo expandido: alterna o colapso manual deste grupo (ver `SidebarContent`). */
  onToggleExpanded: () => void
}) {
  const meta = ROUTE_META[path]
  const navigate = useNavigate()
  const [flyout, setFlyout] = useState(false)
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const flyoutRef = useRef<HTMLDivElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // true só quando o flyout foi aberto por Enter/Espaço (não por clique de rato
  // nem por hover) — `MouseEvent.detail === 0` é o sinal de ativação por teclado
  // num <button> (o browser sintetiza um click com detail 0 para Enter/Espaço).
  const openedByKeyboard = useRef(false)

  const isActiveRoot = activePathname === path || activePathname.startsWith(`${path}/`)

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = undefined
    }
  }
  const scheduleClose = () => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setFlyout(false), 150)
  }
  const openFlyoutNow = () => {
    clearCloseTimer()
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const estimatedH = items.length * 40 + 48
      setFlyoutPos({
        left: r.right + 8,
        top: Math.min(r.top, Math.max(8, window.innerHeight - estimatedH - 8)),
      })
    }
    setFlyout(true)
  }

  // Estado do flyout fica obsoleto se o sidebar deixar de estar colapsado
  // enquanto aberto: sem este reset, recolapsar mais tarde reabre-o sozinho
  // (o `collapsed && flyout` do render voltaria a ser true sem clique nenhum).
  useEffect(() => {
    if (!collapsed) setFlyout(false)
  }, [collapsed])

  // Ao abrir por teclado: foco entra no 1.º subitem do flyout (mesmo padrão do
  // Combobox.tsx — setTimeout 0 para focar já depois do portal montar).
  useEffect(() => {
    if (!collapsed || !flyout || !openedByKeyboard.current) return
    openedByKeyboard.current = false
    const t = setTimeout(() => {
      flyoutRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }, 0)
    return () => clearTimeout(t)
  }, [collapsed, flyout])

  // Fecha ao clicar fora / Esc (só relevante enquanto o flyout está aberto).
  useEffect(() => {
    if (!collapsed || !flyout) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || flyoutRef.current?.contains(t)) return
      setFlyout(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFlyout(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [collapsed, flyout])

  if (!meta) return null

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (collapsed) {
      if (flyout) {
        setFlyout(false)
      } else {
        openedByKeyboard.current = e.detail === 0
        openFlyoutNow()
      }
      return
    }
    if (expanded) {
      // Pai expandido → colapsa sem navegar (pedido de UX: hoje não havia
      // forma de fechar o acordeão ativo).
      onToggleExpanded()
      return
    }
    // Pai fechado (rota ativa ou não) → navega para o 1.º subitem permitido e
    // expande. Chamar onToggleExpanded aqui também limpa qualquer colapso
    // manual anterior deste grupo mesmo quando o `navigate` é um no-op (já
    // estamos no subitem) — sem isto o grupo ficaria preso fechado.
    onToggleExpanded()
    navigate(items[0]?.path ?? path)
  }

  const goToSub = (subPath: string) => {
    navigate(subPath)
    setFlyout(false)
  }

  // Navegação por ↑/↓ DENTRO do flyout (handler local, não o roving global do
  // <nav> — os botões vivem num portal fora do navRef; ver comentário no
  // SidebarContent). stopPropagation evita que o evento chegue ao <nav>: como
  // React despacha eventos sintéticos pela árvore de componentes (não pelo DOM),
  // NavItemGroup continua "dentro" do <nav> mesmo com o flyout portalled para
  // document.body, e o handler global apanharia a tecla se deixássemos subir.
  const onFlyoutKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(flyoutRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      if (!buttons.length) return
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = e.key === 'ArrowDown' ? (idx + 1) % buttons.length : (idx - 1 + buttons.length) % buttons.length
      buttons[next]?.focus()
    } else if (e.key === 'Tab') {
      // Tab fecha o flyout (comportamento de menu) — não impede o Tab nativo
      // de mover o foco, só deixa de o mostrar aberto.
      e.stopPropagation()
      setFlyout(false)
    }
    // Esc já é tratado pelo listener global do document (fecha + devolve o
    // foco ao botão-pai), não precisa de handling aqui.
  }

  return (
    <div
      className="relative"
      onMouseEnter={collapsed ? openFlyoutNow : undefined}
      onMouseLeave={collapsed ? scheduleClose : undefined}
    >
      <button
        ref={btnRef}
        data-nav-focusable="true"
        onClick={handleClick}
        title={collapsed ? meta.nome : undefined}
        aria-expanded={collapsed ? flyout : expanded}
        className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'} ${isActiveRoot ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
      >
        {isActiveRoot && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-accent" />}
        <Icon name={meta.icon} className="w-[19px] h-[19px] shrink-0" strokeWidth={isActiveRoot ? 2 : 1.75} />
        {!collapsed && <span className="flex-1 text-left">{meta.nome}</span>}
        {!collapsed && (
          <Icon
            name="chevronDown"
            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Acordeão (sidebar expandida + drawer mobile): subitens indentados.
          Só existe no DOM quando expandido — um grupo fechado não pode deixar
          os seus subitens alcançáveis (roving tabindex / getByRole), senão
          duplicam o nome acessível dos itens de módulo da sidebar (ex.: "Loja"
          aparece no menu E, escondido por CSS, dentro do Financeiro). */}
      {!collapsed && expanded && (
        <div className="mt-1">
          <div className="ml-4 pl-3 border-l border-zinc-200 dark:border-zinc-800 space-y-0.5 pb-0.5">
            {items.map((it) => (
              <SubmenuLink
                key={it.path}
                item={it}
                active={activePathname === it.path}
                onClick={() => navigate(it.path)}
                variant="accordion"
                focusable
              />
            ))}
          </div>
        </div>
      )}

      {/* Flyout (sidebar colapsada, portal — mesmo padrão do Combobox). */}
      {collapsed && flyout && createPortal(
        <div
          ref={flyoutRef}
          style={{ position: 'fixed', top: flyoutPos?.top ?? 0, left: flyoutPos?.left ?? 0, zIndex: 100 }}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
          onKeyDown={onFlyoutKeyDown}
          className="w-48 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1.5"
        >
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{meta.nome}</p>
          {items.map((it) => (
            <SubmenuLink
              key={it.path}
              item={it}
              active={activePathname === it.path}
              onClick={() => goToSub(it.path)}
              variant="flyout"
            />
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

function SidebarContent({ accessiblePaths, collapsed }: {
  accessiblePaths: string[]
  collapsed: boolean
}) {
  const { hasPermission } = useAuth()
  const location = useLocation()
  const navRef = useRef<HTMLElement | null>(null)
  // Só o item /mensagens usa isto — chamado aqui (e não por NavItem) para não
  // instanciar um hook de chat por cada item do menu. Fica coerente com o
  // ChatLauncher/ChatFab, que já chamam useChatUnread() cada um por sua vez;
  // o React Query cacheia/deduplica o pedido de rede pela mesma queryKey.
  const unreadMessages = useChatUnread()

  // Acordeão: só um pai (com submenu) expandido de cada vez — por omissão o da
  // rota ativa (derivado). Pode ser manualmente COLAPSADO sem navegar
  // (pedido de UX): `collapsedOverride` guarda o path que o utilizador fechou
  // à mão; só tem efeito enquanto continuar a ser o grupo ativo — noutro
  // grupo/rota, `derivedExpandedPath` muda e o efeito abaixo limpa o
  // override (senão o grupo ativo nunca mais reabriria sozinho ao voltar por
  // outro caminho que não o clique no próprio pai, ex.: deep-link).
  const [collapsedOverride, setCollapsedOverride] = useState<string | null>(null)
  const derivedExpandedPath = useMemo(
    () => accessiblePaths.find((p) => SUBMENU[p] && (location.pathname === p || location.pathname.startsWith(`${p}/`))) ?? null,
    [accessiblePaths, location.pathname],
  )
  useEffect(() => {
    setCollapsedOverride(null)
  }, [derivedExpandedPath])
  const expandedPath = collapsedOverride !== null && collapsedOverride === derivedExpandedPath ? null : derivedExpandedPath

  // Navegação por setas (↑/↓) entre todos os itens focáveis do menu (pais +
  // subitens visíveis do acordeão aberto) — Enter/Espaço já "expande" (é o
  // clique nativo do botão, que expande + navega). Roving simples: percorre
  // por ordem do DOM.
  const handleNavKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const root = navRef.current
    if (!root) return
    const focusables = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-nav-focusable="true"]'))
    if (!focusables.length) return
    e.preventDefault()
    const idx = focusables.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (idx + 1) % focusables.length : (idx - 1 + focusables.length) % focusables.length
    focusables[next]?.focus()
  }

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2.5 h-16 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
        {/* Logo RV — marca sem fundo, maior */}
        <img src="/icons/logo.svg" alt="Backoffice" className={`${collapsed ? 'h-7' : 'h-8'} w-auto shrink-0`} />
        {!collapsed && <span className="font-semibold text-[17px] tracking-tight text-zinc-900 dark:text-white">Backoffice</span>}
      </div>

      {/* Zona de navegação scrollável: com todos os grupos do acordeão abertos
          o menu pode ficar mais alto que o viewport — `flex-1 min-h-0
          overflow-y-auto` deixa-a encolher e ganhar scroll próprio, com o
          logo (acima, `shrink-0`) sempre fixo. Sem rodapé: o logout vive só no
          menu do avatar (`AvatarMenu`, topbar) — ver T3.3.
          A scrollbar discreta vem do CSS global (`index.css`), igual à usada
          noutros painéis com scroll (NotificationBell, ChatPopup, …). */}
      <div className={`mt-2 flex-1 min-h-0 overflow-y-auto pb-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Menu</p>}
        <nav ref={navRef} className="space-y-1" onKeyDown={handleNavKeyDown}>
          {accessiblePaths.map((path) => {
            const groupItems = allowedSubitems(path, hasPermission)
            if (groupItems.length > 0) {
              const isExpanded = expandedPath === path
              return (
                <NavItemGroup
                  key={path}
                  path={path}
                  items={groupItems}
                  collapsed={collapsed}
                  expanded={isExpanded}
                  activePathname={location.pathname}
                  onToggleExpanded={() => setCollapsedOverride(isExpanded ? path : null)}
                />
              )
            }
            return (
              <NavItem
                key={path}
                path={path}
                active={location.pathname === path}
                collapsed={collapsed}
                badge={path === '/mensagens' ? unreadMessages : undefined}
              />
            )
          })}
        </nav>
      </div>
    </div>
  )
}

/**
 * Título do topbar (T1.1): a rota-raiz (ex.: `/financeiro`, que é também o
 * path do 1.º subitem "O Negócio") continua a mostrar só o nome da página —
 * duplicar em "Financeiro · O Negócio" seria redundante. Uma subpágina real
 * (ex.: `/financeiro/despesas`) compõe "Pai · Subitem", como um breadcrumb
 * curto — dá contexto sem precisar de abrir a sidebar para saber onde se está.
 */
function resolveTopbarTitle(pathname: string): string {
  const direct = ROUTE_META[pathname]?.nome
  if (direct) return direct
  const root = Object.keys(SUBMENU).find((r) => pathname.startsWith(`${r}/`))
  if (!root) return ''
  const rootLabel = ROUTE_META[root]?.nome ?? ''
  const sub = SUBMENU[root].find((s) => s.path === pathname)
  return sub ? `${rootLabel} · ${sub.label}` : rootLabel
}

/**
 * Menu do avatar no topbar (T3.3, `.design/shell-nav-perfil/`): devolve a
 * identidade do tenant que foi removida do cartão da sidebar (fix anterior) —
 * "O meu perfil" (→ `/perfil`) e "Terminar sessão". Portal (mesmo padrão do
 * flyout de `NavItemGroup`/`useAnchoredMenu`), ancorado à direita por baixo do
 * avatar (é o item mais à direita do topbar — um menu alinhado à esquerda
 * sairia do ecrã). Acessível: `aria-haspopup`/`aria-expanded`, fecha em Esc e
 * clique fora, foco volta ao botão do avatar ao fechar por Esc.
 */
function AvatarMenu({ onLogout }: { onLogout: () => void }) {
  const { username, loggingOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
    setOpen(true)
  }

  // Fecha ao clicar fora / Esc (mesmo padrão do NavItemGroup/NotificationBell).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const goToProfile = () => {
    setOpen(false)
    navigate('/perfil')
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu da conta"
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Avatar name={username ?? '?'} color="#2A6FDB" size={34} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Conta"
          style={{ position: 'fixed', top: pos?.top ?? 0, right: pos?.right ?? 0, zIndex: 100 }}
          className="w-52 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1.5"
        >
          {username && (
            <p className="px-3 pb-1.5 mb-0.5 border-b border-zinc-100 dark:border-zinc-800 text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
              {username}
            </p>
          )}
          <button
            role="menuitem"
            onClick={goToProfile}
            className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors"
          >
            <Icon name="user" className="w-4 h-4" />
            O meu perfil
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onLogout() }}
            disabled={loggingOut}
            className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
          >
            <Icon name="logout" className="w-4 h-4" />
            {loggingOut ? 'A sair...' : 'Terminar sessão'}
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}

function Topbar({ theme, onToggleTheme, onMenu, onCollapse, onLogout }: {
  theme: string; onToggleTheme: () => void
  onMenu: () => void; onCollapse: () => void
  onLogout: () => void
}) {
  const location = useLocation()
  const title = resolveTopbarTitle(location.pathname)

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
        <ChatLauncher />
        <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} onClick={onToggleTheme} label="Tema" />
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-0.5 hidden sm:block" />
        <AvatarMenu onLogout={onLogout} />
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
  const { logout, permissions, hasPermission } = useAuth()
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

  const isAdmin = permissions.some((p) => p.name === 'VIEW_ADMIN')
  // Conjunto de rotas acessíveis (dashboard + módulos por permissão + core + admin)…
  const accessible = new Set<string>([
    '/dashboard',
    ...permissions.map((p) => MODULE_PERM_TO_PATH[p.name ?? '']).filter(Boolean),
    ...CORE_PATHS,
    ...(isAdmin ? ['/admin'] : []),
  ])
  // …apresentadas pela ordem fixa de MENU_ORDER (extras desconhecidos vão para o fim).
  const accessiblePaths = [
    ...MENU_ORDER.filter((p) => accessible.has(p)),
    ...[...accessible].filter((p) => !MENU_ORDER.includes(p)),
  ]

  // Fecha o drawer ao navegar
  useEffect(() => { setDrawer(false) }, [location.pathname])

  // Guard por PREFIXO (T1.1): um pathname sob um root acessível é válido, não só
  // o path exato (/financeiro/despesas é válido porque /financeiro é). "/despesas"
  // é um deep-link antigo sem item de menu próprio — entra como root extra só para
  // o guard não o expulsar antes do <Navigate> do App.tsx o reescrever para
  // /financeiro/despesas (o guard não faz essa reescrita; só garante que o pathname
  // não é imediatamente atirado para o dashboard nesse instante). "/perfil" (T3.3)
  // é core mas fora da sidebar (acede-se pelo menu do avatar, AvatarMenu) — pela
  // mesma razão entra como root extra, senão o guard expulsava-o para o dashboard
  // por não pertencer a nenhum item de `accessiblePaths`.
  const guardRoots = [...accessiblePaths, '/despesas', '/perfil']

  // Redirige para rota acessível se a actual não o for; um SUBITEM sem permissão
  // (ex.: /financeiro/ginasio sem VIEW_GYM) cai no 1.º subitem permitido do MESMO
  // pai — nunca no dashboard.
  useEffect(() => {
    if (!accessiblePaths.length) return
    const root = findRoot(location.pathname, guardRoots)
    if (!root) {
      navigate(accessiblePaths[0], { replace: true })
      return
    }
    const subs = allowedSubitems(root, hasPermission)
    if (subs.length > 0 && !subs.some((s) => s.path === location.pathname)) {
      // Preserva a query string (coerente com o FinanceiroEntry, App.tsx, que
      // já faz o mesmo no seu próprio redirect de `?vista=`) — este redirect é
      // por pathname/permissão, não por um query param específico, por isso
      // não há nada próprio a remover daqui.
      navigate(`${subs[0].path}${location.search}`, { replace: true })
    }
  }, [location.pathname, permissions]) // eslint-disable-line

  // Teclado virtual (mobile): ao abrir, encolhe a altura da app para o espaço
  // visível (visualViewport) — o composer fica por cima do teclado e nada faz
  // scroll por trás do topbar. Sem teclado cai para 100% (estável, sem saltos).
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const apply = () => {
      const keyboardOpen = window.innerHeight - vv.height > 120
      if (keyboardOpen) root.style.setProperty('--app-h', `${vv.height}px`)
      else root.style.removeProperty('--app-h')
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      root.style.removeProperty('--app-h')
    }
  }, [])

  // Rotas "full-bleed" no mobile: o conteúdo ocupa todo o espaço abaixo do topbar,
  // sem padding e sem scroll no <main> (a própria página gere o seu scroll interno).
  // Ex.: /mensagens (chat imersivo tipo app de mensagens).
  const fullBleed = location.pathname === "/mensagens";

  return (
    <div className="flex bg-zinc-50 dark:bg-zinc-950 overflow-hidden" style={{ height: 'var(--app-h, 100%)' }}>
      <SwRegistrar />
      <aside className={`hidden lg:flex flex-col shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        <SidebarContent accessiblePaths={accessiblePaths} collapsed={collapsed} />
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
            <SidebarContent accessiblePaths={accessiblePaths} collapsed={false} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          theme={theme}
          onToggleTheme={onToggleTheme}
          onMenu={() => setDrawer(true)}
          onCollapse={() => setCollapsed(!collapsed)}
          onLogout={handleLogout}
        />
        {/* Faixa de billing (platform subscription): fica acima do <main> e por
            isso persiste no topo enquanto o conteúdo faz scroll. Silenciosa
            quando está tudo pago. */}
        <BillingBanner />
        <main className={`flex-1 min-h-0 ${fullBleed ? "overflow-hidden sm:overflow-y-auto" : "overflow-y-auto"}`}>
          <div
            className={
              fullBleed
                ? "h-full sm:h-auto sm:max-w-[1400px] sm:mx-auto sm:px-6 lg:px-8 sm:py-8"
                : "max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"
            }
          >
            {children}
          </div>
        </main>
      </div>

      {/* Botão flutuante de mensagens (some na própria página /mensagens) */}
      <ChatFab />
    </div>
  )
}
