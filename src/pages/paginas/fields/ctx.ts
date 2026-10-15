/**
 * Construção do `FieldCtx` a partir do trabalho (puro) e utilitários de `path`/issues.
 */
import { pagePath, pageTitle } from "../state/tree";
import type { MissingItem } from "../state/missing";
import type { Catalog, Issue, LangCtx, Manifest, Work } from "../state/types";
import type { FieldAnchor, FieldCtx, FieldDocument, FieldPage, MediaValue } from "./types";

type Rec = Record<string, unknown>;
export const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

export const joinPath = (a: string, b: string): string => (a ? `${a}.${b}` : b);

/** Línguas do tenant com a base primeiro, sem repetidos. */
export function orderedLanguages(lang: LangCtx): string[] {
  return [lang.defaultLanguage, ...lang.languages.filter((l) => l !== lang.defaultLanguage)];
}

export function normalizeMedia(v: unknown): MediaValue {
  if (isObj(v) && isObj(v.values)) {
    const values: Record<string, string> = {};
    for (const [k, x] of Object.entries(v.values)) if (typeof x === "string") values[k] = x;
    return { same: v.same !== false, values };
  }
  return { same: true, values: {} };
}

function documentsOf(work: Work, catalog: Catalog | null, base: string): FieldDocument[] {
  const out: FieldDocument[] = [];
  const scan = (owner: string, comps: unknown) => {
    if (!Array.isArray(comps)) return;
    for (const c of comps) {
      if (!isObj(c) || typeof c.id !== "string" || !isObj(c.v)) continue;
      const def = catalog?.components.find((x) => x.type === c.type);
      if (!def) continue;
      for (const [fname, spec] of Object.entries(def.fields)) {
        if (spec.type !== "list" || !spec.of) continue;
        const fileKey = Object.keys(spec.of).find((k) => spec.of![k].type === "media" && spec.of![k].kind === "file");
        const nameKey = Object.keys(spec.of).find((k) => spec.of![k].type === "text");
        const rows = (c.v as Rec)[fname];
        if (!fileKey || !Array.isArray(rows)) continue;
        for (const row of rows) {
          if (!isObj(row) || typeof row._id !== "string") continue;
          const media = normalizeMedia(row[fileKey]);
          if (!media.values[base]) continue;
          const n = nameKey ? row[nameKey] : undefined;
          const name = typeof n === "string" ? n : isObj(n) && typeof n[base] === "string" ? (n[base] as string) : "";
          out.push({ id: `${owner}/${c.id}/${row._id}`, name: name.trim() || "Documento", media });
        }
      }
    }
  };
  for (const b of work.blocks) scan(`b:${b.id}`, b.comps);
  for (const p of ["topo", "rodape"] as const) scan(`p:${p}`, work.parts[p]?.comps);
  return out;
}

export interface BuildCtxInput {
  work: Work;
  lang: LangCtx;
  catalog: Catalog | null;
  manifest: Manifest | null;
  issues: readonly Issue[];
}

/** Tudo o que não depende do campo: as línguas, as páginas, as âncoras, os documentos, os issues. */
export function buildFieldCtx({ work, lang, catalog, manifest, issues }: BuildCtxInput): Omit<FieldCtx, "name" | "path"> {
  const base = lang.defaultLanguage;
  const pages: FieldPage[] = work.pages.map((p) => ({
    id: p.id,
    title: pageTitle(p, base),
    path: pagePath(work.pages, p.id) || "/",
    status: p.status === "published" ? "published" : "draft",
    isHome: !!p.isHome,
  }));
  const firstPage = (blockId: string): string | undefined => {
    const p = work.pages.find((pg) => (work.items[pg.id] ?? []).some((it) => it.blockId === blockId));
    return p ? pageTitle(p, base) : undefined;
  };
  const anchors: FieldAnchor[] = work.blocks
    .filter((b) => !!b.anchor)
    .map((b) => ({ blockId: b.id, name: b.name || "Sem nome", anchor: b.anchor as string, pageTitle: firstPage(b.id) }));
  return {
    languages: orderedLanguages(lang),
    base,
    pages,
    anchors,
    documents: documentsOf(work, catalog, base),
    icons: manifest?.icons ?? [],
    issues: [...issues],
    defaults: catalog?.defaults,
  };
}

/** O "Ver onde" em curso, se é desta entidade (para as listas abrirem a linha e a caixa se focar). */
export function revealFor(focus: MissingItem | null, reveal: number | null, entity: string, id: string): FieldCtx["focus"] {
  return focus && reveal !== null && focus.entity === entity && focus.id === id ? { path: focus.path, locale: focus.locale, tick: reveal } : null;
}

/** Contexto do campo filho `name` (o `path` acompanha). */
export const childCtx = (ctx: FieldCtx, name: string): FieldCtx => ({ ...ctx, name, path: joinPath(ctx.path, name) });

// ── issues ────────────────────────────────────────────────────────────────────

const under = (issuePath: string | undefined, path: string): boolean =>
  typeof issuePath === "string" && (issuePath === path || issuePath.startsWith(`${path}.`));

/** Issues deste campo (e do que está dentro dele: sub-campos, linhas de lista, línguas). */
export const issuesUnder = (ctx: FieldCtx): Issue[] => ctx.issues.filter((i) => under(i.path, ctx.path));

/** Issues que são DESTE campo (o `path` coincide), por oposição aos do que está dentro dele. */
export const issuesAt = (ctx: FieldCtx): Issue[] => ctx.issues.filter((i) => i.path === ctx.path);

/** Os issues de uma entidade (o `Issue` traz `entity` + `id`), para o `ctx.issues`. */
export const issuesFor = (issues: readonly Issue[], entity: Issue["entity"], id: string): Issue[] =>
  issues.filter((i) => i.entity === entity && i.id === id);

/** A API manda `{ pt: … }`-style locale no issue; um campo i18n mostra-o na caixa dessa língua. */
export const localeIssues = (list: readonly Issue[], locale: string): Issue[] => list.filter((i) => i.locale === locale);
