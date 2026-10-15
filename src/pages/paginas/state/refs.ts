/**
 * Quem impede apagar uma página (CONTRATO §6.7 `PAGE_IN_USE`), calculado no cliente para o mostrar
 * ANTES de tentar: subpáginas, ligações/cartões em blocos, partes comuns e especiais, e canónicas de
 * outras páginas. A API continua a ser a autoridade (devolve `409 PAGE_IN_USE {refs}` na mesma).
 */
import { compsOf, isRec, specialSpecs, specsOf, walkFields } from "./walk";
import { childrenOf } from "./tree";
import type { Catalog, FieldSpecs, Manifest, PartName, Work } from "./types";

export type Blocker =
  | { kind: "child"; pageId: string }
  | { kind: "block"; blockId: string; name: string }
  | { kind: "part"; part: PartName }
  | { kind: "special"; pageId: string; itemId: string; name: string }
  | { kind: "canonical"; pageId: string };

const points = (specs: FieldSpecs, values: unknown, target: string): boolean => {
  let hit = false;
  walkFields(specs, values, (spec, value) => {
    if (spec.type === "dest" && isRec(value) && value.kind === "page" && value.pageId === target) hit = true;
    else if (spec.type === "pages" && Array.isArray(value) && value.includes(target)) hit = true;
  });
  return hit;
};

export function pageBlockers(work: Work, catalog: Catalog | null, manifest: Manifest | null, pageId: string): Blocker[] {
  const out: Blocker[] = childrenOf(work.pages, pageId).map((p) => ({ kind: "child", pageId: p.id }));
  const usesIn = (list: unknown) => compsOf(list).some((c) => points(specsOf(catalog, c.type), c.v, pageId));
  for (const b of work.blocks) if (usesIn(b.comps)) out.push({ kind: "block", blockId: b.id, name: b.name || "Sem nome" });
  for (const part of ["topo", "rodape"] as const) if (usesIn(work.parts[part]?.comps)) out.push({ kind: "part", part });
  for (const [pid, items] of Object.entries(work.items)) {
    for (const it of items) {
      if (it.kind === "special" && points(specialSpecs(manifest, it.specialType), it.specialData, pageId)) {
        out.push({ kind: "special", pageId: pid, itemId: it.id, name: manifest?.specials?.[it.specialType ?? ""]?.label ?? "Especial" });
      }
    }
  }
  for (const p of work.pages) {
    const seo = p.seo as { canonicalPageId?: unknown } | null | undefined;
    if (p.id !== pageId && seo?.canonicalPageId === pageId) out.push({ kind: "canonical", pageId: p.id });
  }
  return out;
}
