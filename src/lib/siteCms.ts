/**
 * Helpers para integração CMS no editor de blocos do site.
 *
 * O conteúdo dos blocos (títulos, imagens, listas) vive no CMS (contexto `website`),
 * organizado por chaves determinísticas: `site.<blockId>.<campo>` com índices 1-based.
 *
 * Flatten: converte conteúdo inline (por locale) em entradas CMS individuais.
 * Unflatten: reconstrói conteúdo inline a partir de entradas CMS (inverso).
 */

/** Tipo de entrada CMS (text = string; image = URL de imagem; data = slug/id/link não-traduzível). */
export type CmsEntryType = "text" | "image" | "data";

/** Entrada CMS para upsert via API. */
export interface CmsEntry {
  key: string;
  locale: string;
  value: string;
  type: CmsEntryType;
}

/**
 * Identifica o tipo de um campo CMS baseado no nome e/ou valor.
 *
 * - `image` se o nome contiver "image|img|foto|logo" (case-insensitive)
 *   OU o valor for uma URL http(s) de imagem.
 * - `data` se o ÚLTIMO segmento do nome (após split por ".") for EXATAMENTE
 *   um de: to, href, ctahref, cta, slug (case-insensitive).
 * - `text` por defeito.
 */
export function identifyFieldType(fieldName: string, value: string): CmsEntryType {
  const name = fieldName.toLowerCase();

  // Campos que são sempre imagens (check de substring)
  if (/image|img|foto|logo/.test(name)) {
    return "image";
  }

  // Campos que são sempre dados: último segmento deve ser EXATAMENTE um dos keywords
  const lastSegment = name.split(".").pop() ?? "";
  if (["to", "href", "ctahref", "cta", "slug"].includes(lastSegment)) {
    return "data";
  }

  // Se o valor parece uma URL de imagem, é imagem
  if (/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|svg)$/i.test(value)) {
    return "image";
  }

  return "text";
}

/**
 * Converte conteúdo inline (objeto de campos por locale) em entradas CMS.
 *
 * @param blockId ID estável do bloco (ex: "b1", "uuid")
 * @param locale Código de língua (ex: "pt", "en")
 * @param fields Objeto de campos (ex: { title: "Título", items: [{ name: "Item 1" }] })
 * @returns Lista de entradas CMS (key, locale, value, type)
 *
 * Exemplo:
 *   blockId="b1", locale="pt", fields={ title: "Título", items: [{ name: "Item 1" }, { name: "Item 2" }] }
 *   → [
 *       { key: "site.b1.title", locale: "pt", value: "Título", type: "text" },
 *       { key: "site.b1.items.1.name", locale: "pt", value: "Item 1", type: "text" },
 *       { key: "site.b1.items.2.name", locale: "pt", value: "Item 2", type: "text" },
 *     ]
 */
export function flattenBlockContent(
  blockId: string,
  locale: string,
  fields: Record<string, unknown>,
): CmsEntry[] {
  const entries: CmsEntry[] = [];

  function visit(obj: Record<string, unknown>, prefix: string) {
    for (const [key, val] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (val === null || val === undefined) {
        // Skip null/undefined
        continue;
      }

      if (typeof val === "string") {
        // Leaf: string value
        entries.push({
          key: `site.${blockId}.${path}`,
          locale,
          value: val,
          type: identifyFieldType(key, val),
        });
      } else if (typeof val === "number") {
        // Leaf: number (convert to string)
        entries.push({
          key: `site.${blockId}.${path}`,
          locale,
          value: String(val),
          type: "text",
        });
      } else if (typeof val === "boolean") {
        // Leaf: boolean (convert to string)
        entries.push({
          key: `site.${blockId}.${path}`,
          locale,
          value: val ? "true" : "false",
          type: "text",
        });
      } else if (Array.isArray(val)) {
        // Array of strings or objects
        for (let i = 0; i < val.length; i++) {
          const item = val[i];
          const itemIndex = i + 1; // 1-based
          if (typeof item === "string") {
            // Array of strings: site.b1.items.1, site.b1.items.2, ...
            entries.push({
              key: `site.${blockId}.${path}.${itemIndex}`,
              locale,
              value: item,
              type: identifyFieldType(path, item),
            });
          } else if (typeof item === "object" && item !== null) {
            // Array of objects: recurse
            visit(item as Record<string, unknown>, `${path}.${itemIndex}`);
          }
        }
      } else if (typeof val === "object") {
        // Nested object: recurse
        visit(val as Record<string, unknown>, path);
      }
    }
  }

  visit(fields, "");
  return entries;
}

