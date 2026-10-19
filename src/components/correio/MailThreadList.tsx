import { Icon } from "../../ui/icons.jsx";
import type { MailThreadSummary } from "../../gen/backoffice/types/MailThreadSummary";
import { addressSummary, formatMailDate, type MailFolder } from "../../lib/mail";

/** Uma linha: remetente (destinatário nos Enviados), assunto, pré-visualização, data e clipe de anexo. */
export function MailThreadRow({
  item,
  folder,
  selected,
  onSelect,
}: {
  item: MailThreadSummary;
  folder: MailFolder;
  selected?: boolean;
  onSelect: () => void;
}) {
  const who = folder === "sent" ? `Para: ${addressSummary(item.to) || "—"}` : addressSummary(item.from) || "(sem remetente)";
  return (
    <li>
      <button
        type="button"
        data-testid="mail-thread-row"
        data-unread={item.unread ? "true" : "false"}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={`w-full text-left px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 transition-colors ${
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
        <p className={`pl-4 truncate text-[13px] ${item.unread ? "font-medium text-zinc-800 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}`}>
          {item.subject || "(sem assunto)"}
        </p>
        {item.preview && <p className="pl-4 truncate text-xs text-zinc-400">{item.preview}</p>}
      </button>
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
