import type { CampaignBlock } from "../gen/backoffice/types/CampaignBlock";
import type { CampaignSegment } from "../gen/backoffice/types/CampaignSegment";
import { mailErrorMessage } from "./mail";

/**
 * Correio → Campanhas (B42, fase 9) — peças puras do Backoffice. Quem decide é sempre a API (público, saneamento,
 * HTML, preços, estado); aqui só há rótulos, validação rápida de formulário (a API valida outra vez) e formatação.
 */

export const CAMPAIGNS_PATH = "/correio/campanhas";
export const campaignHref = (id: string) => `${CAMPAIGNS_PATH}/${encodeURIComponent(id)}`;
/** Segmento de rota que abre o assistente sem campanha ainda. */
export const NEW_CAMPAIGN = "nova";

// ── Estados ──────────────────────────────────────────────────────────────────

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: "neutral" | "blue" | "amber" | "green" | "red" }> = {
  draft: { label: "Rascunho", tone: "neutral" },
  scheduled: { label: "Agendada", tone: "blue" },
  sending: { label: "A enviar", tone: "amber" },
  sent: { label: "Enviada", tone: "green" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  failed: { label: "Falhou", tone: "red" },
};

/** Filtros da lista: os quatro estados do plano + os que acabam mal. */
export const CAMPAIGN_FILTERS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "draft", label: "Rascunho" },
  { id: "scheduled", label: "Agendada" },
  { id: "sending", label: "A enviar" },
  { id: "sent", label: "Enviada" },
];

export const isCampaignStatus = (v: unknown): v is CampaignStatus =>
  typeof v === "string" && v in CAMPAIGN_STATUS;

// ── Segmentos ────────────────────────────────────────────────────────────────

export type SegmentType = CampaignSegment["type"];

export const SEGMENT_OPTIONS: ReadonlyArray<{ type: SegmentType; label: string; hint: string }> = [
  { type: "all", label: "Todos os subscritos", hint: "Toda a gente que aceitou receber novidades." },
  { type: "members_active", label: "Sócios activos", hint: "Subscritos com mensalidade em dia." },
  { type: "members_overdue", label: "Sócios em atraso", hint: "Subscritos com uma mensalidade vencida por pagar." },
  { type: "agenda_recent", label: "Clientes da agenda", hint: "Subscritos com marcação nos últimos dias." },
  { type: "buyers", label: "Compradores", hint: "Subscritos que compraram na loja." },
  { type: "tag", label: "Etiqueta", hint: "Subscritos com uma etiqueta (Contactos)." },
  { type: "language", label: "Língua", hint: "Subscritos que preferem uma língua." },
];

export const DEFAULT_SEGMENT: CampaignSegment = { type: "all" };

/** Segmento pronto a mandar à API (campos que não pertencem ao tipo ficam de fora). */
export function cleanSegment(s: CampaignSegment, defaultLanguage = "pt"): CampaignSegment {
  switch (s.type) {
    case "agenda_recent":
      return { type: "agenda_recent", days: clampDays(s.days) ?? 30 };
    case "buyers":
      return s.days ? { type: "buyers", days: clampDays(s.days) } : { type: "buyers" };
    case "tag":
      return { type: "tag", tag: (s.tag ?? "").trim() };
    case "language":
      return { type: "language", language: s.language || defaultLanguage };
    default:
      return { type: s.type };
  }
}

function clampDays(n?: number): number | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  return Math.min(3650, Math.max(1, Math.round(n)));
}

/** O segmento está completo para pedir a contagem? (etiqueta vazia ainda não é um segmento) */
export function segmentReady(s: CampaignSegment): boolean {
  if (s.type === "tag") return !!(s.tag ?? "").trim();
  if (s.type === "agenda_recent") return !!clampDays(s.days);
  return true;
}

