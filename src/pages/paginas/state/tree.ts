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
