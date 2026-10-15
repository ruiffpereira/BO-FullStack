/**
 * Operações da lista lateral (F11) e do conteúdo da página (F12) sobre a cópia de trabalho: funções puras `Work → Work`.
 *
 * Entram no reducer pela acção `op` (`store.ts`), por isso cada uma é UMA entrada no desfazer.
 * Uma operação recusada ou sem efeito devolve o MESMO `Work` — o reducer não regista nada.
 * Ids novos vêm de fora (o `build*` abaixo gera-os), para o reducer continuar puro.
 */
import { newEntityId } from "./ids";
import { MAX_DEPTH, canAddChild, childrenOf, movePage, type DropPosition } from "./tree";
import type { Block, Folder, Item, LangCtx, Page, Work } from "./types";

/** Id da linha "Sem pasta" da biblioteca: largar um bloco nela tira-o da pasta. */
export const LIB_ROOT = "__sem-pasta__";
/** Prefixo da linha "Arrasta blocos para aqui" de uma pasta vazia (conta como a própria pasta). */
export const EMPTY_PREFIX = "vazia:";

export const FOLDER_NAME_MAX = 80;
const DEFAULT_PAGE_TITLE = "Nova página";
const HOME_TITLE = "Início";

export type WorkOp =
  | { type: "movePage"; from: string; to: string; position: DropPosition; maxDepth?: number }
  | { type: "addPage"; page: Page; items: Item[] }
  | { type: "addFolder"; folder: Folder }
  | { type: "renameFolder"; id: string; name: string }
  | { type: "deleteFolder"; id: string }
  | { type: "moveLibrary"; from: string; to: string; position: DropPosition }
  // F12 — conteúdo da página. `block` (opcional) é um bloco NOVO que entra na biblioteca na mesma operação.
  | { type: "addBlock"; block: Block }
  | { type: "addItem"; pageId: string; index: number; item: Item; block?: Block }
  | { type: "removeItem"; pageId: string; itemId: string }
  | { type: "hideItem"; pageId: string; itemId: string; hidden: boolean }
  /** "Cópia só nesta página": o item passa a apontar para `block` (uma cópia nova); as outras páginas ficam. */
  | { type: "separateItem"; pageId: string; itemId: string; block: Block }
  | { type: "moveItem"; pageId: string; from: string; to: string; position: "before" | "after" };

// ── ordem ─────────────────────────────────────────────────────────────────────

type Ordered = { id: string; sortOrder?: number };
const byOrder = <T extends Ordered>(list: readonly T[]): T[] =>
  list.map((x, i) => ({ x, i })).sort((a, b) => (a.x.sortOrder ?? 0) - (b.x.sortOrder ?? 0) || a.i - b.i).map(({ x }) => x);

export const sortedFolders = (w: Work): Folder[] => byOrder(w.folders);
/** Blocos de uma pasta (`null` = soltos), pela ordem da biblioteca. */
export const blocksIn = (w: Work, folderId: string | null): Block[] =>
  byOrder(w.blocks.filter((b) => (b.folderId ?? null) === folderId));

/** Aplica `sortOrder = índice` a `list`; devolve só o que mudou (para o changeset ser mínimo). */
function renumber<T extends Ordered>(list: readonly T[], extra?: (x: T) => Partial<T>): Map<string, T> {
  const out = new Map<string, T>();
  list.forEach((x, i) => {
    const patch = extra?.(x) ?? {};
    const changed = x.sortOrder !== i || Object.entries(patch).some(([k, v]) => (x as Record<string, unknown>)[k] !== v);
    if (changed) out.set(x.id, { ...x, ...patch, sortOrder: i });
  });
  return out;
}

const replaceBy = <T extends { id: string }>(list: readonly T[], changes: ReadonlyMap<string, T>): T[] =>
  list.map((x) => changes.get(x.id) ?? x);

// ── biblioteca: pastas e blocos ───────────────────────────────────────────────

/** `vazia:<pasta>` e a própria pasta são o mesmo alvo ("dentro"). */
const libTarget = (id: string): string => (id.startsWith(EMPTY_PREFIX) ? id.slice(EMPTY_PREFIX.length) : id);

export function canMoveLibrary(w: Work, from: string, toRaw: string, position: DropPosition): boolean {
  const to = libTarget(toRaw);
  if (from === to || toRaw === from) return false;
  const isBlock = w.blocks.some((b) => b.id === from);
  const isFolder = w.folders.some((f) => f.id === from);
  if (isBlock) {
    if (to === LIB_ROOT) return position === "inside";
    if (w.folders.some((f) => f.id === to)) return position === "inside";
    return w.blocks.some((b) => b.id === to) && position !== "inside";
  }
  if (isFolder) return w.folders.some((f) => f.id === to) && position !== "inside";
  return false;
}

