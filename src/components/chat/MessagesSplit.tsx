import type { ReactNode } from "react";
import { Icon } from "../../ui/icons.jsx";
import { Avatar, EmptyState } from "../../ui/ui.jsx";

/**
 * Master-detail das Mensagens (Clientes e Backoffice): lista à esquerda, conversa à direita.
 * Abaixo de `lg` mostra uma de cada vez (a conversa tem botão "Voltar"). Altura por flex: no telemóvel enche o que
 * sobra abaixo do topbar/separadores; a partir de `sm` o cartão tem altura calculada (a página não faz scroll).
 */
export function MessagesSplit({
  list,
  detail,
  selected,
  emptyTitle,
  emptyDesc,
}: {
  list: ReactNode;
  /** Conversa aberta (cabeçalho + vista); `null` = nenhuma. */
  detail: ReactNode | null;
  selected: boolean;
  emptyTitle: string;
  emptyDesc: string;
}) {
  return (
    <div
      data-testid="messages-split"
      className="flex flex-1 min-h-0 overflow-hidden bg-white dark:bg-zinc-900 sm:rounded-xl sm:border sm:border-zinc-200/80 dark:sm:border-zinc-800"
    >
      <aside
        className={`${selected ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-80 shrink-0 border-r border-zinc-100 dark:border-zinc-800 min-h-0`}
      >
        {list}
      </aside>
      <section className={`${selected ? "flex" : "hidden lg:flex"} flex-1 flex-col min-w-0 min-h-0`}>
        {detail ?? (
          <div className="flex-1 hidden lg:flex">
            <EmptyState icon="message" title={emptyTitle} desc={emptyDesc} />
          </div>
        )}
      </section>
    </div>
  );
}

/** Cabeçalho da conversa aberta, com "Voltar" abaixo de `lg`. */
export function ConversationHeader({
  name,
  subtitle,
  color,
  onBack,
}: {
  name: string;
  subtitle?: string | null;
  color: string;
  onBack: () => void;
}) {
  return (
    <header className="flex items-center gap-2 px-3 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
      <button
        onClick={onBack}
        aria-label="Voltar"
        className="lg:hidden w-9 h-9 -ml-1 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
      >
        <Icon name="chevronLeft" className="w-5 h-5" />
      </button>
      <Avatar name={name} color={color} size={36} />
      <div className="min-w-0">
        <p data-testid="conversation-title" className="text-sm font-semibold text-zinc-900 dark:text-white truncate leading-tight">
          {name}
        </p>
        {subtitle && <p className="text-xs text-zinc-400 truncate">{subtitle}</p>}
      </div>
    </header>
  );
}
