/**
 * Edições das definições de uma página (F15): `Work → Work`, puras. Passam pelo `edit` do store (com a
 * chave de junção, para escrever seguido numa caixa ser UMA entrada do desfazer). Um valor igual ao
 * que já está devolve o MESMO `Work` (o reducer não regista nada).
 */
import { isRec } from "./walk";
import type { Page, Work } from "./types";

export const SLUG_MAX = 80;

/**
 * Endereço a partir do que se escreve: minúsculas, sem acentos, espaços e símbolos viram "-".
 * Enquanto se escreve (`final: false`) deixa o "-" do fim para se poder continuar a palavra;
 * ao sair da caixa (`final: true`) tira-o. Respeita `^[a-z0-9]+(-[a-z0-9]+)*$` (§6.5).
 */
export function slugify(text: string, final = true): string {
  const s = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX);
  return final ? s.replace(/-+$/, "") : s;
}

function mapPage(w: Work, id: string, f: (p: Page) => Page): Work {
  const p = w.pages.find((x) => x.id === id);
  if (!p) return w;
  const next = f(p);
  return next === p ? w : { ...w, pages: w.pages.map((x) => (x.id === id ? next : x)) };
}

export const setPageStatus = (w: Work, id: string, status: Page["status"]): Work =>
  mapPage(w, id, (p) => (p.status === status ? p : { ...p, status }));

export const setPageTitle = (w: Work, id: string, title: Page["title"]): Work =>
  mapPage(w, id, (p) => (JSON.stringify(p.title) === JSON.stringify(title) ? p : { ...p, title }));

/** Endereço na língua base (a home nunca muda: fica em `/`). */
export const setPageSlug = (w: Work, id: string, slug: string): Work =>
  mapPage(w, id, (p) => (p.isHome || p.slug === slug ? p : { ...p, slug }));

/** Endereço noutra língua; vazio = usa o da base (tira a chave; sem nenhuma, `slugs` fica `null`). */
export const setPageLocalSlug = (w: Work, id: string, lang: string, slug: string): Work =>
  mapPage(w, id, (p) => {
    if (p.isHome || (p.slugs?.[lang] ?? "") === slug) return p;
    const next = { ...(p.slugs ?? {}) };
    if (slug === "") delete next[lang];
    else next[lang] = slug;
    return { ...p, slugs: Object.keys(next).length ? next : null };
  });

/** Um valor «vazio» do SEO não se grava (`{}` de um I18n sem línguas, media sem ficheiros, texto vazio). */
const isEmpty = (v: unknown): boolean => {
  if (v === undefined || v === null || v === "" || v === false) return true;
  if (!isRec(v)) return false;
  if (isRec(v.values)) return Object.keys(v.values).length === 0;
  return Object.keys(v).length === 0;
};

/** Escreve (ou tira, se vazio) um campo do SEO da página: `title`, `description`, `keywords`, `image`, `noindex`, `canonicalPageId`. */
export const setSeoField = (w: Work, id: string, name: string, value: unknown): Work =>
  mapPage(w, id, (p) => {
    const seo: Record<string, unknown> = { ...(isRec(p.seo) ? p.seo : {}) };
    if (isEmpty(value)) delete seo[name];
    else seo[name] = value;
    const next = Object.keys(seo).length ? seo : null;
    return JSON.stringify(next) === JSON.stringify(p.seo ?? null) ? p : { ...p, seo: next };
  });