function moveLibrary(w: Work, from: string, toRaw: string, position: DropPosition): Work {
  if (!canMoveLibrary(w, from, toRaw, position)) return w;
  const to = libTarget(toRaw);
  const block = w.blocks.find((b) => b.id === from);

  if (block) {
    const targetBlock = w.blocks.find((b) => b.id === to);
    const newFolder: string | null = targetBlock ? (targetBlock.folderId ?? null) : to === LIB_ROOT ? null : to;
    const oldFolder = block.folderId ?? null;
    const sibs = blocksIn(w, newFolder).filter((b) => b.id !== from);
    const at = targetBlock ? sibs.findIndex((b) => b.id === to) + (position === "after" ? 1 : 0) : sibs.length;
    sibs.splice(at, 0, block);
    const changes = renumber(sibs, () => ({ folderId: newFolder }));
    if (oldFolder !== newFolder) {
      for (const [id, b] of renumber(blocksIn(w, oldFolder).filter((b) => b.id !== from))) changes.set(id, b);
    }
    return changes.size ? { ...w, blocks: replaceBy(w.blocks, changes) } : w;
  }

  const sibs = sortedFolders(w).filter((f) => f.id !== from);
  sibs.splice(sibs.findIndex((f) => f.id === to) + (position === "after" ? 1 : 0), 0, w.folders.find((f) => f.id === from)!);
  const changes = renumber(sibs);
  return changes.size ? { ...w, folders: replaceBy(w.folders, changes) } : w;
}

// ── blocos comuns a todas as páginas ──────────────────────────────────────────

/**
 * Os blocos que estão em TODAS as páginas (por referência), na ordem da primeira página
 * (a home, se existir). Sem páginas, nenhum. Especiais não contam: pertencem a uma página.
 */
export function commonBlockIds(w: Work): string[] {
  if (!w.pages.length) return [];
  const lists = w.pages.map((p) => (w.items[p.id] ?? []).filter((it) => it.kind === "block" && it.blockId));
  const first = (w.pages.find((p) => p.isHome) ?? w.pages[0]).id;
  const base = (w.items[first] ?? []).filter((it) => it.kind === "block" && it.blockId).map((it) => it.blockId as string);
  const inAll = base.filter((id) => lists.every((l) => l.some((it) => it.blockId === id)));
  return [...new Set(inAll)];
}

// ── páginas novas ─────────────────────────────────────────────────────────────

