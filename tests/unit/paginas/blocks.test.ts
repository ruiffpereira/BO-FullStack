import { describe, expect, it } from "vitest";
import { applyOp, blocksIn, type WorkOp } from "../../../src/pages/paginas/state/ops";
import { initState, reduce } from "../../../src/pages/paginas/state/store";
import { blockUsage } from "../../../src/pages/paginas/state/listing";
import {
  buildAddSpecial,
  buildCopyBlock,
  buildDuplicateItem,
  buildNewBlock,
  buildSeparateItem,
  buildUseBlock,
  blockSummary,
  copyBlock,
  specialEntries,
  usableBlocks,
  type IdGen,
} from "../../../src/pages/paginas/state/blocks";
import type { Block, Catalog, Manifest, Work } from "../../../src/pages/paginas/state/types";
import { block, blockItem, clone, page, sampleWork } from "./fixtures";

let seq = 0;
const ids: IdGen = { entity: () => `e-${++seq}`, short: () => `s-${++seq}` };

const catalog: Catalog = {
  components: [
    { type: "titulo", label: "Título", fields: { text: { type: "text", i18n: true }, level: { type: "choice", default: "h2" } } },
    { type: "texto", label: "Texto", fields: { body: { type: "md", i18n: true } } },
    { type: "lista", label: "Lista", fields: { items: { type: "list", of: { text: { type: "text", i18n: true } } } } },
  ],
  starters: [
    { id: "branco", label: "Em branco", layout: 1, comps: [] },
    { id: "titulo-texto", label: "Título e texto", layout: 1, comps: [{ type: "titulo", col: "all" }, { type: "texto", col: "all" }] },
    { id: "texto-imagem", label: "Texto e imagem", layout: 2, comps: [{ type: "texto", col: 1 }, { type: "titulo", col: 2 }] },
  ],
};
const manifest: Manifest = {
  backgrounds: [{ id: "escuro", label: "Escuro" }, { id: "claro", label: "Claro" }],
  styles: { titulo: [{ id: "seccao", label: "Secção" }] },
  specials: { faixa: { label: "Faixa", desc: "Nomes", fields: { mode: { type: "choice", default: "lento" }, items: { type: "list", of: {} } } } },
};

/** Bloco rico: duas colunas, âncora e uma lista com `_id` dentro dos valores do componente. */
const rich = (): Block =>
  block("b-rich", {
    name: "Equipa",
    layout: 2,
    anchor: "#equipa",
    folderId: "f1",
    comps: [
      { id: "c1", type: "titulo", style: "seccao", col: "all", v: { text: { pt: "Olá", en: "Hi" } } },
      { id: "c2", type: "lista", style: "normal", col: 1, v: { items: [{ _id: "k1", text: { pt: "a", en: "a" } }, { _id: "k2", text: { pt: "b", en: "b" } }] } },
    ],
  });

/** home e obras; b1 partilhado pelas duas, b2 só na home, b-rich só na home. */
function lib(): Work {
  const w = sampleWork();
  return {
    ...w,
    blocks: [block("b1"), block("b2", { sortOrder: 1 }), { ...rich(), sortOrder: 0 }],
    items: {
      "p-home": [blockItem("i1", "b1"), blockItem("i2", "b2"), blockItem("i3", "b-rich")],
      "p-obras": [blockItem("i4", "b1")],
    },
  };
}

const run = (w: Work, op: WorkOp | null): Work => {
  expect(op).not.toBeNull();
  return applyOp(w, op!);
};
const itemsOf = (w: Work, pageId: string) => w.items[pageId].map((it) => it.id);
const allIds = (b: Block): string[] => {
  const found: string[] = [b.id];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if ((k === "id" || k === "_id") && typeof x === "string") found.push(x);
        else walk(x);
      }
    }
  };
  walk(b.comps);
  return found;
};

