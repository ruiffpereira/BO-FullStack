/**
 * Verificações de SEO de uma página (CONTRATO §9), puras. Orientação, nunca bloqueiam o "Guardar".
 * Por língua: texto, título, descrição, palavras-chave e endereço são os dessa língua (cai na base
 * quando falta, como o site). Pontuação = % de verificações certas.
 *
 * A API/o kit não calculam isto — é só ajuda à escrita; o Google não lê a lista de palavras-chave.
 */
import { pagePathIn } from "./tree";
import { compsOf, isRec, pageComps, specsOf, walkFields, type CompLike } from "./walk";
import type { Catalog, LangCtx, Page, Work } from "./types";

export interface SeoEnv {
  catalog: Catalog | null;
  lang: LangCtx;
  /** Nome do site para o " · <site>" do título no Google (vazio = sem sufixo). */
  siteName: string;
}

export interface SeoCheck {
  id: string;
  ok: boolean;
  text: string;
}

export interface SeoReport {
  checks: SeoCheck[];
  /** 0–100: % de verificações certas. */
  score: number;
  locale: string;
  googleTitle: string;
  description: string;
  path: string;
}

export const TITLE_MIN = 30;
export const TITLE_MAX = 60;
export const DESC_MIN = 70;
export const DESC_MAX = 160;
export const MIN_WORDS = 150;

// ── texto ─────────────────────────────────────────────────────────────────────

/** Valor `I18n` (ou string) numa língua; cai na base. */
export function i18nText(v: unknown, locale: string, base: string): string {
  if (typeof v === "string") return v.trim();
  if (!isRec(v)) return "";
  const pick = (l: string) => (typeof v[l] === "string" ? (v[l] as string).trim() : "");
  return pick(locale) || pick(base);
}

/** Markdown → texto simples. */
export const plain = (md: string): string =>
  md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>~]|^\s*[-+]\s+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Sem acentos e em minúsculas, para comparar. */
export const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const wordCount = (s: string): number => plain(s).split(/\s+/).filter(Boolean).length;

const seoOf = (p: Page): Record<string, unknown> => (isRec(p.seo) ? p.seo : {});

export function googleTitle(p: Page, locale: string, env: SeoEnv): string {
  const base = env.lang.defaultLanguage;
  const t = i18nText(seoOf(p).title, locale, base) || i18nText(p.title, locale, base);
  return env.siteName ? `${t} · ${env.siteName}` : t;
}

export const descriptionOf = (p: Page, locale: string, base: string): string => i18nText(seoOf(p).description, locale, base);

