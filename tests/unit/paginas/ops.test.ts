import { describe, expect, it } from "vitest";
import { emptyWork } from "../../../src/pages/paginas/state/changeset";
import { initState, reduce } from "../../../src/pages/paginas/state/store";
import {
  LIB_ROOT,
  applyOp,
  blocksIn,
  buildAddPage,
  canMoveLibrary,
  commonBlockIds,
  sortedFolders,
  type WorkOp,
} from "../../../src/pages/paginas/state/ops";
import { block, blockItem, page, sampleWork } from "./fixtures";
import type { Work } from "../../../src/pages/paginas/state/types";

const LANG = { languages: ["pt", "en"], defaultLanguage: "pt" };
let seq = 0;
const newId = () => `id-${++seq}`;

/** home + obras; blocos b1 (home e obras), b2 (só home), b3 solto; pastas f1 (b4, b5) e f2 (vazia). */
function lib(): Work {
  const w = sampleWork();
  return {
    ...w,
    blocks: [
      block("b1"),
      block("b2", { sortOrder: 1 }),
      block("b3", { sortOrder: 2 }),
      block("b4", { folderId: "f1", sortOrder: 0 }),
      block("b5", { folderId: "f1", sortOrder: 1 }),
    ],
    folders: [
      { id: "f1", name: "Heróis", sortOrder: 0 },
      { id: "f2", name: "Rodapés", sortOrder: 1 },
    ],
    items: { "p-home": [blockItem("i1", "b1"), blockItem("i2", "b2")], "p-obras": [blockItem("i3", "b1")] },
  };
}

const idsOf = (list: { id: string }[]) => list.map((x) => x.id);
const usedIn = (w: Work, blockId: string) => Object.values(w.items).filter((l) => l.some((it) => it.blockId === blockId)).length;

describe("pastas", () => {
  it("criar: vai para o fim, com o nome pedido", () => {
    const w = applyOp(lib(), { type: "addFolder", folder: { id: "f3", name: "Nova pasta", sortOrder: 0 } });
    expect(idsOf(sortedFolders(w))).toEqual(["f1", "f2", "f3"]);
    expect(w.folders.find((f) => f.id === "f3")).toMatchObject({ name: "Nova pasta", sortOrder: 2 });
  });

  it("renomear: corta espaços; vazio ou igual não muda nada", () => {
    const w = lib();
    expect(applyOp(w, { type: "renameFolder", id: "f1", name: "  Capas  " }).folders[0].name).toBe("Capas");
    expect(applyOp(w, { type: "renameFolder", id: "f1", name: "   " })).toBe(w);
    expect(applyOp(w, { type: "renameFolder", id: "f1", name: "Heróis" })).toBe(w);
    expect(applyOp(w, { type: "renameFolder", id: "nope", name: "X" })).toBe(w);
    expect(applyOp(w, { type: "renameFolder", id: "f1", name: "x".repeat(200) }).folders[0].name).toHaveLength(80);
  });

  it("apagar: só se estiver vazia", () => {
    const w = lib();
    expect(applyOp(w, { type: "deleteFolder", id: "f1" })).toBe(w);
    expect(idsOf(applyOp(w, { type: "deleteFolder", id: "f2" }).folders)).toEqual(["f1"]);
  });

  it("mover pasta: antes/depois de outra; dentro não", () => {
    const w = lib();
    expect(idsOf(sortedFolders(applyOp(w, { type: "moveLibrary", from: "f2", to: "f1", position: "before" })))).toEqual(["f2", "f1"]);
    expect(idsOf(sortedFolders(applyOp(w, { type: "moveLibrary", from: "f1", to: "f2", position: "after" })))).toEqual(["f2", "f1"]);
    expect(canMoveLibrary(w, "f1", "f2", "inside")).toBe(false);
    expect(canMoveLibrary(w, "f1", "b3", "after")).toBe(false); // pastas só entre pastas
  });
});