describe("duplicar", () => {
  it("cria um bloco novo logo a seguir, com ids novos em tudo e o nome '(cópia)'", () => {
    const w0 = lib();
    const w = run(w0, buildDuplicateItem(w0, "p-home", "i3", ids));
    expect(w.blocks).toHaveLength(w0.blocks.length + 1);
    const copy = w.blocks[w.blocks.length - 1];
    const src = w0.blocks.find((b) => b.id === "b-rich")!;
    expect(copy.name).toBe("Equipa (cópia)");
    expect(copy.layout).toBe(2);
    expect(copy.folderId).toBe("f1");
    expect(copy.anchor).toBeNull(); // a âncora é única por tenant
    // nada partilhado: nem o bloco, nem os componentes, nem os `_id` das listas
    const old = new Set(allIds(src));
    for (const id of allIds(copy)) expect(old.has(id)).toBe(false);
    expect(allIds(copy)).toHaveLength(allIds(src).length);
    // mas o conteúdo é igual
    expect(copy.comps.map((c) => (c as { type: string }).type)).toEqual(["titulo", "lista"]);
    expect((copy.comps[1] as { v: { items: { text: unknown }[] } }).v.items.map((i) => i.text)).toEqual([{ pt: "a", en: "a" }, { pt: "b", en: "b" }]);
    // o original ficou intacto
    expect(w.blocks.find((b) => b.id === "b-rich")).toEqual(src);
  });

  it("entra logo depois do item, na página, apontando para a cópia (não partilha)", () => {
    const w0 = lib();
    const w = run(w0, buildDuplicateItem(w0, "p-home", "i1", ids));
    const list = w.items["p-home"];
    expect(list.map((it) => it.id)).toHaveLength(4);
    expect(list[0].id).toBe("i1");
    expect(list[1].blockId).not.toBe("b1");
    expect(list[2].id).toBe("i2");
    expect(blockUsage(w).get("b1")).toBe(2); // o original continua nas mesmas páginas
  });

  it("um especial duplica-se com `_id` novos nos valores", () => {
    const w0 = lib();
    w0.items["p-home"].push({ id: "sp", kind: "special", blockId: null, specialType: "faixa", specialData: { items: [{ _id: "z1", name: { pt: "x" } }] }, hidden: false });
    const w = run(w0, buildDuplicateItem(w0, "p-home", "sp", ids));
    const copy = w.items["p-home"][4];
    expect(copy.kind).toBe("special");
    expect(copy.id).not.toBe("sp");
    expect((copy.specialData as { items: { _id: string }[] }).items[0]._id).not.toBe("z1");
    expect(w.blocks).toHaveLength(w0.blocks.length);
  });

  it("item inexistente: null", () => {
    expect(buildDuplicateItem(lib(), "p-home", "nope", ids)).toBeNull();
  });
});

describe("usar um que já existe (partilha)", () => {
  it("o item novo aponta para o MESMO bloco; a biblioteca não muda", () => {
    const w0 = lib();
    const w = run(w0, buildUseBlock(w0, "p-obras", 1, "b2", ids));
    expect(w.items["p-obras"].map((it) => it.blockId)).toEqual(["b1", "b2"]);
    expect(w.blocks).toEqual(w0.blocks);
    expect(blockUsage(w).get("b2")).toBe(2);
  });

  it("só oferece os blocos que ainda não estão na página, por nome", () => {
    expect(usableBlocks(lib(), "p-obras").map((b) => b.id)).toEqual(["b2", "b-rich"].sort((a, b) => lib().blocks.find((x) => x.id === a)!.name.localeCompare(lib().blocks.find((x) => x.id === b)!.name, "pt")));
    expect(usableBlocks(lib(), "p-home")).toEqual([]);
  });

  it("bloco ou página inexistentes: null", () => {
    expect(buildUseBlock(lib(), "p-obras", 0, "nope", ids)).toBeNull();
    expect(buildUseBlock(lib(), "nope", 0, "b1", ids)).toBeNull();
  });
});

