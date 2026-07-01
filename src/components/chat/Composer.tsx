import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Icon } from "../../ui/icons.jsx";
import { uploadImage } from "../../gen/backoffice/hooks/useUploadImage.js";
import type { ChatAttachment, MessageInput } from "../../hooks/useChat";

interface PendingAttachment {
  file: File;
  url: string; // blob: preview
  name: string;
  mime: string;
}

export interface ComposerProps {
  onSend: (input: MessageInput) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Caixa de escrita do chat: textarea auto-grow, anexos de imagem com upload
 * diferido (só ao Enviar) e envio com Enter (Shift+Enter = nova linha).
 */
export function Composer({ onSend, disabled = false, placeholder = "Escreve uma mensagem…" }: ComposerProps) {
  const [text, setText] = useState("");
  const [atts, setAtts] = useState<PendingAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const next: PendingAttachment[] = [];
    for (const file of Array.from(list).slice(0, 10)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({ file, url: URL.createObjectURL(file), name: file.name, mime: file.type });
    }
    setAtts((prev) => [...prev, ...next].slice(0, 10));
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeAtt(i: number) {
    setAtts((prev) => {
      const a = prev[i];
      if (a && a.url.startsWith("blob:")) URL.revokeObjectURL(a.url);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  async function handleSend() {
    if (busy || disabled) return;
    const body = text.trim();
    if (!body && atts.length === 0) return;
    setBusy(true);
    try {
      const uploaded: ChatAttachment[] = [];
      for (const a of atts) {
        const r: any = await uploadImage({ image: a.file, module: "chat" } as any);
        uploaded.push({
          url: r.fileUrl,
          name: a.name,
          mime: a.mime,
          size: a.file.size,
          srcSet: r.srcSet,
        });
        if (a.url.startsWith("blob:")) URL.revokeObjectURL(a.url);
      }
      await onSend({ body: body || null, attachments: uploaded.length ? uploaded : null });
      setText("");
      setAtts([]);
      if (taRef.current) {
        taRef.current.style.height = "auto";
        taRef.current.focus(); // mantém o teclado aberto após enviar
      }
    } catch {
      // mantém o conteúdo para o utilizador tentar de novo
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
      e.preventDefault();
      void handleSend();
    }
  }

  const canSend = (!!text.trim() || atts.length > 0) && !busy && !disabled;

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800 px-2.5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-white dark:bg-zinc-900">
      {atts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {atts.map((a, i) => (
            <div key={i} className="relative group">
              <img src={a.url} alt={a.name} className="w-16 h-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" />
              <button
                onClick={() => removeAtt(i)}
                aria-label="Remover anexo"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 text-white flex items-center justify-center shadow"
              >
                <Icon name="x" className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => pickFiles(e.target.files)}
        />
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          disabled={busy || disabled}
          aria-label="Anexar imagem"
          className="shrink-0 w-11 h-11 sm:w-10 sm:h-10 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center disabled:opacity-50"
        >
          <Icon name="paperclip" className="w-[18px] h-[18px]" />
        </button>

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autoGrow();
          }}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Mensagem"
          className="flex-1 resize-none bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-3.5 py-2.5 sm:py-2 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent/30 max-h-[140px]"
        />

        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label="Enviar"
          className="shrink-0 w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-sm shadow-accent/20 hover:brightness-110 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
        >
          <Icon name={busy ? "loader" : "send"} className={`w-[18px] h-[18px] ${busy ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
