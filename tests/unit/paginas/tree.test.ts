import { describe, expect, it } from "vitest";
import { MAX_DEPTH, canAddChild, canMovePage, childrenOf, depthOf, heightOf, movePage, pagePath } from "../../../src/pages/paginas/state/tree";
import type { Page } from "../../../src/pages/paginas/state/types";
import { page } from "./fixtures";

/**
 * home
 * a (0) ── a1 (0) ── a1x (0)
 *       └─ a2 (1)
 * b (1)
 * c (2)
 */
const tree = (): Page[] => [
  page("home", { isHome: true, slug: "" }),
  page("a", { sortOrder: 0 }),
  page("a1", { parentId: "a", sortOrder: 0 }),
  page("a1x", { parentId: "a1", sortOrder: 0 }),
  page("a2", { parentId: "a", sortOrder: 1 }),
  page("b", { sortOrder: 1 }),
  page("c", { sortOrder: 2 }),
];

const order = (pages: Page[], parent: string | null) => childrenOf(pages, parent).map((p) => p.id);
const byId = (pages: Page[], id: string) => pages.find((p) => p.id === id)!;

describe("árvore de páginas · medidas", () => {
  it("nível, altura e caminho", () => {
    const t = tree();
    expect(depthOf(t, "a")).toBe(1);
    expect(depthOf(t, "a1x")).toBe(3);
    expect(heightOf(t, "a")).toBe(3);
    expect(heightOf(t, "b")).toBe(1);
    expect(pagePath(t, "home")).toBe("/");
    expect(pagePath(t, "a1x")).toBe("/a/a1/a1x");
  });

  it("a home não recebe filhas; o resto cabe até ao limite", () => {
    const t = tree();
    expect(canAddChild(t, "home")).toBe(false);
    expect(canAddChild(t, "b")).toBe(true);
    expect(canAddChild(t, "a1x")).toBe(true); // nível 3 → a filha é o nível 4
    expect(canAddChild(t, "a1x", 3)).toBe(false);
    expect(canAddChild(t, null)).toBe(true);
  });
});

describe("árvore de páginas · mover", () => {
  it("antes: fica na posição e renumera os irmãos", () => {
    const t = movePage(tree(), "c", "a", "before");
    expect(order(t, null)).toEqual(["home", "c", "a", "b"]);
    expect(byId(t, "c").sortOrder).toBe(1);
    expect(byId(t, "a").sortOrder).toBe(2);
    expect(byId(t, "b").sortOrder).toBe(3);
  });

  it("depois: de um irmão e entre filhas de outra mãe", () => {
    expect(order(movePage(tree(), "a", "c", "after"), null)).toEqual(["home", "b", "c", "a"]);
    const t = movePage(tree(), "b", "a1", "after");
    expect(order(t, "a")).toEqual(["a1", "b", "a2"]);
    expect(byId(t, "b").parentId).toBe("a");
    expect(order(t, null)).toEqual(["home", "a", "c"]); // o grupo de origem fica sem buracos
    expect(byId(t, "c").sortOrder).toBe(2);
  });

  it("dentro: vai para o fim das filhas", () => {
    const t = movePage(tree(), "c", "a", "inside");
    expect(order(t, "a")).toEqual(["a1", "a2", "c"]);
    expect(byId(t, "c").parentId).toBe("a");
  });

  it("depois da home: passa a ser a primeira do primeiro nível", () => {
    expect(order(movePage(tree(), "c", "home", "after"), null)).toEqual(["home", "c", "a", "b"]);
  });

  it("move a subárvore inteira e não altera as outras páginas", () => {
    const before = tree();
    const t = movePage(before, "a", "b", "inside");
    expect(byId(t, "a1x").parentId).toBe("a1");
    expect(depthOf(t, "a1x")).toBe(4);
    expect(byId(t, "home")).toBe(byId(before, "home")); // a mesma referência: não entra no changeset
  });

  it("sem efeito devolve o mesmo array (o reducer não regista)", () => {
    const t = tree();
    expect(movePage(t, "b", "a", "after")).toBe(t); // já está lá
    expect(movePage(t, "b", "b", "after")).toBe(t);
    expect(movePage(t, "nope", "b", "after")).toBe(t);
  });
});

describe("árvore de páginas · regras do §6.3", () => {
  it("recusa ciclos: dentro de si ou de uma descendente", () => {
    const t = tree();
    expect(canMovePage(t, "a", "a", "inside")).toBe(false);
    expect(canMovePage(t, "a", "a1", "inside")).toBe(false);
    expect(canMovePage(t, "a", "a1x", "inside")).toBe(false);
    expect(canMovePage(t, "a", "a1x", "after")).toBe(false); // a nova mãe seria a1, dentro de a
    expect(movePage(t, "a", "a1x", "inside")).toBe(t);
    expect(canMovePage(t, "a1", "a2", "after")).toBe(true); // irmãos continuam livres
  });

  it("a home fica onde está e nada entra nem fica antes dela", () => {
    const t = tree();
    expect(canMovePage(t, "home", "b", "after")).toBe(false);
    expect(canMovePage(t, "home", "b", "inside")).toBe(false);
    expect(canMovePage(t, "b", "home", "inside")).toBe(false);
    expect(canMovePage(t, "b", "home", "before")).toBe(false);
    expect(canMovePage(t, "b", "home", "after")).toBe(true);
    expect(movePage(t, "b", "home", "inside")).toBe(t);
  });

  it("recusa passar da profundidade máxima (4), contando a subárvore que vai atrás", () => {
    const t = tree(); // a tem 3 níveis
    expect(MAX_DEPTH).toBe(4);
    expect(canMovePage(t, "a", "b", "inside")).toBe(true); // b(1) + 3 = 4
    const deeper = [...t, page("d", { parentId: "c", sortOrder: 0 }), page("e", { parentId: "d", sortOrder: 0 })]; // c > d > e
    expect(canMovePage(deeper, "a", "e", "inside")).toBe(false); // e(3) + 3 = 6
    expect(canMovePage(deeper, "b", "e", "inside")).toBe(true); // 3 + 1 = 4
    expect(canMovePage(deeper, "b", "e", "inside", 3)).toBe(false);
    expect(canMovePage(deeper, "a", "d", "inside")).toBe(false); // d(2) + 3 = 5
  });
});
