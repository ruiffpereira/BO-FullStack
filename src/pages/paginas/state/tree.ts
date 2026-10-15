/** Árvore de páginas para a lista (home primeiro, depois em profundidade por `sortOrder`). */
import type { Page } from "./types";

export interface PageRow {
  page: Page;
  depth: number;
}

const byOrder = (a: Page, b: Page) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

export function flattenPages(pages: readonly Page[]): PageRow[] {
  const ids = new Set(pages.map((p) => p.id));
  const kids = new Map<string | null, Page[]>();
  for (const p of pages) {
    // uma mãe que não existe (estado inconsistente) não pode esconder a página
    const parent = p.parentId && ids.has(p.parentId) ? p.parentId : null;
    kids.set(parent, [...(kids.get(parent) ?? []), p]);
  }
  const out: PageRow[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    const list = (kids.get(parent) ?? []).slice().sort((a, b) => (a.isHome === b.isHome ? byOrder(a, b) : a.isHome ? -1 : 1));
    for (const page of list) {
      if (seen.has(page.id)) continue; // ciclo: nunca entra em ciclo
      seen.add(page.id);
      out.push({ page, depth });
      walk(page.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Título na língua base (cai na primeira língua com texto; nunca vazio). */
export function pageTitle(page: Page, base: string): string {
  const t = page.title ?? {};
  const v = t[base]?.trim() || Object.values(t).find((x) => typeof x === "string" && x.trim());
  return v || "Sem título";
}

// ── regras da árvore (CONTRATO §6.3), já no cliente ──────────────────────────
// Sem ciclos · a home fica no primeiro nível e não recebe filhas · profundidade ≤ 4.
// A API continua a ser a autoridade; isto só evita oferecer ao utilizador o que ela recusaria.

export const MAX_DEPTH = 4;
export type DropPosition = "before" | "after" | "inside";

const parentOf = (ids: ReadonlySet<string>, p: Page): string | null => (p.parentId && ids.has(p.parentId) ? p.parentId : null);
const idSet = (pages: readonly Page[]) => new Set(pages.map((p) => p.id));

/** As filhas de `parentId` (`null` = primeiro nível), pela ordem da lista: a home primeiro. */
export function childrenOf(pages: readonly Page[], parentId: string | null): Page[] {
  const ids = idSet(pages);
  return pages
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => parentOf(ids, p) === parentId)
    .sort((a, b) => (a.p.isHome !== b.p.isHome ? (a.p.isHome ? -1 : 1) : byOrder(a.p, b.p) || a.i - b.i))
    .map(({ p }) => p);
}

/** Nível da página: 1 = primeiro nível. 0 se não existe. */
export function depthOf(pages: readonly Page[], id: string): number {
  const ids = idSet(pages);
  const byId = new Map(pages.map((p) => [p.id, p]));
  let depth = 0;
  const seen = new Set<string>();
  for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = byId.get(parentOf(ids, cur) ?? "")) {
    seen.add(cur.id);
    depth++;
  }
  return depth;
}

/** Altura da subárvore: 1 = folha. */
export function heightOf(pages: readonly Page[], id: string): number {
  const seen = new Set<string>();
  const walk = (cur: string): number => {
    if (seen.has(cur)) return 0;
    seen.add(cur);
    return 1 + Math.max(0, ...childrenOf(pages, cur).map((c) => walk(c.id)));
  };
  return walk(id);
}

/** `id` está dentro de `ancestorId` (em qualquer nível)? */
export function isDescendant(pages: readonly Page[], id: string, ancestorId: string): boolean {
  const ids = idSet(pages);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const seen = new Set<string>();
  for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = byId.get(parentOf(ids, cur) ?? "")) {
    seen.add(cur.id);
    if (parentOf(ids, cur) === ancestorId) return true;
  }
  return false;
}

/** Cabe mais uma filha dentro de `parentId`? (a home nunca recebe filhas) */
export function canAddChild(pages: readonly Page[], parentId: string | null, maxDepth = MAX_DEPTH): boolean {
  if (parentId === null) return true;
  const parent = pages.find((p) => p.id === parentId);
  return !!parent && !parent.isHome && depthOf(pages, parentId) + 1 <= maxDepth;
}

/** Pode a página `from` ir para `position` de `to`? */
export function canMovePage(pages: readonly Page[], from: string, to: string, position: DropPosition, maxDepth = MAX_DEPTH): boolean {
  const a = pages.find((p) => p.id === from);
  const b = pages.find((p) => p.id === to);
  if (!a || !b || a.id === b.id) return false;
  if (a.isHome) return false; // a home fica onde está
  if (b.isHome && position !== "after") return false; // nada antes da home, nada dentro dela
  const newParent = position === "inside" ? b.id : parentOf(idSet(pages), b);
  if (newParent !== null && (newParent === a.id || isDescendant(pages, newParent, a.id))) return false; // ciclo
  const base = newParent === null ? 0 : depthOf(pages, newParent);
  return base + heightOf(pages, a.id) <= maxDepth;
}

/**
 * Move `from` para antes/depois/dentro de `to` e renumera só os grupos de irmãs que mudam.
 * Devolve o MESMO array se a regra recusa ou se nada muda (o reducer não regista).
 */
export function movePage(pages: Page[], from: string, to: string, position: DropPosition, maxDepth = MAX_DEPTH): Page[] {
  if (!canMovePage(pages, from, to, position, maxDepth)) return pages;
  const moved = pages.find((p) => p.id === from)!;
  const target = pages.find((p) => p.id === to)!;
  const ids = idSet(pages);
  const oldParent = parentOf(ids, moved);
  const newParent = position === "inside" ? target.id : parentOf(ids, target);

  const sibs = childrenOf(pages, newParent).filter((p) => p.id !== from);
  const at = position === "inside" ? sibs.length : sibs.findIndex((p) => p.id === to) + (position === "after" ? 1 : 0);
  sibs.splice(at, 0, moved);
  // Largar onde já estava não é uma alteração (mesmo que os `sortOrder` do servidor tenham buracos).
  if (oldParent === newParent && childrenOf(pages, newParent).every((p, i) => p.id === sibs[i].id)) return pages;

  const next = new Map<string, { parentId: string | null; sortOrder: number }>();
  sibs.forEach((p, i) => next.set(p.id, { parentId: newParent, sortOrder: i }));
  if (oldParent !== newParent) {
    childrenOf(pages, oldParent).filter((p) => p.id !== from).forEach((p, i) => next.set(p.id, { parentId: oldParent, sortOrder: i }));
  }
  let changed = false;
  const out = pages.map((p) => {
    const n = next.get(p.id);
    if (!n) return p;
    const parentId = n.parentId;
    if ((p.parentId ?? null) === parentId && p.sortOrder === n.sortOrder) return p;
    changed = true;
    return { ...p, parentId, sortOrder: n.sortOrder };
  });
  return changed ? out : pages;
}

/** Caminho (na língua base) da página: `/`, `/obras`, `/obras/2024`. */
export function pagePath(pages: readonly Page[], id: string): string {
  const ids = idSet(pages);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const parts: string[] = [];
  const seen = new Set<string>();
  for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = byId.get(parentOf(ids, cur) ?? "")) {
    seen.add(cur.id);
    if (!cur.isHome && cur.slug) parts.unshift(cur.slug);
  }
  return `/${parts.join("/")}`;
}

