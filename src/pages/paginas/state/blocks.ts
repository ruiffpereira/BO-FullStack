/**
 * Blocos e itens de página (F12): copiar, duplicar, usar, pontos de partida e especiais.
 *
 * Duas famílias, que não se misturam (CONTRATO §1):
 *  - **Usar** (partilhar) — o item novo aponta para o MESMO `blockId`; mudar o bloco muda em todas as páginas.
 *  - **Copiar / Duplicar / "cópia só nesta página"** — um bloco NOVO, com ids novos em tudo (o bloco, os
 *    componentes e os `_id` dos itens de listas, a qualquer fundura dentro dos valores) e o nome com
 *    " (cópia)". A âncora não se copia (é única por tenant).
 *
 * Os `build*` são puros: devolvem a `WorkOp` pronta para o `apply` (uma entrada no desfazer) ou `null`
 * se o gesto não faz sentido. Os ids vêm de `IdGen`, para os testes serem determinísticos.
 */
import { newEntityId, newShortId } from "./ids";
import { blockUsage } from "./listing";
import type { Comp, Holder, WorkOp } from "./ops";
import type { Block, Catalog, FieldSpecs, Item, Manifest, PartName, Sel, Starter, Work } from "./types";

export interface IdGen {
  /** UUID: blocos e itens de página. */
  entity: () => string;
  /** nanoid(10): componentes e `_id` de itens de lista. */
  short: () => string;
}
export const DEFAULT_IDS: IdGen = { entity: newEntityId, short: newShortId };

export const COPY_SUFFIX = " (cópia)";
export const BLOCK_NAME_MAX = 120;
export const NEW_BLOCK_NAME = "Bloco novo";

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

export function copyName(name: string): string {
  return (name.trim() || "Bloco").slice(0, BLOCK_NAME_MAX - COPY_SUFFIX.length) + COPY_SUFFIX;
}

/** Cópia profunda de um valor em que cada `_id` (itens de listas) é novo. */
export function reIdValue<T>(v: T, ids: Pick<IdGen, "short">): T {
  if (Array.isArray(v)) return v.map((x) => reIdValue(x, ids)) as T;
  if (isObj(v)) {
    const out: Rec = {};
    for (const [k, x] of Object.entries(v)) out[k] = k === "_id" && typeof x === "string" ? ids.short() : reIdValue(x, ids);
    return out as T;
  }
  return v;
}

/** Componente independente: `id` novo e `_id` novos em todos os itens de listas. */
export const copyComp = (c: Comp, ids: IdGen = DEFAULT_IDS): Comp => ({ ...(reIdValue(c, ids) as Comp), id: ids.short() });

/** Bloco independente: id, componentes e `_id` novos; sem âncora; fica na mesma pasta. */
export function copyBlock(src: Block, ids: IdGen = DEFAULT_IDS): Block {
  const comps = (Array.isArray(src.comps) ? src.comps : []).map((c) => copyComp(c as Comp, ids));
  return { ...src, id: ids.entity(), name: copyName(src.name), anchor: null, sortOrder: undefined, comps };
}

/** Valores por omissão de uns campos (hoje: o `default` das `choice`). Nunca inventa texto. */
export function defaultValues(fields: FieldSpecs): Rec {
  const out: Rec = {};
  for (const [k, spec] of Object.entries(fields)) if (spec.default !== undefined) out[k] = spec.default;
  return out;
}

// ── a partir do catálogo e do manifest ────────────────────────────────────────

/** O fundo de um bloco novo: sempre o 1.º do manifest. Sem manifest não há fundo ("") e não se cria bloco. */
export const firstBackground = (m: Manifest | null): string => m?.backgrounds?.[0]?.id ?? "";

/** Componente novo: 1.º estilo do manifest (ou `normal`) e os valores por omissão do catálogo (o título nasce H2). */
export const newComp = (type: string, col: string | number, catalog: Catalog | null, manifest: Manifest | null, ids: IdGen = DEFAULT_IDS): Comp => ({
  id: ids.short(),
  type,
  style: manifest?.styles?.[type]?.[0]?.id ?? "normal",
  col,
  v: defaultValues(catalog?.components.find((x) => x.type === type)?.fields ?? {}),
});

/** Bloco novo a partir de um ponto de partida (§3.3): disposição, componentes com o 1.º estilo do manifest. */
export function newBlockFromStarter(starter: Starter, catalog: Catalog | null, manifest: Manifest | null, ids: IdGen = DEFAULT_IDS): Block {
  const layout = (starter.layout >= 1 && starter.layout <= 3 ? starter.layout : 1) as Block["layout"];
  return {
    id: ids.entity(),
    name: starter.id === "branco" ? NEW_BLOCK_NAME : starter.label,
    folderId: null,
    layout,
    bg: firstBackground(manifest),
    anchor: null,
    comps: starter.comps.map((c) => newComp(c.type, layout === 1 ? "all" : c.col, catalog, manifest, ids)),
  };
}

const blockItem = (blockId: string, ids: IdGen): Item => ({ id: ids.entity(), kind: "block", blockId, specialType: null, specialData: null, hidden: false });

