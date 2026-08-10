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

/**
 * Variantes por vertical (stand, gym) adicionadas — garantir que:
 * 1. As variantes novas têm formulário rico (não editor genérico)
 * 2. As variantes que reutilizam campos (como gym do hero) o fazem corretamente
 */
describe("variantes por vertical — stand e gym", () => {
  it("hero \"stand\" tem os campos do stand", () => {
    const fields = getBlockFields("hero", "stand").map((f) => f.key);
    expect(fields).toContain("carCount");
    expect(fields).toContain("featureCar");
    expect(fields).toContain("featurePrice");
    expect(fields).toContain("featureMonthly");
    expect(fields).toContain("featureImage");
    expect(fields).toContain("searchCta");
    // Não deve ter campos do split
    expect(fields).not.toContain("contacto.morada1");
  });

  it("hero \"gym\" reutiliza os MESMOS campos que \"split\"", () => {
    const split = getBlockFields("hero", "split").map((f) => f.key);
    const gym = getBlockFields("hero", "gym").map((f) => f.key);
    expect(gym).toEqual(split);
    // Prova que é a variante split
    expect(gym).toContain("contacto.morada1");
    expect(gym).toContain("stat1.valor");
  });

  it("products \"stand\" tem os campos do stand", () => {
    const fields = getBlockFields("products", "stand").map((f) => f.key);
    expect(fields).toContain("eyebrow");
    expect(fields).toContain("badgeLabel");
    expect(fields).toContain("priceFromLabel");
    expect(fields).toContain("detailsLabel");
    expect(fields).toContain("countSuffix");
    expect(fields).toContain("anchorId");
  });

  it("stats \"stand\" tem os campos do stand", () => {
    const fields = getBlockFields("stats", "stand").map((f) => f.key);
    expect(fields).toContain("item1.title");
    expect(fields).toContain("item1.subtitle");
    expect(fields).toContain("item4.subtitle");
  });

  it("services \"stand\" tem os campos do stand", () => {
    const fields = getBlockFields("services", "stand").map((f) => f.key);
    expect(fields).toContain("eyebrow");
    expect(fields).toContain("service1.title");
    expect(fields).toContain("service1.description");
    expect(fields).toContain("service3.description");
  });

  it("cta \"stand\" tem os campos do stand", () => {
    const fields = getBlockFields("cta", "stand").map((f) => f.key);
    expect(fields).toContain("eyebrow");
    expect(fields).toContain("perk1.label");
    expect(fields).toContain("perk3.description");
    expect(fields).toContain("calculator.taegPct");
    expect(fields).toContain("calculator.disclaimer");
  });

  it("contact \"stand\" tem os campos do stand", () => {
    const fields = getBlockFields("contact", "stand").map((f) => f.key);
    expect(fields).toContain("eyebrow");
    expect(fields).toContain("location1.name");
    expect(fields).toContain("location2.phone");
    expect(fields).toContain("form.thanksTitle");
  });

  it("gallery \"gym\" reutiliza os MESMOS campos que \"grid\"", () => {
    const grid = getBlockFields("gallery", "grid").map((f) => f.key);
    const gym = getBlockFields("gallery", "gym").map((f) => f.key);
    expect(gym).toEqual(grid);
    // Prova que tem os campos da grid
    expect(gym).toContain("titulo");
    expect(gym).toContain("photos");
  });

  it("about \"gym\" reutiliza os MESMOS campos que \"portrait\"", () => {
    const portrait = getBlockFields("about", "portrait").map((f) => f.key);
    const gym = getBlockFields("about", "gym").map((f) => f.key);
    expect(gym).toEqual(portrait);
    // Prova que tem os campos do portrait
    expect(gym).toContain("corpo1");
    expect(gym).toContain("foto");
    expect(gym).toContain("especialidades");
  });

  it("gym \"gym-cards\" tem os campos do gym-cards", () => {
    const fields = getBlockFields("gym", "gym-cards").map((f) => f.key);
    expect(fields).toContain("eyebrow");
    expect(fields).toContain("title");
    expect(fields).toContain("plans");
    expect(fields).toContain("anchorId");
  });
});