// ── endereços por língua (CONTRATO §2, §6.5) ─────────────────────────────────

/** Cadeia de mães até à página (a primeira primeiro). */
function chainTo(pages: readonly Page[], id: string): Page[] {
  const ids = idSet(pages);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const out: Page[] = [];
  const seen = new Set<string>();
  for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = byId.get(parentOf(ids, cur) ?? "")) {
    seen.add(cur.id);
    out.unshift(cur);
  }
  return out;
}

/** Slug de uma página numa língua: o da língua, senão (vazio) o da base. */
export const slugIn = (p: Page, lang: string, base: string): string => (lang !== base && p.slugs?.[lang]) || p.slug;

/** Endereço de uma mãe (só as mães, sem a própria): `/obras` ou `` no primeiro nível. */
export function parentPathIn(pages: readonly Page[], id: string, lang: string, base: string): string {
  const segs = chainTo(pages, id).slice(0, -1).filter((p) => !p.isHome).map((p) => slugIn(p, lang, base)).filter(Boolean);
  return segs.length ? `/${segs.join("/")}` : "";
}

/** Endereço da página numa língua, como no servidor: `/obras`, `/en/projects`, `/en` (home). */
export function pagePathIn(pages: readonly Page[], id: string, lang: string, base: string): string {
  const segs = chainTo(pages, id).filter((p) => !p.isHome).map((p) => slugIn(p, lang, base)).filter(Boolean);
  const prefix = lang !== base ? `/${lang}` : "";
  return `${prefix}/${segs.join("/")}`.replace(/\/$/, "") || "/";
}

/**
 * O que muda de endereço entre o servidor e o trabalho: os da própria página (por língua) e quantas
 * descendentes mudam por arrasto. O servidor cria os endereços antigos sozinho ao gravar (§6.5); isto só serve o aviso.
 */
export function pathChanges(
  server: readonly Page[],
  work: readonly Page[],
  id: string,
  langs: readonly string[],
  base: string,
): { own: { from: string; to: string }[]; others: number } {
  const own: { from: string; to: string }[] = [];
  const inServer = new Set(server.map((p) => p.id));
  if (!inServer.has(id) || !work.some((p) => p.id === id)) return { own, others: 0 };
  const differs = (pid: string) => langs.filter((l) => pagePathIn(server, pid, l, base) !== pagePathIn(work, pid, l, base));
  for (const l of differs(id)) own.push({ from: pagePathIn(server, id, l, base), to: pagePathIn(work, id, l, base) });
  const others = work.filter((p) => p.id !== id && inServer.has(p.id) && isDescendant(work, p.id, id) && differs(p.id).length > 0).length;
  return { own, others };
}
