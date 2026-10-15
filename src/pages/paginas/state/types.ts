/**
 * Tipos do construtor de páginas (CONTRATO §1, §3, §5). As entidades vêm dos tipos GERADOS pelo Kubb
 * (corpo do `save`) — nada escrito à mão que duplique a API. Só o catálogo e o manifest, que o
 * `GET` tipa como `object`, ganham aqui uma forma mínima (o que a UX precisa de ler).
 */
import type { PostCmsSiteBuilderSaveMutationRequest } from "../../../gen/backoffice/types/PostCmsSiteBuilderSave";

export type SaveBody = PostCmsSiteBuilderSaveMutationRequest;
type Upsert<T extends { upsert?: unknown[] } | undefined> = NonNullable<NonNullable<T>["upsert"]>[number];

export type Page = Upsert<SaveBody["pages"]>;
export type Block = Upsert<SaveBody["blocks"]>;
export type Folder = Upsert<SaveBody["folders"]>;
export type Item = NonNullable<SaveBody["items"]>[string][number];
export type PartName = "topo" | "rodape";
/** `topo` = `{comps}`; `rodape` = `{layout, bg, comps}` (CONTRATO §3.3). */
export type Part = Record<string, unknown>;

/** Cópia de trabalho (e último estado do servidor): tudo o que o `save` pode alterar. */
export interface Work {
  pages: Page[];
  blocks: Block[];
  folders: Folder[];
  /** Lista COMPLETA e ordenada de itens por id de página. */
  items: Record<string, Item[]>;
  parts: Record<PartName, Part | null>;
}

// ── Forma mínima do catálogo (§3.3) e do manifest (§4), tal como a API os entrega ──

export interface FieldSpec {
  type: string;
  i18n?: boolean;
  kind?: string;
  /** Valor por omissão (`choice`, no catálogo e nos especiais do manifest). */
  default?: unknown;
  /** Só nas listas: os campos de cada entrada (um nível). */
  of?: Record<string, FieldSpec>;
  // Restantes propriedades da definição da API (§3.3) — só as que a UX lê.
  required?: boolean;
  /** Campo de SEO: o formulário agrupa-os na caixa "Google (SEO)". */
  seo?: boolean;
  max?: number;
  min?: number;
  /** `choice` com opções fixas. */
  options?: string[];
  /** `choice` cujas opções vêm do manifest (ícones). */
  optionsFrom?: "icons";
  /** Rótulo dado pela API; sem ele usa-se o dicionário de `fields/labels.ts`. */
  label?: string;
}
export type FieldSpecs = Record<string, FieldSpec>;
export interface CatalogComponent {
  type: string;
  label: string;
  fields: FieldSpecs;
}
export interface Starter {
  id: string;
  label: string;
  layout: number;
  comps: { type: string; col: string | number }[];
}
export interface Catalog {
  components: CatalogComponent[];
  parts?: Partial<Record<PartName, string[]>>;
  starters?: Starter[];
  defaults?: { textMax?: number; mdMax?: number };
}
export interface Manifest {
  backgrounds?: { id: string; label: string }[];
  icons?: { id: string; label: string }[];
  styles?: Record<string, { id: string; label: string }[]>;
  parts?: Partial<Record<PartName, string[]>>;
  specials?: Record<string, { label: string; desc?: string; fields: FieldSpecs }>;
}

/** Contexto de línguas do tenant (`User.languages`; base = `User.defaultLanguage`). */
export interface LangCtx {
  languages: string[];
  defaultLanguage: string;
}

/** `Issue` do `422 VALIDATION` (§5.2), tal como o Kubb o gerou. */
export interface Issue {
  code: string;
  entity: "page" | "block" | "part" | "item" | "folder" | "manifest";
  id: string;
  path?: string;
  locale?: string;
  message: string;
}

/** O que se escolheu na UI (lista, biblioteca, selecção dentro da página). */
export type Sel =
  | { kind: "block"; id: string; ref?: string }
  | { kind: "item"; id: string }
  | { kind: "part"; id: PartName }
  | { kind: "page"; id: string }
  | null;
