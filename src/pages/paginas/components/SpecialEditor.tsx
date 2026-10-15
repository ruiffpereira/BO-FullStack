/**
 * Editor de um especial (F14): só os campos que o manifest declara — sem estilos, sem componentes,
 * sem disposição. Caminho com "N de M" e anterior/seguinte; rodapé Esconder · Duplicar · Retirar.
 */
import { Icon } from "../../../ui/icons.jsx";
import { FieldsForm } from "../fields/FieldsForm";
import { useFieldCtx, useFieldEditor } from "../fields/edit";
import { useBuilder } from "../state/store";
import { pageTitle } from "../state/tree";
import { Crumb, EditorShell, ItemFooter, editorBody, useItemNav } from "./EditorBits";

interface Props {
  itemId: string;
  onFlash: (itemId: string) => void;
  onSeo: () => void;
}

function Fields({ itemId }: { itemId: string }) {
  const { state, manifest } = useBuilder();
  const item = Object.values(state.work.items).flat().find((it) => it.id === itemId);
  const def = manifest?.specials?.[item?.specialType ?? ""];
  const target = { entity: "item", id: itemId } as const;
  const ctx = useFieldCtx(target);
  const onField = useFieldEditor(target);
  if (!def) return <p className="text-sm text-amber-700 dark:text-amber-300">Este especial já não existe no site. Só se pode retirar.</p>;
  return Object.keys(def.fields).length > 0 ? (
    <FieldsForm fields={def.fields} values={item?.specialData} onField={onField} ctx={ctx} />
  ) : (
    <p className="text-sm text-zinc-500">Esta secção é desenhada no site e não tem campos.</p>
  );
}

export function SpecialEditor({ itemId, onFlash, onSeo }: Props) {
  const { state, manifest, lang, select } = useBuilder();
  const work = state.work;
  const pageId = Object.entries(work.items).find(([, l]) => l.some((it) => it.id === itemId))?.[0] ?? null;
  const page = work.pages.find((p) => p.id === pageId) ?? null;
  const items = (pageId && work.items[pageId]) || [];
  const item = items.find((it) => it.id === itemId) ?? null;
  const def = manifest?.specials?.[item?.specialType ?? ""];
  const name = def?.label ?? item?.specialType ?? "Especial";

  const nav = useItemNav(items, itemId);

  if (!item || !page) return null;
  const title = pageTitle(page, lang.defaultLanguage);
  return (
    <EditorShell>
      <Crumb
        backText={title}
        backLabel={`Voltar à página ${title}`}
        onBack={() => select({ libId: null, sel: { kind: "page", id: page.id } })}
        here={name}
        nav={nav}
        seo={{ pageId: page.id, onOpen: onSeo }}
      />
      <div className={editorBody}>
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden="true" className="flex h-[72px] w-24 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
            <Icon name="layers" className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{name}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{def?.desc || "Especial deste site"}</p>
          </div>
        </div>
        <Fields key={item.id} itemId={item.id} />
      </div>
      <ItemFooter pageId={page.id} item={item} name={name} uses={0} duplicateLabel="Duplicar" onFlash={onFlash} />
    </EditorShell>
  );
}
