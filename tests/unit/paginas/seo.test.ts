import { describe, expect, it } from "vitest";
import { failingFirst, fold, keywordsOf, plain, seoBand, seoReport, siteSeo, type SeoEnv } from "../../../src/pages/paginas/state/seo";
import type { Catalog, Page, Work } from "../../../src/pages/paginas/state/types";
import { block, blockItem, page, sampleWork } from "./fixtures";

const catalog: Catalog = {
  components: [
    { type: "titulo", label: "Título", fields: { text: { type: "text", i18n: true }, level: { type: "choice", default: "h2" } } },
    { type: "texto", label: "Texto", fields: { body: { type: "md", i18n: true } } },
    { type: "imagem", label: "Imagem", fields: { image: { type: "media", kind: "image" }, alt: { type: "text", i18n: true } } },
    { type: "galeria", label: "Galeria", fields: { items: { type: "list", of: { image: { type: "media", kind: "image" }, alt: { type: "text", i18n: true } } } } },
    { type: "botao", label: "Botão", fields: { label: { type: "text", i18n: true }, dest: { type: "dest" } } },
    { type: "paginas", label: "Cartões", fields: { pick: { type: "pages" } } },
  ],
};
const env: SeoEnv = { catalog, lang: { languages: ["pt", "en"], defaultLanguage: "pt" }, siteName: "Winter" };
const t = (pt: string, en = pt) => ({ pt, en });
const comp = (id: string, type: string, v: Record<string, unknown>) => ({ id, type, style: "normal", col: "all", v });
const img = (url: string) => ({ same: true, values: { pt: url } });
const words = (n: number) => Array.from({ length: n }, (_, i) => `palavra${i}`).join(" ");

/** Uma página (`p-obras`) com os componentes dados num só bloco. */
function setup(comps: ReturnType<typeof comp>[], extra: Partial<Page> = {}, more?: (w: Work) => void) {
  const w = sampleWork();
  w.blocks = [block("b1", { name: "Herói", comps })];
  w.items["p-obras"] = [blockItem("it1", "b1")];
  w.pages = w.pages.map((p) => (p.id === "p-obras" ? { ...p, ...extra } : p.id === "p-home" ? { ...p, status: "published" as const } : p));
  more?.(w);
  const p = w.pages.find((x) => x.id === "p-obras")!;
  const report = (locale = "pt") => seoReport(w, p, locale, env);
  const check = (id: string, locale = "pt") => report(locale).checks.find((c) => c.id === id)!;
  return { w, p, report, check };
}

describe("seo · títulos", () => {
  it("um só H1", () => {
    expect(setup([comp("c1", "titulo", { text: t("Obras"), level: "h1" })]).check("h1").ok).toBe(true);
  });
  it("nenhum H1 falha; dois H1 falham e dizem onde", () => {
    expect(setup([comp("c1", "titulo", { text: t("Obras"), level: "h2" })]).check("h1").ok).toBe(false);
    const two = setup([comp("c1", "titulo", { text: t("A"), level: "h1" }), comp("c2", "titulo", { text: t("B"), level: "h1" })]).check("h1");
    expect(two.ok).toBe(false);
    expect(two.text).toContain("2 títulos H1");
    expect(two.text).toContain("Herói");
  });
  it("sem nível, o título vale o por omissão do catálogo (H2)", () => {
    expect(setup([comp("c1", "titulo", { text: t("A") })]).check("h1").ok).toBe(false);
  });
  it("níveis por ordem: H1 e depois H3 salta um nível", () => {
    const bad = setup([comp("c1", "titulo", { text: t("A"), level: "h1" }), comp("c2", "titulo", { text: t("Salto"), level: "h3" })]).check("levels");
    expect(bad.ok).toBe(false);
    expect(bad.text).toContain("Salto");
    const ok = setup([
      comp("c1", "titulo", { text: t("A"), level: "h1" }),
      comp("c2", "titulo", { text: t("B"), level: "h2" }),
      comp("c3", "titulo", { text: t("C"), level: "h3" }),
    ]);
    expect(ok.check("levels").ok).toBe(true);
  });
  it("só conta o que a página mostra: um bloco escondido não entra", () => {
    const s = setup([comp("c1", "titulo", { text: t("A"), level: "h1" })], {}, (w) => {
      w.items["p-obras"] = [{ ...blockItem("it1", "b1"), hidden: true }];
    });
    expect(s.check("h1").ok).toBe(false);
  });
});

