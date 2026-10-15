import { describe, expect, it } from "vitest";
import { setPageLocalSlug, setPageSlug, setPageStatus, setPageTitle, setSeoField, slugify } from "../../../src/pages/paginas/state/pageSettings";
import { pageBlockers } from "../../../src/pages/paginas/state/refs";
import { applyOp } from "../../../src/pages/paginas/state/ops";
import { initState, reduce } from "../../../src/pages/paginas/state/store";
import { pagePathIn, parentPathIn, pathChanges } from "../../../src/pages/paginas/state/tree";
import type { Catalog, Manifest } from "../../../src/pages/paginas/state/types";
import { block, blockItem, page, sampleWork } from "./fixtures";

describe("slugify", () => {
  it("minúsculas, sem acentos, símbolos viram '-'", () => {
    expect(slugify("Reabilitação de Fachadas!")).toBe("reabilitacao-de-fachadas");
    expect(slugify("  --a__b  ")).toBe("a-b");
  });
  it("a escrever mantém o '-' do fim; ao sair tira-o", () => {
    expect(slugify("obras ", false)).toBe("obras-");
    expect(slugify("obras ", true)).toBe("obras");
  });
  it("respeita os 80 caracteres", () => {
    expect(slugify("a".repeat(100))).toHaveLength(80);
  });
});

describe("edições da página", () => {
  it("um valor igual devolve o mesmo Work (o reducer não regista)", () => {
    const w = sampleWork();
    expect(setPageSlug(w, "p-obras", "p-obras")).toBe(w);
    expect(setPageStatus(w, "p-obras", "draft")).toBe(w);
    expect(setPageTitle(w, "p-obras", w.pages[1].title)).toBe(w);
    expect(setSeoField(w, "p-obras", "noindex", undefined)).toBe(w);
    expect(setPageSlug(w, "nao-existe", "x")).toBe(w);
  });
  it("a home não muda de endereço", () => {
    const w = sampleWork();
    expect(setPageSlug(w, "p-home", "x")).toBe(w);
    expect(setPageLocalSlug(w, "p-home", "en", "x")).toBe(w);
  });
  it("endereço noutra língua: vazio tira a chave e sem nenhuma fica null", () => {
    let w = setPageLocalSlug(sampleWork(), "p-obras", "en", "projects");
    expect(w.pages[1].slugs).toEqual({ en: "projects" });
    w = setPageLocalSlug(w, "p-obras", "fr", "projets");
    expect(w.pages[1].slugs).toEqual({ en: "projects", fr: "projets" });
    w = setPageLocalSlug(setPageLocalSlug(w, "p-obras", "en", ""), "p-obras", "fr", "");
    expect(w.pages[1].slugs).toBeNull();
  });
  it("seo: escreve, tira o que fica vazio e volta a null", () => {
    let w = setSeoField(sampleWork(), "p-obras", "title", { pt: "T" });
    expect(w.pages[1].seo).toEqual({ title: { pt: "T" } });
    w = setSeoField(w, "p-obras", "noindex", true);
    expect(w.pages[1].seo).toEqual({ title: { pt: "T" }, noindex: true });
    w = setSeoField(w, "p-obras", "title", {}); // I18n sem línguas
    w = setSeoField(w, "p-obras", "noindex", false);
    expect(w.pages[1].seo).toBeNull();
    w = setSeoField(w, "p-obras", "image", { same: true, values: {} });
    expect(w.pages[1].seo).toBeNull();
  });
});

describe("endereços por língua", () => {
  const w = sampleWork();
  w.pages = [
    page("p-home", { isHome: true, slug: "" }),
    page("a", { slug: "obras", slugs: { en: "projects" } }),
    page("b", { slug: "braga", parentId: "a", slugs: { en: "braga-en" } }),
  ];
  it("pagePathIn / parentPathIn", () => {
    expect(pagePathIn(w.pages, "p-home", "pt", "pt")).toBe("/");
    expect(pagePathIn(w.pages, "p-home", "en", "pt")).toBe("/en");
    expect(pagePathIn(w.pages, "b", "pt", "pt")).toBe("/obras/braga");
    expect(pagePathIn(w.pages, "b", "en", "pt")).toBe("/en/projects/braga-en");
    expect(pagePathIn(w.pages, "b", "fr", "pt")).toBe("/fr/obras/braga"); // sem slug em fr: cai no da base
    expect(parentPathIn(w.pages, "b", "en", "pt")).toBe("/projects");
    expect(parentPathIn(w.pages, "a", "pt", "pt")).toBe("");
  });
  it("pathChanges: a própria (por língua) e as descendentes por arrasto", () => {
    const next = setPageSlug(w, "a", "projectos");
    const c = pathChanges(w.pages, next.pages, "a", ["pt", "en"], "pt");
    expect(c.own).toEqual([{ from: "/obras", to: "/projectos" }]);
    expect(c.others).toBe(1);
    expect(pathChanges(w.pages, w.pages, "a", ["pt", "en"], "pt")).toEqual({ own: [], others: 0 });
    const en = setPageLocalSlug(w, "a", "en", "works");
    expect(pathChanges(w.pages, en.pages, "a", ["pt", "en"], "pt").own).toEqual([{ from: "/en/projects", to: "/en/works" }]);
  });
  it("uma página nova não tem endereço antigo", () => {
    const added = [...w.pages, page("n", { slug: "nova" })];
    expect(pathChanges(w.pages, added, "n", ["pt"], "pt")).toEqual({ own: [], others: 0 });
  });
});

