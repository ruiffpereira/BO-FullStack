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
 *  - `coolify`: "A publicar no site…" enquanto `pending`/`running` (o detalhe está na `PublishBar`), "No ar" quando
 *    `live`, "Falhou: <motivo>".
 * A hora é a de `liveAt` (a API grava-a quando o site passa a servir a revisão; em `runtime`, a cada gravação).
 * Em `runtime` uma gravação desta sessão é mais recente do que o `liveAt` lido no arranque, por isso ganha.
 */
export function publishLine(i: { save: SaveStatus; dirty: boolean; publish: Publish; savedAt?: string | null }): { tone: string; text: string } {
  const { save, dirty, publish, savedAt } = i;
  if (save === "saving") return { tone: "bg-amber-500 animate-pulse", text: "A guardar…" };
  if (save === "conflict") return { tone: "bg-red-500", text: "Conta alterada noutro sítio" };
  if (save === "invalid" || save === "error") return { tone: "bg-red-500", text: "Não foi possível guardar" };
  if (dirty) return { tone: "bg-amber-500", text: "Alterações por guardar" };
  const s = publish?.status;
  if (s === "pending" || s === "running") return { tone: "bg-blue-500 animate-pulse", text: "A publicar no site…" };
  // Em `coolify` o motivo vai inteiro na `PublishBar` logo por baixo: aqui só o estado (a 390 o motivo truncado repetia-se).
  if (s === "failed") return { tone: "bg-red-500", text: publish?.error && publish.mode !== "coolify" ? `Falhou: ${publish.error}` : "Falhou a publicação" };
  if (s === "live" || publish?.mode === "runtime") {
    const t = (publish?.mode === "runtime" ? hhmm(savedAt) : null) ?? hhmm(publish?.liveAt);
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

// ── barra persistente da publicação (B38 · P2) ──────────────────────────────────

/** Tecto da percentagem estimada enquanto o site não confirma a revisão (100 % só quando está no ar). */
export const PROGRESS_CAP = 95;

/** Percentagem estimada = tempo decorrido ÷ duração média dos deploys anteriores; `null` sem base (barra indeterminada). */
export function progressPercent(startedAt: string | null | undefined, estimatedMs: number | null | undefined, nowMs: number): number | null {
  if (!startedAt || !estimatedMs || estimatedMs <= 0) return null;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return null;
  const pct = Math.floor(((nowMs - start) / estimatedMs) * 100);
  return Math.min(PROGRESS_CAP, Math.max(0, pct));
}

export type PublishBarView =
  | { kind: "progress"; label: string; percent: number | null }
  | { kind: "live"; label: string }
  | { kind: "failed"; label: string };

const PHASE_LABEL: Record<string, string> = { queued: "Em fila…", building: "A construir o site…", confirming: "A confirmar…" };

/**
 * O que a barra mostra. Só em modo `coolify` (em `runtime` não há deploy). `pending`/`running` → fase e percentagem;
 * `failed` → o motivo (persiste até à próxima publicação); `live` → "Site actualizado · hh:mm", mas só quando esta
 * página viu o deploy a correr (`sawRunning`) — abrir Páginas com o site parado no ar não mostra barra nenhuma.
 */
export function publishBar(publish: Publish | undefined, nowMs: number, sawRunning: boolean): PublishBarView | null {
  if (!publish || publish.mode !== "coolify") return null;
  const s = publish.status;
  if (s === "pending") return { kind: "progress", label: PHASE_LABEL.queued, percent: null };
  if (s === "running") {
    return {
      kind: "progress",
      label: PHASE_LABEL[publish.phase ?? "queued"] ?? PHASE_LABEL.queued,
      percent: progressPercent(publish.startedAt, publish.estimatedMs, nowMs),
    };
  }
  if (s === "failed") return { kind: "failed", label: publish.error ? `Falhou: ${publish.error}` : "Falhou a publicação" };
  if (s === "live" && sawRunning) {
    const t = hhmm(publish.liveAt);
    return { kind: "live", label: t ? `Site actualizado · ${t}` : "Site actualizado" };
  }
  return null;
}

/**
 * Barra fina no topo de Páginas com o progresso do deploy. O estado vem do `GET /cms/site-builder` (que o editor já
 * repete a cada 5 s enquanto `pending`/`running`), por isso sobrevive a um refresh; o cliente continua a editar.
 * O relógio local só serve para a percentagem avançar entre leituras.
 */
export function PublishBar() {
  const { publish } = useBuilder();
  const running = publish?.status === "pending" || publish?.status === "running";
  const [now, setNow] = useState(() => Date.now());
  const [sawRunning, setSawRunning] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!running) return;
    setSawRunning(true);
    setHidden(false);
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const view = publishBar(publish, now, sawRunning);
  if (!view || (hidden && view.kind === "live")) return null;

  const tone =
    view.kind === "failed"
      ? "border-red-300/60 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
      : view.kind === "live"
        ? "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
        : "border-blue-300/60 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200";
  const percent = view.kind === "progress" ? view.percent : view.kind === "live" ? 100 : null;

  return (
    <div
      data-testid="publish-bar"
      data-kind={view.kind}
      role={view.kind === "failed" ? "alert" : "status"}
      aria-live="polite"
      className={`shrink-0 rounded-lg border px-3 py-2 text-[13px] ${tone}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex-1 min-w-0 break-words">{view.label}</span>
        {view.kind === "progress" && percent !== null && <span className="shrink-0 tabular-nums font-medium">{percent}%</span>}
        {view.kind === "live" && (
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="Fechar"
            className="shrink-0 -my-1 min-h-8 min-w-8 inline-flex items-center justify-center rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
      {view.kind !== "failed" && (
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/70 dark:bg-white/10"
          role="progressbar"
          aria-label="Progresso da publicação"
          aria-valuemin={0}
          aria-valuemax={100}
          {...(percent !== null ? { "aria-valuenow": percent } : {})}
        >
          {percent !== null ? (
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${view.kind === "live" ? "bg-emerald-500" : "bg-blue-500"}`}
              style={{ width: `${percent}%` }}
            />
          ) : (
            <div className="h-full w-1/3 rounded-full bg-blue-500 animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}

/** "Publicar agora": só em modo `coolify` (em `runtime` o site já lê a API). Serve sobretudo para repetir um `failed`. */
export function PublishNowButton() {
  const { state, dirty, publish, publishNow, canPublish } = useBuilder();
  const [busy, setBusy] = useState(false);
  // Equipa (B41 2b): publicar é a acção `paginas.publicar` — sem ela o botão nem aparece.
  if (publish?.mode !== "coolify" || !canPublish) return null;
  const running = publish.status === "running" || publish.status === "pending";
  const blocked = dirty || state.status === "saving";
  return (
    <GuardButton
      leaf="paginas.publicar"
      variant="outline"
      className="min-h-10"
      isLoading={busy}
      disabled={blocked || running || busy}
      title={dirty ? "Guarda as alterações antes de publicar." : running ? "Já há uma publicação a decorrer." : "Volta a publicar o site (gravar já publica sozinho)."}
      onClick={() => {
        setBusy(true);
        void publishNow().finally(() => setBusy(false));
      }}
    >
      Publicar agora
    </GuardButton>
  );
}
