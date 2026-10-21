import { Icon } from "../../ui/icons.jsx";
import type { MailThreadSummary } from "../../gen/backoffice/types/MailThreadSummary";
import { addressSummary, formatMailDate, type MailFolder } from "../../lib/mail";

// O pin só se esconde (até ao hover/foco) onde há rato E espaço (computador): em ecrãs táteis e a 390px está sempre à vista.
const PIN_HIDDEN =
  "[@media(hover:hover)_and_(min-width:768px)]:opacity-0 [@media(hover:hover)_and_(min-width:768px)]:group-hover:opacity-100 [@media(hover:hover)_and_(min-width:768px)]:group-focus-within:opacity-100";

/**
 * Uma linha: remetente (destinatário nos Enviados), assunto, pré-visualização, data e clipe de anexo. O pin (CR-26) é um
 * botão IRMÃO do botão da linha (nunca dentro dele): clicar não abre a conversa. Escrita → fica desactivado só com «Ver».
 */
export function MailThreadRow({
  item,
  folder,
  selected,
  onSelect,
  onTogglePin,
  pinGuard,
}: {
  item: MailThreadSummary;
  folder: MailFolder;
  selected?: boolean;
  onSelect: () => void;
  /** Fixar / desafixar (`pinned` = o estado pedido). Sem isto a linha não mostra o pin. */
  onTogglePin?: (threadId: string, pinned: boolean) => void;
  /** `useWriteGuard` da caixa: `readOnly` desactiva o pin e `message` diz porquê. */
  pinGuard?: { readOnly: boolean; message: string };
}) {
  const who = folder === "sent" ? `Para: ${addressSummary(item.to) || "—"}` : addressSummary(item.from) || "(sem remetente)";
  const pinned = !!item.pinned;
  const blocked = !!pinGuard?.readOnly;
  return (
    <li data-pinned={pinned ? "true" : "false"} className="group relative border-b border-zinc-100 dark:border-zinc-800">
      <button
        type="button"
        data-testid="mail-thread-row"
        data-unread={item.unread ? "true" : "false"}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={`w-full text-left px-3 py-2.5 transition-colors ${
          selected ? "bg-accent/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }`}
      >
        <div className="flex items-center gap-2">
          {item.unread ? <span aria-label="Não lida" className="w-2 h-2 rounded-full bg-accent shrink-0" /> : <span className="w-2 shrink-0" />}
          <span className={`min-w-0 flex-1 truncate text-sm ${item.unread ? "font-semibold text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"}`}>
            {who}
          </span>
          {item.hasAttachment && <span title="Tem anexos" data-testid="mail-clip" className="shrink-0 text-zinc-400"><Icon name="paperclip" className="w-3.5 h-3.5" /></span>}
          <time className="shrink-0 text-[11px] text-zinc-400" dateTime={item.receivedAt}>
            {formatMailDate(item.receivedAt)}
          </time>
        </div>
        <p className={`pl-4 pr-8 truncate text-[13px] ${item.unread ? "font-medium text-zinc-800 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}`}>
          {item.subject || "(sem assunto)"}
        </p>
        {item.preview && <p className="pl-4 pr-8 truncate text-xs text-zinc-400">{item.preview}</p>}
      </button>
      {onTogglePin && (
        <button
          type="button"
          data-testid="mail-pin"
          aria-pressed={pinned}
          aria-label={pinned ? "Desafixar conversa" : "Fixar conversa"}
          title={blocked ? pinGuard?.message : pinned ? "Desafixar" : "Fixar no topo"}
          disabled={blocked}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(item.threadId ?? "", !pinned);
          }}
          className={`absolute right-1 bottom-1 w-8 h-8 rounded-lg flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40 ${
            pinned ? "text-accent" : `text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ${PIN_HIDDEN}`
          } ${blocked ? "" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
        >
          <Icon name="pin" className={`w-4 h-4 ${pinned ? "fill-current" : ""}`} />
        </button>
      )}
    </li>
  );
}

/** Paginação do servidor (Anterior / Seguinte). */
export function MailPager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  if (pages <= 1) return null;
  return (
    <div className="shrink-0 flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800 px-3 py-2 text-xs text-zinc-500">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
      >
        Anterior
      </button>
      <span>
        {page} / {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
      >
        Seguinte
      </button>
    </div>
  );
}
