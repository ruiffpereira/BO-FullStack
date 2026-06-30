import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Icon } from "../../ui/icons.jsx";
import { useChatUnread } from "../../hooks/useChat";
import { ChatPopup } from "./ChatPopup";

/**
 * Botão flutuante de mensagens (canto inferior direito). Abre um **mini-chat
 * por cima** da página atual (widget), sem navegar. Aparece em todas as páginas
 * EXCETO em /mensagens. Badge de não-lidas via `useChatUnread`.
 */
export function ChatFab() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const unread = useChatUnread();

  // Escape fecha o widget
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Fecha ao mudar de página
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (location.pathname === "/mensagens") return null;

  return (
    <>
      {open && <ChatPopup onClose={() => setOpen(false)} />}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar mensagens" : `Mensagens${unread ? ` (${unread} não lidas)` : ""}`}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 sm:right-5 z-40 w-14 h-14 rounded-full bg-accent text-white shadow-lg shadow-accent/30 flex items-center justify-center hover:brightness-110 active:scale-95 transition"
      >
        <Icon name={open ? "x" : "message"} className="w-6 h-6" />
        {!open && unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white dark:border-zinc-950"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    </>
  );
}
