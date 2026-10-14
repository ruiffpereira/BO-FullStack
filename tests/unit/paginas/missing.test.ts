import { describe, expect, it } from "vitest";
import {
  countMissing, findMissing, firstMissing, isBlank, locateMissing, missingLocales, type MissingItem,
} from "../../../src/pages/paginas/state/missing";
import type { Catalog, LangCtx, Manifest } from "../../../src/pages/paginas/state/types";
import { block, blockItem, page, sampleWork } from "./fixtures";

const lang: LangCtx = { languages: ["pt", "en", "fr"], defaultLanguage: "pt" };
const catalog: Catalog = {
  components: [
    { type: "titulo", label: "Título", fields: { text: { type: "text", i18n: true }, level: { type: "choice" } } },
    { type: "faq", label: "FAQ", fields: { items: { type: "list", of: { q: { type: "text", i18n: true }, a: { type: "md", i18n: true } } } } },
    { type: "imagem", label: "Imagem", fields: { image: { type: "media", kind: "image" }, alt: { type: "text", i18n: true } } },
    { type: "botao", label: "Botão", fields: { label: { type: "text", i18n: true }, dest: { type: "dest" } } },
    { type: "numeros", label: "Números", fields: { items: { type: "list", of: { value: { type: "text", i18n: false } } } } },
  ],
};
const manifest: Manifest = {
  specials: { faixa: { label: "Faixa", fields: { eyebrow: { type: "text", i18n: true } } } },
};
const comp = (id: string, type: string, v: Record<string, unknown>) => ({ id, type, style: "normal", col: "all", v });
const find = (w = sampleWork()) => findMissing(w, catalog, manifest, lang);

describe("missingLocales (regra do §6.4)", () => {
  const text = { type: "text", i18n: true };
  it("só conta se a base tem valor", () => {
    expect(missingLocales({ pt: "Olá" }, text, lang.languages, "pt")).toEqual(["en", "fr"]);
    expect(missingLocales({ pt: "Olá", en: "Hi", fr: "Salut" }, text, lang.languages, "pt")).toEqual([]);
    expect(missingLocales({ en: "Hi" }, text, lang.languages, "pt")).toEqual([]); // base vazia: é "obrigatório", não tradução
    expect(missingLocales({ pt: "   ", en: "x" }, text, lang.languages, "pt")).toEqual([]);
  });
  it("espaços contam como vazio", () => {
    expect(isBlank("  ")).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(missingLocales({ pt: "a", en: " ", fr: "c" }, text, lang.languages, "pt")).toEqual(["en"]);
  });
  it("texto sem i18n e media com same:true nunca faltam", () => {
    expect(missingLocales("Olá", { type: "text" }, lang.languages, "pt")).toEqual([]);
    expect(missingLocales({ same: true, values: { pt: "a.webp" } }, { type: "media" }, lang.languages, "pt")).toEqual([]);
  });
  it("media com same:false exige uma por língua", () => {
    expect(missingLocales({ same: false, values: { pt: "a.webp", en: "b.webp" } }, { type: "media" }, lang.languages, "pt")).toEqual(["fr"]);
  });
  it("as línguas são parâmetros (nada de pt/en/fr fixo)", () => {
    expect(missingLocales({ de: "Hallo" }, { type: "text", i18n: true }, ["de", "es"], "de")).toEqual(["es"]);
  });
});

