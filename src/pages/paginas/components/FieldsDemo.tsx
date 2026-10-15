/**
 * Demonstração mínima do F13 no marcador do editor (o editor a sério é o F14): mostra os campos do
 * 1.º componente do bloco/parte aberto, ou os dados do especial, ligados ao reducer — prova o caminho
 * `FieldsForm → onField → edit(chave de junção) → desfazer` sem ainda ter o editor de componentes.
 */
import { FieldsForm } from "../fields/FieldsForm";
import { useFieldCtx, useFieldEditor, type FieldTarget } from "../fields/edit";
import { useBuilder } from "../state/store";
import type { FieldSpecs, PartName } from "../state/types";

export type DemoSource = { kind: "block"; id: string } | { kind: "part"; id: PartName } | { kind: "item"; id: string };

type Comps = { id: string; type: string; v?: unknown }[];

/** O alvo + a definição dos campos do que se vai mostrar (`null` = não há nada para editar). */
function useDemoTarget(source: DemoSource): { target: FieldTarget; fields: FieldSpecs; values: unknown; title: string } | null {
  const { state, catalog, manifest } = useBuilder();
  const { work } = state;
  if (source.kind === "item") {
    const it = Object.values(work.items).flat().find((x) => x.id === source.id);
    const def = it?.kind === "special" ? manifest?.specials?.[it.specialType ?? ""] : undefined;
    return it && def ? { target: { entity: "item", id: it.id }, fields: def.fields, values: it.specialData, title: def.label } : null;
  }
  const comps = (source.kind === "block" ? work.blocks.find((b) => b.id === source.id)?.comps : work.parts[source.id]?.comps) as Comps | undefined;
  const comp = comps?.[0];
  const def = comp ? catalog?.components.find((c) => c.type === comp.type) : undefined;
  if (!comp || !def) return null;
  const target: FieldTarget = source.kind === "block" ? { entity: "block", id: source.id, compId: comp.id } : { entity: "part", id: source.id, compId: comp.id };
  return { target, fields: def.fields, values: comp.v, title: def.label };
}

function Form({ target, fields, values, title }: NonNullable<ReturnType<typeof useDemoTarget>>) {
  const ctx = useFieldCtx(target);
  const onField = useFieldEditor(target);
  return (
    <section aria-label={`Campos de ${title}`} className="mt-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <FieldsForm fields={fields} values={values} onField={onField} ctx={ctx} />
    </section>
  );
}

export function FieldsDemo({ source }: { source: DemoSource }) {
  const found = useDemoTarget(source);
  if (!found) return null;
  // `key` reinicia o estado local (itens abertos…) ao trocar de alvo.
  return <Form key={`${found.target.entity}:${found.target.id}:${"compId" in found.target ? found.target.compId : ""}`} {...found} />;
}