describe("blocos na biblioteca", () => {
  it("para dentro de uma pasta: vai para o fim e renumera a origem", () => {
    const w = applyOp(lib(), { type: "moveLibrary", from: "b3", to: "f1", position: "inside" });
    expect(idsOf(blocksIn(w, "f1"))).toEqual(["b4", "b5", "b3"]);
    expect(w.blocks.find((b) => b.id === "b3")!.folderId).toBe("f1");
    expect(idsOf(blocksIn(w, null))).toEqual(["b1", "b2"]);
  });

  it("para uma pasta vazia, pela linha 'arrasta blocos para aqui'", () => {
    const w = applyOp(lib(), { type: "moveLibrary", from: "b3", to: "vazia:f2", position: "inside" });
    expect(idsOf(blocksIn(w, "f2"))).toEqual(["b3"]);
  });

  it("antes/depois de um bloco adopta a pasta dele", () => {
    const w = applyOp(lib(), { type: "moveLibrary", from: "b1", to: "b5", position: "before" });
    expect(idsOf(blocksIn(w, "f1"))).toEqual(["b4", "b1", "b5"]);
    expect(w.blocks.find((b) => b.id === "b1")!.folderId).toBe("f1");
    expect(idsOf(blocksIn(w, null))).toEqual(["b2", "b3"]);
  });

  it("para fora da pasta: 'Sem pasta' mete-o no fim dos soltos", () => {
    const w = applyOp(lib(), { type: "moveLibrary", from: "b4", to: LIB_ROOT, position: "inside" });
    expect(w.blocks.find((b) => b.id === "b4")!.folderId).toBeNull();
    expect(idsOf(blocksIn(w, null))).toEqual(["b1", "b2", "b3", "b4"]);
    expect(idsOf(blocksIn(w, "f1"))).toEqual(["b5"]);
  });

  it("só toca nos blocos que mudam (changeset mínimo) e recusa gestos impossíveis", () => {
    const w0 = lib();
    const w = applyOp(w0, { type: "moveLibrary", from: "b3", to: "b2", position: "before" });
    expect(idsOf(blocksIn(w, null))).toEqual(["b1", "b3", "b2"]);
    expect(w.blocks.find((b) => b.id === "b1")).toBe(w0.blocks.find((b) => b.id === "b1"));
    expect(w.blocks.find((b) => b.id === "b4")).toBe(w0.blocks.find((b) => b.id === "b4"));
    expect(canMoveLibrary(w0, "b3", "b1", "inside")).toBe(false);
    expect(canMoveLibrary(w0, "b3", "b3", "after")).toBe(false);
    expect(canMoveLibrary(w0, "b3", "f1", "after")).toBe(false);
    expect(applyOp(w0, { type: "moveLibrary", from: "b1", to: "b2", position: "before" })).toBe(w0); // já está lá
  });
});

