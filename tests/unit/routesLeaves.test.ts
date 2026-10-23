import { describe, it, expect } from "vitest";
// O fonte do App.tsx lido como texto: as rotas declaradas são a verdade, não uma lista manual.
import appSrc from "../../src/App.tsx?raw";
import { LEAF_EXEMPT_PATHS, LEAF_FOR_PATH, isLeafExempt, leafForPath } from "../../src/lib/navigation";

// EQ-03/EQ-04: toda a rota do Backoffice tem uma FOLHA em LEAF_FOR_PATH (o write-guard fecha as escritas a um
// membro só-ver) ou uma isenção explícita e comentada em LEAF_EXEMPT_PATHS. Uma rota nova sem nenhuma das duas
// parte este teste — senão nasceria aberta a um membro só-ver.

const declared = [...appSrc.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== "*");
const concrete = (p: string) => p.replace(/\/:[A-Za-z]+/g, "/x");

describe("rotas do App.tsx ↔ folhas da árvore", () => {
  it("extrai as rotas declaradas (sanidade do parser)", () => {
    expect(declared.length).toBeGreaterThan(40);
    expect(declared).toContain("/agenda/marcacoes");
    expect(declared).toContain("/correio/campanhas/:campaignId");
  });

  it.each(declared.map((p) => [p]))("%s tem folha ou isenção", (path) => {
    const p = concrete(path);
    expect(leafForPath(p) !== undefined || isLeafExempt(p), `${path} sem folha em LEAF_FOR_PATH nem isenção em LEAF_EXEMPT_PATHS`).toBe(true);
  });

  it("toda a isenção tem justificação e não esconde uma rota que já tem folha", () => {
    for (const [prefix, why] of LEAF_EXEMPT_PATHS) {
      expect(why.length, prefix).toBeGreaterThan(10);
      expect(leafForPath(prefix), `${prefix} está isenta mas tem folha`).toBeUndefined();
    }
  });

  it("LEAF_FOR_PATH não tem prefixos duplicados", () => {
    const keys = LEAF_FOR_PATH.map(([p]) => p);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("as rotas de dono (Faturação, Equipa, Admin, Perfil) estão isentas de propósito", () => {
    for (const p of ["/faturacao", "/equipa", "/admin/sistema", "/perfil"]) expect(isLeafExempt(p), p).toBe(true);
  });
});