describe("copiar um que já existe", () => {
  it("cria um bloco novo e independente (ids novos em tudo) e põe-no na página", () => {
    const w0 = lib();
    const w = run(w0, buildCopyBlock(w0, "p-obras", 0, "b-rich", ids));
    const item = w.items["p-obras"][0];
    const copy = w.blocks.find((b) => b.id === item.blockId)!;
    expect(copy.id).not.toBe("b-rich");
    expect(copy.name).toBe("Equipa (cópia)");
    const old = new Set(allIds(w0.blocks.find((b) => b.id === "b-rich")!));
    for (const id of allIds(copy)) expect(old.has(id)).toBe(false);
    expect(blockUsage(w).get("b-rich")).toBe(1); // o original não ganhou páginas
  });

  it("sem página (botão 'Novo' da biblioteca): só entra na biblioteca, no fim da pasta", () => {
    const w0 = lib();
    const w = run(w0, buildCopyBlock(w0, null, 0, "b-rich", ids));
    expect(w.items).toEqual(w0.items);
    const copy = w.blocks[w.blocks.length - 1];
    expect(copy.folderId).toBe("f1");
    expect(blocksIn(w, "f1").map((b) => b.id)).toEqual(["b-rich", copy.id]);
  });
});

describe("usar uma cópia só nesta página", () => {
  it("só nesta página troca o blockId; as outras ficam com o original", () => {
    const w0 = lib();
    const w = run(w0, buildSeparateItem(w0, "p-obras", "i4", ids));
    const mine = w.items["p-obras"][0];
    expect(mine.id).toBe("i4");
    expect(mine.blockId).not.toBe("b1");
    expect(w.items["p-home"][0].blockId).toBe("b1");
    const copy = w.blocks.find((b) => b.id === mine.blockId)!;
    expect(copy.name).toBe("b1 (cópia)");
    expect(blockUsage(w).get("b1")).toBe(1);
    expect(blockUsage(w).get(copy.id)).toBe(1);
  });

  it("ids novos em tudo", () => {
    const w0 = lib();
    w0.items["p-obras"].push(blockItem("i5", "b-rich"));
    const w = run(w0, buildSeparateItem(w0, "p-obras", "i5", ids));
    const copy = w.blocks.find((b) => b.id === w.items["p-obras"][1].blockId)!;
    const old = new Set(allIds(w0.blocks.find((b) => b.id === "b-rich")!));
    for (const id of allIds(copy)) expect(old.has(id)).toBe(false);
  });

  it("bloco que só está numa página: não há o que separar (null)", () => {
    expect(buildSeparateItem(lib(), "p-home", "i2", ids)).toBeNull();
  });
});

describe("retirar desta página", () => {
  it("tira o item mas o bloco continua na biblioteca", () => {
    const w0 = lib();
    const w = applyOp(w0, { type: "removeItem", pageId: "p-home", itemId: "i2" });
    expect(itemsOf(w, "p-home")).toEqual(["i1", "i3"]);
    expect(w.blocks.map((b) => b.id)).toContain("b2");
    expect(blockUsage(w).get("b2") ?? 0).toBe(0);
  });

  it("item inexistente: sem efeito (mesmo objecto)", () => {
    const w0 = lib();
    expect(applyOp(w0, { type: "removeItem", pageId: "p-home", itemId: "nope" })).toBe(w0);
  });
});

describe("esconder / mostrar nesta página", () => {
  it("mexe só em `hidden` do item desta página", () => {
    const w0 = lib();
    const w = applyOp(w0, { type: "hideItem", pageId: "p-obras", itemId: "i4", hidden: true });
    expect(w.items["p-obras"][0].hidden).toBe(true);
    expect(w.items["p-home"][0].hidden).toBe(false); // o mesmo bloco, na outra página
    expect(w.blocks).toEqual(w0.blocks);
    const back = applyOp(w, { type: "hideItem", pageId: "p-obras", itemId: "i4", hidden: false });
    expect(back.items["p-obras"][0].hidden).toBe(false);
  });

  it("já estava assim: sem efeito", () => {
    const w0 = lib();
    expect(applyOp(w0, { type: "hideItem", pageId: "p-obras", itemId: "i4", hidden: false })).toBe(w0);
  });
});

