import { describe, it, expect } from "vitest";
import { fmtEur } from "../../src/lib/money";

// FI-06: euros formatam-se num só sítio (lib/money.ts, pt-PT, vírgula decimal).
// O código-fonte lê-se com import.meta.glob (?raw): o BO não tem @types/node.
const sources = import.meta.glob(["../../src/**/*.{ts,tsx,jsx}", "!../../src/gen/**"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const files = Object.keys(sources);
const read = (f: string) => sources[f];
const rel = (p: string) => p.replace("../../src/", "");

describe("formatação de euros", () => {
  it("fmtEur usa vírgula pt-PT", () => {
    expect(fmtEur(12.5)).toMatch(/^12,50\s€$/);
    expect(fmtEur(0.87)).toMatch(/^0,87\s€$/);
    expect(fmtEur(Number.NaN as number)).toMatch(/NaN|0,00/);
  });

  it("ninguém escreve toFixed(2)} € em src/ (ponto decimal)", () => {
    const bad = files.filter((f) => /toFixed\(\d\)\}\s?€/.test(read(f))).map(rel);
    expect(bad).toEqual([]);
  });

  it("fmtEur só está definido em lib/money.ts", () => {
    const defs = files
      .filter((f) => /(const|function)\s+fmtEur\b/.test(read(f)))
      .map(rel);
    expect(defs).toEqual(["lib/money.ts"]);
  });

  it("dívida (AG-18/AG-20) não se calcula no ecrã: sem apptDebtOf/priorDebtFor e sem somar pagamentos para obter dívida", () => {
    const bad = files
      .filter((f) => /apptDebtOf|priorDebtFor/.test(read(f)))
      .map(rel);
    expect(bad).toEqual([]);
    // a Agenda (agora partida em pages/agenda/) lê o priorDebt que a API põe em cada marcação
    const agenda = files.filter((f) => f.startsWith("../../src/pages/agenda/")).map(read).join("\n");
    expect(agenda).toMatch(/\.priorDebt \?\? 0/);
  });
});
