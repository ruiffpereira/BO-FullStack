/**
 * Contrato do renderizador de campos (F13): `(fieldDef, value, onChange, ctx)`.
 *
 * O `FieldCtx` é o que um campo precisa de saber do tenant — nada de `pt/en/fr` fixos: as línguas, a
 * base, as páginas (com estado), os blocos com âncora, os documentos e os `issues` do último `422`.
 * `name` + `path` dizem QUEM é este campo (o `path` tem a mesma forma do `Issue.path` da API, relativo
 * à entidade: `comps.c_x81.v.items.k3f.text`), e é com ele que os issues são casados.
 */
import type { Issue } from "../state/types";

export type MediaKindName = "image" | "file" | "video";

export interface MediaValue {
  same: boolean;
  /** `same:true` → só a base; `same:false` → uma por língua. Um `blob:` = ficheiro por carregar. */
  values: Record<string, string>;
}

export interface FieldPage {
  id: string;
  title: string;
  /** `/obras/braga` */
  path: string;
  status: "draft" | "published";
  isHome: boolean;
}
export interface FieldAnchor {
  blockId: string;
  name: string;
  anchor: string;
  /** Título da 1.ª página onde o bloco está (para distinguir blocos com o mesmo nome). */
  pageTitle?: string;
}
export interface FieldDocument {
  id: string;
  name: string;
  media: MediaValue;
}

export interface FieldCtx {
  /** Línguas do tenant, a BASE primeiro. */
  languages: string[];
  base: string;
  pages: FieldPage[];
  anchors: FieldAnchor[];
  documents: FieldDocument[];
  /** `manifest.icons` — as opções dos `choice` com `optionsFrom: "icons"`. */
  icons: { id: string; label: string }[];
  /** Issues do último `422` JÁ filtrados para a entidade em edição. */
  issues: Issue[];
  /** Nome do campo (chave em `v`) e o seu `path` completo. */
  name: string;
  path: string;
  /** Limites por omissão do catálogo (`text`/`md` sem `max`). */
  defaults?: { textMax?: number; mdMax?: number };
  /** Desliga todos os controlos (billing só-leitura). */
  disabled?: boolean;
}

/**
 * Alteração de um campo. `key` junta escrita seguida no MESMO campo numa só entrada do desfazer
 * (é o `path` do campo que se está a escrever); gestos discretos (escolher, adicionar, remover,
 * reordenar, carregar) não levam `key` e ficam cada um na sua entrada.
 */
export type FieldChange = (value: unknown, key?: string) => void;
