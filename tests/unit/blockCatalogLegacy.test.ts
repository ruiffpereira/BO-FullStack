import { describe, it, expect } from "vitest";
import { getBlockFields, canonicalVariant } from "../../src/lib/blockCatalog";

/**
 * Variantes com o nome ANTIGO continuam gravadas em sites reais. O editor tem
 * de continuar a mostrar-lhes o formulário certo — senão o tenant abre um bloco
 * publicado e vê os 6 campos genéricos em vez dos campos que o bloco usa.
 */
describe("variantes legadas no editor de blocos", () => {
  it("hero \"tifas-split\" mostra os MESMOS campos que \"split\"", () => {
    const novo = getBlockFields("hero", "split").map((f) => f.key);
    const legado = getBlockFields("hero", "tifas-split").map((f) => f.key);
    expect(legado).toEqual(novo);
    // Prova que é o formulário rico, não o fallback genérico.
    expect(legado).toContain("contacto.morada1");
    expect(legado).toContain("stat1.valor");
  });

  it("\"tifas\" resolve para a variante por omissão de cada tipo", () => {
    expect(canonicalVariant("gallery", "tifas")).toBe("grid");
    expect(canonicalVariant("about", "tifas")).toBe("portrait");
    expect(getBlockFields("about", "tifas").map((f) => f.key)).toEqual(
      getBlockFields("about", "portrait").map((f) => f.key),
    );
  });

  it("uma variante atual passa incólume", () => {
    expect(canonicalVariant("hero", "split")).toBe("split");
  });
});
