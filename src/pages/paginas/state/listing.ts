/**
 * Derivados da lista lateral (F11): linhas da biblioteca, uso dos blocos, onde há traduções em
 * falta, e as preferências por pessoa (ordem e abertos dos grupos) no `localStorage`.
 */
import { EMPTY_PREFIX, LIB_ROOT, blocksIn, sortedFolders } from "./ops";
import type { MissingItem } from "./missing";
import { childrenOf } from "./tree";
import type { Block, Folder, Page, Work } from "./types";

// ── biblioteca ────────────────────────────────────────────────────────────────

export type LibRow =
  | { kind: "folder"; id: string; folder: Folder; count: number; open: boolean }
  | { kind: "block"; id: string; block: Block; parentId: string | null }
  | { kind: "empty"; id: string; parentId: string }
  | { kind: "root"; id: string };

/**
 * Linhas visíveis da biblioteca: pastas (com os blocos por baixo, se abertas), depois "Sem pasta"
 * (só se há pastas) e os blocos soltos. Com pesquisa, só blocos, por nome, numa lista plana.
 */
export function libraryRows(w: Work, closedFolders: ReadonlySet<string>, query: string): LibRow[] {
  const q = query.trim().toLowerCase();
  if (q) {
    return byName(w.blocks, q).map((block) => ({ kind: "block", id: block.id, block, parentId: null }));
  }
  const rows: LibRow[] = [];
  for (const folder of sortedFolders(w)) {
    const inside = blocksIn(w, folder.id);
    const open = !closedFolders.has(folder.id);
    rows.push({ kind: "folder", id: folder.id, folder, count: inside.length, open });
    if (!open) continue;
    if (inside.length === 0) rows.push({ kind: "empty", id: `${EMPTY_PREFIX}${folder.id}`, parentId: folder.id });
    for (const block of inside) rows.push({ kind: "block", id: block.id, block, parentId: folder.id });
  }
  if (w.folders.length > 0) rows.push({ kind: "root", id: LIB_ROOT });
  for (const block of blocksIn(w, null)) rows.push({ kind: "block", id: block.id, block, parentId: null });
  return rows;
}

const byName = (blocks: readonly Block[], q: string): Block[] => blocks.filter((b) => b.name.toLowerCase().includes(q));

/** Em quantas páginas cada bloco está (uma página conta uma vez, mesmo com o bloco repetido). */
export function blockUsage(w: Work): Map<string, number> {
  const out = new Map<string, number>();
  for (const list of Object.values(w.items)) {
    for (const id of new Set(list.filter((it) => it.kind === "block" && it.blockId).map((it) => it.blockId as string))) {
      out.set(id, (out.get(id) ?? 0) + 1);
    }
  }
  return out;
}

// ── traduções em falta, por entidade ──────────────────────────────────────────

export interface MissingIndex {
  /** Páginas com falta nelas ou nos seus itens (especiais). */
  pages: ReadonlySet<string>;
  blocks: ReadonlySet<string>;
  parts: ReadonlySet<string>;
}

export function missingIndex(w: Work, missing: readonly MissingItem[]): MissingIndex {
  const pages = new Set<string>();
  const blocks = new Set<string>();
  const parts = new Set<string>();
  const pageOfItem = new Map<string, string>();
  if (missing.some((m) => m.entity === "item")) {
    for (const [pid, list] of Object.entries(w.items)) for (const it of list) pageOfItem.set(it.id, pid);
  }
  for (const m of missing) {
    if (m.entity === "page") pages.add(m.id);
    else if (m.entity === "block") blocks.add(m.id);
    else if (m.entity === "part") parts.add(m.id);
    else {
      const pid = pageOfItem.get(m.id);
      if (pid) pages.add(pid);
    }
  }
  return { pages, blocks, parts };
}

/** Alguma descendente (qualquer nível) de `id` tem falta? Serve a mãe fechada. */
export function descendantMissing(pages: readonly Page[], id: string, idx: MissingIndex): boolean {
  const seen = new Set<string>([id]);
  const walk = (cur: string): boolean =>
    childrenOf(pages, cur).some((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return idx.pages.has(c.id) || walk(c.id);
    });
  return walk(id);
}

// ── preferências por pessoa (conveniência, não dados) ────────────────────────

export type GroupId = "pages" | "blocks" | "common";
export const DEFAULT_GROUPS: readonly GroupId[] = ["pages", "blocks", "common"];

export interface ListPrefs {
  order: GroupId[];
  /** Grupos fechados. */
  closed: GroupId[];
}

const KEY = "bo.paginas.lista.v1";
const isGroup = (v: unknown): v is GroupId => v === "pages" || v === "blocks" || v === "common";

export const defaultPrefs = (): ListPrefs => ({ order: [...DEFAULT_GROUPS], closed: [] });

/** Valida o que veio do disco: a ordem tem de ser uma permutação dos três grupos. */
export function sanitizePrefs(raw: unknown): ListPrefs {
  const base = defaultPrefs();
  if (typeof raw !== "object" || raw === null) return base;
  const r = raw as { order?: unknown; closed?: unknown };
  if (Array.isArray(r.order) && r.order.length === 3 && r.order.every(isGroup) && new Set(r.order).size === 3) base.order = r.order as GroupId[];
  if (Array.isArray(r.closed)) base.closed = [...new Set(r.closed.filter(isGroup))];
  return base;
}

/** Nunca lança: sem `localStorage` (modo privado, bloqueado, sessão de suporte) usa os defaults. */
export function readPrefs(enabled = true): ListPrefs {
  if (!enabled) return defaultPrefs();
  try {
    const s = window.localStorage.getItem(KEY);
    return s ? sanitizePrefs(JSON.parse(s)) : defaultPrefs();
  } catch {
    return defaultPrefs();
  }
}

export function writePrefs(p: ListPrefs, enabled = true): void {
  if (!enabled) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sem armazenamento: a página funciona na mesma */
  }
}