/** As palavras-chave da língua; a primeira é a principal. */
export function keywordsOf(p: Page, locale: string, base: string): string[] {
  return i18nText(seoOf(p).keywords, locale, base)
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── o que a página mostra ─────────────────────────────────────────────────────

const mediaUrl = (v: unknown, locale: string, base: string): string => {
  const values = isRec(v) && isRec(v.values) ? v.values : {};
  const pick = (l: string) => (typeof values[l] === "string" ? (values[l] as string) : "");
  return pick(locale) || pick(base);
};

/** Os textos (`text`/`md` com `i18n`) dos componentes, na língua. */
function textsOf(comps: CompLike[], catalog: Catalog | null, locale: string, base: string): string[] {
  const out: string[] = [];
  for (const c of comps) {
    walkFields(specsOf(catalog, c.type), c.v, (spec, value) => {
      if ((spec.type === "text" || spec.type === "md") && spec.i18n) {
        const t = i18nText(value, locale, base);
        if (t) out.push(t);
      }
    });
  }
  return out;
}

interface Dest {
  kind: "page" | "anchor" | "other";
  pageId?: string;
}

function destsOf(comps: CompLike[], catalog: Catalog | null): Dest[] {
  const out: Dest[] = [];
  for (const c of comps) {
    walkFields(specsOf(catalog, c.type), c.v, (spec, value) => {
      if (spec.type === "dest" && isRec(value)) {
        if (value.kind === "page" && typeof value.pageId === "string") out.push({ kind: "page", pageId: value.pageId });
        else if (value.kind === "anchor") out.push({ kind: "anchor" });
        else out.push({ kind: "other" });
      } else if (spec.type === "pages" && Array.isArray(value)) {
        for (const id of value) if (typeof id === "string") out.push({ kind: "page", pageId: id });
      }
    });
  }
  return out;
}

/** Imagens com ficheiro mas sem descrição (`alt`) na língua: campos `media` de imagem com um irmão `alt`. */
function imagesWithoutAlt(comps: { blockName: string; comp: CompLike }[], catalog: Catalog | null, locale: string, base: string): string[] {
  const out: string[] = [];
  for (const { blockName, comp } of comps) {
    walkFields(specsOf(catalog, comp.type), comp.v, (spec, value, row, specs, name) => {
      if (spec.type !== "media" || spec.kind !== "image" || !specs.alt || name === "alt") return;
      if (mediaUrl(value, locale, base) && !i18nText(row.alt, locale, base)) out.push(blockName);
    });
  }
  return out;
}

// ── a verificação ─────────────────────────────────────────────────────────────

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function seoReport(work: Work, page: Page, locale: string, env: SeoEnv): SeoReport {
  const base = env.lang.defaultLanguage;
  const catalog = env.catalog;
  const shown = pageComps(work, page.id);
  const comps = shown.map((x) => x.comp);
  const checks: SeoCheck[] = [];
  const add = (id: string, ok: boolean, text: string) => checks.push({ id, ok, text });

  // títulos
  const defaultLevel = String((catalog?.components.find((c) => c.type === "titulo")?.fields.level?.default as string | undefined) ?? "h2");
  const titles = shown
    .filter((x) => x.comp.type === "titulo")
    .map((x) => {
      const v = isRec(x.comp.v) ? x.comp.v : {};
      return { block: x.blockName, level: Number(String(v.level ?? defaultLevel).slice(1)) || 2, text: plain(i18nText(v.text, locale, base)) };
    });
  const h1 = titles.filter((t) => t.level === 1);
  if (h1.length === 1) add("h1", true, `Um título H1: «${h1[0].text}».`);
  else if (h1.length === 0) add("h1", false, "Nenhum título H1. Abre o título principal da página e escolhe H1.");
  else add("h1", false, `${h1.length} títulos H1 (${h1.map((t) => t.block).join(", ")}). Deixa só um.`);

  let max = 1;
  let jump: (typeof titles)[number] | null = null;
  for (const t of titles) {
    if (t.level > max + 1 && !jump) jump = t;
    max = Math.max(max, t.level);
  }
  add("levels", !jump, jump ? `O título «${jump.text}» é H${jump.level} sem um H${jump.level - 1} antes. Usa os níveis por ordem.` : "Os títulos seguem a ordem (H1, H2, H3).");

  // título e descrição no Google
  const gt = googleTitle(page, locale, env);
  const desc = descriptionOf(page, locale, base);
  if (gt.length > TITLE_MAX) add("title", false, `O título no Google tem ${gt.length} caracteres; a partir de ${TITLE_MAX} é cortado.`);
  else if (gt.length < TITLE_MIN) add("title", false, `O título no Google é curto (${gt.length} caracteres). Entre ${TITLE_MIN} e ${TITLE_MAX} é o ideal.`);
  else add("title", true, `Título no Google com ${gt.length} caracteres.`);
  if (!desc) add("description", false, "Falta a descrição para o Google.");
  else if (desc.length > DESC_MAX) add("description", false, `A descrição tem ${desc.length} caracteres; o Google corta a partir de ${DESC_MAX}.`);
  else if (desc.length < DESC_MIN) add("description", false, `A descrição é curta (${desc.length} caracteres). Entre ${DESC_MIN} e ${DESC_MAX} é o ideal.`);
  else add("description", true, `Descrição com ${desc.length} caracteres.`);

  const twin = work.pages.find((q) => q.id !== page.id && fold(googleTitle(q, locale, env)) === fold(gt));
  add("twin", !twin, twin ? `O título no Google é igual ao de «${i18nText(twin.title, locale, base) || "outra página"}». Cada página deve ter o seu.` : "O título no Google não se repete noutra página.");

  // palavra-chave principal
  const kw = keywordsOf(page, locale, base)[0];
  if (!kw) add("keyword", false, "Sem palavra-chave principal. Escreve o que as pessoas procuram no Google para chegar aqui.");
  else {
    const k = fold(kw);
    const firstText = comps.find((c) => c.type === "texto");
    const firstPara = firstText && isRec(firstText.v) ? plain(i18nText(firstText.v.body, locale, base).split(/\n\s*\n/)[0] ?? "") : "";
    const places: [string, string][] = [
      ["no título do Google", gt],
      ["no H1", h1[0]?.text ?? ""],
      ["na descrição", desc],
      ["no endereço", pagePathIn(work.pages, page.id, locale, base).replace(/[-/]/g, " ")],
      ["no primeiro parágrafo", firstPara],
    ];
    const yes = places.filter(([, t]) => fold(t).includes(k)).map(([w]) => w);
    const no = places.filter(([, t]) => !fold(t).includes(k)).map(([w]) => w);
    add(
      "keyword",
      no.length === 0,
      no.length ? `«${kw}» falta ${no.join(", ")}${yes.length ? ` (já está ${yes.join(", ")})` : ""}.` : `«${kw}» está no título, no H1, na descrição, no endereço e no primeiro parágrafo.`,
    );
  }

  // conteúdo
  const words = textsOf(comps, catalog, locale, base).reduce((n, t) => n + wordCount(t), 0);
  add("words", words >= MIN_WORDS, words >= MIN_WORDS ? `${words} palavras de texto.` : `Pouco texto (${words} palavras). Páginas com mais conteúdo aparecem melhor; ${MIN_WORDS} ou mais é o mínimo.`);
  const noAlt = imagesWithoutAlt(shown, catalog, locale, base);
  const where = [...new Set(noAlt)].join(", ");
  add("alt", noAlt.length === 0, noAlt.length ? `${noAlt.length} ${plural(noAlt.length, "imagem sem descrição", "imagens sem descrição")} (${where}).` : "Todas as imagens têm descrição.");

  // ligações
  const inner = destsOf(comps, catalog).filter((d) => d.kind === "anchor" || (d.kind === "page" && d.pageId !== page.id));
  add(
    "links",
    inner.length > 0,
    inner.length ? `${inner.length} ${plural(inner.length, "ligação", "ligações")} para outras páginas ou secções do site.` : "Não liga a nenhuma outra página. Junta um botão para páginas relacionadas: ajuda o Google a percorrer o site.",
  );
  const everywhere = [...comps, ...compsOf(work.parts.topo?.comps), ...compsOf(work.parts.rodape?.comps)];
  const draft = destsOf(everywhere, catalog)
    .map((d) => (d.kind === "page" ? work.pages.find((q) => q.id === d.pageId) : undefined))
    .find((q) => q?.status === "draft");
  add("drafts", !draft, draft ? `Liga para «${i18nText(draft.title, locale, base) || "outra página"}», que está em rascunho: no site essa ligação não funciona.` : "Não liga a páginas em rascunho.");

  const noindex = seoOf(page).noindex === true;
  add("noindex", !noindex, noindex ? "Está escondida do Google («Aparecer no Google: Não»)." : "Pode aparecer no Google.");

  const score = Math.round((100 * checks.filter((c) => c.ok).length) / checks.length);
  return { checks, score, locale, googleTitle: gt, description: desc, path: pagePathIn(work.pages, page.id, locale, base) };
}

/** Faixa de cor da pontuação. */
export const seoBand = (n: number): "ok" | "mid" | "bad" => (n >= 80 ? "ok" : n >= 50 ? "mid" : "bad");

/** As verificações que falham primeiro (a ordem relativa mantém-se). */
export const failingFirst = (checks: readonly SeoCheck[]): SeoCheck[] => [...checks.filter((c) => !c.ok), ...checks.filter((c) => c.ok)];

export interface SiteSeoRow {
  page: Page;
  report: SeoReport;
  /** O primeiro problema (`null` = nada a melhorar). */
  first: SeoCheck | null;
}

/** Todas as páginas, na ordem dada, com a pontuação e o primeiro problema; e a média. */
export function siteSeo(work: Work, locale: string, env: SeoEnv, order: readonly Page[] = work.pages): { rows: SiteSeoRow[]; average: number } {
  const rows = order.map((page) => {
    const report = seoReport(work, page, locale, env);
    return { page, report, first: report.checks.find((c) => !c.ok) ?? null };
  });
  const average = rows.length ? Math.round(rows.reduce((n, r) => n + r.report.score, 0) / rows.length) : 0;
  return { rows, average };
}

/** O que o site faz sozinho (§9 «Feito pelo site»), para a janela «SEO do site». */
export const SITE_DOES: readonly string[] = [
  "Título e descrição de cada página, em cada língua",
  "Endereço canónico e versões por língua ligadas entre si (hreflang)",
  "Pré-visualização ao partilhar no WhatsApp, Facebook e LinkedIn (Open Graph)",
  "Dados da empresa, caminho da página, perguntas frequentes, avaliações e morada para o Google",
  "Mapa do site (sitemap.xml) só com as páginas no ar, e instruções para os motores de busca (robots.txt)",
  "Redireccionamento dos endereços antigos",
  "Páginas em rascunho e escondidas do Google ficam fora do mapa do site",
];
