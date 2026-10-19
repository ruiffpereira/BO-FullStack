import { Avatar } from "../../ui/ui.jsx";
import { colorFromString, timeLabel } from "./chatFormat";

/** Hora se for de hoje, senão dd/mm. */
export function shortWhen(iso: string): string {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return timeLabel(iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

export interface ConversationRowProps {
  name: string;
  /** Semente da cor do avatar; por omissão o nome. */
  colorSeed?: string;
  avatarColor?: string;
  preview: string | null;
  when: string | null;
  unread: number;
  active: boolean;
  onClick: () => void;
  testId?: string;
  /** Esmaece o nome (ex.: pessoa removida). */
  muted?: boolean;
}

/** Linha de uma lista de conversas (Clientes / Backoffice) — mesmo visual da inbox do admin. */
export function ConversationRow({ name, colorSeed, avatarColor, preview, when, unread, active, onClick, testId, muted }: ConversationRowProps) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      aria-current={active ? "true" : undefined}
      className={`w-full text-left flex items-start gap-3 px-2.5 py-2.5 rounded-lg transition-colors ${
        active ? "bg-accent/10" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
      }`}
    >
      <Avatar name={name} color={avatarColor ?? colorFromString(colorSeed ?? name)} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-semibold truncate ${muted ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-100"}`}>{name}</p>
          {when && <span className="text-[11px] text-zinc-400 shrink-0">{shortWhen(when)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-[13px] truncate ${unread > 0 ? "text-zinc-700 dark:text-zinc-200 font-medium" : "text-zinc-500"}`}>
            {preview ?? "Sem mensagens"}
          </p>
          {unread > 0 && (
            <span
              data-testid="conversation-unread"
              className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
