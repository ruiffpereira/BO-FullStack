import { useNavigate } from "react-router-dom";
import { Icon } from "../../ui/icons.jsx";
import { useChatUnread } from "../../hooks/useChat";

/**
 * Ícone de mensagens no topbar (para todos). Navega para /mensagens e mostra
 * badge de não-lidas (admin = nº de conversas por ler; tenant = a sua conversa).
 */
export function ChatLauncher() {
  const navigate = useNavigate();
  const unread = useChatUnread();

  return (
    <button
      onClick={() => navigate("/mensagens")}
      aria-label={`Mensagens${unread ? ` (${unread} não lidas)` : ""}`}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative"
    >
      <Icon name="message" className="w-[18px] h-[18px]" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
