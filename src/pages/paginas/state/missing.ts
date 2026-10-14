/**
 * Traduções em falta (CONTRATO §6.4), só para a UX: avisar e bloquear o "Guardar" antes de ir à API.
 * A API é a autoridade — o mesmo varrimento corre no servidor e devolve `MISSING_TRANSLATION`.
 *
 * Regra: um `I18n` (text/md com `i18n`) ou um `media` com `same:false` que TEM valor na língua base
 * tem de ter valor em todas as línguas do tenant. Tudo o resto (strings simples, `media` com
 * `same:true`, campos vazios na base) nunca falta nada. "Vazio" = não-string ou só espaços.
 */
import type { Catalog, FieldSpec, FieldSpecs, LangCtx, Manifest, Sel, Work } from "./types";

export interface MissingItem {
  entity: "page" | "block" | "part" | "item";
  /** Id da entidade (`topo`/`rodape` nas partes). */
  id: string;
  /** Relativo à entidade, igual ao `Issue.path` da API: `comps.c1.v.items.k3.text`. */
  path: string;
  locale: string;
}

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
export const isBlank = (v: unknown): boolean => typeof v !== "string" || v.trim() === "";
const join = (a: string, b: string) => (a ? `${a}.${b}` : b);

/** Línguas em falta num valor, só se a base tem valor (espelha `missingTranslations` da API). */
export function missingLocales(value: unknown, spec: Pick<FieldSpec, "type" | "i18n">, langs: readonly string[], base: string): string[] {
  let map: Rec | null = null;
  if ((spec.type === "text" || spec.type === "md") && spec.i18n) map = isObj(value) ? value : null;
  else if (spec.type === "media" && isObj(value) && value.same === false && isObj(value.values)) map = value.values;
  if (!map || isBlank(map[base])) return [];
  return langs.filter((l) => isBlank(map![l]));
}

interface Walk {
  langs: string[];
  base: string;
  out: MissingItem[];
}

function field(spec: FieldSpec, value: unknown, entity: MissingItem["entity"], id: string, path: string, w: Walk): void {
  if (spec.type === "list") {
    if (!Array.isArray(value) || !spec.of) return;
    value.forEach((row, i) => {
      if (!isObj(row)) return;
      const key = typeof row._id === "string" && row._id ? row._id : String(i);
      fields(spec.of!, row, entity, id, join(path, key), w);
    });
    return;
  }
  if (spec.type === "dest") {
    // Só o destino "ficheiro" leva media (PDF por língua).
    if (isObj(value) && value.kind === "file") {
      for (const locale of missingLocales(value.media, { type: "media" }, w.langs, w.base)) {
        w.out.push({ entity, id, path: join(path, "media"), locale });
      }
    }
    return;
  }
  for (const locale of missingLocales(value, spec, w.langs, w.base)) w.out.push({ entity, id, path, locale });
}

function fields(specs: FieldSpecs, values: unknown, entity: MissingItem["entity"], id: string, path: string, w: Walk): void {
  if (!isObj(values)) return;
  for (const [k, spec] of Object.entries(specs)) field(spec, values[k], entity, id, join(path, k), w);
}

function comps(list: unknown, catalog: Catalog, entity: "block" | "part", id: string, w: Walk): void {
  if (!Array.isArray(list)) return;
  for (const c of list) {
    if (!isObj(c) || typeof c.id !== "string") continue;
    const def = catalog.components.find((x) => x.type === c.type);
    if (def) fields(def.fields, c.v, entity, id, `comps.${c.id}.v`, w);
  }
}

const SEO_FIELDS: FieldSpecs = {
  title: { type: "text", i18n: true },
  description: { type: "text", i18n: true },
  keywords: { type: "text", i18n: true },
  image: { type: "media", kind: "image" },
};

/**
 * Tudo o que falta traduzir no estado de trabalho, por ordem: páginas (título, SEO), partes comuns,
 * TODOS os blocos da biblioteca (usados ou não — como o servidor) e especiais das páginas.
 */
export function findMissing(work: Work, catalog: Catalog | null, manifest: Manifest | null, lang: LangCtx): MissingItem[] {
  const base = lang.defaultLanguage;
  const w: Walk = { langs: lang.languages.includes(base) ? lang.languages : [base, ...lang.languages], base, out: [] };
  const cat: Catalog = catalog ?? { components: [] };

  for (const p of work.pages) {
    fields({ title: { type: "text", i18n: true } }, p, "page", p.id, "", w);
    if (isObj(p.seo)) fields(SEO_FIELDS, p.seo, "page", p.id, "seo", w);
  }
  for (const name of ["topo", "rodape"] as const) comps(work.parts[name]?.comps, cat, "part", name, w);
  for (const b of work.blocks) comps(b.comps, cat, "block", b.id, w);
  for (const p of work.pages) {
    for (const it of work.items[p.id] ?? []) {
      const def = it.kind === "special" && it.specialType ? manifest?.specials?.[it.specialType] : undefined;
      if (def) fields(def.fields, it.specialData, "item", it.id, "specialData", w);
    }
  }
  return w.out;
}

/** Quantos CAMPOS têm traduções em falta (uma língua a faltar, ou três, conta como um campo). */
export function countMissing(list: readonly MissingItem[]): number {
  return new Set(list.map((m) => `${m.entity}|${m.id}|${m.path}`)).size;
}

const sameField = (a: MissingItem, b: MissingItem) => a.entity === b.entity && a.id === b.id && a.path === b.path;

/**
 * O primeiro campo por traduzir. Com `after`, o SEGUINTE a esse campo (em roda: depois do último
 * volta ao primeiro) — é o que o "Ver onde" usa para ir de um em um. `null` se não falta nada.
 */
export function firstMissing(list: readonly MissingItem[], after?: MissingItem | null): MissingItem | null {
  if (!list.length) return null;
  if (!after) return list[0];
  const i = list.findIndex((m) => sameField(m, after));
  if (i < 0) return list[0];
  for (let k = 1; k <= list.length; k++) {
    const next = list[(i + k) % list.length];
    if (!sameField(next, after)) return next;
  }
  return list[i]; // só existe este campo
}

/** Onde uma falta mora na UI: que página/bloco/parte abrir. Usa-se no "Ver onde". */
export function locateMissing(
  work: Work,
  m: MissingItem,
): { pageId?: string; libId?: string; sel: Sel } {
  switch (m.entity) {
    case "page":
      return { pageId: m.id, sel: { kind: "page", id: m.id } };
    case "block":
      return { libId: m.id, sel: { kind: "block", id: m.id } };
    case "part":
      return { sel: { kind: "part", id: m.id === "topo" ? "topo" : "rodape" } };
    case "item": {
      const pageId = Object.keys(work.items).find((pid) => work.items[pid].some((it) => it.id === m.id));
      return { pageId, sel: { kind: "item", id: m.id } };
    }
  }
}
