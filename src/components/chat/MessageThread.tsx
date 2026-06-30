import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../../ui/icons.jsx";
import type { ChatAttachment, ChatMessage, SenderRole } from "../../hooks/useChat";
import { dayKey, dayLabel, timeLabel } from "./chatFormat";

function isImageAttachment(a: ChatAttachment): boolean {
  return !!a.mime?.startsWith("image") || /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(a.url);
}

/** Só http(s) é clicável/renderável — bloqueia javascript:/data:/blob: (anti-XSS). */
function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function Attachments({ items, mine }: { items: ChatAttachment[]; mine: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 mb-1">
      {items.map((a, i) =>
        !isSafeHttpUrl(a.url) ? (
          <span key={i} className="inline-flex items-center gap-2 text-[13px] opacity-70">
            <Icon name="paperclip" className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-[12rem]">{a.name || "Anexo"}</span>
          </span>
        ) : isImageAttachment(a) ? (
          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block">
            <img
              src={a.url}
              alt={a.name || "imagem"}
              className="rounded-lg max-h-52 w-auto object-cover border border-black/5"
              loading="lazy"
            />
          </a>
        ) : (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] ${
              mine
                ? "bg-white/15 hover:bg-white/25"
                : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <Icon name="paperclip" className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-[12rem]">{a.name || "Ficheiro"}</span>
          </a>
        ),
      )}
    </div>
  );
}

function MessageBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const hasText = !!(m.body && m.body.trim());
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] sm:max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words ${
          mine
            ? "bg-accent text-white rounded-br-md"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-bl-md"
        } ${m.failed ? "ring-1 ring-red-400" : ""} ${m.pending ? "opacity-70" : ""}`}
      >
        {m.attachments?.length ? <Attachments items={m.attachments} mine={mine} /> : null}
        {hasText && <p className="whitespace-pre-wrap">{m.body}</p>}
        <span className={`block text-[10px] mt-1 text-right ${mine ? "text-white/70" : "text-zinc-400"}`}>
          {timeLabel(m.createdAt)}
        </span>
      </div>
    </div>
  );
}

function DayDivider({ iso }: { iso: string }) {
  return (
    <div className="flex items-center justify-center my-3">
      <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-500">
        {dayLabel(iso)}
      </span>
    </div>
  );
}

export interface MessageThreadProps {
  messages: ChatMessage[];
  meRole: SenderRole;
  otherLastReadAt: string | null;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  isLoading: boolean;
}

export function MessageThread({
  messages,
  meRole,
  otherLastReadAt,
  hasMore,
  loadingOlder,
  onLoadOlder,
  isLoading,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prevLen = useRef(0);
  const [showJump, setShowJump] = useState(false);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = atBottom;
    if (atBottom) setShowJump(false);
  }

  // useLayoutEffect + rAF: garante o scroll ao fundo ANTES do paint e de novo
  // após o layout/animação assentar (ex.: o popup que abre com transform/scale,
  // ou dados em cache que já vêm no 1.º render).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stick.current) {
      const toBottom = () => {
        const node = scrollRef.current;
        if (node && stick.current) node.scrollTop = node.scrollHeight;
      };
      toBottom();
      requestAnimationFrame(toBottom);
    } else if (messages.length > prevLen.current) {
      setShowJump(true);
    }
    prevLen.current = messages.length;
  }, [messages]);

  function jumpToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    stick.current = true;
    setShowJump(false);
  }

  const lastMineIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].senderRole === meRole) return i;
    return -1;
  })();

  function statusFor(m: ChatMessage): string {
    if (m.pending) return "A enviar…";
    if (m.failed) return "Não enviada";
    if (otherLastReadAt && new Date(otherLastReadAt).getTime() >= new Date(m.createdAt).getTime())
      return "Visto";
    return "Entregue";
  }

  let lastDay = "";

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label="Mensagens"
        className="h-full overflow-y-auto overscroll-contain px-3 sm:px-4 py-3"
      >
        {hasMore && (
          <div className="flex justify-center mb-3">
            <button
              onClick={onLoadOlder}
              disabled={loadingOlder}
              className="px-3 py-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-full bg-zinc-100 dark:bg-zinc-800 disabled:opacity-50"
            >
              {loadingOlder ? "A carregar…" : "Carregar mais antigas"}
            </button>
          </div>
        )}

        {isLoading && messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-zinc-400">A carregar…</div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 px-6">
            <Icon name="message" className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Sem mensagens ainda.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {messages.map((m, idx) => {
              const dk = dayKey(new Date(m.createdAt));
              const showDay = dk !== lastDay;
              lastDay = dk;
              const mine = m.senderRole === meRole;
              return (
                <div key={m.messageId}>
                  {showDay && <DayDivider iso={m.createdAt} />}
                  <MessageBubble m={m} mine={mine} />
                  {idx === lastMineIdx && mine && (
                    <div className="flex justify-end pr-1 mt-0.5">
                      <span className={`text-[11px] ${m.failed ? "text-red-500" : "text-zinc-400"}`}>
                        {statusFor(m)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showJump && (
        <button
          onClick={jumpToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white text-[12px] font-medium shadow-lg"
        >
          <Icon name="arrowDown" className="w-3.5 h-3.5" /> Novas mensagens
        </button>
      )}
    </div>
  );
}
