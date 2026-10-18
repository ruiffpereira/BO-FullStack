import { describe, it, expect } from "vitest";
import {
  canFromGrants,
  cascadeWarning,
  giveLevelOf,
  hasLimitedNodes,
  levelLabel,
  checkState,
  fullAccess,
  grantsToMap,
  indexTree,
  serializeGrants,
  setNodeLevel,
  toggleNode,
  visibleTree,
  type TreeNode,
} from "../../src/lib/teamTree";

const VE = ["view", "edit"] as const;
const node = (
  key: string,
  over: Partial<TreeNode> & { children?: TreeNode[] } = {},
): TreeNode => ({
  key,
  label: key,
  levels: [...VE],
  action: false,
  storable: true,
  available: true,
  children: [],
  ...over,
});
const group = (key: string, children: TreeNode[], over: Partial<TreeNode> = {}) =>
  node(key, { levels: [], storable: false, children, ...over });
const action = (key: string) => node(key, { levels: ["edit"], action: true });

const TREE: TreeNode[] = [
  group("agenda", [
    node("agenda.marcacoes", { children: [node("agenda.marcacoes.valores")] }),
    node("agenda.servicos"),
  ]),
  group("clientes", [
    node("clientes.lista", { children: [action("clientes.lista.exportar"), action("clientes.lista.apagar")] }),
    node("clientes.leads"),
  ]),
  group("loja", [node("loja.produtos", { available: false })]),
  node("estatisticas", { levels: ["view"] }),
];

describe("canFromGrants — can() com folhas", () => {
  const g = [
    { key: "agenda.marcacoes", level: "edit" as const },
    { key: "agenda.servicos", level: "view" as const },
    { key: "clientes.lista", level: "view" as const },
    { key: "clientes.lista.exportar", level: "edit" as const },
  ];
  it("folha exacta decide pelo seu nível", () => {
    expect(canFromGrants(g, "agenda.marcacoes", "edit")).toBe(true);
    expect(canFromGrants(g, "agenda.servicos", "view")).toBe(true);
    expect(canFromGrants(g, "agenda.servicos", "edit")).toBe(false);
    expect(canFromGrants(g, "agenda.config", "view")).toBe(false);
  });
  it("agrupador/topo = alguma folha debaixo ao nível pedido", () => {
    expect(canFromGrants(g, "agenda", "view")).toBe(true);
    expect(canFromGrants(g, "agenda", "edit")).toBe(true);
    expect(canFromGrants(g, "clientes", "view")).toBe(true);
    expect(canFromGrants(g, "loja", "view")).toBe(false);
  });
  it("uma acção em edit não eleva o nível da folha-pai", () => {
    expect(canFromGrants(g, "clientes.lista", "edit")).toBe(false);
    expect(canFromGrants(g, "clientes.lista.exportar", "edit")).toBe(true);
    expect(canFromGrants(g, "clientes.lista.apagar", "edit")).toBe(false);
  });
  it("não confunde prefixos de texto (agenda vs agendamento)", () => {
    expect(canFromGrants([{ key: "agendamento.x", level: "edit" }], "agenda", "view")).toBe(false);
  });
  it("sem grants → falso", () => {
    expect(canFromGrants([], "agenda", "view")).toBe(false);
  });
});

describe("árvore — marcar", () => {
  it("marcar um pai marca os filhos ao nível máximo", () => {
    const g = toggleNode(TREE, "agenda.marcacoes", {});
    expect(g).toEqual({ "agenda.marcacoes": "edit", "agenda.marcacoes.valores": "edit" });
  });
  it("marcar o agrupador marca tudo o que existe debaixo (só disponíveis)", () => {
    const g = toggleNode(TREE, "agenda", {});
    expect(Object.keys(g).sort()).toEqual(["agenda.marcacoes", "agenda.marcacoes.valores", "agenda.servicos"]);
    expect(checkState(TREE[0], g)).toBe("on");
  });
  it("nó indisponível nunca é marcado", () => {
    expect(toggleNode(TREE, "loja", {})).toEqual({});
    expect(toggleNode(TREE, "loja.produtos", {})).toEqual({});
    expect(fullAccess(TREE)["loja.produtos"]).toBeUndefined();
  });
  it("desmarcar um filho deixa o pai parcial", () => {
    let g = toggleNode(TREE, "agenda.marcacoes", {});
    g = toggleNode(TREE, "agenda.marcacoes.valores", g);
    expect(g["agenda.marcacoes.valores"]).toBeUndefined();
    expect(checkState(TREE[0].children[0], g)).toBe("partial");
    expect(checkState(TREE[0], g)).toBe("partial");
  });
  it("desmarcar o pai (tudo marcado) desmarca os filhos", () => {
    let g = toggleNode(TREE, "agenda.marcacoes", {});
    g = toggleNode(TREE, "agenda.marcacoes", g);
    expect(g).toEqual({});
  });
  it("pai parcial: clicar completa o ramo", () => {
    let g = toggleNode(TREE, "agenda.marcacoes", {});
    g = toggleNode(TREE, "agenda.marcacoes.valores", g);
    g = toggleNode(TREE, "agenda.marcacoes", g);
    expect(g).toEqual({ "agenda.marcacoes": "edit", "agenda.marcacoes.valores": "edit" });
  });
  it("marcar um filho sozinho acrescenta o pai (sem ele a API recusa)", () => {
    const g = toggleNode(TREE, "agenda.marcacoes.valores", {});
    expect(g).toEqual({ "agenda.marcacoes.valores": "edit", "agenda.marcacoes": "edit" });
    const a = toggleNode(TREE, "clientes.lista.exportar", {});
    expect(a).toEqual({ "clientes.lista.exportar": "edit", "clientes.lista": "view" });
  });
});