describe("inserir na posição certa", () => {
  const useAt = (w: Work, index: number) => run(w, buildUseBlock(w, "p-home", index, "b-extra", ids));
  const base = (): Work => ({ ...lib(), blocks: [...lib().blocks, block("b-extra", { sortOrder: 5 })] });

  it("＋ antes do primeiro, entre itens e no fim", () => {
    const at = (i: number) => useAt(base(), i).items["p-home"].map((it) => it.blockId);
    expect(at(0)).toEqual(["b-extra", "b1", "b2", "b-rich"]);
    expect(at(1)).toEqual(["b1", "b-extra", "b2", "b-rich"]);
    expect(at(2)).toEqual(["b1", "b2", "b-extra", "b-rich"]);
    expect(at(3)).toEqual(["b1", "b2", "b-rich", "b-extra"]);
  });

  it("índice fora dos limites encosta ao princípio/fim", () => {
    const w = base();
    expect(useAt(w, 99).items["p-home"].at(-1)!.blockId).toBe("b-extra");
    expect(useAt(w, -5).items["p-home"][0].blockId).toBe("b-extra");
  });

  it("bloco novo de um ponto de partida: entra na biblioteca e na posição pedida", () => {
    const w0 = lib();
    const starter = catalog.starters![1];
    const w = run(w0, buildNewBlock(w0, "p-home", 1, starter, catalog, manifest, ids));
    expect(w.items["p-home"]).toHaveLength(4);
    const created = w.blocks.find((b) => b.id === w.items["p-home"][1].blockId)!;
    expect(created.name).toBe("Título e texto");
    expect(created.bg).toBe("escuro"); // o 1.º fundo do manifest
    expect(created.layout).toBe(1);
    const [t, tx] = created.comps as { type: string; style: string; col: unknown; v: Record<string, unknown>; id: string }[];
    expect([t.type, tx.type]).toEqual(["titulo", "texto"]);
    expect(t.style).toBe("seccao"); // 1.º estilo do manifest; sem estilos → "normal"
    expect(tx.style).toBe("normal");
    expect(t.v).toEqual({ level: "h2" }); // valor por omissão do catálogo, nunca texto inventado
    expect(new Set([t.id, tx.id]).size).toBe(2);
  });

  it("duas colunas: a coluna do ponto de partida mantém-se; em branco chama-se 'Bloco novo'", () => {
    const w0 = lib();
    const two = run(w0, buildNewBlock(w0, "p-home", 0, catalog.starters![2], catalog, manifest, ids));
    const created = two.blocks.find((b) => b.id === two.items["p-home"][0].blockId)!;
    expect(created.layout).toBe(2);
    expect((created.comps as { col: unknown }[]).map((c) => c.col)).toEqual([1, 2]);
    const blank = run(w0, buildNewBlock(w0, null, 0, catalog.starters![0], catalog, manifest, ids));
    expect(blank.blocks.at(-1)!.name).toBe("Bloco novo");
    expect(blank.items).toEqual(w0.items); // sem página: só biblioteca
  });

  it("ids repetidos não duplicam nada", () => {
    const w0 = lib();
    const op = buildUseBlock(w0, "p-obras", 0, "b2", ids)!;
    const once = applyOp(w0, op);
    expect(applyOp(once, op)).toBe(once);
  });
});

describe("especiais", () => {
  it("só existem se o manifest os declara", () => {
    expect(specialEntries(manifest).map((s) => s.type)).toEqual(["faixa"]);
    expect(specialEntries({ ...manifest, specials: undefined })).toEqual([]);
    expect(specialEntries(null)).toEqual([]);
    expect(buildAddSpecial(lib(), { ...manifest, specials: {} }, "p-home", 0, "faixa", ids)).toBeNull();
    expect(buildAddSpecial(lib(), null, "p-home", 0, "faixa", ids)).toBeNull();
    expect(buildAddSpecial(lib(), manifest, "p-home", 0, "inventado", ids)).toBeNull();
  });

  it("nasce com os valores por omissão da spec, na posição pedida", () => {
    const w0 = lib();
    const w = run(w0, buildAddSpecial(w0, manifest, "p-home", 1, "faixa", ids));
    const it = w.items["p-home"][1];
    expect(it).toMatchObject({ kind: "special", specialType: "faixa", blockId: null, hidden: false, specialData: { mode: "lento" } });
    expect(w.blocks).toEqual(w0.blocks); // um especial não é um bloco
  });
});

