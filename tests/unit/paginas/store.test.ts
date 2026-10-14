import { describe, expect, it } from "vitest";
import { initState, reduce } from "../../../src/pages/paginas/state/store";
import { newEntityId, newShortId } from "../../../src/pages/paginas/state/ids";
import { flattenPages, pageTitle } from "../../../src/pages/paginas/state/tree";
import { page, sampleWork } from "./fixtures";

describe("store (reducer)", () => {
  it("abre na home, sem alterações", () => {
    const s = initState(sampleWork(), 5);
    expect(s.pageId).toBe("p-home");
    expect(s.revision).toBe(5);
    expect(s.status).toBe("idle");
  });

  it("edit, undo e redo; um edit idêntico não regista", () => {
    let s = initState(sampleWork(), 1);
    const same = reduce(s, { type: "edit", update: (w) => w });
    expect(same).toBe(s);
    s = reduce(s, { type: "edit", update: (w) => ({ ...w, folders: [...w.folders, { id: "f2", name: "N", sortOrder: 1 }] }) });
    expect(s.work.folders).toHaveLength(2);
    s = reduce(s, { type: "undo" });
    expect(s.work.folders).toHaveLength(1);
    s = reduce(s, { type: "redo" });
    expect(s.work.folders).toHaveLength(2);
  });

  it("apagar a página selecionada move a selecção para a home", () => {
    let s = initState(sampleWork(), 1);
    s = reduce(s, { type: "select", pageId: "p-obras", sel: { kind: "page", id: "p-obras" } });
    s = reduce(s, { type: "edit", update: (w) => ({ ...w, pages: w.pages.filter((p) => p.id !== "p-obras") }) });
    expect(s.pageId).toBe("p-home");
    expect(s.sel).toBeNull();
  });

  it("saveOk: o enviado passa a ser o servidor, com a revisão nova e o ponto guardado", () => {
    let s = initState(sampleWork(), 1);
    s = reduce(s, { type: "edit", update: (w) => ({ ...w, pages: [...w.pages, page("p-x")] }) });
    const sent = s.work;
    s = reduce(s, { type: "saveStart" });
    expect(s.status).toBe("saving");
    s = reduce(s, { type: "saveOk", revision: 2, sent });
    expect(s.revision).toBe(2);
    expect(s.status).toBe("idle");
    expect(s.server.pages.map((p) => p.id)).toContain("p-x");
    expect(s.server).not.toBe(sent); // cópia
  });

  it("409 mantém o trabalho; dismiss fecha o aviso sem o perder; load recarrega", () => {
    let s = initState(sampleWork(), 1);
    s = reduce(s, { type: "edit", update: (w) => ({ ...w, pages: [...w.pages, page("p-x")] }) });
    s = reduce(s, { type: "conflict", revision: 9 });
    expect(s.status).toBe("conflict");
    expect(s.conflictRevision).toBe(9);
    expect(s.work.pages).toHaveLength(3);
    s = reduce(s, { type: "dismiss" });
    expect(s.status).toBe("idle");
    expect(s.work.pages).toHaveLength(3);
    s = reduce(s, { type: "load", work: sampleWork(), revision: 9 });
    expect(s.work.pages).toHaveLength(2);
    expect(s.revision).toBe(9);
  });

  it("422 guarda os issues para as fatias seguintes", () => {
    let s = initState(sampleWork(), 1);
    const issues = [{ code: "MISSING_TRANSLATION", entity: "block" as const, id: "b1", path: "comps.c1.v.text", locale: "en", message: "Falta" }];
    s = reduce(s, { type: "invalid", issues });
    expect(s.status).toBe("invalid");
    expect(s.issues).toEqual(issues);
    s = reduce(s, { type: "saveStart" });
    expect(s.issues).toEqual([]);
  });

  it("dismiss não interrompe uma gravação a decorrer", () => {
    let s = initState(sampleWork(), 1);
    s = reduce(s, { type: "saveStart" });
    expect(reduce(s, { type: "dismiss" }).status).toBe("saving");
  });
});

describe("ids", () => {
  it("UUID v4 para entidades; nanoid(10) com alfabeto seguro para componentes", () => {
    expect(newEntityId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const ids = new Set(Array.from({ length: 500 }, () => newShortId()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{10}$/); // = ID_RE da API
  });
});

describe("tree", () => {
  it("home primeiro, filhas em profundidade por sortOrder; ciclos e mães inexistentes não escondem páginas", () => {
    const rows = flattenPages([
      page("b", { sortOrder: 2 }),
      page("a", { sortOrder: 1 }),
      page("a1", { parentId: "a" }),
      page("home", { isHome: true, sortOrder: 9 }),
      page("orf", { parentId: "nao-existe", sortOrder: 5 }),
    ]);
    expect(rows.map((r) => `${r.depth}:${r.page.id}`)).toEqual(["0:home", "0:a", "1:a1", "0:b", "0:orf"]);
  });
  it("pageTitle cai na primeira língua com texto", () => {
    expect(pageTitle(page("x", { title: { pt: "", en: "Works" } }), "pt")).toBe("Works");
    expect(pageTitle(page("x", { title: {} }), "pt")).toBe("Sem título");
  });
});
