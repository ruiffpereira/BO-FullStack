import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { Icon } from "../../ui/icons.jsx";
import { Avatar, Button, Modal, Input, EmptyState } from "../../ui/ui.jsx";
import { useAuth } from "../../context/AuthContext";
import { useAdminConversations, type ChatConversation } from "../../hooks/useChat";
import { ChatConversationView } from "./ChatConversationView";
import { colorFromString, timeLabel } from "./chatFormat";

interface UserRow {
  userId: string;
  name?: string;
  username?: string;
  email?: string;
}

interface SelectedTenant {
  tenantUserId: string;
  tenantName: string;
}

function userName(u: UserRow): string {
  return u.name || u.username || u.email || "—";
}

function shortWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return timeLabel(iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

/** Lista de utilizadores (tenants) para iniciar uma conversa nova. */
function useUsersPicker(enabled: boolean) {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<UserRow[]>({
    queryKey: ["chat", "users-picker"],
    enabled: isAuthenticated && enabled,
    queryFn: async () => {
      const res = await axiosInstance.get("/users", { headers: authHeader() });
      const data: any = res.data;
      const arr = Array.isArray(data) ? data : (data?.users ?? []);
      return arr as UserRow[];
    },
  });
}

function NewConversationModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (t: SelectedTenant) => void;
}) {
  const { data: users, isLoading } = useUsersPicker(open);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const list = users ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (u) => userName(u).toLowerCase().includes(s) || (u.email ?? "").toLowerCase().includes(s),
    );
  }, [users, q]);

  return (
    <Modal open={open} onClose={onClose} title="Nova conversa" subtitle="Escolhe um cliente para iniciar">
      <Input icon="search" placeholder="Procurar cliente…" value={q} onChange={(e: any) => setQ(e.target.value)} />
      <div className="mt-3 max-h-80 overflow-y-auto -mx-1">
        {isLoading ? (
          <p className="text-sm text-zinc-400 px-2 py-6 text-center">A carregar…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-400 px-2 py-6 text-center">Sem clientes.</p>
        ) : (
          filtered.map((u) => (
            <button
              key={u.userId}
              onClick={() => {
                onPick({ tenantUserId: u.userId, tenantName: userName(u) });
                onClose();
              }}
              className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
            >
              <Avatar name={userName(u)} color={colorFromString(u.userId)} size={34} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{userName(u)}</p>
                {u.email && <p className="text-[12px] text-zinc-400 truncate">{u.email}</p>}
              </div>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

function ConvItem({
  c,
  active,
  onClick,
}: {
  c: ChatConversation;
  active: boolean;
  onClick: () => void;
}) {
  const preview = c.lastMessage
    ? (c.lastMessage.senderRole === "admin" ? "Tu: " : "") + c.lastMessage.preview
    : "—";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-2.5 py-2.5 rounded-lg transition-colors ${
        active ? "bg-accent/10" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
      }`}
    >
      <Avatar name={c.tenantName} color={colorFromString(c.tenantUserId)} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">{c.tenantName}</p>
          {c.lastMessageAt && (
            <span className="text-[11px] text-zinc-400 shrink-0">{shortWhen(c.lastMessageAt)}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-[13px] truncate ${c.unread > 0 ? "text-zinc-700 dark:text-zinc-200 font-medium" : "text-zinc-500"}`}>
            {preview}
          </p>
          {c.unread > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center">
              {c.unread > 99 ? "99+" : c.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/** Tab "Mensagens" do Admin: inbox master-detail de todos os tenants. */
export function MensagensTab() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedTenant | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const { data, isLoading } = useAdminConversations(search);
  const conversations = data?.conversations ?? [];

  return (
    <div className="flex h-[calc(100vh-15rem)] min-h-[480px] rounded-xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
      {/* Lista */}
      <aside
        className={`${selected ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-80 shrink-0 border-r border-zinc-100 dark:border-zinc-800`}
      >
        <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
          <div className="flex-1">
            <Input
              icon="search"
              placeholder="Procurar tenant…"
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" icon="plus" onClick={() => setNewOpen(true)}>
            Nova
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {isLoading ? (
            <p className="text-sm text-zinc-400 px-2 py-6 text-center">A carregar…</p>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-zinc-400 px-3 py-8 text-center">
              {search ? "Sem resultados." : "Ainda não há conversas."}
            </p>
          ) : (
            conversations.map((c) => (
              <ConvItem
                key={c.conversationId}
                c={c}
                active={selected?.tenantUserId === c.tenantUserId}
                onClick={() => setSelected({ tenantUserId: c.tenantUserId, tenantName: c.tenantName })}
              />
            ))
          )}
        </div>
      </aside>

      {/* Detalhe */}
      <section className={`${selected ? "flex" : "hidden lg:flex"} flex-1 flex-col min-w-0`}>
        {selected ? (
          <>
            <header className="flex items-center gap-2 px-3 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <button
                onClick={() => setSelected(null)}
                aria-label="Voltar"
                className="lg:hidden w-9 h-9 -ml-1 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
              >
                <Icon name="chevronLeft" className="w-5 h-5" />
              </button>
              <Avatar name={selected.tenantName} color={colorFromString(selected.tenantUserId)} size={36} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate leading-tight">
                  {selected.tenantName}
                </p>
                <p className="text-xs text-zinc-400">Conversa de suporte</p>
              </div>
            </header>
            <ChatConversationView
              key={selected.tenantUserId}
              scope={{ kind: "admin", tenantUserId: selected.tenantUserId }}
              active
            />
          </>
        ) : (
          <div className="flex-1 hidden lg:flex">
            <EmptyState icon="message" title="As tuas conversas" desc="Escolhe um tenant à esquerda ou começa uma conversa nova." />
          </div>
        )}
      </section>

      <NewConversationModal open={newOpen} onClose={() => setNewOpen(false)} onPick={setSelected} />
    </div>
  );
}