function uniqueSlug(pages: readonly Page[], base: string): string {
  const taken = new Set(pages.map((p) => p.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export interface NewPageOptions {
  /** Mãe (`null` = primeiro nível). */
  parentId: string | null;
  maxPages?: number;
  maxDepth?: number;
  newId?: () => string;
}

/**
 * "Nova" página (CONTRATO §1): primeiro nível nasce com os blocos que estão em todas as páginas
 * (os mesmos blocos, por referência); subpágina nasce vazia. A primeira página de um site vazio é a
 * home. O título leva o mesmo texto em todas as línguas — o novo texto não deixa "por traduzir".
 * `null` se não cabe (limite de páginas, profundidade, mãe inexistente ou home).
 */
export function buildAddPage(w: Work, lang: LangCtx, o: NewPageOptions): Extract<WorkOp, { type: "addPage" }> | null {
  const newId = o.newId ?? newEntityId;
  if (w.pages.length >= (o.maxPages ?? 200)) return null;
  if (o.parentId !== null && !canAddChild(w.pages, o.parentId, o.maxDepth ?? MAX_DEPTH)) return null;
  const isHome = w.pages.length === 0 && o.parentId === null;
  const text = isHome ? HOME_TITLE : DEFAULT_PAGE_TITLE;
  const langs = lang.languages.includes(lang.defaultLanguage) ? lang.languages : [lang.defaultLanguage, ...lang.languages];
  const page: Page = {
    id: newId(),
    parentId: o.parentId,
    isHome,
    slug: isHome ? "" : uniqueSlug(w.pages, "nova-pagina"),
    slugs: null,
    title: Object.fromEntries(langs.map((l) => [l, text])),
    status: "draft",
    seo: null,
  };
  const items: Item[] =
    o.parentId === null
      ? commonBlockIds(w).map((blockId): Item => ({ id: newId(), kind: "block", blockId, specialType: null, specialData: null, hidden: false }))
      : [];
  return { type: "addPage", page, items };
}

// ── itens da página (F12) ─────────────────────────────────────────────────────

/** Junta um bloco novo ao fim da sua pasta (ou dos soltos). Id repetido: sem efeito. */
function withBlock(w: Work, block: Block): Work {
  if (w.blocks.some((b) => b.id === block.id)) return w;
  const sibs = blocksIn(w, block.folderId ?? null);
  const sortOrder = sibs.length ? Math.max(...sibs.map((b) => b.sortOrder ?? 0)) + 1 : 0;
  return { ...w, blocks: [...w.blocks, { ...block, sortOrder }] };
}

function addItem(w: Work, op: Extract<WorkOp, { type: "addItem" }>): Work {
  const list = w.items[op.pageId];
  if (!list || !w.pages.some((p) => p.id === op.pageId)) return w;
  if (Object.values(w.items).some((l) => l.some((it) => it.id === op.item.id))) return w;
  const withIt = op.block ? withBlock(w, op.block) : w;
  if (op.item.kind === "block" && !withIt.blocks.some((b) => b.id === op.item.blockId)) return w;
  if (op.item.kind === "special" && !op.item.specialType) return w;
  const at = Math.max(0, Math.min(op.index, list.length));
  return { ...withIt, items: { ...withIt.items, [op.pageId]: [...list.slice(0, at), op.item, ...list.slice(at)] } };
}

const mapItem = (w: Work, pageId: string, itemId: string, f: (it: Item) => Item): Work => {
  const list = w.items[pageId];
  if (!list?.some((it) => it.id === itemId)) return w;
  return { ...w, items: { ...w.items, [pageId]: list.map((it) => (it.id === itemId ? f(it) : it)) } };
};

function moveItem(w: Work, op: Extract<WorkOp, { type: "moveItem" }>): Work {
  const list = w.items[op.pageId];
  const item = list?.find((it) => it.id === op.from);
  if (!list || !item || op.from === op.to || !list.some((it) => it.id === op.to)) return w;
  const rest = list.filter((it) => it.id !== op.from);
  rest.splice(rest.findIndex((it) => it.id === op.to) + (op.position === "after" ? 1 : 0), 0, item);
  return { ...w, items: { ...w.items, [op.pageId]: rest } };
}

// ── despacho ──────────────────────────────────────────────────────────────────

export function applyOp(w: Work, op: WorkOp): Work {
  switch (op.type) {
    case "movePage": {
      const pages = movePage(w.pages, op.from, op.to, op.position, op.maxDepth);
      return pages === w.pages ? w : { ...w, pages };
    }
    case "addPage": {
      if (w.pages.some((p) => p.id === op.page.id)) return w;
      const sibs = childrenOf(w.pages, op.page.parentId ?? null);
      const sortOrder = sibs.length ? Math.max(...sibs.map((p) => p.sortOrder ?? 0)) + 1 : 0;
      return { ...w, pages: [...w.pages, { ...op.page, sortOrder }], items: { ...w.items, [op.page.id]: op.items } };
    }
    case "addFolder": {
      if (w.folders.some((f) => f.id === op.folder.id)) return w;
      const sortOrder = w.folders.length ? Math.max(...w.folders.map((f) => f.sortOrder ?? 0)) + 1 : 0;
      return { ...w, folders: [...w.folders, { ...op.folder, name: op.folder.name.slice(0, FOLDER_NAME_MAX), sortOrder }] };
    }
    case "renameFolder": {
      const name = op.name.trim().slice(0, FOLDER_NAME_MAX);
      const f = w.folders.find((x) => x.id === op.id);
      if (!f || !name || f.name === name) return w;
      return { ...w, folders: w.folders.map((x) => (x.id === op.id ? { ...x, name } : x)) };
    }
    case "deleteFolder": {
      // Só vazias: o servidor também recusa (`FOLDER_NOT_EMPTY`).
      if (!w.folders.some((f) => f.id === op.id) || w.blocks.some((b) => b.folderId === op.id)) return w;
      return { ...w, folders: w.folders.filter((f) => f.id !== op.id) };
    }
    case "moveLibrary":
      return moveLibrary(w, op.from, op.to, op.position);
    case "addBlock":
      return withBlock(w, op.block);
    case "addItem":
      return addItem(w, op);
    case "removeItem": {
      const list = w.items[op.pageId];
      return list?.some((it) => it.id === op.itemId) ? { ...w, items: { ...w.items, [op.pageId]: list.filter((it) => it.id !== op.itemId) } } : w;
    }
    case "hideItem":
      return (w.items[op.pageId]?.find((it) => it.id === op.itemId)?.hidden ?? false) === op.hidden ? w : mapItem(w, op.pageId, op.itemId, (it) => ({ ...it, hidden: op.hidden }));
    case "separateItem": {
      const it = w.items[op.pageId]?.find((x) => x.id === op.itemId);
      if (!it || it.kind !== "block" || it.blockId === op.block.id) return w;
      const withNew = withBlock(w, op.block);
      return mapItem(withNew, op.pageId, op.itemId, (x) => ({ ...x, blockId: op.block.id }));
    }
    case "moveItem":
      return moveItem(w, op);
  }
}

