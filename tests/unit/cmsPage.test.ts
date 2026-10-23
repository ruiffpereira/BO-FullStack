import { describe, it, expect } from "vitest";
import { importRowsFromRaw } from "../../src/pages/conteudos/importFile";
import { getSectionPath, groupEntries, emptyEntry, localeLabel } from "../../src/pages/conteudos/model";

const BOM = String.fromCharCode(0xfeff);

describe("importação do CMS — importRowsFromRaw", () => {
  it("aceita cabeçalhos PT e EN, com BOM e maiúsculas", () => {
    const { rows, skipped } = importRowsFromRaw([
      { [BOM + "Key"]: "hero.title", Valor: "Olá", "Língua": "pt", Tipo: "text", "Secção": "Hero", Pai: "Home" },
      { key: "hero.img", value: "https://x/y.jpg", type: "image", locale: "pt", section: "Hero", parent: "" },
    ]);
    expect(skipped).toBe(0);
    expect(rows[0]).toEqual({
      key: "hero.title",
      locale: "pt",
      value: "Olá",
      type: "text",
      sectionName: "Hero",
      parentSectionName: "Home",
    });
    expect(rows[1]).toMatchObject({ key: "hero.img", type: "image", parentSectionName: null });
  });

  it("ignora (e conta) as linhas sem key ou sem valor; tipo por omissão = text", () => {
    const { rows, skipped } = importRowsFromRaw([
      { key: "", value: "x" },
      { key: "a", value: "" },
      { key: "b", value: "ok" },
    ]);
    expect(skipped).toBe(2);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "b", type: "text", locale: null, sectionName: null });
  });
});

describe("modelo do CMS", () => {
  it("groupEntries junta as traduções por key (locale null → «_»)", () => {
    const g = groupEntries([
      { userId: "u", entryId: "1", key: "k", locale: "pt", value: "Olá", type: "text", sectionId: "s1" },
      { userId: "u", entryId: "2", key: "k", locale: "en", value: "Hi", type: "text", sectionId: "s1" },
      { userId: "u", entryId: "3", key: "j", locale: null, value: "x", type: "image", sectionId: null },
    ]);
    expect(g).toHaveLength(2);
    expect(g[0]).toEqual({ key: "k", type: "text", translations: { pt: "Olá", en: "Hi" }, sectionId: "s1" });
    expect(g[1].translations).toEqual({ _: "x" });
  });

  it("getSectionPath devolve a cadeia da raiz até à secção", () => {
    const sections = [
      { userId: "u", sectionId: "a", parentId: null, name: "A", sortOrder: 0, context: "website" as const },
      { userId: "u", sectionId: "b", parentId: "a", name: "B", sortOrder: 0, context: "website" as const },
      { userId: "u", sectionId: "c", parentId: "b", name: "C", sortOrder: 0, context: "website" as const },
    ];
    expect(getSectionPath(sections, "c").map((s) => s.sectionId)).toEqual(["a", "b", "c"]);
    expect(getSectionPath(sections, null)).toEqual([]);
    expect(getSectionPath(sections, "zzz")).toEqual([]);
  });

  it("emptyEntry e localeLabel", () => {
    expect(emptyEntry("s1")).toMatchObject({
      key: "",
      type: "text",
      sectionId: "s1",
      translations: [{ locale: "pt", value: "" }],
    });
    expect(localeLabel("pt-PT")).toBe("PT");
  });
});
