/**
 * Diferença `server` → `work` no formato do `POST /cms/site-builder/save` (CONTRATO §5.2).
 * Mínima de propósito: upsert só do que mudou ou é novo, `delete` só do que saiu, `items` completos
 * só das páginas cujos itens mudaram, `parts` só se mudaram. Comparação por valor (JSON estável).
 * Também traz `fromServer()`: o estado do `GET` reduzido aos campos que o `save` aceita.
 */
import type { GetCmsSiteBuilder200 } from "../../../gen/backoffice/types/GetCmsSiteBuilder";
import type { Block, Folder, Item, Page, Part, PartName, SaveBody, Work } from "./types";

type Rec = Record<string, unknown>;

/** JSON com chaves ordenadas; `undefined` conta como ausente. Dois valores iguais ⇒ a mesma string. */
export function stable(v: unknown): string {
  return JSON.stringify(sortKeys(v));
}
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const o: Rec = {};
    for (const k of Object.keys(v as Rec).sort()) {
      const x = (v as Rec)[k];
      if (x !== undefined) o[k] = sortKeys(x);
    }
    return o;
  }
  return v;
}

export const sameValue = (a: unknown, b: unknown): boolean => a === b || stable(a) === stable(b);

export function emptyWork(): Work {
  return { pages: [], blocks: [], folders: [], items: {}, parts: { topo: null, rodape: null } };
}

// ── GET → Work ────────────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const asRecs = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isObj) : []);

/** Só os campos que o `save` aceita (o `GET` traz `path`, `updatedAt`… que nunca voltam). */
function pickPage(r: Rec): Page {
  return {
    id: r.id as string,
    parentId: (r.parentId ?? null) as string | null,
    sortOrder: r.sortOrder as number | undefined,
    isHome: (r.isHome ?? false) as boolean,
    slug: (r.slug ?? "") as string,
    slugs: (r.slugs ?? null) as Page["slugs"],
    title: (r.title ?? {}) as Page["title"],
    status: (r.status ?? "draft") as Page["status"],
    seo: (r.seo ?? null) as Page["seo"],
  };
}
function pickBlock(r: Rec): Block {
  return {
    id: r.id as string,
    name: (r.name ?? "") as string,
    folderId: (r.folderId ?? null) as string | null,
    sortOrder: r.sortOrder as number | undefined,
    layout: r.layout as Block["layout"],
    bg: r.bg as string,
    anchor: (r.anchor ?? null) as string | null,
    comps: (Array.isArray(r.comps) ? r.comps : []) as Block["comps"],
  };
}
function pickFolder(r: Rec): Folder {
  return { id: r.id as string, name: (r.name ?? "") as string, sortOrder: r.sortOrder as number | undefined };
}
function pickItem(r: Rec): Item {
  return {
    id: r.id as string,
    kind: r.kind as Item["kind"],
    blockId: (r.blockId ?? null) as string | null,
    specialType: (r.specialType ?? null) as string | null,
    specialData: (r.specialData ?? null) as Item["specialData"],
    hidden: (r.hidden ?? false) as boolean,
  };
}
function pickPart(name: PartName, r: unknown): Part | null {
  if (!isObj(r)) return null;
  const comps = Array.isArray(r.comps) ? r.comps : [];
  return name === "topo" ? { comps } : { layout: r.layout, bg: r.bg, comps };
}

/** Estado do `GET` (já com `enabled:true`) → `Work`. */
export function fromServer(data: GetCmsSiteBuilder200): Work {
  const parts = isObj(data.parts) ? data.parts : {};
  const items: Work["items"] = {};
  for (const [pageId, list] of Object.entries(data.items ?? {})) items[pageId] = asRecs(list).map(pickItem);
  return {
    pages: asRecs(data.pages).map(pickPage),
    blocks: asRecs(data.blocks).map(pickBlock),
    folders: asRecs(data.folders).map(pickFolder),
    items,
    parts: { topo: pickPart("topo", parts.topo), rodape: pickPart("rodape", parts.rodape) },
  };
}

// ── diferença ─────────────────────────────────────────────────────────────────

function diffEntities<T extends { id: string }>(server: T[], work: T[]): { upsert: T[]; delete: string[] } {
  const before = new Map(server.map((e) => [e.id, stable(e)]));
  const after = new Set(work.map((e) => e.id));
  return {
    upsert: work.filter((e) => before.get(e.id) !== stable(e)),
    delete: server.filter((e) => !after.has(e.id)).map((e) => e.id),
  };
}

/** Só inclui as chaves não vazias (`pages: {}` nunca vai). */
function ops<T>(d: { upsert: T[]; delete: string[] }): { upsert?: T[]; delete?: string[] } | undefined {
  const o: { upsert?: T[]; delete?: string[] } = {};
  if (d.upsert.length) o.upsert = d.upsert;
  if (d.delete.length) o.delete = d.delete;
  return o.upsert || o.delete ? o : undefined;
}

/**
 * Changeset mínimo `server → work`, ou `null` se não há nada a gravar.
 * Itens: lista completa de cada página que existe no `work` e cujos itens mudaram (uma página nova
 * sem itens não manda lista). Partes: só as que ficam com valor e diferem (`null` = não mexer).
 */
export function buildChangeset(server: Work, work: Work, baseRevision: number): SaveBody | null {
  const body: SaveBody = { baseRevision };
  const pages = ops(diffEntities(server.pages, work.pages));
  const blocks = ops(diffEntities(server.blocks, work.blocks));
  const folders = ops(diffEntities(server.folders, work.folders));
  if (pages) body.pages = pages;
  if (blocks) body.blocks = blocks;
  if (folders) body.folders = folders;

  const items: Record<string, Item[]> = {};
  for (const p of work.pages) {
    const now = work.items[p.id] ?? [];
    const before = server.items[p.id] ?? [];
    if (!sameValue(before, now)) items[p.id] = now;
  }
  if (Object.keys(items).length) body.items = items;

  const parts: NonNullable<SaveBody["parts"]> = {};
  for (const name of ["topo", "rodape"] as const) {
    const now = work.parts[name];
    if (now && !sameValue(server.parts[name], now)) parts[name] = now;
  }
  if (parts.topo || parts.rodape) body.parts = parts;

  return Object.keys(body).length > 1 ? body : null;
}
