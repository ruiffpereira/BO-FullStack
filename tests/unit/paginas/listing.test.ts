import { afterEach, describe, expect, it, vi } from "vitest";
import {
  blockUsage,
  defaultPrefs,
  descendantMissing,
  libraryRows,
  missingIndex,
  readPrefs,
  sanitizePrefs,
  writePrefs,
} from "../../../src/pages/paginas/state/listing";
import type { MissingItem } from "../../../src/pages/paginas/state/missing";
import { block, blockItem, page, sampleWork } from "./fixtures";
import type { Work } from "../../../src/pages/paginas/state/types";

function lib(): Work {
  return {
    ...sampleWork(),
    pages: [page("p-home", { isHome: true, slug: "" }), page("p-a", { sortOrder: 1 }), page("p-a1", { parentId: "p-a" })],
    blocks: [block("b1"), block("b2", { sortOrder: 1 }), block("b3", { folderId: "f1" })],
    folders: [{ id: "f1", name: "Heróis", sortOrder: 0 }, { id: "f2", name: "Vazia", sortOrder: 1 }],
    items: { "p-home": [blockItem("i1", "b1"), blockItem("i2", "b1")], "p-a": [blockItem("i3", "b1")], "p-a1": [] },
  };
}

describe("linhas da biblioteca", () => {
  it("pastas com os seus blocos, 'Sem pasta' e os soltos", () => {
    const rows = libraryRows(lib(), new Set(), "");
    expect(rows.map((r) => `${r.kind}:${r.id}`)).toEqual([
      "folder:f1", "block:b3", "folder:f2", "empty:vazia:f2", "root:__sem-pasta__", "block:b1", "block:b2",
    ]);
  });

  it("pasta fechada esconde os blocos; sem pastas não há 'Sem pasta'", () => {
    expect(libraryRows(lib(), new Set(["f1", "f2"]), "").map((r) => r.id)).toEqual(["f1", "f2", "__sem-pasta__", "b1", "b2"]);
    const w = { ...lib(), folders: [], blocks: lib().blocks.map((b) => ({ ...b, folderId: null })) };
    expect(libraryRows(w, new Set(), "").map((r) => r.kind)).toEqual(["block", "block", "block"]);
  });

  it("pesquisa: só blocos, por nome, sem pastas", () => {
    const w = { ...lib(), blocks: [block("b1", { name: "Herói grande" }), block("b2", { name: "Rodapé" }), block("b3", { name: "HERÓI pequeno", folderId: "f1" })] };
    expect(libraryRows(w, new Set(), "  herói ").map((r) => r.id)).toEqual(["b1", "b3"]);
    expect(libraryRows(w, new Set(), "zzz")).toEqual([]);
  });

  it("uso: uma página conta uma vez, mesmo com o bloco repetido", () => {
    const u = blockUsage(lib());
    expect(u.get("b1")).toBe(2);
    expect(u.get("b2")).toBeUndefined();
  });
});

describe("traduções em falta por entidade", () => {
  const miss = (entity: MissingItem["entity"], id: string): MissingItem => ({ entity, id, path: "x", locale: "en" });

  it("páginas (também por um item especial), blocos e partes", () => {
    const w = lib();
    w.items["p-a1"] = [{ ...blockItem("sp1", "b1"), kind: "special" }];
    const idx = missingIndex(w, [miss("page", "p-a"), miss("item", "sp1"), miss("block", "b2"), miss("part", "topo")]);
    expect([...idx.pages].sort()).toEqual(["p-a", "p-a1"]);
    expect([...idx.blocks]).toEqual(["b2"]);
    expect([...idx.parts]).toEqual(["topo"]);
  });

  it("a mãe fechada herda a bolinha da filha em falta", () => {
    const w = lib();
    const idx = missingIndex(w, [miss("page", "p-a1")]);
    expect(descendantMissing(w.pages, "p-a", idx)).toBe(true);
    expect(descendantMissing(w.pages, "p-home", idx)).toBe(false);
    expect(descendantMissing(w.pages, "p-a1", idx)).toBe(false);
  });
});

describe("preferências no localStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("guarda e lê a ordem e os fechados", () => {
    writePrefs({ order: ["blocks", "pages", "common"], closed: ["common"] });
    expect(readPrefs()).toEqual({ order: ["blocks", "pages", "common"], closed: ["common"] });
  });

  it("lixo no disco cai nos defaults", () => {
    expect(sanitizePrefs(null)).toEqual(defaultPrefs());
    expect(sanitizePrefs({ order: ["pages", "pages", "blocks"] }).order).toEqual(["pages", "blocks", "common"]);
    expect(sanitizePrefs({ order: ["a", "b", "c"], closed: ["pages", "x"] })).toEqual({ order: ["pages", "blocks", "common"], closed: ["pages"] });
    window.localStorage.setItem("bo.paginas.lista.v1", "{não é json");
    expect(readPrefs()).toEqual(defaultPrefs());
  });

  it("sem localStorage (a lançar) nunca rebenta", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("cheio"); });
    expect(readPrefs()).toEqual(defaultPrefs());
    expect(() => writePrefs(defaultPrefs())).not.toThrow();
  });

  it("desligado (sessão de suporte) não lê nem escreve", () => {
    writePrefs({ order: ["blocks", "pages", "common"], closed: [] }, false);
    expect(window.localStorage.getItem("bo.paginas.lista.v1")).toBeNull();
    window.localStorage.setItem("bo.paginas.lista.v1", JSON.stringify({ order: ["blocks", "pages", "common"], closed: [] }));
    expect(readPrefs(false)).toEqual(defaultPrefs());
  });
});
