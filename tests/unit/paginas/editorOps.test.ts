import { describe, expect, it } from "vitest";
import { applyOp, anchorFromName, fitCol, type Comp, type Holder } from "../../../src/pages/paginas/state/ops";
import { initState, reduce } from "../../../src/pages/paginas/state/store";
import {
  allowedTypes,
  buildAddComp,
  buildCopyComp,
  buildDuplicateComp,
  compHolders,
  compSummary,
  neighbours,
  selFor,
  type IdGen,
} from "../../../src/pages/paginas/state/blocks";
import type { Catalog, Manifest, Work } from "../../../src/pages/paginas/state/types";
import { block, blockItem, sampleWork } from "./fixtures";

let seq = 0;
const ids: IdGen = { entity: () => `e-${++seq}`, short: () => `s-${++seq}` };

const catalog: Catalog = {
  components: [
    { type: "titulo", label: "Título", fields: { text: { type: "text", i18n: true }, level: { type: "choice", default: "h2" } } },
    { type: "texto", label: "Texto", fields: { body: { type: "md", i18n: true } } },
    { type: "lista", label: "Lista", fields: { items: { type: "list", of: { text: { type: "text", i18n: true } } } } },
    { type: "menu", label: "Menu", fields: {} },
  ],
  parts: { topo: ["menu", "texto"], rodape: ["texto", "menu"] },
};
const manifest: Manifest = {
  styles: { titulo: [{ id: "seccao", label: "Secção" }, { id: "frase", label: "Frase" }] },
  parts: { topo: ["menu"] },
};

const B: Holder = { kind: "block", id: "b1" };
const comp = (id: string, type: string, col: string | number, v: unknown = {}): Comp => ({ id, type, style: "normal", col, v });

/** b1 com 3 colunas e componentes em todas (está na home); b2 solto, sem uso. */
function work(): Work {
  const w = sampleWork();
  return {
    ...w,
    blocks: [
      block("b1", { layout: 3, comps: [comp("c0", "titulo", "all"), comp("c1", "texto", 1), comp("c2", "texto", 2), comp("c3", "texto", 3)] }),
      block("b2", { sortOrder: 1, name: "Solto" }),
    ],
    items: { "p-home": [blockItem("i1", "b1")], "p-obras": [] },
    parts: { topo: null, rodape: null },
  };
}

const colsOf = (w: Work, id = "b1") => (w.blocks.find((b) => b.id === id)!.comps as Comp[]).map((c) => c.col);

describe("F14 · disposição", () => {
  it("reduzir colunas reposiciona os componentes cujo col deixou de existir; 'all' fica", () => {
    const w = applyOp(work(), { type: "setHolder", holder: B, patch: { layout: 2 } });
    expect(w.blocks[0].layout).toBe(2);
    expect(colsOf(w)).toEqual(["all", 1, 2, 2]);
    const w1 = applyOp(w, { type: "setHolder", holder: B, patch: { layout: 1 } });
    expect(colsOf(w1)).toEqual(["all", 1, 1, 1]);
  });

  it("aumentar colunas não mexe nos componentes; igual não faz nada", () => {
    const w = applyOp(work(), { type: "setHolder", holder: B, patch: { layout: 2 } });
    const up = applyOp(w, { type: "setHolder", holder: B, patch: { layout: 3 } });
    expect(colsOf(up)).toEqual(["all", 1, 2, 2]);
    expect(applyOp(up, { type: "setHolder", holder: B, patch: { layout: 3 } })).toBe(up);
  });

  it("passa pelo reducer: uma entrada no desfazer, que repõe as colunas", () => {
    let s = initState(work(), 1);
    s = reduce(s, { type: "op", op: { type: "setHolder", holder: B, patch: { layout: 2 } } });
    expect(colsOf(s.work)).toEqual(["all", 1, 2, 2]);
    s = reduce(s, { type: "undo" });
    expect(colsOf(s.work)).toEqual(["all", 1, 2, 3]);
  });

  it("fitCol", () => {
    expect([fitCol("all", 1), fitCol(3, 2), fitCol(2, 3), fitCol(undefined, 2)]).toEqual(["all", 2, 2, "all"]);
  });
});