describe("seo · título e descrição no Google", () => {
  it("o título leva ' · site' e conta de 30 a 60", () => {
    const short = setup([], { title: t("Obras") });
    expect(short.report().googleTitle).toBe("Obras · Winter");
    expect(short.check("title").ok).toBe(false);
    expect(setup([], { title: t("Reabilitação de fachadas em Braga") }).check("title").ok).toBe(true);
    const long = setup([], { seo: { title: t("x".repeat(60)) } });
    expect(long.check("title").ok).toBe(false);
    expect(long.check("title").text).toContain("cortado");
  });
  it("sem nome do site não há sufixo", () => {
    const s = setup([], { title: t("Obras") });
    expect(seoReport(s.w, s.p, "pt", { ...env, siteName: "" }).googleTitle).toBe("Obras");
  });
  it("o título do SEO ganha ao nome da página", () => {
    expect(setup([], { title: t("Obras"), seo: { title: t("Projectos") } }).report().googleTitle).toBe("Projectos · Winter");
  });
  it("descrição: vazia, curta, boa e longa", () => {
    expect(setup([]).check("description").ok).toBe(false);
    expect(setup([], { seo: { description: t("curta") } }).check("description").text).toContain("curta");
    expect(setup([], { seo: { description: t("d".repeat(100)) } }).check("description").ok).toBe(true);
    expect(setup([], { seo: { description: t("d".repeat(161)) } }).check("description").ok).toBe(false);
    expect(setup([], { seo: { description: t("d".repeat(70)) } }).check("description").ok).toBe(true);
    expect(setup([], { seo: { description: t("d".repeat(160)) } }).check("description").ok).toBe(true);
  });
  it("título repetido noutra página (sem acentos nem maiúsculas)", () => {
    const s = setup([], { title: t("Projectos") }, (w) => {
      w.pages = [...w.pages, page("p-x", { title: t("PROJECTOS") })];
    });
    expect(s.check("twin").ok).toBe(false);
    expect(setup([], { title: t("Projectos") }).check("twin").ok).toBe(true);
  });
});

describe("seo · palavra-chave principal", () => {
  const kwPage = (kw: string): Partial<Page> => ({
    slug: "reabilitacao-fachadas",
    title: t("Reabilitação de fachadas"),
    seo: { keywords: t(kw), description: t("Fazemos reabilitação de fachadas em todo o Norte, com garantia e prazo certo para a sua obra.") },
  });
  const comps = [
    comp("c1", "titulo", { text: t("Reabilitação de fachadas"), level: "h1" }),
    comp("c2", "texto", { body: t("A reabilitação de fachadas devolve vida ao edifício.\n\nOutro parágrafo.") }),
  ];
  it("sem palavra-chave falha", () => {
    expect(setup(comps, kwPage("")).check("keyword").ok).toBe(false);
  });
  it("a primeira é a principal e tem de estar nos cinco sítios (sem acentos)", () => {
    expect(setup(comps, kwPage("fachadas, molduras")).check("keyword").ok).toBe(true);
  });
  it("diz onde falta", () => {
    const c = setup(comps, kwPage("molduras, reabilitação")).check("keyword");
    expect(c.ok).toBe(false);
    expect(c.text).toContain("molduras");
    expect(c.text).toContain("falta no título do Google");
  });
  it("só o primeiro parágrafo conta", () => {
    const body = comp("c2", "texto", { body: t("Intro sem a palavra.\n\nreabilitação de fachadas aqui.") });
    const c = setup([comps[0], body], kwPage("reabilitacao de fachadas")).check("keyword");
    expect(c.ok).toBe(false);
    expect(c.text).toContain("primeiro parágrafo");
  });
  it("keywordsOf separa por vírgula e ignora vazios", () => {
    expect(keywordsOf(page("a", { seo: { keywords: t("a, b;; c ,") } }), "pt", "pt")).toEqual(["a", "b", "c"]);
  });
});

describe("seo · conteúdo, imagens e ligações", () => {
  it("≥ 150 palavras", () => {
    expect(setup([comp("c1", "texto", { body: t(words(149)) })]).check("words").ok).toBe(false);
    expect(setup([comp("c1", "texto", { body: t(words(150)) })]).check("words").ok).toBe(true);
    expect(setup([comp("c1", "texto", { body: t(`**${words(100)}**`) }), comp("c2", "titulo", { text: t(words(50)) })]).check("words").ok).toBe(true);
  });
  it("imagens sem alt (imagem e itens de galeria); sem ficheiro não conta", () => {
    const bad = setup([
      comp("c1", "imagem", { image: img("a.webp") }),
      comp("c2", "galeria", { items: [{ _id: "k", image: img("b.webp"), alt: t("") }, { _id: "j", image: img("c.webp"), alt: t("Fachada") }] }),
    ]).check("alt");
    expect(bad.ok).toBe(false);
    expect(bad.text).toContain("2 imagens sem descrição");
    expect(setup([comp("c1", "imagem", { image: img("a.webp"), alt: t("Fachada") })]).check("alt").ok).toBe(true);
    expect(setup([comp("c1", "imagem", {})]).check("alt").ok).toBe(true);
  });
  it("pelo menos uma ligação interna (página ≠ esta, âncora, cartões)", () => {
    const btn = (dest: unknown) => comp("c1", "botao", { label: t("x"), dest });
    expect(setup([btn({ kind: "page", pageId: "p-obras" })]).check("links").ok).toBe(false);
    expect(setup([btn({ kind: "url", href: "https://a.pt" })]).check("links").ok).toBe(false);
    expect(setup([btn({ kind: "page", pageId: "p-home" })]).check("links").ok).toBe(true);
    expect(setup([btn({ kind: "anchor", blockId: "b9" })]).check("links").ok).toBe(true);
    expect(setup([comp("c1", "paginas", { pick: ["p-home"] })]).check("links").ok).toBe(true);
  });
  it("ligações para rascunhos, também no topo e no rodapé", () => {
    const toDraft = comp("c1", "botao", { label: t("x"), dest: { kind: "page", pageId: "p-draft" } });
    const withDraft = (w: Work) => {
      w.pages = [...w.pages, page("p-draft", { title: t("Em obras"), status: "draft" })];
    };
    const d = setup([toDraft], {}, withDraft).check("drafts");
    expect(d.ok).toBe(false);
    expect(d.text).toContain("Em obras");
    expect(
      setup([], {}, (w) => {
        withDraft(w);
        w.parts.rodape = { comps: [toDraft] };
      }).check("drafts").ok,
    ).toBe(false);
    expect(setup([comp("c1", "botao", { label: t("x"), dest: { kind: "page", pageId: "p-home" } })]).check("drafts").ok).toBe(true);
  });
  it("noindex ligado", () => {
    expect(setup([], { seo: { noindex: true } }).check("noindex").ok).toBe(false);
    expect(setup([], { seo: { noindex: false } }).check("noindex").ok).toBe(true);
  });
});