export function segmentLabel(s?: CampaignSegment | null): string {
  if (!s) return "Todos os subscritos";
  const base = SEGMENT_OPTIONS.find((o) => o.type === s.type)?.label ?? s.type;
  if (s.type === "agenda_recent") return `${base} (últimos ${s.days ?? 30} dias)`;
  if (s.type === "buyers") return s.days ? `${base} (últimos ${s.days} dias)` : base;
  if (s.type === "tag") return `${base}: ${s.tag ?? ""}`;
  if (s.type === "language") return `${base}: ${(s.language ?? "").toUpperCase()}`;
  return base;
}

// ── Blocos ───────────────────────────────────────────────────────────────────

export type BlockType = CampaignBlock["type"];

export const BLOCK_TYPES: ReadonlyArray<{ type: BlockType; label: string; icon: string }> = [
  { type: "title", label: "Título", icon: "edit" },
  { type: "text", label: "Texto", icon: "message" },
  { type: "image", label: "Imagem", icon: "image" },
  { type: "button", label: "Botão", icon: "link" },
  { type: "product", label: "Produto", icon: "box" },
  { type: "service", label: "Serviço", icon: "calendar" },
];

export const blockLabel = (t: BlockType) => BLOCK_TYPES.find((b) => b.type === t)?.label ?? t;

export function newBlock(type: BlockType): CampaignBlock {
  switch (type) {
    case "title":
    case "text":
      return { type, text: "" };
    case "image":
      return { type, url: "", alt: "" };
    case "button":
      return { type, label: "", url: "" };
    default:
      return { type, refId: "", title: "", text: "" };
  }
}

/** Só `https:` — igual à API (`safeHttpsUrl`); `javascript:`, `data:` e `http:` são recusados. */
export function isHttpsUrl(v?: string | null): boolean {
  const raw = (v ?? "").trim();
  if (!raw) return false;
  try {
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

/** Um bloco está vazio (nada para enviar)? Vazios saem antes de guardar. */
export function blockIsEmpty(b: CampaignBlock): boolean {
  switch (b.type) {
    case "title":
    case "text":
      return !(b.text ?? "").trim();
    case "image":
      return !(b.url ?? "").trim();
    case "button":
      return !(b.label ?? "").trim() && !(b.url ?? "").trim();
    default:
      return !(b.refId ?? "").trim() && !(b.title ?? "").trim();
  }
}

/**
 * Erro (PT) de um bloco para mostrar junto dele, ou `null`. Só cobre o que se vê no cliente: URL que não é `https:`,
 * botão sem texto, produto/serviço sem título. A API valida tudo outra vez.
 */
export function blockError(b: CampaignBlock): string | null {
  const bad = (v?: string | null) => !!(v ?? "").trim() && !isHttpsUrl(v);
  switch (b.type) {
    case "image":
      if (!(b.url ?? "").trim()) return "Falta o endereço da imagem.";
      if (!isHttpsUrl(b.url)) return "O endereço da imagem tem de começar por https://";
      if (bad(b.linkUrl)) return "A ligação da imagem tem de começar por https://";
      return null;
    case "button":
      if (!(b.label ?? "").trim()) return "Falta o texto do botão.";
      if (!(b.url ?? "").trim()) return "Falta a ligação do botão.";
      if (!isHttpsUrl(b.url)) return "A ligação do botão tem de começar por https://";
      return null;
    case "product":
    case "service":
      if (!(b.refId ?? "").trim() || !(b.title ?? "").trim()) return "Escolhe um item e dá-lhe um título.";
      if (bad(b.url)) return "A ligação tem de começar por https://";
      if (bad(b.imageUrl)) return "A imagem tem de começar por https://";
      return null;
    default:
      return null;
  }
}

/** Primeiro erro de um conjunto de blocos (para bloquear «Seguinte»). */
export function blocksError(blocks: CampaignBlock[]): string | null {
  for (const b of blocks) {
    if (blockIsEmpty(b)) continue;
    const e = blockError(b);
    if (e) return `${blockLabel(b.type)}: ${e}`;
  }
  return null;
}

/** Blocos prontos a guardar: sem vazios e sem campos vazios (a API recusa `url: ""`). */
export function cleanBlocks(blocks: CampaignBlock[]): CampaignBlock[] {
  return blocks
    .filter((b) => !blockIsEmpty(b))
    .map((b) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(b)) {
        if (typeof v === "string") {
          const t = v.trim();
          if (t || k === "type") out[k] = t;
        } else if (v != null) out[k] = v;
      }
      return out as CampaignBlock;
    });
}