/**
 * Reconstrói conteúdo inline a partir de entradas CMS.
 * Inverso de `flattenBlockContent`.
 *
 * @param blockId ID do bloco
 * @param entries Todas as entradas CMS do tenant
 * @param locale Locale a extrair (opcional; sem locale retorna undefined para campos que são null)
 * @returns Objeto de conteúdo (ex: { title: "Título", items: [{ name: "Item 1" }] })
 *
 * Exemplo:
 *   blockId="b1", entries=[
 *     { key: "site.b1.title", locale: "pt", value: "Título", ... },
 *     { key: "site.b1.items.1.name", locale: "pt", value: "Item 1", ... },
 *   ]
 *   → { title: "Título", items: [{ name: "Item 1" }] }
 */
export function unflattenBlockEntries(
  blockId: string,
  entries: CmsEntry[],
  locale?: string,
): Record<string, unknown> {
  const prefix = `site.${blockId}.`;
  const relevant = entries.filter((e) => e.key.startsWith(prefix) && (!locale || e.locale === locale));

  // Mapa flat de chaves para valores
  const flatMap: Record<string, string> = {};
  for (const entry of relevant) {
    const key = entry.key.slice(prefix.length); // Remove "site.b1." prefix
    flatMap[key] = entry.value;
  }

  return unflattenMap(flatMap);
}

/**
 * Unflatten um mapa flat de chaves em objeto aninhado.
 * Semelhante ao `unflattenPrefix` do site-engine.
 *
 * Exemplo:
 *   { "title": "Título", "items.1.name": "Item 1", "items.2.name": "Item 2" }
 *   → { title: "Título", items: [{ name: "Item 1" }, { name: "Item 2" }] }
 */
export function unflattenMap(flatMap: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flatMap)) {
    const parts = key.split(".");
    let current: any = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const isNumeric = /^\d+$/.test(part);
      const nextPart = parts[i + 1];
      const nextIsNumeric = /^\d+$/.test(nextPart);

      if (isNumeric) {
        // This is a 1-based array index; convert to 0-based
        const idx = parseInt(part, 10) - 1;

        // Ensure current is an array
        if (!Array.isArray(current)) {
          break; // Malformed; skip this entry
        }

        // Expand array if needed
        while (current.length <= idx) {
          current.push({});
        }

        current = current[idx];
      } else {
        // Object key
        if (!current[part]) {
          current[part] = nextIsNumeric ? [] : {};
        }
        current = current[part];
      }
    }

    // Set the final leaf value
    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      const idx = parseInt(lastPart, 10) - 1;
      if (Array.isArray(current)) {
        while (current.length <= idx) {
          current.push(value);
        }
        current[idx] = value;
      }
    } else {
      current[lastPart] = value;
    }
  }

  return result;
}

/**
 * Determina quais entradas CMS de um bloco devem ser apagadas após uma mudança.
 *
 * Usado quando um item de lista é removido: todas as entradas com índice ≥ novo comprimento
 * da lista precisam de ser apagadas.
 *
 * @param blockId ID do bloco
 * @param fieldName Nome do campo (ex: "items")
 * @param newLength Novo comprimento da lista
 * @param entries Todas as entradas CMS do tenant
 * @returns Keys das entradas que devem ser apagadas
 *
 * Exemplo:
 *   blockId="b1", fieldName="items", newLength=2, entries=[
 *     { key: "site.b1.items.1.name", ... },
 *     { key: "site.b1.items.2.name", ... },
 *     { key: "site.b1.items.3.name", ... },  // Será apagado
 *   ]
 *   → ["site.b1.items.3.name"]
 */
export function getOrphanedEntryKeys(
  blockId: string,
  fieldName: string,
  newLength: number,
  entries: CmsEntry[],
): string[] {
  const prefix = `site.${blockId}.${fieldName}.`;
  const orphaned: string[] = [];

  for (const entry of entries) {
    if (!entry.key.startsWith(prefix)) continue;

    const rest = entry.key.slice(prefix.length);
    const firstPart = rest.split(".")[0];
    const idx = parseInt(firstPart, 10);

    if (isNaN(idx) || idx > newLength) {
      orphaned.push(entry.key);
    }
  }

  return orphaned;
}

/**
 * Determina todas as entradas CMS de um bloco (para remoção completa).
 *
 * @param blockId ID do bloco
 * @param entries Todas as entradas CMS do tenant
 * @returns Keys de todas as entradas do bloco
 */
export function getBlockEntryKeys(blockId: string, entries: CmsEntry[]): string[] {
  const prefix = `site.${blockId}.`;
  return entries.filter((e) => e.key.startsWith(prefix)).map((e) => e.key);
}
