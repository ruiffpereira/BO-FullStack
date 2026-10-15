import { useEffect, useRef, useState } from "react";
import { GuardButton } from "../../../components/GuardButton";
import { useBuilder, type SaveStatus } from "../state/store";
import type { GetCmsSiteBuilder200 } from "../../../gen/backoffice/types/GetCmsSiteBuilder";

type Publish = GetCmsSiteBuilder200["publish"];

const hhmm = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
};

/**
 * A linha de estado da barra de topo (F16): gravação primeiro, depois a publicação.
 *  - `runtime`: o site lê a API, por isso "No ar" logo a seguir a gravar (não há nada a esperar);
 *  - `github`: "A publicar no site…" enquanto `pending`/`running`, "No ar" quando `live`, "Falhou: <motivo>".
 * A API não envia a hora em que entrou no ar: usa-se a do último pedido (`requestedAt`) e, na falta, a
 * da última gravação desta sessão.
 */
export function publishLine(i: { save: SaveStatus; dirty: boolean; publish: Publish; savedAt?: string | null }): { tone: string; text: string } {
  const { save, dirty, publish, savedAt } = i;
  if (save === "saving") return { tone: "bg-amber-500 animate-pulse", text: "A guardar…" };
  if (save === "conflict") return { tone: "bg-red-500", text: "Conta alterada noutro sítio" };
  if (save === "invalid" || save === "error") return { tone: "bg-red-500", text: "Não foi possível guardar" };
  if (dirty) return { tone: "bg-amber-500", text: "Alterações por guardar" };
  const s = publish?.status;
  if (s === "pending" || s === "running") return { tone: "bg-blue-500 animate-pulse", text: "A publicar no site…" };
  if (s === "failed") return { tone: "bg-red-500", text: publish?.error ? `Falhou: ${publish.error}` : "Falhou a publicação" };
  if (s === "live" || publish?.mode === "runtime") {
    const t = hhmm(publish?.requestedAt) ?? hhmm(savedAt);
    return { tone: "bg-emerald-500", text: t ? `No ar · ${t}` : "No ar" };
  }
  return { tone: "bg-emerald-500", text: "Guardado" };
}

export function StatusText() {
  const { state, dirty, publish } = useBuilder();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const rev = useRef(state.revision);
  useEffect(() => {
    if (state.revision !== rev.current) {
      rev.current = state.revision;
      setSavedAt(new Date().toISOString());
    }
  }, [state.revision]);
  const { tone, text } = publishLine({ save: state.status, dirty, publish, savedAt });
  return (
    <span role="status" className="inline-flex items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-300 min-w-0 max-w-full">
      <span className={`w-2 h-2 rounded-full shrink-0 ${tone}`} aria-hidden="true" />
      <span className="truncate" title={text}>{text}</span>
    </span>
  );
}

/** "Publicar agora": só em modo `github` (em `runtime` o site já lê a API). */
export function PublishNowButton() {
  const { state, dirty, publish, publishNow } = useBuilder();
  const [busy, setBusy] = useState(false);
  if (publish?.mode !== "github") return null;
  const running = publish.status === "running";
  const blocked = dirty || state.status === "saving";
  return (
    <GuardButton
      variant="outline"
      className="min-h-10"
      isLoading={busy}
      disabled={blocked || running || busy}
      title={dirty ? "Guarda as alterações antes de publicar." : running ? "Já há uma publicação a decorrer." : "Publica já, sem esperar pelo minuto de intervalo."}
      onClick={() => {
        setBusy(true);
        void publishNow().finally(() => setBusy(false));
      }}
    >
      Publicar agora
    </GuardButton>
  );
}