/** Move o item `from` para `to` (sem mutar). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export type CampaignContent = Record<string, CampaignBlock[]>;

/** Línguas com conteúdo (blocos não vazios) — são as que a API trata como línguas da campanha. */
export function languagesWithContent(content: CampaignContent): string[] {
  return Object.entries(content)
    .filter(([, blocks]) => blocks.some((b) => !blockIsEmpty(b)))
    .map(([lang]) => lang);
}

/** Objecto de textos por língua sem as entradas vazias. */
export function cleanTexts(texts: Record<string, string>, langs: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of langs) {
    const v = (texts[l] ?? "").trim();
    if (v) out[l] = v;
  }
  return out;
}

// ── Prontidão (o que falta, e em que passo) ──────────────────────────────────

export const CAMPAIGN_STEPS = [
  { id: "destinatarios", label: "Destinatários" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "teste", label: "Teste" },
  { id: "enviar", label: "Enviar" },
] as const;
export type CampaignStepId = (typeof CAMPAIGN_STEPS)[number]["id"];

/** Passo (índice) a que pertence um erro de `readiness.errors` («Falta o assunto (pt).», «Falta o conteúdo (pt).»). */
export function readinessStep(error: string): number {
  if (/segmento|destinat|p[uú]blico/i.test(error)) return 0;
  return 1;
}

export function readinessByStep(errors: readonly string[] | undefined): string[][] {
  const out: string[][] = CAMPAIGN_STEPS.map(() => []);
  for (const e of errors ?? []) out[readinessStep(e)].push(e);
  return out;
}

// ── Estatísticas ─────────────────────────────────────────────────────────────

/** «42%» de `part` em `whole` (sem divisão por zero). */
export function pct(part?: number | null, whole?: number | null): string {
  const p = part ?? 0;
  const w = whole ?? 0;
  if (!w) return "—";
  return `${Math.round((p / w) * 100)}%`;
}

// ── Datas ────────────────────────────────────────────────────────────────────

/** `datetime-local` (hora do browser) → ISO UTC; `null` se vazio ou inválido. */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO → valor de um `<input type="datetime-local">` (hora do browser). */
export function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Mínimo aceite pela API: daqui a 1 minuto. Para o `min` do input, já com folga. */
export function minScheduleInput(now: Date = new Date()): string {
  return isoToLocalInput(new Date(now.getTime() + 5 * 60_000).toISOString());
}

export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// ── Erros ────────────────────────────────────────────────────────────────────

/** Texto PT de um erro das campanhas; `CAMPAIGN_INCOMPLETE` mostra o que falta (`details[]`) quando a API o diz. */
export function campaignErrorMessage(error: unknown, fallback?: string): string {
  const data = (error as any)?.response?.data;
  if (data?.error === "CAMPAIGN_INCOMPLETE" && Array.isArray(data?.details) && data.details.length > 0) {
    return data.details.map(String).join(" ");
  }
  return mailErrorMessage(error, fallback);
}

/** 409 `CAMPAIGNS_LOCKED`: a página volta ao estado bloqueado. */
export function isCampaignsLocked(error: unknown): boolean {
  const data = (error as any)?.response?.data;
  return (error as any)?.response?.status === 409 && data?.error === "CAMPAIGNS_LOCKED";
}
