import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PermissionTree } from "../../src/components/PermissionTree";
import {
  hasLimitedNodes,
  normalizeScopes,
  scopeOf,
  scopesToMap,
  serializeGrants,
  setNodeScope,
  toggleNode,
  type GrantMap,
  type ScopeMap,
  type TreeNode,
} from "../../src/lib/teamTree";

const VE = ["view", "edit"] as const;
const node = (key: string, over: Partial<TreeNode> = {}): TreeNode => ({
  key,
  label: key,
  levels: [...VE],
  action: false,
  storable: true,
  available: true,
  children: [],
  ...over,
});

/** Árvore do Profissionais: agenda.marcacoes e financeiro.negocio têm âmbito; `maxScope` vem do actor. */
const tree = (maxScope: "meus" | null): TreeNode[] => [
  node("agenda", {
    label: "Agenda",
    levels: [],
    storable: false,
    children: [
      node("agenda.marcacoes", { label: "Calendário e marcações", scoped: true, maxScope }),
      node("agenda.servicos", { label: "Serviços" }),
      node("agenda.profissionais", {
        label: "Profissionais",
        children: [node("agenda.profissionais.precos", { label: "Preços por profissional", levels: ["edit"], action: true })],
      }),
    ],
  }),
  node("financeiro", {
    label: "Financeiro",
    levels: [],
    storable: false,
    children: [node("financeiro.negocio", { label: "O Negócio", levels: ["view"], scoped: true, maxScope })],
  }),
];

describe("âmbito [Todos | Só os meus] — lógica pura", () => {
  it("scopeOf: forçado a «meus» quando quem edita não pode dar «Todos» (maxScope)", () => {
    expect(scopeOf({ maxScope: null }, {}, "k")).toBe("todos");
    expect(scopeOf({ maxScope: null }, { k: "meus" }, "k")).toBe("meus");
    expect(scopeOf({ maxScope: "meus" }, {}, "k")).toBe("meus");
  });

  it("setNodeScope: «Todos» recusado onde maxScope = meus; nós sem âmbito ignorados", () => {
    const t = tree("meus");
    expect(setNodeScope(t, "agenda.marcacoes", "todos", { "agenda.marcacoes": "meus" })).toEqual({ "agenda.marcacoes": "meus" });
    const free = tree(null);
    expect(setNodeScope(free, "agenda.marcacoes", "meus", {})).toEqual({ "agenda.marcacoes": "meus" });
    expect(setNodeScope(free, "agenda.marcacoes", "todos", { "agenda.marcacoes": "meus" })).toEqual({});
    expect(setNodeScope(free, "agenda.servicos", "meus", {})).toEqual({});
  });

  it("normalizeScopes: só nós marcados têm âmbito; maxScope força «meus» ao marcar", () => {
    const t = tree("meus");
    const grants: GrantMap = { "agenda.marcacoes": "edit", "agenda.servicos": "view" };
    expect(normalizeScopes(t, grants, {})).toEqual({ "agenda.marcacoes": "meus" });
    // Desmarcado → o âmbito sai.
    expect(normalizeScopes(tree(null), { "agenda.servicos": "view" }, { "agenda.marcacoes": "meus" })).toEqual({});
  });

  it("serializeGrants: só «meus» viaja (scope); Todos = ausente; maxScope força mesmo sem escolha", () => {
    const grants: GrantMap = { "agenda.marcacoes": "edit", "financeiro.negocio": "view", "agenda.servicos": "view" };
    expect(serializeGrants(tree(null), grants, { "agenda.marcacoes": "meus" })).toEqual([
      { key: "agenda.marcacoes", level: "edit", scope: "meus" },
      { key: "agenda.servicos", level: "view" },
      { key: "financeiro.negocio", level: "view" },
    ]);
    const forced = serializeGrants(tree("meus"), grants, {});
    expect(forced.find((e) => e.key === "financeiro.negocio")).toEqual({ key: "financeiro.negocio", level: "view", scope: "meus" });
    expect(forced.find((e) => e.key === "agenda.servicos")).toEqual({ key: "agenda.servicos", level: "view" });
  });

  it("scopesToMap: lê grants[].scope da API (só nós com âmbito)", () => {
    expect(
      scopesToMap(tree(null), [
        { key: "agenda.marcacoes", scope: "meus" },
        { key: "agenda.servicos", scope: "meus" },
        { key: "financeiro.negocio" },
      ]),
    ).toEqual({ "agenda.marcacoes": "meus" });
  });

  it("os nós novos aparecem na árvore como os outros e nascem fechados", () => {
    const g = toggleNode(tree(null), "agenda.profissionais", {});
    expect(g["agenda.profissionais"]).toBe("edit");
    expect(g["agenda.profissionais.precos"]).toBe("edit");
    expect(toggleNode(tree(null), "agenda.profissionais", g)).toEqual({});
  });

  it("hasLimitedNodes: um nó com âmbito limitado a «meus» conta como limitado", () => {
    expect(hasLimitedNodes(tree("meus"))).toBe(true);
    expect(hasLimitedNodes(tree(null))).toBe(false);
  });
});