describe("resumo e cópia", () => {
  it("resume os componentes pelo rótulo do catálogo", () => {
    expect(blockSummary(rich(), catalog)).toBe("Título · Lista");
    expect(blockSummary({ comps: [{ type: "texto" }, { type: "texto" }, { type: "x" }] }, catalog)).toBe("Texto ×2 · x");
    expect(blockSummary({ comps: [] }, catalog)).toBe("Sem componentes");
  });

  it("copyBlock não toca no original (cópia profunda)", () => {
    const src = rich();
    const before = clone(src);
    const copy = copyBlock(src, ids);
    ((copy.comps[1] as { v: { items: { text: { pt: string } }[] } }).v.items[0].text).pt = "mudou";
    expect(src).toEqual(before);
  });

  it("nome longo cabe nos 120 caracteres", () => {
    const copy = copyBlock(block("x", { name: "n".repeat(120) }), ids);
    expect(copy.name).toHaveLength(120);
    expect(copy.name.endsWith(" (cópia)")).toBe(true);
  });
});

describe("mover itens", () => {
  it("antes / depois de outro", () => {
    const w0 = lib();
    expect(itemsOf(applyOp(w0, { type: "moveItem", pageId: "p-home", from: "i3", to: "i1", position: "before" }), "p-home")).toEqual(["i3", "i1", "i2"]);
    expect(itemsOf(applyOp(w0, { type: "moveItem", pageId: "p-home", from: "i1", to: "i3", position: "after" }), "p-home")).toEqual(["i2", "i3", "i1"]);
    expect(applyOp(w0, { type: "moveItem", pageId: "p-home", from: "i1", to: "i1", position: "after" })).toBe(w0);
    expect(applyOp(w0, { type: "moveItem", pageId: "p-home", from: "i1", to: "nope", position: "after" })).toBe(w0);
  });
});

describe("desfazer", () => {
  const w0 = (): Work => ({ ...lib(), pages: [page("p-home", { isHome: true, slug: "" }), page("p-obras", { sortOrder: 1 })] });
  const cases: [string, (w: Work) => WorkOp | null][] = [
    ["bloco novo na página", (w) => buildNewBlock(w, "p-home", 0, catalog.starters![1], catalog, manifest, ids)],
    ["bloco novo só na biblioteca", (w) => buildNewBlock(w, null, 0, catalog.starters![1], catalog, manifest, ids)],
    ["usar", (w) => buildUseBlock(w, "p-obras", 0, "b2", ids)],
    ["copiar", (w) => buildCopyBlock(w, "p-obras", 0, "b-rich", ids)],
    ["especial", (w) => buildAddSpecial(w, manifest, "p-home", 0, "faixa", ids)],
    ["duplicar", (w) => buildDuplicateItem(w, "p-home", "i3", ids)],
    ["cópia só nesta página", (w) => buildSeparateItem(w, "p-obras", "i4", ids)],
    ["retirar", () => ({ type: "removeItem", pageId: "p-home", itemId: "i2" })],
    ["esconder", () => ({ type: "hideItem", pageId: "p-home", itemId: "i2", hidden: true })],
    ["mover item", () => ({ type: "moveItem", pageId: "p-home", from: "i3", to: "i1", position: "before" })],
  ];

  for (const [name, make] of cases) {
    it(`${name}: uma entrada no desfazer; desfazer repõe e refazer volta`, () => {
      const start = w0();
      let s = initState(start, 1);
      s = reduce(s, { type: "op", op: make(start)! });
      expect(s.work).not.toEqual(start);
      expect(s.history.stack).toHaveLength(2);
      const after = s.work;
      s = reduce(s, { type: "undo" });
      expect(s.work).toEqual(start);
      s = reduce(s, { type: "redo" });
      expect(s.work).toEqual(after);
    });
  }
});
