import { useEffect, useRef, useState } from "react";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useDeleteNotification,
  type Notification,
} from "../hooks/useNotifications";
import { usePushSubscription } from "../hooks/usePushSubscription";

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function CheckAllIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12l5 5L22 5" />
      <path d="M16 5l-5 5" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function NotificationItem({
  n,
  onRead,
  onDelete,
}: {
  n: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const when = new Date(n.createdAt).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const typeLabel = n.type === "booking" ? "Marcação" : "Encomenda";

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
        n.read ? "opacity-60" : ""
      }`}
    >
      <span
        className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
          n.type === "booking"
            ? "bg-blue-500"
            : "bg-emerald-500"
        } ${n.read ? "opacity-0" : ""}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 leading-snug truncate">
              {n.title}
            </p>
            {n.body && (
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                {n.body}
              </p>
            )}
            <p className="text-[11px] text-zinc-400 mt-1">
              <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium mr-1.5 ${
                n.type === "booking"
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              }`}>
                {typeLabel}
              </span>
              {when}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!n.read && (
              <button
                onClick={() => onRead(n.notificationId)}
                aria-label="Marcar como lida"
                className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <CheckAllIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onDelete(n.notificationId)}
              aria-label="Eliminar"
              className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const deleteN = useDeleteNotification();
  const { permission, requestAndSubscribe } = usePushSubscription();

  const unread = data?.unread ?? 0;
  const notifications = data?.notifications ?? [];

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}
        aria-expanded={open}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative"
      >
        <BellIcon className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notificações"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-100">
              Notificações
              {unread > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-semibold">
                  {unread}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="px-2 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                >
                  Marcar todas
                </button>
              )}
              {/* Push permission toggle */}
              {permission !== "granted" && "Notification" in window && (
                <button
                  onClick={requestAndSubscribe}
                  title="Ativar notificações push"
                  className="px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline rounded"
                >
                  Ativar push
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-[13px] text-zinc-400">
                A carregar…
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-zinc-400 dark:text-zinc-500">
                <BellIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Sem notificações
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.notificationId}
                    n={n}
                    onRead={(id) => markRead.mutate(id)}
                    onDelete={(id) => deleteN.mutate(id)}
                  />
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 text-center">
              <span className="text-[11px] text-zinc-400">
                {data?.total ?? 0} notificação{(data?.total ?? 0) !== 1 ? "s" : ""} no total
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
