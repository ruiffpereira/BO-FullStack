import { describe, it, expect } from "vitest";
import {
  identifyFieldType,
  flattenBlockContent,
  unflattenBlockEntries,
  unflattenMap,
  getOrphanedEntryKeys,
  getBlockEntryKeys,
  type CmsEntry,
} from "../../src/lib/siteCms";

describe("siteCms helpers", () => {
  describe("identifyFieldType", () => {
    it("identifica campos de imagem por nome", () => {
      expect(identifyFieldType("image", "https://example.com/img.jpg")).toBe("image");
      expect(identifyFieldType("imageUrl", "...")).toBe("image");
      expect(identifyFieldType("imagemDestaque", "...")).toBe("image");
      expect(identifyFieldType("logo", "...")).toBe("image");
      expect(identifyFieldType("foto", "...")).toBe("image");
    });

    it("identifica campos de dados (slugs, links, etc.) como 'data'", () => {
      expect(identifyFieldType("to", "/pagina")).toBe("data");
      expect(identifyFieldType("href", "/pagina")).toBe("data");
      expect(identifyFieldType("ctaHref", "/pagina")).toBe("data");
      expect(identifyFieldType("cta", "/pagina")).toBe("data");
      expect(identifyFieldType("slug", "pagina")).toBe("data");
    });

    it("identifica campos de texto por defeito (incluindo palavras que contêm 'to' como substring)", () => {
      expect(identifyFieldType("title", "Título")).toBe("text");
      expect(identifyFieldType("description", "Descrição")).toBe("text");
      expect(identifyFieldType("label", "Label")).toBe("text");
      // Cuidado: "texto" contém "to" mas NÃO é exatamente "to", por isso é "text"
      expect(identifyFieldType("texto", "conteúdo")).toBe("text");
      expect(identifyFieldType("autor", "João")).toBe("text");
    });

    it("identifica URLs de imagem pelo valor", () => {
      expect(identifyFieldType("foto", "https://example.com/photo.jpg")).toBe("image");
      expect(identifyFieldType("url", "https://example.com/image.png")).toBe("image");
      expect(identifyFieldType("content", "http://example.com/pic.gif")).toBe("image");
    });

    it("não confunde URLs normais com imagens", () => {
      expect(identifyFieldType("link", "https://example.com/page")).toBe("text");
      expect(identifyFieldType("description", "https://example.com")).toBe("text");
    });
  });

  describe("flattenBlockContent", () => {
    it("achata campos simples", () => {
      const result = flattenBlockContent("b1", "pt", {
        title: "Título",
        description: "Descrição",
      });

      expect(result).toEqual([
        { key: "site.b1.title", locale: "pt", value: "Título", type: "text" },
        { key: "site.b1.description", locale: "pt", value: "Descrição", type: "text" },
      ]);
    });

    it("identifica tipos de campos corretamente", () => {
      const result = flattenBlockContent("b1", "pt", {
        title: "Título",
        imageUrl: "https://example.com/img.jpg",
        ctaHref: "/pagina",
      });

      expect(result).toEqual([
        { key: "site.b1.title", locale: "pt", value: "Título", type: "text" },
        {
          key: "site.b1.imageUrl",
          locale: "pt",
          value: "https://example.com/img.jpg",
          type: "image",
        },
        { key: "site.b1.ctaHref", locale: "pt", value: "/pagina", type: "data" },
      ]);
    });

    it("achata listas de strings com índices 1-based", () => {
      const result = flattenBlockContent("b1", "pt", {
        items: ["Item 1", "Item 2", "Item 3"],
      });

      expect(result).toEqual([
        { key: "site.b1.items.1", locale: "pt", value: "Item 1", type: "text" },
        { key: "site.b1.items.2", locale: "pt", value: "Item 2", type: "text" },
        { key: "site.b1.items.3", locale: "pt", value: "Item 3", type: "text" },
      ]);
    });

    it("achata listas de objetos com campos aninhados", () => {
      const result = flattenBlockContent("b1", "pt", {
        items: [
          { name: "Item 1", value: "V1" },
          { name: "Item 2", value: "V2" },
        ],
      });

      expect(result).toEqual([
        { key: "site.b1.items.1.name", locale: "pt", value: "Item 1", type: "text" },
        { key: "site.b1.items.1.value", locale: "pt", value: "V1", type: "text" },
        { key: "site.b1.items.2.name", locale: "pt", value: "Item 2", type: "text" },
        { key: "site.b1.items.2.value", locale: "pt", value: "V2", type: "text" },
      ]);
    });

    it("converte números para strings", () => {
      const result = flattenBlockContent("b1", "pt", {
        count: 42,
        price: 99.99,
      });

      expect(result).toEqual([
        { key: "site.b1.count", locale: "pt", value: "42", type: "text" },
        { key: "site.b1.price", locale: "pt", value: "99.99", type: "text" },
      ]);
    });

    it("converte booleans para strings", () => {
      const result = flattenBlockContent("b1", "pt", {
        active: true,
        archived: false,
      });

      expect(result).toEqual([
        { key: "site.b1.active", locale: "pt", value: "true", type: "text" },
        { key: "site.b1.archived", locale: "pt", value: "false", type: "text" },
      ]);
    });

    it("ignora null e undefined", () => {
      const result = flattenBlockContent("b1", "pt", {
        title: "Título",
        description: null,
        other: undefined,
      });

      expect(result).toEqual([
        { key: "site.b1.title", locale: "pt", value: "Título", type: "text" },
      ]);
    });

    it("acha listas vazias sem gerar entradas", () => {
      const result = flattenBlockContent("b1", "pt", {
        items: [],
      });

      expect(result).toEqual([]);
    });

    it("acha objetos vazios sem gerar entradas", () => {
      const result = flattenBlockContent("b1", "pt", {
        settings: {},
      });

      expect(result).toEqual([]);
    });
  });

  describe("unflattenMap", () => {
    it("desachata campos simples", () => {
      const flatMap = {
        title: "Título",
        description: "Descrição",
      };

      const result = unflattenMap(flatMap);

      expect(result).toEqual({
        title: "Título",
        description: "Descrição",
      });
    });

    it("desachata listas de strings com índices 1-based", () => {
      const flatMap = {
        "items.1": "Item 1",
        "items.2": "Item 2",
        "items.3": "Item 3",
      };

      const result = unflattenMap(flatMap);

      expect(result).toEqual({
        items: ["Item 1", "Item 2", "Item 3"],
      });
    });

    it("desachata listas de objetos", () => {
      const flatMap = {
        "items.1.name": "Item 1",
        "items.1.value": "V1",
        "items.2.name": "Item 2",
        "items.2.value": "V2",
      };

      const result = unflattenMap(flatMap);

      expect(result).toEqual({
        items: [
          { name: "Item 1", value: "V1" },
          { name: "Item 2", value: "V2" },
        ],
      });
    });

    it("tolera índices esparsos (preenche lacunas com objects vazios para arrays de objetos)", () => {
      const flatMap = {
        "items.1.name": "Item 1",
        "items.3.name": "Item 3", // Gap — item 2 não existe
      };

      const result = unflattenMap(flatMap);

      // Array é expandido até ao índice 3 (0-based = 2), posição vazia fica como objeto vazio
      expect(result).toEqual({
        items: [{ name: "Item 1" }, {}, { name: "Item 3" }],
      });
    });

    it("desachata objetos aninhados", () => {
      const flatMap = {
        "contact.name": "John",
        "contact.email": "john@example.com",
        "contact.address.street": "Main St",
        "contact.address.city": "NYC",
      };

      const result = unflattenMap(flatMap);

      expect(result).toEqual({
        contact: {
          name: "John",
          email: "john@example.com",
          address: {
            street: "Main St",
            city: "NYC",
          },
        },
      });
    });

    it("roundtrip: flatten → unflatten", () => {
      const original = {
        title: "Título",
        description: "Descrição",
        items: [
          { name: "Item 1", count: 10 },
          { name: "Item 2", count: 20 },
        ],
      };

      // Flatten
      const entries = flattenBlockContent("b1", "pt", original);
      const flatMap: Record<string, string> = {};
      for (const e of entries) {
        const key = e.key.replace("site.b1.", "");
        flatMap[key] = e.value;
      }

      // Unflatten
      const result = unflattenMap(flatMap);

      // Values are strings after round-trip (convert back for comparison)
      expect(result).toEqual({
        title: "Título",
        description: "Descrição",
        items: [
          { name: "Item 1", count: "10" },
          { name: "Item 2", count: "20" },
        ],
      });
    });
  });

  describe("unflattenBlockEntries", () => {
    it("reconstrói a partir de entradas CMS filtradas por locale", () => {
      const entries: CmsEntry[] = [
        { key: "site.b1.title", locale: "pt", value: "Título PT", type: "text" },
        { key: "site.b1.title", locale: "en", value: "Title EN", type: "text" },
        { key: "site.b1.description", locale: "pt", value: "Descrição PT", type: "text" },
        { key: "site.b2.title", locale: "pt", value: "Outro Bloco", type: "text" }, // Não incluso (outro bloco)
      ];

      const result = unflattenBlockEntries("b1", entries, "pt");

      expect(result).toEqual({
        title: "Título PT",
        description: "Descrição PT",
      });
    });

    it("ignora entradas de outros blocos", () => {
      const entries: CmsEntry[] = [
        { key: "site.b1.title", locale: "pt", value: "B1", type: "text" },
        { key: "site.b2.title", locale: "pt", value: "B2", type: "text" },
        { key: "site.b1.items.1.name", locale: "pt", value: "Item", type: "text" },
      ];

      const result = unflattenBlockEntries("b1", entries, "pt");

      expect(result).toEqual({
        title: "B1",
        items: [{ name: "Item" }],
      });
    });

    it("reconstrói sem locale (retorna primeira entrada por chave)", () => {
      const entries: CmsEntry[] = [
        { key: "site.b1.title", locale: "pt", value: "Título", type: "text" },
      ];

      const result = unflattenBlockEntries("b1", entries);

      expect(result).toEqual({
        title: "Título",
      });
    });
  });

  describe("getOrphanedEntryKeys", () => {
    it("encontra entradas com índice > novo comprimento", () => {
      const entries: CmsEntry[] = [
        { key: "site.b1.items.1.name", locale: "pt", value: "Item 1", type: "text" },
        { key: "site.b1.items.2.name", locale: "pt", value: "Item 2", type: "text" },
        { key: "site.b1.items.3.name", locale: "pt", value: "Item 3", type: "text" },
        { key: "site.b1.items.3.value", locale: "pt", value: "V3", type: "text" },
        { key: "site.b1.title", locale: "pt", value: "Título", type: "text" }, // Não orphano
      ];

      const orphaned = getOrphanedEntryKeys("b1", "items", 2, entries);

      expect(orphaned).toEqual([
        "site.b1.items.3.name",
        "site.b1.items.3.value",
      ]);
    });

    it("não marca como orphano entradas com índice ≤ novo comprimento", () => {
      const entries: CmsEntry[] = [
        { key: "site.b1.items.1.name", locale: "pt", value: "Item 1", type: "text" },
        { key: "site.b1.items.2.name", locale: "pt", value: "Item 2", type: "text" },
      ];

      const orphaned = getOrphanedEntryKeys("b1", "items", 2, entries);

      expect(orphaned).toEqual([]);
    });

    it("ignora entradas de outros campos", () => {
      const entries: CmsEntry[] = [
        { key: "site.b1.items.1.name", locale: "pt", value: "Item 1", type: "text" },
        { key: "site.b1.tags.1", locale: "pt", value: "Tag 1", type: "text" },
      ];

      const orphaned = getOrphanedEntryKeys("b1", "items", 0, entries);

      expect(orphaned).toEqual([
        "site.b1.items.1.name",
      ]);
    });
  });

  describe("getBlockEntryKeys", () => {
    it("retorna todas as keys do bloco", () => {
      const entries: CmsEntry[] = [
        { key: "site.b1.title", locale: "pt", value: "Título", type: "text" },
        { key: "site.b1.items.1.name", locale: "pt", value: "Item 1", type: "text" },
        { key: "site.b2.title", locale: "pt", value: "Outro", type: "text" },
        { key: "site.b1.items.1.value", locale: "en", value: "Value", type: "text" },
      ];

      const keys = getBlockEntryKeys("b1", entries);

      expect(keys).toEqual([
        "site.b1.title",
        "site.b1.items.1.name",
        "site.b1.items.1.value",
      ]);
    });

    it("retorna lista vazia se nenhuma entrada do bloco", () => {
      const entries: CmsEntry[] = [
        { key: "site.b2.title", locale: "pt", value: "Outro", type: "text" },
      ];

      const keys = getBlockEntryKeys("b1", entries);

      expect(keys).toEqual([]);
    });
  });
});