describe("F14 · bloco e âncora", () => {
  it("nome e fundo; o topo não tem fundo nem disposição", () => {
    let w = applyOp(work(), { type: "setHolder", holder: B, patch: { name: "Novo nome", bg: "escuro" } });
    expect(w.blocks[0]).toMatchObject({ name: "Novo nome", bg: "escuro" });
    w = applyOp(w, { type: "setHolder", holder: { kind: "part", id: "topo" }, patch: { bg: "escuro", layout: 2 } });
    expect(w.parts.topo).toBeNull();
  });

  it("âncora gerada do nome (slug) e única entre blocos", () => {
    expect(anchorFromName("Os Nossos Serviços!")).toBe("#os-nossos-servicos");
    let w = applyOp(work(), { type: "setHolder", holder: { kind: "block", id: "b2" }, patch: { anchor: "Obras" } });
    expect(w.blocks[1].anchor).toBe("#obras");
    w = applyOp(w, { type: "setHolder", holder: B, patch: { anchor: "obras" } });
    expect(w.blocks[0].anchor).toBe("#obras-2");
    w = applyOp(w, { type: "setHolder", holder: B, patch: { anchor: "" } });
    expect(w.blocks[0].anchor).toBeNull();
  });

  it("o rodapé que ainda não existe nasce com disposição 1 e o fundo dado", () => {
    const w = applyOp(work(), { type: "setHolder", holder: { kind: "part", id: "rodape", bg: "claro" }, patch: { layout: 2 } });
    expect(w.parts.rodape).toMatchObject({ layout: 2, bg: "claro", comps: [] });
  });
});

describe("F14 · componentes", () => {
  it("componente novo: 1.º estilo do manifest e valores por omissão (título H2)", () => {
    const op = buildAddComp(B, 1, "titulo", catalog, manifest, ids)!;
    expect(op.comp).toMatchObject({ type: "titulo", style: "seccao", col: "all", v: { level: "h2" } });
    const w = applyOp(work(), op);
    expect((w.blocks[0].comps as Comp[])[1].id).toBe(op.comp.id);
    expect(buildAddComp(B, 0, "inexistente", catalog, manifest, ids)).toBeNull();
  });

  it("copiar componente gera ids novos (no componente e em todos os _id de listas)", () => {
    const src = comp("c9", "lista", 1, { items: [{ _id: "a1", text: { pt: "x" } }, { _id: "a2", text: { pt: "y" } }] });
    const op = buildCopyComp(B, 0, src, catalog, manifest, ids)!;
    expect(op.comp.id).not.toBe("c9");
    const rows = (op.comp.v as { items: { _id: string; text: unknown }[] }).items;
    expect(rows.map((r) => r._id)).not.toContain("a1");
    expect(rows.map((r) => r._id)).not.toContain("a2");
    expect(new Set(rows.map((r) => r._id)).size).toBe(2);
    expect(rows[0].text).toEqual({ pt: "x" });
    // a fonte fica intacta
    expect((src.v as { items: { _id: string }[] }).items[0]._id).toBe("a1");
  });

  it("copiar para um bloco com menos colunas ajusta a coluna; duplicar vai logo a seguir", () => {
    let w = applyOp(work(), { type: "setHolder", holder: { kind: "block", id: "b2" }, patch: { layout: 2 } });
    w = applyOp(w, buildCopyComp({ kind: "block", id: "b2" }, 0, comp("x", "texto", 3), catalog, manifest, ids)!);
    expect(colsOf(w, "b2")).toEqual([2]);
    const dup = buildDuplicateComp(w, B, "c1", ids)!;
    expect(dup.index).toBe(2);
    const w2 = applyOp(w, dup);
    expect((w2.blocks[0].comps as Comp[]).map((c) => c.type)).toEqual(["titulo", "texto", "texto", "texto", "texto"]);
  });

  it("mover, mudar estilo/coluna e apagar passam pelo reducer", () => {
    let s = initState(work(), 1);
    s = reduce(s, { type: "op", op: { type: "moveComp", holder: B, from: "c3", to: "c0", position: "before" } });
    expect((s.work.blocks[0].comps as Comp[]).map((c) => c.id)).toEqual(["c3", "c0", "c1", "c2"]);
    s = reduce(s, { type: "op", op: { type: "patchComp", holder: B, compId: "c1", patch: { style: "grande", col: "all" } } });
    expect((s.work.blocks[0].comps as Comp[])[2]).toMatchObject({ style: "grande", col: "all" });
    s = reduce(s, { type: "op", op: { type: "removeComp", holder: B, compId: "c1" } });
    expect((s.work.blocks[0].comps as Comp[]).map((c) => c.id)).toEqual(["c3", "c0", "c2"]);
    expect(applyOp(s.work, { type: "removeComp", holder: B, compId: "nao-existe" })).toBe(s.work);
  });
});