/** Estado mínimo à volta da árvore, como o convite/ficha da Equipa. */
function Harness({ t, onState }: { t: TreeNode[]; onState: (g: GrantMap, s: ScopeMap) => void }) {
  const [grants, setGrants] = useState<GrantMap>({});
  const [scopes, setScopes] = useState<ScopeMap>({});
  onState(grants, scopes);
  return <PermissionTree tree={t} value={grants} onChange={setGrants} scopes={scopes} onScopesChange={setScopes} />;
}

describe("PermissionTree — âmbito no editor", () => {
  it("o seletor só aparece num nó com âmbito já marcado; escolher «Só os meus» actualiza o estado", () => {
    const seen = vi.fn();
    render(<Harness t={tree(null)} onState={seen} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Agenda" }));
    expect(screen.queryByRole("tab", { name: "Calendário e marcações: âmbito todos" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Calendário e marcações"));
    const todos = screen.getByRole("tab", { name: "Calendário e marcações: âmbito todos" });
    expect(todos).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Calendário e marcações: âmbito só os meus" }));
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ "agenda.marcacoes": "edit" }), { "agenda.marcacoes": "meus" });
    // Um nó sem âmbito (Serviços) nunca mostra o seletor.
    fireEvent.click(screen.getByLabelText("Serviços"));
    expect(screen.queryByRole("tab", { name: "Serviços: âmbito todos" })).toBeNull();
  });

  it("maxScope = meus: «Todos» desactivado e o âmbito fica «Só os meus» logo ao marcar", () => {
    const seen = vi.fn();
    render(<Harness t={tree("meus")} onState={seen} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Agenda" }));
    fireEvent.click(screen.getByLabelText("Calendário e marcações"));
    const todos = screen.getByRole("tab", { name: "Calendário e marcações: âmbito todos" });
    expect(todos).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Calendário e marcações: âmbito só os meus" })).toHaveAttribute("aria-selected", "true");
    expect(seen).toHaveBeenLastCalledWith(expect.anything(), { "agenda.marcacoes": "meus" });
    // Clicar no desactivado não muda nada.
    fireEvent.click(todos);
    expect(seen).toHaveBeenLastCalledWith(expect.anything(), { "agenda.marcacoes": "meus" });
  });

  it("desmarcar o nó tira-lhe o âmbito", () => {
    const seen = vi.fn();
    render(<Harness t={tree(null)} onState={seen} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Agenda" }));
    fireEvent.click(screen.getByLabelText("Calendário e marcações"));
    fireEvent.click(screen.getByRole("tab", { name: "Calendário e marcações: âmbito só os meus" }));
    fireEvent.click(screen.getByLabelText("Calendário e marcações"));
    expect(seen).toHaveBeenLastCalledWith({}, {});
  });
});
