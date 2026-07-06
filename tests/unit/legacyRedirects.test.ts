import { describe, it, expect } from "vitest";
import { resolveLegacyTabTarget } from "../../src/lib/navigation";

// T2.8 (varredura de deep-links órfãos, `.design/shell-nav-perfil/TASKS.md`):
// cobre `resolveLegacyTabTarget` para os casos reais que o `LegacyTabEntry`
// (App.tsx) resolve em produção — um por página migrada na Fase 2, mais os
// dois casos "sem redirect" (id-âncora da raiz e id desconhecido).

describe("resolveLegacyTabTarget", () => {
  it("Financeiro: ?vista=ginasio → /financeiro/ginasio", () => {
    expect(resolveLegacyTabTarget("/financeiro", "ginasio", "")).toBe(
      "/financeiro/ginasio",
    );
  });

  it("Loja: ?tab=encomendas → /loja/encomendas", () => {
    expect(resolveLegacyTabTarget("/loja", "encomendas", "")).toBe(
      "/loja/encomendas",
    );
  });

  it("Clientes: ?tab=leads preserva os restantes query params (ex.: lead=<id>)", () => {
    expect(resolveLegacyTabTarget("/clientes", "leads", "lead=abc-123")).toBe(
      "/clientes/leads?lead=abc-123",
    );
  });

  it("id-âncora da própria raiz não gera redirect (fica no conteúdo por defeito)", () => {
    // "negocio" (Financeiro), "produtos" (Loja) e "clientes" (Clientes) são os
    // ids-âncora — o path deles já É a raiz, por isso `resolveLegacyTabTarget`
    // devolve null mesmo sendo um id real do SUBMENU.
    expect(resolveLegacyTabTarget("/financeiro", "negocio", "")).toBeNull();
    expect(resolveLegacyTabTarget("/loja", "produtos", "")).toBeNull();
    expect(resolveLegacyTabTarget("/clientes", "clientes", "")).toBeNull();
  });

  it("id inválido/desconhecido não gera redirect (raiz renderiza o conteúdo por defeito)", () => {
    expect(resolveLegacyTabTarget("/financeiro", "inexistente", "")).toBeNull();
    expect(resolveLegacyTabTarget("/loja", "", "")).toBeNull();
  });

  it("sem id (param ausente) não gera redirect", () => {
    expect(resolveLegacyTabTarget("/financeiro", null, "")).toBeNull();
  });

  it("raiz sem SUBMENU (root desconhecida) não gera redirect", () => {
    expect(resolveLegacyTabTarget("/inexistente", "algum-id", "")).toBeNull();
  });
});
