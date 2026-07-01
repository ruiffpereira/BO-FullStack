import { PageHeader, Avatar } from "../ui/ui.jsx";
import { useAuth } from "../context/AuthContext";
import { MensagensTab } from "../components/chat/MensagensTab";
import { ChatConversationView } from "../components/chat/ChatConversationView";

/**
 * Conversa única do tenant com o suporte.
 * Mobile: preenche todo o container abaixo do topbar da app — sem título de página
 * nem header próprio (o topbar já é o header). Só a lista de mensagens faz scroll;
 * o composer fica colado em baixo (por cima do teclado).
 * Desktop (sm+): card com cabeçalho, como antes.
 */
function TenantSupport() {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-zinc-900 sm:flex-none sm:h-[calc(100dvh-13rem)] sm:min-h-[480px] sm:rounded-xl sm:border sm:border-zinc-200/80 dark:sm:border-zinc-800 sm:overflow-hidden">
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

/**
 * Página "Mensagens" (core, na sidebar para todos):
 *  - Admin (VIEW_ADMIN) → inbox de todos os tenants.
 *  - Tenant → a sua conversa com o suporte.
 */
export function Mensagens() {
  const { permissions } = useAuth();
  const isAdmin = permissions.some((p) => p.name === "VIEW_ADMIN");

  return (
    <div className="h-full sm:h-auto flex flex-col">
      {/* Título da página só no desktop — no mobile o chat é imersivo (full-bleed). */}
      <div className="hidden sm:block">
        <PageHeader
          title="Mensagens"
          subtitle={isAdmin ? "Conversas com os teus clientes" : "Fala com o suporte"}
        />
      </div>
      {isAdmin ? <MensagensTab /> : <TenantSupport />}
    </div>
  );
}
