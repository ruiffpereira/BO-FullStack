import { Navigate, useNavigate } from "react-router-dom";
import { Avatar, Tabs } from "../ui/ui.jsx";
import { useAuth } from "../context/AuthContext";
import { usePageSubtitle } from "../context/PageMetaContext";
import { MensagensTab } from "../components/chat/MensagensTab";
import { ChatConversationView } from "../components/chat/ChatConversationView";
import { ClientesChatTab } from "../components/chat/ClientesChatTab";
import { BackofficeChatTab } from "../components/chat/BackofficeChatTab";
import { CountBadge } from "../components/NavBadge";
import { useMessagesSummary } from "../hooks/useMessages";
import { backofficeUnread } from "../lib/messages";

/**
 * Conversa única do tenant com o suporte.
 * Mobile: preenche todo o container abaixo do topbar da app — sem título de página
 * nem header próprio (o topbar já é o header). Só a lista de mensagens faz scroll;
 * o composer fica colado em baixo (por cima do teclado).
 * Desktop (sm+): card com cabeçalho, como antes.
 */
function TenantSupport() {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-zinc-900 sm:rounded-xl sm:border sm:border-zinc-200/80 dark:sm:border-zinc-800 sm:overflow-hidden">
      {/* Cabeçalho só no desktop — no mobile o topbar da app já serve de header. */}
      <header className="hidden sm:flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <Avatar name="Suporte" color="#0EA5A4" size={36} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-tight">Suporte</p>
          <p className="text-xs text-zinc-400">Falamos contigo por aqui</p>
        </div>
      </header>
      <ChatConversationView scope={{ kind: "support" }} active />
    </div>
  );
}

export type MensagensView = "clientes" | "backoffice";

/**
 * Página "Mensagens" (core, na sidebar para todos):
 *  - Admin da plataforma (VIEW_ADMIN) → inbox do Suporte de todos os tenants (não vê Clientes nem Equipa).
 *  - Tenant/membro (B43) → dois separadores: **Clientes** (`/mensagens`, folha `mensagens.clientes`) e
 *    **Backoffice** (`/mensagens/backoffice`, Suporte + equipa; folhas `mensagens.suporte`/`mensagens.equipa`).
 *    Cada separador só aparece com a sua folha; sem nenhuma o Shell nem monta a página.
 *  - Sessão de suporte (impersonation): só a leitura do Suporte — `/messages/*` fecha-se nessa sessão.
 */
export function Mensagens({ view = "clientes" }: { view?: MensagensView }) {
  const { permissions, can, supportSession } = useAuth();
  const navigate = useNavigate();
  const isAdmin = permissions.some((p) => p.name === "VIEW_ADMIN");
  const showClientes = can("mensagens.clientes");
  const showBackoffice = can("mensagens.equipa") || can("mensagens.suporte");
  const summary = useMessagesSummary(!isAdmin && (showClientes || showBackoffice));

  // O subtítulo é do separador activo (hook sempre chamado, por isso antes dos returns).
  const active: MensagensView = view === "backoffice" ? (showBackoffice ? "backoffice" : "clientes") : showClientes ? "clientes" : "backoffice";
  usePageSubtitle(
    isAdmin ? "Conversas com os teus clientes"
    : supportSession ? "Fala com o suporte"
    : active === "clientes" ? "Conversas com os clientes do teu site"
    : "Suporte e equipa",
  );

  if (isAdmin) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <MensagensTab />
      </div>
    );
  }
  if (supportSession) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <TenantSupport />
      </div>
    );
  }
  if (!showClientes && !showBackoffice) return null;
  // Pediu um separador que não tem: leva ao que tem (membro com só uma folha).
  if (active !== view) return <Navigate to={active === "clientes" ? "/mensagens" : "/mensagens/backoffice"} replace />;

  const tabs = [
    ...(showClientes
      ? [{ id: "clientes", label: <>Clientes<CountBadge count={summary.data?.customers ?? 0} size="nav" className="ml-1" /></> }]
      : []),
    ...(showBackoffice
      ? [{ id: "backoffice", label: <>Backoffice<CountBadge count={backofficeUnread(summary.data)} size="nav" className="ml-1" /></> }]
      : []),
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Separadores só com mais do que um: quem tem uma folha só vê a lista dela. */}
      {tabs.length > 1 && (
        <div className="shrink-0 px-3 py-2 sm:px-0 sm:pt-0 sm:pb-3 bg-white dark:bg-zinc-900 sm:bg-transparent sm:dark:bg-transparent border-b border-zinc-100 dark:border-zinc-800 sm:border-0">
          <Tabs
            tabs={tabs}
            value={active}
            onChange={(id: string) => navigate(id === "clientes" ? "/mensagens" : "/mensagens/backoffice")}
            size="sm"
          />
        </div>
      )}
      {active === "clientes" ? <ClientesChatTab /> : <BackofficeChatTab />}
    </div>
  );
}