describe("apagar página", () => {
  it("deletePage: tira a página e os itens; a home e as mães não se apagam", () => {
    const w = sampleWork();
    const next = applyOp(w, { type: "deletePage", id: "p-obras" });
    expect(next.pages.map((p) => p.id)).toEqual(["p-home"]);
    expect(next.items["p-obras"]).toBeUndefined();
    expect(applyOp(w, { type: "deletePage", id: "p-home" })).toBe(w);
    const kids = { ...w, pages: [...w.pages, page("filha", { parentId: "p-obras" })] };
    expect(applyOp(kids, { type: "deletePage", id: "p-obras" })).toBe(kids);
  });

  const catalog: Catalog = {
    components: [
      { type: "botao", label: "Botão", fields: { label: { type: "text", i18n: true }, dest: { type: "dest" } } },
      { type: "menu", label: "Menu", fields: { items: { type: "list", of: { dest: { type: "dest" } } } } },
      { type: "paginas", label: "Cartões", fields: { pick: { type: "pages" } } },
    ],
  };
  const manifest: Manifest = { specials: { faixa: { label: "Faixa", fields: { go: { type: "dest" } } } } };
  const to = { kind: "page", pageId: "alvo" };
  const comp = (id: string, type: string, v: unknown) => ({ id, type, style: "normal", col: "all", v });

  it("motivos: filhas, blocos, partes, especiais e canónicas", () => {
    const w = sampleWork();
    w.pages = [...w.pages, page("alvo", { slug: "alvo" }), page("filha", { parentId: "alvo" }), page("outra", { seo: { canonicalPageId: "alvo" } })];
    w.blocks = [
      block("b1", { name: "Chamada", comps: [comp("c1", "botao", { dest: to })] }),
      block("b2", { name: "Cartões", comps: [comp("c2", "paginas", { pick: ["x", "alvo"] })] }),
      block("b3", { name: "Sem nada", comps: [comp("c3", "botao", { dest: { kind: "page", pageId: "p-home" } })] }),
    ];
    w.parts.topo = { comps: [comp("t1", "menu", { items: [{ _id: "k", dest: to }] })] };
    w.items["p-home"] = [{ id: "sp", kind: "special", blockId: null, specialType: "faixa", specialData: { go: to }, hidden: false }, blockItem("i1", "b1")];
    const kinds = pageBlockers(w, catalog, manifest, "alvo").map((b) => b.kind).sort();
    expect(kinds).toEqual(["block", "block", "canonical", "child", "part", "special"]);
    expect(pageBlockers(w, catalog, manifest, "p-obras")).toEqual([]);
  });
});

describe("store · separador e «Ver onde»", () => {
  it("o separador volta a «content» ao mudar de página ou abrir um editor; sel de página mantém", () => {
    let s = initState(sampleWork(), 1);
    expect(s.tab).toBe("content");
    s = reduce(s, { type: "select", tab: "settings" });
    expect(s.tab).toBe("settings");
    s = reduce(s, { type: "select", libId: null, sel: { kind: "page", id: "p-home" } });
    expect(s.tab).toBe("settings");
    s = reduce(s, { type: "select", libId: "b1", sel: { kind: "block", id: "b1" } });
    expect(s.tab).toBe("content");
    s = reduce(s, { type: "select", tab: "settings" });
    s = reduce(s, { type: "select", pageId: "p-obras", sel: { kind: "page", id: "p-obras" } });
    expect(s.tab).toBe("content");
  });
  it("reveal sobe a cada «Ver onde» e desaparece na navegação seguinte", () => {
    const m = { entity: "page" as const, id: "p-home", path: "title", locale: "en" };
    let s = reduce(initState(sampleWork(), 1), { type: "select", focus: m, tab: "settings" });
    expect(s.reveal).toBe(1);
    s = reduce(s, { type: "select", focus: m, tab: "settings" });
    expect(s.reveal).toBe(2);
    s = reduce(s, { type: "select", tab: "content" });
    expect(s.reveal).toBeNull();
  });
});
