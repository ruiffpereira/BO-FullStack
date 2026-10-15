/**
 * Uma linha de componente no editor de bloco/parte (F14). Fechada: pega, miniatura, tipo, estilo,
 * selo H1/H2 nos títulos, "Toda a largura/Coluna N", "Falta EN" e o resumo. Aberta: **Estilo**
 * (cartões, com o nome do manifest), **Onde fica** (se há mais de uma coluna), os campos
 * (`FieldsForm`, F13), Duplicar e Apagar (com confirmação).
 *
 * Estilos e colunas vêm do manifest e da disposição do bloco — nada fixo aqui.
 */
import { useState } from "react";
import { quickToast } from "../state/notify";
import { Badge, Button } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { FieldsForm } from "../fields/FieldsForm";
import { useFieldCtx, useFieldEditor, type FieldTarget } from "../fields/edit";
import { buildDuplicateComp, compSummary } from "../state/blocks";
import type { Comp, Holder } from "../state/ops";
import { useBuilder } from "../state/store";
import type { CatalogComponent } from "../state/types";
import { BlockThumb } from "./BlockThumb";
import { Confirm, EditorFooter, Lbl, Seg, dangerBtn } from "./EditorBits";
import { DragHandle, type HandleProps } from "./SortableTree";

interface Props {
  holder: Holder;
  comp: Comp;
  layout: number;
  handle: HandleProps | null;
  open: boolean;
  onToggle: () => void;
  /** Línguas em falta neste componente. */
  locales: readonly string[];
  /** Depois de duplicar (para abrir a cópia). */
  onDuplicated: (compId: string) => void;
}

function Body({ holder, comp, layout, def, onDuplicated }: { holder: Holder; comp: Comp; layout: number; def?: CatalogComponent; onDuplicated: (id: string) => void }) {
  const { state, manifest, apply } = useBuilder();
  const target: FieldTarget = { entity: holder.kind, id: holder.id, compId: comp.id } as FieldTarget;
  const ctx = useFieldCtx(target);
  const onField = useFieldEditor(target);
  const [confirm, setConfirm] = useState(false);
  const styles = manifest?.styles?.[comp.type] ?? [];
  const cols = [{ id: "all", label: "Toda a largura" }, ...Array.from({ length: layout }, (_, k) => ({ id: String(k + 1), label: `Coluna ${k + 1}` }))];

  const duplicate = () => {
    const op = buildDuplicateComp(state.work, holder, comp.id);
    if (!op) return;
    apply(op);
    onDuplicated(op.comp.id);
    quickToast("Criada uma cópia logo a seguir.");
  };

  return (
    <div className="flex flex-col gap-4 border-t border-zinc-200 p-3 dark:border-zinc-800">
      {styles.length > 1 && (
        <div>
          <Lbl hint="Os estilos que existem no site">Estilo</Lbl>
          <div role="group" aria-label="Estilo" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {styles.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={comp.style === s.id}
                onClick={() => apply({ type: "patchComp", holder, compId: comp.id, patch: { style: s.id } })}
                className={`flex min-h-16 items-center gap-2 rounded-xl border p-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  comp.style === s.id ? "border-accent bg-accent/10 font-medium text-accent" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                <BlockThumb block={{ layout: 1, bg: "claro", comps: [{ type: comp.type, col: "all" }] }} />
                <span className="min-w-0 break-words">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {layout > 1 && (
        <div>
          <Lbl>Onde fica</Lbl>
          <Seg
            label="Onde fica"
            value={String(comp.col ?? "all")}
            options={cols}
            onChange={(id) => apply({ type: "patchComp", holder, compId: comp.id, patch: { col: id === "all" ? "all" : Number(id) } })}
          />
        </div>
      )}
      {def ? (
        def.fields && Object.keys(def.fields).length > 0 ? (
          <FieldsForm fields={def.fields} values={comp.v} onField={onField} ctx={ctx} />
        ) : (
          <p className="text-sm text-zinc-500">Esta peça é desenhada no site e não tem campos. Pode mudá-la de sítio ou retirá-la.</p>
        )
      ) : (
        <p className="text-sm text-amber-700 dark:text-amber-300">Este tipo de componente já não existe no catálogo. Só se pode apagar.</p>
      )}
      <EditorFooter>
        {confirm ? (
          <Confirm text="Apagar este componente?" action="Apagar" onYes={() => apply({ type: "removeComp", holder, compId: comp.id })} onNo={() => setConfirm(false)} />
        ) : (
          <>
            {def && <Button variant="outline" size="sm" className="min-h-10" icon="copy" onClick={duplicate}>Duplicar</Button>}
            <span className="flex-1" />
            <Button variant="outline" size="sm" className={`min-h-10 ${dangerBtn}`} icon="trash" onClick={() => setConfirm(true)}>Apagar componente</Button>
          </>
        )}
      </EditorFooter>
    </div>
  );
}

export function CompRow({ holder, comp, layout, handle, open, onToggle, locales, onDuplicated }: Props) {
  const { catalog, manifest, lang } = useBuilder();
  const def = catalog?.components.find((c) => c.type === comp.type);
  const styles = manifest?.styles?.[comp.type] ?? [];
  const styleName = styles.length > 1 ? styles.find((s) => s.id === comp.style)?.label ?? comp.style : null;
  const level = comp.type === "titulo" ? String((comp.v as { level?: string } | undefined)?.level ?? def?.fields.level?.default ?? "h2").toUpperCase() : null;
  const label = def?.label ?? comp.type;
  const titleId = `cp-${comp.id}`;
  const summary = compSummary(comp, catalog, lang.defaultLanguage);

  return (
    <div className={`rounded-xl border bg-white dark:bg-zinc-900 ${open ? "border-accent/50" : "border-zinc-200 dark:border-zinc-700"}`}>
      <div className="flex items-stretch">
        <DragHandle handle={handle} describedBy={titleId} className="self-center" />
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pr-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <BlockThumb block={{ layout: 1, bg: "claro", comps: [{ type: comp.type, col: "all" }] }} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <b id={titleId} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</b>
              {styleName && <span className="text-xs text-zinc-500 dark:text-zinc-400">{styleName}</span>}
              {level && <Badge tone="blue">{level}</Badge>}
              {layout > 1 && <Badge>{comp.col === "all" || comp.col === undefined ? "Toda a largura" : `Coluna ${comp.col}`}</Badge>}
              {locales.map((l) => <Badge key={l} tone="amber">Falta {l.toUpperCase()}</Badge>)}
            </span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{summary || "Por preencher"}</span>
          </span>
          <Icon name={open ? "chevronDown" : "chevronRight"} className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>
      </div>
      {open && <Body holder={holder} comp={comp} layout={layout} def={def} onDuplicated={onDuplicated} />}
    </div>
  );
}
