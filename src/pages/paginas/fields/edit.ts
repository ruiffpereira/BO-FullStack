/**
 * Ligação dos campos ao reducer (F13): onde se escreve um valor e com que chave de junção.
 *
 *  - `setFieldValue` — função pura `Work → Work` (o que o `edit` do store recebe).
 *  - `editKey` — a chave de junção: escrita seguida NO MESMO campo (≤ 1,5 s) é UMA entrada do desfazer,
 *    gestos discretos (sem `key`) ficam cada um na sua. A chave leva a entidade, para dois blocos
 *    diferentes com o mesmo campo nunca se juntarem.
 *  - `useFieldEditor` / `useFieldCtx` — os dois hooks que o editor de bloco (F14) usa para ligar tudo.
 */
import { useCallback, useMemo } from "react";
import { useBuilder } from "../state/store";
import { buildFieldCtx, issuesFor, revealFor } from "./ctx";
import type { Issue, PartName, Work } from "../state/types";
import type { FieldCtx } from "./types";

/** Onde mora o objeto de valores que um formulário edita. */
export type FieldTarget =
  | { entity: "block"; id: string; compId: string }
  | { entity: "part"; id: PartName; compId: string }
  /** Os dados de um especial (`Item.specialData`). */
  | { entity: "item"; id: string };

type Rec = Record<string, unknown>;
/** Um componente (§3.2); no tipo gerado `comps` é `object[]`. */
type Comp = { id: string; v?: unknown; [k: string]: unknown };

/** Prefixo do `path` (igual ao `Issue.path` da API) dos valores do alvo. */
export const targetPath = (t: FieldTarget): string => (t.entity === "item" ? "specialData" : `comps.${t.compId}.v`);

/** Chave de junção do desfazer; `undefined` (sem `key`) = gesto discreto, uma entrada própria. */
export const editKey = (t: FieldTarget, key?: string): string | undefined => (key ? `${t.entity}:${t.id}|${key}` : undefined);

const setIn = (obj: unknown, name: string, value: unknown): Rec => {
  const next: Rec = { ...(typeof obj === "object" && obj !== null && !Array.isArray(obj) ? (obj as Rec) : {}) };
  if (value === undefined) delete next[name];
  else next[name] = value;
  return next;
};

const patchComps = (comps: Comp[] | undefined | null, compId: string, name: string, value: unknown): Comp[] | null => {
  if (!Array.isArray(comps) || !comps.some((c) => c.id === compId)) return null;
  return comps.map((c) => (c.id === compId ? { ...c, v: setIn(c.v, name, value) } : c)) as Comp[];
};

/** Escreve `value` no campo `name` do alvo. Alvo inexistente: devolve o MESMO `Work` (o reducer ignora). */
export function setFieldValue(work: Work, target: FieldTarget, name: string, value: unknown): Work {
  if (target.entity === "block") {
    const block = work.blocks.find((b) => b.id === target.id);
    const comps = patchComps(block?.comps as Comp[] | undefined, target.compId, name, value);
    return block && comps ? { ...work, blocks: work.blocks.map((b) => (b.id === block.id ? { ...b, comps } : b)) } : work;
  }
  if (target.entity === "part") {
    const part = work.parts[target.id];
    const comps = patchComps(part?.comps as Comp[] | undefined, target.compId, name, value);
    return part && comps ? { ...work, parts: { ...work.parts, [target.id]: { ...part, comps } } } : work;
  }
  for (const [pageId, list] of Object.entries(work.items)) {
    const it = list.find((x) => x.id === target.id);
    if (it && it.kind === "special") {
      return { ...work, items: { ...work.items, [pageId]: list.map((x) => (x === it ? { ...x, specialData: setIn(x.specialData, name, value) } : x)) } };
    }
  }
  return work;
}

/** `(name, value, key?) => void` pronto para o `onField` do `FieldsForm`. */
export function useFieldEditor(target: FieldTarget): (name: string, value: unknown, key?: string) => void {
  const { edit } = useBuilder();
  const { entity, id } = target;
  const compId = "compId" in target ? target.compId : "";
  return useCallback(
    (name, value, key) => {
      const t = (entity === "item" ? { entity, id } : { entity, id, compId }) as FieldTarget;
      edit((w) => setFieldValue(w, t, name, value), editKey(t, key));
    },
    [edit, entity, id, compId],
  );
}

/** O `FieldCtx` de uma entidade: línguas do tenant, páginas, âncoras, documentos e os issues do último 422 dela. */
export function useFieldCtx(target: FieldTarget): FieldCtx {
  const { state, lang, catalog, manifest } = useBuilder();
  const { entity, id } = target;
  const compId = "compId" in target ? target.compId : "";
  const issues: Issue[] = state.issues;
  const base = useMemo(
    () => buildFieldCtx({ work: state.work, lang, catalog, manifest, issues: issuesFor(issues, entity, id) }),
    [state.work, lang, catalog, manifest, issues, entity, id],
  );
  const focus = revealFor(state.focus, state.reveal, entity, id);
  return useMemo(
    () => ({ ...base, focus, name: "", path: targetPath((entity === "item" ? { entity, id } : { entity, id, compId }) as FieldTarget) }),
    [base, focus, entity, id, compId],
  );
}