describe("seo · pontuação e por língua", () => {
  it("é a % de verificações certas, arredondada", () => {
    const r = setup([]).report();
    const ok = r.checks.filter((c) => c.ok).length;
    expect(r.checks).toHaveLength(11);
    expect(r.score).toBe(Math.round((100 * ok) / 11));
    expect(r.score).toBeLessThan(50); // página vazia: quase tudo por fazer
  });
  it("página perfeita = 100", () => {
    const comps = [
      comp("c1", "titulo", { text: t("Reabilitação de fachadas"), level: "h1" }),
      comp("c2", "texto", { body: t(`Reabilitação de fachadas com garantia. ${words(160)}`) }),
      comp("c3", "imagem", { image: img("a.webp"), alt: t("Fachada") }),
      comp("c4", "botao", { label: t("Início"), dest: { kind: "page", pageId: "p-home" } }),
    ];
    const s = setup(comps, {
      slug: "reabilitacao-fachadas",
      title: t("Reabilitação de fachadas"),
      seo: { keywords: t("fachadas"), description: t("Reabilitação de fachadas para moradias e prédios, com garantia e prazo certo para a sua obra.") },
    });
    expect(s.report().score).toBe(100);
  });
  it("cada língua tem a sua: título, descrição, palavra-chave e endereço", () => {
    const s = setup([comp("c1", "titulo", { text: { pt: "Obras", en: "Works" }, level: "h1" })], {
      title: { pt: "Obras", en: "Works" },
      seo: { description: { pt: "d".repeat(100), en: "" }, keywords: { pt: "obras", en: "works" } },
    });
    expect(s.report("pt").googleTitle).toBe("Obras · Winter");
    expect(s.report("en").googleTitle).toBe("Works · Winter");
    expect(s.report("en").path).toBe("/en/p-obras");
    expect(s.check("keyword", "pt").text).toContain("obras");
    expect(s.check("keyword", "en").text).toContain("works");
  });
  it("siteSeo dá cada página com o 1.º problema e a média", () => {
    const s = setup([]);
    const { rows, average } = siteSeo(s.w, "pt", env);
    expect(rows.map((r) => r.page.id)).toEqual(s.w.pages.map((p) => p.id));
    expect(rows[0].first?.ok).toBe(false);
    expect(average).toBe(Math.round(rows.reduce((n, r) => n + r.report.score, 0) / rows.length));
  });
  it("auxiliares", () => {
    expect(seoBand(80)).toBe("ok");
    expect(seoBand(79)).toBe("mid");
    expect(seoBand(49)).toBe("bad");
    expect(failingFirst([{ id: "a", ok: true, text: "" }, { id: "b", ok: false, text: "" }]).map((c) => c.id)).toEqual(["b", "a"]);
    expect(fold("Reabilitação")).toBe("reabilitacao");
    expect(plain("**Olá** [aqui](https://x.pt) ![i](a.png)")).toBe("Olá aqui");
  });
});

describe("seo · «SEO do site» e o separador dão o mesmo", () => {
  it("siteSeo e seoReport coincidem por página e língua; o 1.º problema é o 1.º da lista do separador", () => {
    const s = setup([comp("c1", "titulo", { text: t("Obras"), level: "h2" }), comp("c2", "botao", { label: t("x"), dest: { kind: "page", pageId: "p-home" } })], {
      seo: { description: t("curta") },
    });
    for (const locale of ["pt", "en"]) {
      const { rows } = siteSeo(s.w, locale, env);
      for (const row of rows) {
        const direct = seoReport(s.w, row.page, locale, env);
        expect(row.report).toEqual(direct);
        expect(row.report.score).toBe(direct.score);
        expect(row.first?.id).toBe(failingFirst(direct.checks).find((c) => !c.ok)?.id);
      }
    }
  });
});