/** Especial novo: só se o manifest o declara; nasce com os valores por omissão da spec. */
export function newSpecialItem(type: string, manifest: Manifest | null, ids: IdGen = DEFAULT_IDS): Item | null {
  const def = manifest?.specials?.[type];
  if (!def) return null;
  return { id: ids.entity(), kind: "special", blockId: null, specialType: type, specialData: defaultValues(def.fields), hidden: false };
}

/** Os especiais que o manifest declara (vazio ⇒ a paleta não mostra o separador). */
export const specialEntries = (m: Manifest | null): { type: string; label: string; desc?: string }[] =>
  Object.entries(m?.specials ?? {}).map(([type, s]) => ({ type, label: s.label, desc: s.desc }));

/** "Usar um que já existe": os blocos da biblioteca que ainda não estão nesta página, por nome. */
export function usableBlocks(w: Work, pageId: string): Block[] {
  const onPage = new Set((w.items[pageId] ?? []).map((it) => it.blockId).filter(Boolean));
  return w.blocks.filter((b) => !onPage.has(b.id)).sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

/** "Título · Texto ×2" — o resumo dos componentes. */
export function blockSummary(b: { comps?: unknown[] | null }, catalog: Catalog | null): string {
  const counts = new Map<string, number>();
  for (const c of b.comps ?? []) {
    const t = isObj(c) && typeof c.type === "string" ? c.type : "";
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (!counts.size) return "Sem componentes";
  return [...counts].map(([t, n]) => `${catalog?.components.find((x) => x.type === t)?.label ?? t}${n > 1 ? ` ×${n}` : ""}`).join(" · ");
}

// ── gestos → operações ────────────────────────────────────────────────────────

type Add = Extract<WorkOp, { type: "addItem" }>;
type Result<T extends WorkOp = WorkOp> = T | null;

const hasPage = (w: Work, pageId: string) => w.pages.some((p) => p.id === pageId) && !!w.items[pageId];

/** Bloco novo de um ponto de partida: na página (`pageId`) ou só na biblioteca (`null`). */
export function buildNewBlock(w: Work, pageId: string | null, index: number, starter: Starter, catalog: Catalog | null, manifest: Manifest | null, ids: IdGen = DEFAULT_IDS): Result {
  if (!firstBackground(manifest)) return null;
  const block = newBlockFromStarter(starter, catalog, manifest, ids);
  if (pageId === null) return { type: "addBlock", block };
  return hasPage(w, pageId) ? { type: "addItem", pageId, index, item: blockItem(block.id, ids), block } : null;
}

/** "Usar um que já existe": partilha (mesmo `blockId`). */
export function buildUseBlock(w: Work, pageId: string, index: number, blockId: string, ids: IdGen = DEFAULT_IDS): Result<Add> {
  if (!hasPage(w, pageId) || !w.blocks.some((b) => b.id === blockId)) return null;
  return { type: "addItem", pageId, index, item: blockItem(blockId, ids) };
}

/** "Copiar um que já existe": bloco novo e independente. */
export function buildCopyBlock(w: Work, pageId: string | null, index: number, blockId: string, ids: IdGen = DEFAULT_IDS): Result {
  const src = w.blocks.find((b) => b.id === blockId);
  if (!src) return null;
  const block = copyBlock(src, ids);
  if (pageId === null) return { type: "addBlock", block };
  return hasPage(w, pageId) ? { type: "addItem", pageId, index, item: blockItem(block.id, ids), block } : null;
}

export function buildAddSpecial(w: Work, manifest: Manifest | null, pageId: string, index: number, type: string, ids: IdGen = DEFAULT_IDS): Result<Add> {
  const item = newSpecialItem(type, manifest, ids);
  return item && hasPage(w, pageId) ? { type: "addItem", pageId, index, item } : null;
}

/** "Duplicar": copia independente logo a seguir (bloco ou especial). */
export function buildDuplicateItem(w: Work, pageId: string, itemId: string, ids: IdGen = DEFAULT_IDS): Result<Add> {
  const list = w.items[pageId] ?? [];
  const at = list.findIndex((it) => it.id === itemId);
  if (at < 0) return null;
  const it = list[at];
  if (it.kind === "special") {
    return { type: "addItem", pageId, index: at + 1, item: { ...it, id: ids.entity(), specialData: reIdValue(it.specialData ?? null, ids) } };
  }
  const src = w.blocks.find((b) => b.id === it.blockId);
  if (!src) return null;
  const block = copyBlock(src, ids);
  return { type: "addItem", pageId, index: at + 1, item: { ...blockItem(block.id, ids), hidden: !!it.hidden }, block };
}

/** "Usar uma cópia só nesta página": só faz sentido num bloco partilhado por 2 ou mais páginas. */
export function buildSeparateItem(w: Work, pageId: string, itemId: string, ids: IdGen = DEFAULT_IDS): Result {
  const it = w.items[pageId]?.find((x) => x.id === itemId);
  const src = it?.kind === "block" ? w.blocks.find((b) => b.id === it.blockId) : undefined;
  if (!it || !src || (blockUsage(w).get(src.id) ?? 0) < 2) return null;
  return { type: "separateItem", pageId, itemId, block: copyBlock(src, ids) };
}

// ── editor de bloco/parte (F14) ───────────────────────────────────────────────

/** O que se abre ao carregar num item da página (bloco com `ref` = o item; especial = o próprio item). */
export const selFor = (it: Item): Sel =>
  it.kind === "special" ? { kind: "item", id: it.id } : { kind: "block", id: it.blockId ?? "", ref: it.id };

/** Posição de um item na lista da página e os vizinhos ("N de M", anterior/seguinte). */
export function neighbours(list: readonly Item[], itemId: string): { index: number; total: number; prev: Item | null; next: Item | null } | null {
  const i = list.findIndex((it) => it.id === itemId);
  return i < 0 ? null : { index: i, total: list.length, prev: list[i - 1] ?? null, next: list[i + 1] ?? null };
}

/** Componentes que uma parte aceita (o manifest restringe o catálogo). `null` = fora de uma parte: todos. */
export function allowedTypes(part: PartName | null, catalog: Catalog | null, manifest: Manifest | null): string[] | null {
  if (!part) return null;
  const base = catalog?.parts?.[part];
  const wanted = manifest?.parts?.[part] ?? base ?? [];
  return base ? wanted.filter((t) => base.includes(t)) : wanted;
}

/** Texto de um valor (`I18n` na língua base, ou string). */
const textOf = (v: unknown, base: string): string =>
  typeof v === "string" ? v : isObj(v) && typeof v[base] === "string" ? (v[base] as string) : "";

/** A linha de resumo de um componente: o 1.º texto que tem (campos pela ordem do catálogo; listas pela 1.ª linha). */
export function compSummary(c: Comp, catalog: Catalog | null, base: string): string {
  const scan = (fields: FieldSpecs, v: unknown): string => {
    if (!isObj(v)) return "";
    for (const [name, spec] of Object.entries(fields)) {
      let t = "";
      if (spec.type === "text" || spec.type === "md") t = textOf(v[name], base);
      else if (spec.type === "list" && spec.of && Array.isArray(v[name])) t = scan(spec.of, v[name][0]);
      if (t.trim()) return t.trim();
    }
    return "";
  };
  const t = scan(catalog?.components.find((x) => x.type === c.type)?.fields ?? {}, c.v).replace(/[*_#>`]/g, "").replace(/\s+/g, " ");
  return t.length > 70 ? `${t.slice(0, 69)}…` : t;
}

/** Quem tem componentes (blocos, topo, rodapé) com o que a paleta "Copiar um que já existe" precisa. */
export function compHolders(w: Work): { key: string; name: string; bg: string; layout: number; comps: Comp[] }[] {
  const part = (id: PartName, name: string) => {
    const p = w.parts[id] as { layout?: number; bg?: string; comps?: Comp[] } | null;
    return { key: id, name, bg: p?.bg ?? "claro", layout: p?.layout ?? 1, comps: p?.comps ?? [] };
  };
  return [part("topo", "Topo"), part("rodape", "Rodapé"), ...w.blocks.map((b) => ({ key: b.id, name: b.name || "Sem nome", bg: b.bg, layout: b.layout, comps: (b.comps ?? []) as Comp[] }))];
}

type AddComp = Extract<WorkOp, { type: "addComp" }>;

/** "Componente novo" (de `type`) na posição `index`. `null` se o tipo não existe ou a parte não o aceita. */
export function buildAddComp(holder: Holder, index: number, type: string, catalog: Catalog | null, manifest: Manifest | null, ids: IdGen = DEFAULT_IDS): AddComp | null {
  if (!catalog?.components.some((c) => c.type === type)) return null;
  const allowed = allowedTypes(holder.kind === "part" ? holder.id : null, catalog, manifest);
  if (allowed && !allowed.includes(type)) return null;
  return { type: "addComp", holder, index, comp: newComp(type, "all", catalog, manifest, ids) };
}

/** "Copiar um que já existe" / "Duplicar": o componente `src` com ids novos (o `addComp` ajusta a coluna à disposição de destino). */
export function buildCopyComp(holder: Holder, index: number, src: Comp, catalog: Catalog | null, manifest: Manifest | null, ids: IdGen = DEFAULT_IDS): AddComp | null {
  const allowed = allowedTypes(holder.kind === "part" ? holder.id : null, catalog, manifest);
  return allowed && !allowed.includes(src.type) ? null : { type: "addComp", holder, index, comp: copyComp(src, ids) };
}

/** Duplicar um componente do próprio bloco/parte: logo a seguir. */
export function buildDuplicateComp(w: Work, holder: Holder, compId: string, ids: IdGen = DEFAULT_IDS): AddComp | null {
  const comps = (holder.kind === "block" ? w.blocks.find((b) => b.id === holder.id)?.comps : w.parts[holder.id]?.comps) as Comp[] | undefined;
  const at = comps?.findIndex((c) => c.id === compId) ?? -1;
  return comps && at >= 0 ? { type: "addComp", holder, index: at + 1, comp: copyComp(comps[at], ids) } : null;
}
