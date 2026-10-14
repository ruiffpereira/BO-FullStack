import { describe, expect, it } from "vitest";
import { buildChangeset, fromServer, sameValue, stable } from "../../../src/pages/paginas/state/changeset";
import type { Work } from "../../../src/pages/paginas/state/types";
import { block, blockItem, clone, page, sampleWork } from "./fixtures";

const REV = 7;
const diff = (server: Work, work: Work) => buildChangeset(server, work, REV);

describe("changeset", () => {
  it("sem alterações devolve null (nada a gravar)", () => {
    const s = sampleWork();
    expect(diff(s, clone(s))).toBeNull();
  });

  it("compara por valor: a ordem das chaves não conta", () => {
    expect(stable({ a: 1, b: { c: 2, d: 3 } })).toBe(stable({ b: { d: 3, c: 2 }, a: 1 }));
    expect(sameValue({ a: undefined, b: 1 }, { b: 1 })).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    const s = sampleWork();
    const w = clone(s);
    w.pages[1] = Object.fromEntries(Object.entries(w.pages[1]).reverse()) as never;
    expect(diff(s, w)).toBeNull();
  });

  it("criar página: upsert só dela; itens só se tiver", () => {
    const s = sampleWork();
    const w = clone(s);
    w.pages.push(page("p-new", { sortOrder: 2 }));
    w.items["p-new"] = [];
    expect(diff(s, w)).toEqual({ baseRevision: REV, pages: { upsert: [w.pages[2]] } });

    w.items["p-new"] = [blockItem("i9", "b1")];
    expect(diff(s, w)).toEqual({
      baseRevision: REV,
      pages: { upsert: [w.pages[2]] },
      items: { "p-new": w.items["p-new"] },
    });
  });

  it("editar página: só a que mudou; as outras nunca vão", () => {
    const s = sampleWork();
    const w = clone(s);
    w.pages[1].title = { pt: "Obras", en: "Works" };
    const cs = diff(s, w)!;
    expect(cs.pages).toEqual({ upsert: [w.pages[1]] });
    expect(Object.keys(cs).sort()).toEqual(["baseRevision", "pages"]);
  });

  it("apagar página: delete só do id, sem itens dela", () => {
    const s = sampleWork();
    const w = clone(s);
    w.pages = w.pages.filter((p) => p.id !== "p-obras");
    delete w.items["p-obras"];
    expect(diff(s, w)).toEqual({ baseRevision: REV, pages: { delete: ["p-obras"] } });
  });

  it("criar, editar e apagar bloco", () => {
    const s = sampleWork();
    const w = clone(s);
    w.blocks.push(block("b3", { sortOrder: 2 }));
    w.blocks[0].anchor = "#inicio";
    w.blocks = w.blocks.filter((b) => b.id !== "b2");
    w.items["p-home"] = w.items["p-home"].filter((i) => i.blockId !== "b2");
    const cs = diff(s, w)!;
    expect(cs.blocks!.upsert!.map((b) => b.id)).toEqual(["b1", "b3"]);
    expect(cs.blocks!.delete).toEqual(["b2"]);
    expect(cs.items).toEqual({ "p-home": w.items["p-home"] });
  });

  it("criar, renomear e apagar pasta", () => {
    const s = sampleWork();
    const w = clone(s);
    w.folders.push({ id: "f2", name: "Nova", sortOrder: 1 });
    w.folders[0].name = "Renomeada";
    expect(diff(s, w)!.folders).toEqual({ upsert: w.folders });
    const w2 = clone(s);
    w2.folders = [];
    expect(diff(s, w2)).toEqual({ baseRevision: REV, folders: { delete: ["f1"] } });
  });

  it("mexer nos itens: lista COMPLETA, só das páginas tocadas", () => {
    const s = sampleWork();
    const w = clone(s);
    w.items["p-home"] = [w.items["p-home"][1], w.items["p-home"][0]]; // reordenar
    const cs = diff(s, w)!;
    expect(cs.items).toEqual({ "p-home": w.items["p-home"] });
    expect(cs.pages).toBeUndefined();

    const w2 = clone(s);
    w2.items["p-home"][0].hidden = true; // esconder um item
    expect(diff(s, w2)!.items).toEqual({ "p-home": w2.items["p-home"] });
    expect(Object.keys(diff(s, w2)!.items!)).toEqual(["p-home"]);
  });

  it("partes: só se mudaram; null nunca é enviado", () => {
    const s = sampleWork();
    const w = clone(s);
    w.parts.rodape = { layout: 1, bg: "claro", comps: [] };
    expect(diff(s, w)!.parts).toEqual({ rodape: w.parts.rodape });
    const w2 = clone(s);
    w2.parts.topo = null;
    expect(diff(s, w2)).toBeNull();
  });

  it("desfazer tudo devolve null", () => {
    const s = sampleWork();
    const w = clone(s);
    w.blocks[0].name = "x";
    expect(diff(s, w)).not.toBeNull();
    w.blocks[0].name = "b1";
    expect(diff(s, w)).toBeNull();
  });

  it("fromServer deixa só os campos do save e normaliza nulos", () => {
    const w = fromServer({
      enabled: true,
      revision: 3,
      pages: [{ id: "p", slug: "", title: { pt: "x" }, path: "/", updatedAt: "2026", isHome: true, sortOrder: 0 }],
      blocks: [{ id: "b", name: "B", layout: 1, bg: "claro", comps: [], updatedAt: "2026" }],
      folders: [{ id: "f", name: "F", sortOrder: 2 }],
      items: { p: [{ id: "i", kind: "block", blockId: "b", pageId: "p", sortOrder: 0 }] },
      parts: { topo: { comps: [], extra: 1 }, rodape: null },
    });
    expect(w.pages[0]).not.toHaveProperty("path");
    expect(w.pages[0]).not.toHaveProperty("updatedAt");
    expect(w.pages[0]).toMatchObject({ parentId: null, slugs: null, status: "draft", seo: null });
    expect(w.blocks[0]).toMatchObject({ folderId: null, anchor: null });
    expect(w.items.p[0]).toEqual({ id: "i", kind: "block", blockId: "b", specialType: null, specialData: null, hidden: false });
    expect(w.parts).toEqual({ topo: { comps: [] }, rodape: null });
  });
});
