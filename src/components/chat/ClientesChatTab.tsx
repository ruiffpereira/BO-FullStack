import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "../../ui/ui.jsx";
import { useCustomerConversations, useCustomerThread, type CustomerFilter } from "../../hooks/useMessages";
import { customerPreview } from "../../lib/messages";
import { ChatConversationView } from "./ChatConversationView";
import { ConversationRow } from "./ConversationRow";
import { ConversationHeader, MessagesSplit } from "./MessagesSplit";
import { colorFromString } from "./chatFormat";

const PAGE = 30;
/** Parâmetro do URL com a conversa aberta — também é o deep-link do sino e da ficha do cliente. */
export const CONVERSA_PARAM = "conversa";

const FILTERS: { id: CustomerFilter; label: string }[] = [
  { id: "unread", label: "Por ler" },
  { id: "all", label: "Todas" },
];

/** Separador **Clientes**: conversas com os clientes do site (mais recente em cima), pesquisa e fio. */
export function ClientesChatTab() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get(CONVERSA_PARAM);
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [limit, setLimit] = useState(PAGE);

  // Pesquisa com um pequeno atraso para não pedir a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setLimit(PAGE), [filter, debounced]);

  const { data, isLoading, isError } = useCustomerConversations({ filter, search: debounced, limit });
  const conversations = data?.conversations ?? [];
  const thread = useCustomerThread(selectedId);
  const fromList = conversations.find((c) => c.conversationId === selectedId);
  const name = thread.data?.title ?? fromList?.customerName ?? "Cliente";

  const open = (id: string) => setParams((p) => { p.set(CONVERSA_PARAM, id); return p; });
  const close = () => setParams((p) => { p.delete(CONVERSA_PARAM); return p; });

  const list = (
    <>
      <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
        <Input
          icon="search"
          placeholder="Procurar cliente…"
          aria-label="Procurar cliente"
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5" role="group" aria-label="Filtro das conversas">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                filter === f.id
                  ? "bg-accent text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {f.label}
              {f.id === "unread" && (data?.unreadTotal ?? 0) > 0 ? ` (${data?.unreadTotal})` : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
        {isLoading ? (
          <p className="text-sm text-zinc-400 px-2 py-6 text-center">A carregar…</p>
        ) : isError ? (
          <p className="text-sm text-red-500 px-3 py-8 text-center">Não foi possível carregar as conversas.</p>
        ) : conversations.length === 0 ? (
          <p className="text-sm text-zinc-400 px-3 py-8 text-center" data-testid="clientes-empty">
            {debounced
              ? "Sem resultados."
              : filter === "unread"
                ? "Não tens conversas por ler."
                : "Ainda não há conversas com clientes."}
          </p>
        ) : (
          <>
            {conversations.map((c) => (
              <ConversationRow
                key={c.conversationId}
                testId="customer-conversation"
                name={c.customerName}
                colorSeed={c.customerId}
                preview={customerPreview(c)}
                when={c.lastMessageAt ?? null}
                unread={c.unread}
                active={selectedId === c.conversationId}
                onClick={() => open(c.conversationId)}
              />
            ))}
            {data?.hasMore && (
              <button
                onClick={() => setLimit((l) => l + PAGE)}
                className="w-full py-2 text-[12px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Mostrar mais
              </button>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <MessagesSplit
      list={list}
      selected={!!selectedId}
      emptyTitle="Conversas com clientes"
      emptyDesc="Escolhe uma conversa à esquerda."
      detail={
        selectedId ? (
          <>
            <ConversationHeader
              name={name}
              subtitle={thread.data?.subtitle ?? fromList?.customerEmail ?? "Cliente do site"}
              color={colorFromString(fromList?.customerId ?? selectedId)}
              onBack={close}
            />
            <ChatConversationView key={selectedId} scope={{ kind: "customer", conversationId: selectedId }} active />
          </>
        ) : null
      }
    />
  );
}