describe("árvore — níveis", () => {
  it("um filho nunca fica acima do pai: baixar o pai baixa os filhos", () => {
    let g = toggleNode(TREE, "agenda.marcacoes", {});
    g = setNodeLevel(TREE, "agenda.marcacoes", "view", g);
    expect(g).toEqual({ "agenda.marcacoes": "view", "agenda.marcacoes.valores": "view" });
  });
  it("com o pai em Ver, o filho não passa a Editar (clamp)", () => {
    let g = toggleNode(TREE, "agenda.marcacoes", {});
    g = setNodeLevel(TREE, "agenda.marcacoes", "view", g);
    g = setNodeLevel(TREE, "agenda.marcacoes.valores", "edit", g);
    expect(g["agenda.marcacoes.valores"]).toBe("view");
  });
  it("marcar o pai já em Ver marca os filhos em Ver", () => {
    let g = setNodeLevel(TREE, "agenda.marcacoes", "view", {});
    g = toggleNode(TREE, "agenda.marcacoes", g); // parcial → completa o ramo, ao nível do pai
    expect(g["agenda.marcacoes.valores"]).toBe("view");
  });
  it("acção: só Editar, sobrevive ao pai em Ver", () => {
    let g = toggleNode(TREE, "clientes.lista", {});
    expect(g["clientes.lista.exportar"]).toBe("edit");
    g = setNodeLevel(TREE, "clientes.lista", "view", g);
    expect(g["clientes.lista"]).toBe("view");
    expect(g["clientes.lista.exportar"]).toBe("edit");
  });
  it("nível que o nó não permite é ignorado", () => {
    const g = setNodeLevel(TREE, "estatisticas", "edit", {});
    expect(g).toEqual({});
    expect(toggleNode(TREE, "estatisticas", {})).toEqual({ estatisticas: "view" });
  });
});

describe("acesso total e serialização", () => {
  it("acesso total = todos os nós disponíveis ao nível máximo", () => {
    expect(fullAccess(TREE)).toEqual({
      "agenda.marcacoes": "edit",
      "agenda.marcacoes.valores": "edit",
      "agenda.servicos": "edit",
      "clientes.lista": "edit",
      "clientes.lista.exportar": "edit",
      "clientes.lista.apagar": "edit",
      "clientes.leads": "edit",
      estatisticas: "view",
    });
  });
  it("serializa só nós storable, pela ordem da árvore", () => {
    const out = serializeGrants(TREE, { ...fullAccess(TREE), agenda: "edit", "loja.produtos": "edit" });
    expect(out.map((e) => e.key)).toEqual([
      "agenda.marcacoes",
      "agenda.marcacoes.valores",
      "agenda.servicos",
      "clientes.lista",
      "clientes.lista.exportar",
      "clientes.lista.apagar",
      "clientes.leads",
      "estatisticas",
    ]);
  });
  it("higieniza: descarta órfãos e baixa filho acima do pai", () => {
    const out = serializeGrants(TREE, {
      "agenda.marcacoes.valores": "edit", // pai ausente → órfão
      "clientes.lista": "view",
      "clientes.lista.exportar": "edit", // acção mantém-se
      "agenda.servicos": "edit",
    });
    expect(out).toEqual([
      { key: "agenda.servicos", level: "edit" },
      { key: "clientes.lista", level: "view" },
      { key: "clientes.lista.exportar", level: "edit" },
    ]);
    const lowered = serializeGrants(TREE, { "agenda.marcacoes": "view", "agenda.marcacoes.valores": "edit" });
    expect(lowered).toEqual([
      { key: "agenda.marcacoes", level: "view" },
      { key: "agenda.marcacoes.valores", level: "view" },
    ]);
  });
  it("grantsToMap ignora agrupadores, desconhecidos e níveis proibidos", () => {
    const m = grantsToMap(TREE, [
      { key: "agenda", level: "edit" },
      { key: "nao.existe", level: "view" },
      { key: "estatisticas", level: "edit" },
      { key: "agenda.servicos", level: "view" },
    ]);
    expect(m).toEqual({ "agenda.servicos": "view" });
  });
  it("ida e volta: serializar o que veio da API devolve o mesmo", () => {
    const list = serializeGrants(TREE, fullAccess(TREE));
    expect(serializeGrants(TREE, grantsToMap(TREE, list))).toEqual(list);
  });
  it("indexTree resolve o pai guardável mais próximo", () => {
    const idx = indexTree(TREE);
    expect(idx.get("agenda.marcacoes.valores")?.storableParent).toBe("agenda.marcacoes");
    expect(idx.get("agenda.marcacoes")?.storableParent).toBeNull();
  });
});

