/**
 * Percurso genérico pelos valores de um componente/especial a partir das specs do catálogo/manifest
 * (listas incluídas, um nível). Serve o SEO (`seo.ts`) e as referências a páginas (`refs.ts`).
 */
import type { Catalog, FieldSpec, FieldSpecs, Manifest, Work } from "./types";

type Rec = Record<string, unknown>;
export const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** Chama `cb` por cada campo (`spec`, `value`) do objeto `values`; entra nas linhas das listas. `row` = o objeto que contém o campo. */
export function walkFields(specs: FieldSpecs, values: unknown, cb: (spec: FieldSpec, value: unknown, row: Rec, specs: FieldSpecs, name: string) => void): void {
  if (!isRec(values)) return;
  for (const [name, spec] of Object.entries(specs)) {
    const value = values[name];
    cb(spec, value, values, specs, name);
    if (spec.type === "list" && spec.of && Array.isArray(value)) for (const row of value) walkFields(spec.of, row, cb);
  }
}

export interface CompLike {
  id: string;
  type: string;
  v?: unknown;
}

export const compsOf = (list: unknown): CompLike[] =>
  Array.isArray(list) ? (list.filter((c) => isRec(c) && typeof c.id === "string" && typeof c.type === "string") as unknown as CompLike[]) : [];

/** Os componentes que a página mostra (itens de bloco não escondidos), pela ordem da página. */
export function pageComps(work: Work, pageId: string): { blockId: string; blockName: string; comp: CompLike }[] {
  const out: { blockId: string; blockName: string; comp: CompLike }[] = [];
  for (const it of work.items[pageId] ?? []) {
    if (it.hidden || it.kind !== "block") continue;
    const b = work.blocks.find((x) => x.id === it.blockId);
    if (b) for (const comp of compsOf(b.comps)) out.push({ blockId: b.id, blockName: b.name || "Sem nome", comp });
  }
  return out;
}

export const specsOf = (catalog: Catalog | null, type: string): FieldSpecs => catalog?.components.find((c) => c.type === type)?.fields ?? {};
export const specialSpecs = (manifest: Manifest | null, type: string | null | undefined): FieldSpecs => manifest?.specials?.[type ?? ""]?.fields ?? {};
