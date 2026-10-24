import { describe, expect, it } from "vitest";
import { FEATURES } from "../../src/lib/features";
import { SUBMENU } from "../../src/lib/navigation";
import { fullAccess, isFeatureHiddenNode, serializeGrants, visibleTree, type TreeNode } from "../../src/lib/teamTree";

// FEATURES.campaigns = false (dono 2026-10-24): "as campanhas quero que escondas no backoffice".
const node = (key: string, label: string, over: Partial<TreeNode> = {}): TreeNode => ({
  key,
  label,
  levels: ["view", "edit"],
  action: false,
  storable: true,
  available: true,
  children: [],
  ...over,
});

const TREE: TreeNode[] = [
  node("correio", "Correio", {
    levels: [],
    storable: false,
    children: [
      node("correio.caixa", "Caixa"),
      node("correio.campanhas", "Campanhas", { children: [node("correio.campanhas.enviar", "Enviar", { action: true, levels: ["edit"] })] }),
      node("correio.contactos", "Contactos"),
    ],
  }),
];

describe("Campanhas escondidas (FEATURES.campaigns = false)", () => {
  it("a flag está desligada", () => {
    expect(FEATURES.campaigns).toBe(false);
  });

  it("o submenu do Correio não tem a entrada «Campanhas»; Contactos fica", () => {
    const ids = SUBMENU["/correio"].map((s) => s.id);
    expect(ids).not.toContain("campanhas");
    expect(ids).toContain("contactos");
  });

  it("a árvore da Equipa e do convite não mostra correio.campanhas nem o seu filho", () => {
    const keys: string[] = [];
    const walk = (ns: TreeNode[]) => ns.forEach((n) => (keys.push(n.key), walk(n.children)));
    walk(visibleTree(TREE));
    expect(keys).toEqual(["correio", "correio.caixa", "correio.contactos"]);
    expect(isFeatureHiddenNode("correio.campanhas.enviar")).toBe(true);
    expect(isFeatureHiddenNode("correio.campanhasX")).toBe(false);
  });

  it("«Acesso total» do convite não dá campanhas, mas as permissões já guardadas não se perdem ao gravar", () => {
    expect(Object.keys(fullAccess(TREE))).toEqual(["correio.caixa", "correio.contactos"]);
    const saved = { "correio.caixa": "edit", "correio.campanhas": "edit", "correio.campanhas.enviar": "edit" } as const;
    expect(serializeGrants(TREE, { ...saved }).map((g) => g.key)).toEqual(["correio.caixa", "correio.campanhas", "correio.campanhas.enviar"]);
  });
});
