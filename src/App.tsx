import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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
        <Route path="/financeiro" element={<FinanceiroPage />} />
        {/* Deep-link antigo: abre o Financeiro já na tab Despesas (não está na sidebar). */}
        <Route path="/despesas" element={<FinanceiroPage initialTab="despesas" />} />
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