describe("F14 · partes", () => {
  it("paleta do topo só com os permitidos (o manifest restringe o catálogo)", () => {
    expect(allowedTypes("topo", catalog, manifest)).toEqual(["menu"]);
    expect(allowedTypes("rodape", catalog, manifest)).toEqual(["texto", "menu"]);
    expect(allowedTypes(null, catalog, manifest)).toBeNull();
    expect(buildAddComp({ kind: "part", id: "topo" }, 0, "texto", catalog, manifest, ids)).toBeNull();
    expect(buildAddComp({ kind: "part", id: "topo" }, 0, "menu", catalog, manifest, ids)).not.toBeNull();
    // copiar também respeita a parte
    expect(buildCopyComp({ kind: "part", id: "topo" }, 0, comp("x", "texto", "all"), catalog, manifest, ids)).toBeNull();
  });

  it("adicionar ao topo cria a parte só com comps; o rodapé leva layout e bg", () => {
    const top = applyOp(work(), buildAddComp({ kind: "part", id: "topo" }, 0, "menu", catalog, manifest, ids)!);
    expect(Object.keys(top.parts.topo!)).toEqual(["comps"]);
    const foot = applyOp(work(), buildAddComp({ kind: "part", id: "rodape", bg: "claro" }, 0, "texto", catalog, manifest, ids)!);
    expect(foot.parts.rodape).toMatchObject({ layout: 1, bg: "claro" });
  });

  it("copiar componente: a lista inclui o topo, o rodapé e todos os blocos", () => {
    const w = applyOp(work(), buildAddComp({ kind: "part", id: "topo" }, 0, "menu", catalog, manifest, ids)!);
    const hs = compHolders(w);
    expect(hs.map((h) => h.name)).toEqual(["Topo", "Rodapé", "b1", "Solto"]);
    expect(hs[0].comps).toHaveLength(1);
  });
});

describe("F14 · apagar bloco da biblioteca", () => {
  it("em uso não se apaga; sem uso apaga", () => {
    const w = work();
    expect(applyOp(w, { type: "deleteBlock", id: "b1" })).toBe(w);
    const gone = applyOp(w, { type: "deleteBlock", id: "b2" });
    expect(gone.blocks.map((b) => b.id)).toEqual(["b1"]);
  });
});

describe("F14 · anterior/seguinte e resumo", () => {
  it("percorre os itens da página (blocos e especiais)", () => {
    const list = [blockItem("i1", "b1"), { id: "i2", kind: "special" as const, blockId: null, specialType: "faixa", specialData: {}, hidden: false }, blockItem("i3", "b2")];
    expect(neighbours(list, "i1")).toMatchObject({ index: 0, total: 3, prev: null, next: { id: "i2" } });
    expect(neighbours(list, "i2")).toMatchObject({ index: 1, prev: { id: "i1" }, next: { id: "i3" } });
    expect(neighbours(list, "i3")?.next).toBeNull();
    expect(neighbours(list, "zz")).toBeNull();
    expect(selFor(list[0])).toEqual({ kind: "block", id: "b1", ref: "i1" });
    expect(selFor(list[1])).toEqual({ kind: "item", id: "i2" });
  });

  it("resumo: o 1.º texto, na língua base", () => {
    const t = comp("c", "titulo", "all", { text: { pt: "Como *trabalhamos*", en: "How" } });
    expect(compSummary(t, catalog, "pt")).toBe("Como trabalhamos");
    expect(compSummary(comp("c", "lista", "all", { items: [{ _id: "a", text: { pt: "Primeiro" } }] }), catalog, "pt")).toBe("Primeiro");
    expect(compSummary(comp("c", "menu", "all"), catalog, "pt")).toBe("");
  });
});