describe("visibleTree — o que o plano não inclui não aparece", () => {
  it("tira os nós indisponíveis e os agrupadores que ficam vazios; o resto mantém-se", () => {
    const keys = (t: TreeNode[]): string[] => t.flatMap((n) => [n.key, ...keys(n.children ?? [])]);
    const v = visibleTree(TREE);
    expect(keys(v)).not.toContain("loja");
    expect(keys(v)).not.toContain("loja.produtos");
    expect(keys(v)).toContain("agenda.marcacoes.valores");
    expect(keys(v)).toContain("estatisticas");
    // Um topo guardável indisponível também sai, com os filhos.
    expect(visibleTree([node("x", { available: false, children: [node("x.y")] })])).toEqual([]);
  });
});

describe("fase 3 — Equipa na árvore", () => {
  const T: TreeNode[] = [
    group("agenda", [node("agenda.servicos")]),
    node("equipa", { excludeFromFullAccess: true, levelLabels: { edit: "Gerir" } }),
  ];

  it("'Acesso total' exclui os nós excludeFromFullAccess (equipa)", () => {
    const g = fullAccess(T);
    expect(g["agenda.servicos"]).toBe("edit");
    expect(g.equipa).toBeUndefined();
    expect(serializeGrants(T, g).map((e) => e.key)).not.toContain("equipa");
  });

  it("levelLabel usa levelLabels da API e cai para Ver/Editar", () => {
    expect(levelLabel(T[1], "edit")).toBe("Gerir");
    expect(levelLabel(T[1], "view")).toBe("Ver");
    expect(levelLabel(T[0], "edit")).toBe("Editar");
  });

  it("maxLevel 'view': Gerir não se dá (setNodeLevel ignora) e marcar fica em Ver", () => {
    const M: TreeNode[] = [node("equipa", { maxLevel: "view" }), node("agenda", { maxLevel: "edit" })];
    expect(giveLevelOf(M[0])).toBe("view");
    expect(setNodeLevel(M, "equipa", "edit", {})).toEqual({});
    expect(toggleNode(M, "equipa", {})).toEqual({ equipa: "view" });
    expect(setNodeLevel(M, "agenda", "edit", {})).toEqual({ agenda: "edit" });
  });

  it("maxLevel null: o nó não se pode dar (marcar não faz nada, não entra no acesso total nem na serialização)", () => {
    const M: TreeNode[] = [node("equipa", { maxLevel: null }), node("agenda", { maxLevel: "edit" })];
    expect(giveLevelOf(M[0])).toBeNull();
    expect(toggleNode(M, "equipa", {})).toEqual({});
    expect(checkState(M[0], {})).toBe("off");
    expect(fullAccess(M)).toEqual({ agenda: "edit" });
    expect(serializeGrants(M, { equipa: "view", agenda: "view" })).toEqual([{ key: "agenda", level: "view" }]);
  });
});

describe("cascadeWarning", () => {
  it("nada afectado → sem aviso", () => {
    expect(cascadeWarning(0)).toBeNull();
    expect(cascadeWarning(undefined)).toBeNull();
  });
  it("singular e plural", () => {
    expect(cascadeWarning(1)).toBe("Também sai a 1 utilizador criado por este membro.");
    expect(cascadeWarning(3)).toBe("Também sai a 3 utilizadores criados por este membro.");
  });
});

describe("hasLimitedNodes", () => {
  it("só há nota quando quem edita não pode dar algum nó (ou só o nível 'ver')", () => {
    expect(hasLimitedNodes([node("a", { maxLevel: "edit" }), node("b", { maxLevel: "edit" })])).toBe(false);
    expect(hasLimitedNodes([node("a", { maxLevel: "view" })])).toBe(true);
    expect(hasLimitedNodes([node("a", { maxLevel: null })])).toBe(true);
    expect(hasLimitedNodes([group("g", [node("a", { maxLevel: "edit" }), node("b", { maxLevel: null })])])).toBe(true);
    expect(hasLimitedNodes([node("a", { maxLevel: "view", levels: ["view"] })])).toBe(false);
  });
});
