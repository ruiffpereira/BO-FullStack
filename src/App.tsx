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
import { resolveLegacyTabTarget } from "./lib/navigation";

/**
 * Entrada genérica de uma página com submenu (T1.2 — piloto Financeiro;
 * generalizada no T2.1 para ser reutilizada por T2.2…T2.7). O deep-link antigo
 * `?<param>=<id>` (notificações/emails já enviados) redireciona para o path
 * novo do subitem, preservando quaisquer OUTROS query params; sem o param (ou
 * um valor que não é um id real do submenu, incl. o id-âncora da raiz — ex.
 * "negocio"/"produtos") renderiza `children` sem hop de redirect extra. Uma
 * vista sem permissão redireciona aqui para o path novo na mesma (ex.:
 * `?vista=ginasio` → `/financeiro/ginasio`) — quem decide se essa vista é
 * mesmo permitida é o guard do `Shell.tsx` (prefixo + fallback para o 1.º
 * subitem permitido), não esta entrada.
 */
function LegacyTabEntry({ root, param, children }: { root: string; param: string; children: React.ReactElement }) {
  const [params] = useSearchParams();
  const rest = new URLSearchParams(params);
  rest.delete(param);
  const target = resolveLegacyTabTarget(root, params.get(param), rest.toString());
  return target ? <Navigate to={target} replace /> : children;
}

/**
 * Entrada da rota `/agenda` (T2.7). Não usa `LegacyTabEntry`/
 * `resolveLegacyTabTarget` porque o deep-link antigo aqui não é `?<param>=<id
 * de subitem>` (ex. `?tab=encomendas`) — é `?openService=<id de serviço>`, um
 * ID de negócio arbitrário, não o id de um item do `SUBMENU["/agenda"]`. Só a
 * PRESENÇA do parâmetro importa: quando existe, redirece para
 * `/agenda/servicos` preservando TODOS os query params (incl. o próprio
 * `openService`, que o `ServicosPanel` ainda precisa de ler para abrir o modal
 * de edição — ao contrário do `LegacyTabEntry`, que descarta o param legacy
 * porque o valor dele já não serve de nada no destino). Sem o parâmetro,
 * renderiza o Calendário normalmente.
 */
function AgendaEntry() {
  const [params] = useSearchParams();
  if (params.get("openService")) {
    return <Navigate to={`/agenda/servicos?${params.toString()}`} replace />;
  }
  return <Agenda view="cal" />;
}

/**
 * Entrada da rota `/admin` (T2.4). O único deep-link legacy real aqui não é um
 * `?<param>=<id de subitem>` (`LegacyTabEntry`) — é o retorno do OAuth do
 * Google (`GET /integrations/google/callback` na API, `googleController.ts`),
 * que redireciona sempre para `/admin?google=connected|error`. Com o
 * parâmetro presente, redireciona para `/admin/integracoes` preservando-o (o
 * toast + limpeza do query string continuam dentro de `Admin.tsx`, já
 * view-agnósticos). Sem o parâmetro, renderiza a vista Utilizadores (âncora).
 */
function AdminEntry() {
  const [params] = useSearchParams();
  if (params.get("google")) {
    return <Navigate to={`/admin/integracoes?${params.toString()}`} replace />;
  }
  return <Admin view="utilizadores" />;
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
        <Route path="/financeiro" element={<LegacyTabEntry root="/financeiro" param="vista"><FinanceiroPage view="negocio" /></LegacyTabEntry>} />
        <Route path="/financeiro/agenda" element={<FinanceiroPage view="agenda" />} />
        <Route path="/financeiro/loja" element={<FinanceiroPage view="loja" />} />
        <Route path="/financeiro/ginasio" element={<FinanceiroPage view="ginasio" />} />
        <Route path="/financeiro/despesas" element={<FinanceiroPage view="despesas" />} />
        {/* Deep-link antigo (não está na sidebar): redireciona para o path novo. */}
        <Route path="/despesas" element={<Navigate to="/financeiro/despesas" replace />} />
        <Route path="/clientes" element={<LegacyTabEntry root="/clientes" param="tab"><Clientes view="clientes" /></LegacyTabEntry>} />
        <Route path="/clientes/leads" element={<Clientes view="leads" />} />
        <Route path="/faturacao" element={<Faturacao />} />
        <Route path="/mensagens" element={<Mensagens />} />
        <Route path="/loja" element={<LegacyTabEntry root="/loja" param="tab"><Loja view="produtos" /></LegacyTabEntry>} />
        <Route path="/loja/encomendas" element={<Loja view="encomendas" />} />
        <Route path="/loja/categorias" element={<Loja view="categorias" />} />
        <Route path="/agenda" element={<AgendaEntry />} />
        <Route path="/agenda/marcacoes" element={<Agenda view="marcacoes" />} />
        <Route path="/agenda/servicos" element={<Agenda view="servicos" />} />
        <Route path="/agenda/config" element={<Agenda view="config" />} />
        <Route path="/ginasio" element={<Ginasio view="catalogo" />} />
        <Route path="/ginasio/treinos" element={<Ginasio view="treinos" />} />
        <Route path="/ginasio/planos" element={<Ginasio view="planos" />} />
        <Route path="/ginasio/clientes" element={<Ginasio view="clientes" />} />
        <Route path="/conteudos" element={<Conteudos view="website" />} />
        <Route path="/conteudos/produtos" element={<Conteudos view="product" />} />
        <Route path="/conteudos/servicos" element={<Conteudos view="service" />} />
        <Route path="/conteudos/ginasio" element={<Conteudos view="gym" />} />
        <Route path="/conteudos/linguas" element={<Conteudos view="linguas" />} />
        <Route path="/conteudos/emails" element={<Conteudos view="emails" />} />
        <Route path="/conteudos/notificacoes" element={<Conteudos view="notificacoes" />} />
        <Route path="/website" element={<Website view="site" />} />
        <Route path="/website/template" element={<Website view="template" />} />
        <Route path="/website/paginas" element={<Website view="pages" />} />
        <Route path="/website/marca" element={<Website view="brand" />} />
        <Route path="/website/rodape-nav" element={<Website view="footer" />} />
        <Route path="/website/dominio" element={<Website view="domain" />} />
        <Route path="/admin" element={<AdminEntry />} />
        <Route path="/admin/permissoes" element={<Admin view="permissoes" />} />
        <Route path="/admin/componentes" element={<Admin view="componentes" />} />
        <Route path="/admin/tokens" element={<Admin view="tokens" />} />
        <Route path="/admin/faturacao" element={<Admin view="faturacao" />} />
        <Route path="/admin/integracoes" element={<Admin view="integracoes" />} />
        <Route path="/admin/atividade" element={<Admin view="atividade" />} />
        <Route path="/admin/sistema" element={<Admin view="sistema" />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  );
}

export default App;
