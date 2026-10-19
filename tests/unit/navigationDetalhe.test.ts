import { describe, expect, it } from "vitest";
import { SUBMENU, pathInSubitems } from "../../src/lib/navigation";

describe("pathInSubitems — páginas de detalhe debaixo de um subitem", () => {
  const correio = SUBMENU["/correio"];
  it("aceita o path do subitem e o detalhe debaixo dele (assistente de campanhas)", () => {
    expect(pathInSubitems("/correio/campanhas", "/correio", correio)).toBe(true);
    expect(pathInSubitems("/correio/campanhas/nova", "/correio", correio)).toBe(true);
    expect(pathInSubitems("/correio/campanhas/abc-123", "/correio", correio)).toBe(true);
  });
  it("o detalhe só vale se o subitem estiver permitido (sem Campanhas, /nova não passa)", () => {
    const semCampanhas = correio.filter((s) => s.id !== "campanhas");
    expect(pathInSubitems("/correio/campanhas/nova", "/correio", semCampanhas)).toBe(false);
  });
  it("nunca herda pelo subitem-âncora da raiz: /agenda/xyz não é do Calendário", () => {
    expect(pathInSubitems("/agenda/xyz", "/agenda", SUBMENU["/agenda"])).toBe(false);
    expect(pathInSubitems("/financeiro/xyz", "/financeiro", SUBMENU["/financeiro"])).toBe(false);
    expect(pathInSubitems("/agenda", "/agenda", SUBMENU["/agenda"])).toBe(true);
  });
});
