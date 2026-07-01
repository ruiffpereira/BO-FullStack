import { useNavigate } from "react-router-dom";
import { PageHeader, Avatar } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { useAuth } from "../context/AuthContext";
import { MensagensTab } from "../components/chat/MensagensTab";
import { ChatConversationView } from "../components/chat/ChatConversationView";

/**
 * Conversa única do tenant com o suporte.
 * Mobile: imersiva / full-screen (tipo app de mensagens) — cabeçalho próprio com
 * seta de voltar, lista a ocupar tudo, composer colado por cima do teclado.
 * Desktop (sm+): card em fluxo, como antes.
 */
function TenantSupport() {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-zinc-900 sm:static sm:z-auto sm:h-[calc(100dvh-13rem)] sm:min-h-[480px] sm:rounded-xl sm:border sm:border-zinc-200/80 dark:sm:border-zinc-800 sm:overflow-hidden">
      <header className="flex items-center gap-2.5 shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-2.5 sm:px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 sm:py-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="sm:hidden -ml-0.5 w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-90 transition"
        >
          <Icon name="chevronLeft" className="w-[22px] h-[22px]" />
        </button>
        <Avatar name="Suporte" color="#0EA5A4" size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-tight truncate">Suporte</p>
          <p className="text-[12px] text-zinc-400 leading-tight truncate">Falamos contigo por aqui</p>
        </div>
      </header>
      <ChatConversationView scope={{ kind: "support" }} active />
    </div>
  );
}

/**
 * Página "Mensagens" (core, na sidebar para todos):
 *  - Admin (VIEW_ADMIN) → inbox de todos os tenants.
 *  - Tenant → a sua conversa com o suporte.
 */
export function Mensagens() {
  const { permissions } = useAuth();
  const isAdmin = permissions.some((p) => p.name === "VIEW_ADMIN");

  return (
    <div>
      <PageHeader
        title="Mensagens"
        subtitle={isAdmin ? "Conversas com os teus clientes" : "Fala com o suporte"}
      />
      {isAdmin ? <MensagensTab /> : <TenantSupport />}
    </div>
  );
}