describe("nova página", () => {
  it("de primeiro nível leva os blocos que estão em TODAS as páginas, por referência", () => {
    const w = lib();
    expect(commonBlockIds(w)).toEqual(["b1"]); // b2 só está na home
    const op = buildAddPage(w, LANG, { parentId: null, newId })!;
    expect(op.items.map((it) => it.blockId)).toEqual(["b1"]);
    expect(op.items[0].id).not.toBe("i1"); // item novo, mesmo bloco
    const next = applyOp(w, op);
    expect(next.items[op.page.id]).toHaveLength(1);
    expect(next.blocks).toBe(w.blocks); // o bloco não foi copiado
    expect(usedIn(next, "b1")).toBe(3);
  });

  it("nasce em rascunho, com título em todas as línguas e endereço único", () => {
    let w = lib();
    for (let i = 0; i < 2; i++) w = applyOp(w, buildAddPage(w, LANG, { parentId: null, newId })!);
    const created = w.pages.filter((p) => p.slug.startsWith("nova-pagina"));
    expect(created.map((p) => p.slug)).toEqual(["nova-pagina", "nova-pagina-2"]);
    expect(created[0]).toMatchObject({ status: "draft", isHome: false, parentId: null, title: { pt: "Nova página", en: "Nova página" } });
    expect(created[1].sortOrder).toBeGreaterThan(created[0].sortOrder!);
  });

  it("subpágina nasce vazia, na mãe certa; a home, o limite de profundidade e o de páginas recusam", () => {
    const w = lib();
    const op = buildAddPage(w, LANG, { parentId: "p-obras", newId })!;
    expect(op.items).toEqual([]);
    expect(op.page.parentId).toBe("p-obras");
    expect(buildAddPage(w, LANG, { parentId: "p-home" })).toBeNull();
    expect(buildAddPage(w, LANG, { parentId: "p-obras", maxDepth: 1 })).toBeNull();
    expect(buildAddPage(w, LANG, { parentId: "nope" })).toBeNull();
    expect(buildAddPage(w, LANG, { parentId: null, maxPages: 2 })).toBeNull();
  });

  it("num site sem páginas, a primeira é a home", () => {
    const op = buildAddPage(emptyWork(), LANG, { parentId: null, newId })!;
    expect(op.page).toMatchObject({ isHome: true, slug: "", status: "draft" });
    expect(op.items).toEqual([]);
  });

  it("sem blocos em comum, nasce vazia", () => {
    const w = lib();
    w.items["p-obras"] = [];
    expect(commonBlockIds(w)).toEqual([]);
    expect(buildAddPage(w, LANG, { parentId: null, newId })!.items).toEqual([]);
  });
});

describe("reducer · cada operação entra no desfazer", () => {
  const start = (): Work => ({ ...lib(), pages: [...lib().pages, page("p-x", { sortOrder: 2 })], items: { ...lib().items, "p-x": [] } });
  const ops: [string, (w: Work) => WorkOp][] = [
    ["mover página", () => ({ type: "movePage", from: "p-x", to: "p-obras", position: "before" })],
    ["nova página", (w) => buildAddPage(w, LANG, { parentId: null, newId })!],
    ["nova subpágina", (w) => buildAddPage(w, LANG, { parentId: "p-obras", newId })!],
    ["criar pasta", () => ({ type: "addFolder", folder: { id: "fx", name: "Nova pasta", sortOrder: 0 } })],
    ["renomear pasta", () => ({ type: "renameFolder", id: "f1", name: "Outro" })],
    ["apagar pasta", () => ({ type: "deleteFolder", id: "f2" })],
    ["mover pasta", () => ({ type: "moveLibrary", from: "f2", to: "f1", position: "before" })],
    ["mover bloco", () => ({ type: "moveLibrary", from: "b3", to: "f1", position: "inside" })],
  ];

  for (const [name, make] of ops) {
    it(`${name}: um desfazer repõe o estado e um refazer volta a aplicá-lo`, () => {
      const w0 = start();
      let s = initState(w0, 1);
      s = reduce(s, { type: "op", op: make(w0) });
      expect(s.work).not.toEqual(w0);
      expect(s.history.stack).toHaveLength(2);
      const after = s.work;
      s = reduce(s, { type: "undo" });
      expect(s.work).toEqual(w0);
      s = reduce(s, { type: "redo" });
      expect(s.work).toEqual(after);
    });
  }

  it("uma operação sem efeito não entra no histórico", () => {
    let s = initState(lib(), 1);
    s = reduce(s, { type: "op", op: { type: "deleteFolder", id: "f1" } }); // tem blocos
    s = reduce(s, { type: "op", op: { type: "movePage", from: "p-home", to: "p-obras", position: "after" } }); // a home não se move
    expect(s.history.stack).toHaveLength(1);
  });

  it("nova página fica selecionada (e a seleção volta à home se se desfaz)", () => {
    let s = initState(lib(), 1);
    const op = buildAddPage(s.work, LANG, { parentId: null, newId })!;
    s = reduce(s, { type: "op", op });
    expect(s.pageId).toBe(op.page.id);
    expect(s.sel).toEqual({ kind: "page", id: op.page.id });
    s = reduce(s, { type: "undo" });
    expect(s.pageId).toBe("p-home");
  });
});
