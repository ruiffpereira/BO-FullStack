import { PageHeader, Avatar } from "../ui/ui.jsx";
import { useAuth } from "../context/AuthContext";
import { MensagensTab } from "../components/chat/MensagensTab";
import { ChatConversationView } from "../components/chat/ChatConversationView";

/** Conversa única do tenant com o suporte (vista de página inteira). */
function TenantSupport() {
  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[480px] flex-col rounded-xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
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
    <div>
      <PageHeader
        title="Mensagens"
        subtitle={isAdmin ? "Conversas com os teus clientes" : "Fala com o suporte"}
      />
      {isAdmin ? <MensagensTab /> : <TenantSupport />}
    </div>
  );
}
