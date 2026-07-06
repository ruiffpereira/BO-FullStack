import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { type Theme, computeInitialTheme, persistTheme } from "./lib/uiTheme";
import { Shell } from "./components/Shell";
import { Login } from "./components/Login";
import { SetupPassword } from "./pages/SetupPassword";
import { Signup } from "./pages/Signup";
import { Dashboard } from "./pages/Dashboard";
import { Clientes } from "./pages/Clientes";
import { Loja } from "./pages/Loja";
import { Agenda } from "./pages/Agenda";
import { Admin } from "./pages/Admin";
import { Conteudos } from "./pages/Conteudos";
import { Ginasio } from "./pages/Ginasio";
import { FinanceiroPage } from "./pages/FinanceiroPage";
import { Estatisticas } from "./pages/Estatisticas";
import { Mensagens } from "./pages/Mensagens";
import { Website } from "./pages/Website";
import { Faturacao } from "./pages/Faturacao";
import { SUBMENU } from "./lib/navigation";

// Ids de subitem do Financeiro que correspondem mesmo a um path próprio
// (`/financeiro/<id>`) — "negocio" fica de fora porque o seu path é a
// própria raiz (`/financeiro`), tratada à parte abaixo. Fonte única:
// `src/lib/navigation.ts` (SUBMENU) — nunca duplicar esta lista.
const VALID_FINANCEIRO_VISTAS = new Set(
  (SUBMENU["/financeiro"] ?? []).map((it) => it.id).filter((id) => id !== "negocio"),
);

/**
 * Entrada de `/financeiro` (T1.2 — piloto de rotas reais). O deep-link antigo
 * `?vista=X` (notificações/emails/links já enviados) redireciona para o path
 * novo `/financeiro/X`, preservando quaisquer OUTROS query params; sem `vista`
 * (ou `vista=negocio`) mostra logo "O Negócio" — sem hop de redirect extra,
 * porque o path já é o correto. Uma vista sem permissão redireciona aqui para
 * o path novo na mesma (ex.: `?vista=ginasio` → `/financeiro/ginasio`) — quem
 * decide se essa vista é mesmo permitida é o guard do `Shell.tsx` (prefixo +
 * fallback para o 1.º subitem permitido), não esta entrada. Um `vista`
 * desconhecido/inválido (não é nenhum dos ids reais do submenu) fica em
 * "O Negócio" em vez de tentar navegar para um path que não existe — isso
 * cairia no catch-all `*` e ejetava para o `/dashboard`.
 */
function FinanceiroEntry() {
  const [params] = useSearchParams();
  const vista = params.get("vista");
  if (!vista || !VALID_FINANCEIRO_VISTAS.has(vista)) {
    return <FinanceiroPage view="negocio" />;
  }
  const rest = new URLSearchParams(params);
  rest.delete("vista");
  const qs = rest.toString();
  return <Navigate to={`/financeiro/${vista}${qs ? `?${qs}` : ""}`} replace />;
}

function App() {
  // Init lazy: localStorage("bo.theme") > prefers-color-scheme do sistema >
  // "dark" (src/lib/uiTheme.ts). T3.4 vai promover a fonte para
  // servidor > localStorage > sistema (User.uiTheme).
  const [theme, setTheme] = useState<Theme>(computeInitialTheme);
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    // Barra superior da PWA = cor do header (branco no claro, zinc-950 no
    // escuro). Duplicado em index.html:13 (fallback estático) e no script
    // anti-flash ali mesmo — mantém em sincronia.
    // (--accent/--accent-hex NÃO se definem aqui: são estáticas por tema em
    // src/index.css (:root / .dark), aplicadas desde o 1.º paint pela classe
    // `dark` que o script anti-flash já põe — sem isto o acento piscava claro
    // num reload em dark, até este efeito correr depois do mount.)
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#09090b" : "#ffffff");
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      persistTheme(next);
      return next;
    });

  // Public routes — accessible without authentication
  if (location.pathname === "/setup-password") {
    return <SetupPassword theme={theme} onToggleTheme={toggleTheme} />;
  }
  if (location.pathname === "/signup") {
    // Um tenant já autenticado que caia em /signup (ex.: link antigo, aba
    // reaberta) não deve ver o formulário público — os links "Entrar"/"Voltar
    // ao login" ficariam mortos (caem sempre no /dashboard). Só redireciona
    // depois de a sessão estar resolvida (initializing) para não interromper o
    // fluxo de signup de um visitante não autenticado.
    if (isAuthenticated && !initializing) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Signup theme={theme} onToggleTheme={toggleTheme} />;
  }

  // Restoring session (silent refresh on startup) — avoid flashing the login screen
  if (initializing) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-300 border-t-accent animate-spin dark:border-zinc-700 dark:border-t-accent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <Shell theme={theme} onToggleTheme={toggleTheme}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/estatisticas" element={<Estatisticas />} />
        <Route path="/financeiro" element={<FinanceiroEntry />} />
        <Route path="/financeiro/agenda" element={<FinanceiroPage view="agenda" />} />
        <Route path="/financeiro/loja" element={<FinanceiroPage view="loja" />} />
        <Route path="/financeiro/ginasio" element={<FinanceiroPage view="ginasio" />} />
        <Route path="/financeiro/despesas" element={<FinanceiroPage view="despesas" />} />
        {/* Deep-link antigo (não está na sidebar): redireciona para o path novo. */}
        <Route path="/despesas" element={<Navigate to="/financeiro/despesas" replace />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/faturacao" element={<Faturacao />} />
        <Route path="/mensagens" element={<Mensagens />} />
        <Route path="/loja" element={<Loja />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/ginasio" element={<Ginasio />} />
        <Route path="/conteudos" element={<Conteudos />} />
        <Route path="/website" element={<Website />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  );
}

export default App;