describe("findMissing", () => {
  it("estado completo: nada em falta", () => {
    expect(find()).toEqual([]);
  });

  it("título de página e SEO", () => {
    const w = sampleWork();
    w.pages[1] = page("p-obras", { title: { pt: "Obras" }, seo: { description: { pt: "d", en: "d" }, title: { pt: "t", en: "t", fr: "t" } } });
    const r = find(w);
    expect(r.filter((m) => m.path === "title").map((m) => m.locale)).toEqual(["en", "fr"]);
    expect(r.find((m) => m.path === "seo.description")).toMatchObject({ entity: "page", id: "p-obras", locale: "fr" });
    expect(r.some((m) => m.path === "seo.title")).toBe(false);
  });

  it("componentes de blocos (usados ou não) e listas, com o mesmo path da API", () => {
    const w = sampleWork();
    w.blocks[1] = block("b2", {
      comps: [
        comp("c1", "titulo", { text: { pt: "Olá", en: "Hi", fr: "Salut" } }),
        comp("c2", "faq", { items: [{ _id: "k3", q: { pt: "Q?", en: "Q?" }, a: { pt: "A", en: "A", fr: "A" } }] }),
        comp("c3", "numeros", { items: [{ _id: "n1", value: "10" }] }),
      ],
    });
    expect(find(w)).toEqual([{ entity: "block", id: "b2", path: "comps.c2.v.items.k3.q", locale: "fr" }]);
  });

  it("media por língua e destino ficheiro", () => {
    const w = sampleWork();
    w.blocks[0] = block("b1", {
      comps: [
        comp("c1", "imagem", { image: { same: false, values: { pt: "a.webp" } } }),
        comp("c2", "botao", { label: { pt: "Ver", en: "See", fr: "Voir" }, dest: { kind: "file", media: { same: false, values: { pt: "a.pdf", en: "b.pdf" } } } }),
        comp("c3", "botao", { label: { pt: "x", en: "x", fr: "x" }, dest: { kind: "url", href: "https://x.pt" } }),
      ],
    });
    expect(find(w)).toEqual([
      { entity: "block", id: "b1", path: "comps.c1.v.image", locale: "en" },
      { entity: "block", id: "b1", path: "comps.c1.v.image", locale: "fr" },
      { entity: "block", id: "b1", path: "comps.c2.v.dest.media", locale: "fr" },
    ]);
  });

  it("partes comuns", () => {
    const w = sampleWork();
    w.parts.topo = { comps: [comp("t1", "botao", { label: { pt: "Contactar" }, dest: { kind: "url", href: "/" } })] };
    expect(find(w).map((m) => [m.entity, m.id, m.path, m.locale])).toEqual([
      ["part", "topo", "comps.t1.v.label", "en"],
      ["part", "topo", "comps.t1.v.label", "fr"],
    ]);
  });

  it("especiais (campos do manifest); tipo desconhecido é ignorado", () => {
    const w = sampleWork();
    w.items["p-obras"] = [
      { id: "s1", kind: "special", blockId: null, specialType: "faixa", specialData: { eyebrow: { pt: "Nova", en: "New" } }, hidden: false },
      { id: "s2", kind: "special", blockId: null, specialType: "desconhecido", specialData: { x: { pt: "a" } }, hidden: false },
      blockItem("i7", "b1"),
    ];
    expect(find(w)).toEqual([{ entity: "item", id: "s1", path: "specialData.eyebrow", locale: "fr" }]);
  });

  it("sem catálogo nem manifest não rebenta", () => {
    expect(findMissing(sampleWork(), null, null, lang)).toEqual([]);
  });

  it("uma só língua no tenant: nunca falta nada", () => {
    const w = sampleWork();
    w.pages[0] = page("p-home", { isHome: true, title: { pt: "Início" } });
    expect(findMissing(w, catalog, manifest, { languages: ["pt"], defaultLanguage: "pt" })).toEqual([]);
  });
});

describe("countMissing e firstMissing", () => {
  const list: MissingItem[] = [
    { entity: "page", id: "p1", path: "title", locale: "en" },
    { entity: "page", id: "p1", path: "title", locale: "fr" },
    { entity: "block", id: "b1", path: "comps.c1.v.text", locale: "en" },
    { entity: "part", id: "topo", path: "comps.t1.v.label", locale: "fr" },
  ];
  it("conta campos, não línguas", () => {
    expect(countMissing(list)).toBe(3);
    expect(countMissing([])).toBe(0);
  });
  it("firstMissing devolve o primeiro; null se não falta nada", () => {
    expect(firstMissing(list)).toEqual(list[0]);
    expect(firstMissing([])).toBeNull();
  });
  it("com 'after' avança de campo em campo e dá a volta", () => {
    const b = firstMissing(list, list[0])!;
    expect(b).toEqual(list[2]); // salta a outra língua do mesmo campo
    const c = firstMissing(list, b)!;
    expect(c).toEqual(list[3]);
    expect(firstMissing(list, c)).toEqual(list[0]);
  });
  it("'after' que já não existe leva ao primeiro; um só campo devolve-se a ele próprio", () => {
    expect(firstMissing(list, { entity: "page", id: "zz", path: "title", locale: "en" })).toEqual(list[0]);
    expect(firstMissing([list[0], list[1]], list[0])).toEqual(list[0]);
  });
});

describe("locateMissing", () => {
  const w = sampleWork();
  it("página, bloco, parte e item (acha a página que o tem)", () => {
    expect(locateMissing(w, { entity: "page", id: "p-obras", path: "title", locale: "en" })).toEqual({ pageId: "p-obras", sel: { kind: "page", id: "p-obras" } });
    expect(locateMissing(w, { entity: "block", id: "b2", path: "x", locale: "en" })).toEqual({ libId: "b2", sel: { kind: "block", id: "b2" } });
    expect(locateMissing(w, { entity: "part", id: "rodape", path: "x", locale: "en" })).toEqual({ sel: { kind: "part", id: "rodape" } });
    expect(locateMissing(w, { entity: "item", id: "i2", path: "x", locale: "en" })).toEqual({ pageId: "p-home", sel: { kind: "item", id: "i2" } });
  });
});
