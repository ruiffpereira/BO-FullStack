import { emptyWork } from "../../../src/pages/paginas/state/changeset";
import type { Block, Item, Page, Work } from "../../../src/pages/paginas/state/types";

export const page = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  parentId: null,
  sortOrder: 0,
  isHome: false,
  slug: id,
  slugs: null,
  title: { pt: id, en: id, fr: id },
  status: "draft",
  seo: null,
  ...extra,
});

export const block = (id: string, extra: Partial<Block> = {}): Block => ({
  id,
  name: id,
  folderId: null,
  sortOrder: 0,
  layout: 1,
  bg: "claro",
  anchor: null,
  comps: [],
  ...extra,
});

export const blockItem = (id: string, blockId: string): Item => ({
  id,
  kind: "block",
  blockId,
  specialType: null,
  specialData: null,
  hidden: false,
});

export function sampleWork(): Work {
  return {
    ...emptyWork(),
    pages: [page("p-home", { isHome: true, slug: "" }), page("p-obras", { sortOrder: 1 })],
    blocks: [block("b1"), block("b2", { sortOrder: 1 })],
    folders: [{ id: "f1", name: "Pasta", sortOrder: 0 }],
    items: { "p-home": [blockItem("i1", "b1"), blockItem("i2", "b2")], "p-obras": [] },
    parts: { topo: { comps: [] }, rodape: null },
  };
}

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
