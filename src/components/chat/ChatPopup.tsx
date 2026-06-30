import { useState } from "react";
import { Icon } from "../../ui/icons.jsx";
import { Avatar, Input } from "../../ui/ui.jsx";
import { useAuth } from "../../context/AuthContext";
import { useAdminConversations } from "../../hooks/useChat";
import { ChatConversationView } from "./ChatConversationView";
import { colorFromString, timeLabel } from "./chatFormat";

interface SelectedTenant {
  tenantUserId: string;
  tenantName: string;
}

function shortWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return timeLabel(iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

function PopupHeader({
  title,
  subtitle,
  onClose,
  onBack,
  avatarName,
  avatarColor,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onBack?: () => void;
  avatarName?: string;
  avatarColor?: string;
}) {
  return (
    <header className="flex items-center gap-2.5 px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Voltar"
          className="w-8 h-8 -ml-1 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
        >
          <Icon name="chevronLeft" className="w-5 h-5" />
        </button>
      )}
      {avatarName && <Avatar name={avatarName} color={avatarColor} size={32} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate leading-tight">{title}</p>
        {subtitle && <p className="text-[11px] text-zinc-400 truncate">{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        aria-label="Fechar"
        className="w-8 h-8 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
      >
        <Icon name="x" className="w-4 h-4" />
      </button>
    </header>
  );
}

function TenantPopup({ onClose }: { onClose: () => void }) {
  return (
    <>
      <PopupHeader title="Suporte" subtitle="Falamos contigo por aqui" onClose={onClose} avatarName="Suporte" avatarColor="#0EA5A4" />
      <ChatConversationView scope={{ kind: "support" }} active />
    </>
  );
}

function AdminPopup({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<SelectedTenant | null>(null);
  const [q, setQ] = useState("");
  const { data, isLoading } = useAdminConversations(q);
  const conversations = data?.conversations ?? [];

  if (selected) {
    return (
      <>
        <PopupHeader
          title={selected.tenantName}
          subtitle="Conversa de suporte"
          onClose={onClose}
          onBack={() => setSelected(null)}
          avatarName={selected.tenantName}
          avatarColor={colorFromString(selected.tenantUserId)}
        />
        <ChatConversationView
          key={selected.tenantUserId}
          scope={{ kind: "admin", tenantUserId: selected.tenantUserId }}
          active
        />
      </>
    );
  }

  return (
    <>
      <PopupHeader title="Mensagens" subtitle="Conversas com clientes" onClose={onClose} />
      <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <Input icon="search" placeholder="Procurar…" value={q} onChange={(e: any) => setQ(e.target.value)} />
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isLoading ? (
          <p className="text-sm text-zinc-400 px-2 py-6 text-center">A carregar…</p>
        ) : conversations.length === 0 ? (
          <p className="text-sm text-zinc-400 px-3 py-8 text-center">
            {q ? "Sem resultados." : "Ainda não há conversas."}
          </p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.conversationId}
              onClick={() => setSelected({ tenantUserId: c.tenantUserId, tenantName: c.tenantName })}
              className="w-full text-left flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
            >
              <Avatar name={c.tenantName} color={colorFromString(c.tenantUserId)} size={34} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">{c.tenantName}</p>
                  {c.lastMessageAt && (
                    <span className="text-[10px] text-zinc-400 shrink-0">{shortWhen(c.lastMessageAt)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-[12px] truncate ${c.unread > 0 ? "text-zinc-700 dark:text-zinc-200 font-medium" : "text-zinc-500"}`}>
                    {c.lastMessage ? (c.lastMessage.senderRole === "admin" ? "Tu: " : "") + c.lastMessage.preview : "—"}
                  </p>
                  {c.unread > 0 && (
                    <span className="shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}

/** Mini-chat flutuante (widget) aberto pela bolinha do canto inferior direito. */
export function ChatPopup({ onClose }: { onClose: () => void }) {
  const { permissions } = useAuth();
  const isAdmin = permissions.some((p) => p.name === "VIEW_ADMIN");

  return (
    <div
      role="dialog"
      aria-label="Mensagens"
      className="fixed z-40 bottom-[5.5rem] right-4 sm:right-5 w-[calc(100vw-2rem)] sm:w-[380px] h-[min(560px,calc(100dvh-7.5rem))] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[pop_.16s_cubic-bezier(.2,.8,.2,1)]"
    >
      {isAdmin ? <AdminPopup onClose={onClose} /> : <TenantPopup onClose={onClose} />}
    </div>
  );
}
