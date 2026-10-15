/**
 * `list`: itens que abrem e fecham, ordenáveis (`SortableList`), "Adicionar …" e remover — respeita
 * `min`/`max`. Um nível só (§3.1): os campos de cada item vêm de `def.of`. Cada item tem um `_id`
 * estável, e é ele que entra no `path` (`items.k3f9.text`), para ordenar sem perder traduções nem issues.
 */
import { useEffect, useState } from "react";
import { Badge, Button } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { defaultValues } from "../state/blocks";
import { newShortId } from "../state/ids";
import { missingLocales } from "../state/missing";
import type { FieldSpec } from "../state/types";
import { DragHandle } from "../components/SortableTree";
import { SortableList } from "../components/SortableList";
import { isObj, issuesAt, issuesUnder, joinPath } from "./ctx";
import { FieldsForm } from "./FieldsForm";
import { addLabel, fieldLabel } from "./labels";
import { FieldShell, Side } from "./shared";
import type { FieldChange, FieldCtx } from "./types";

interface Props {
  def: FieldSpec;
  value: unknown;
  onChange: FieldChange;
  ctx: FieldCtx;
}

type Row = Record<string, unknown>;
const rowId = (r: Row, i: number): string => (typeof r._id === "string" && r._id ? r._id : `#${i}`);

/** O nome de uma linha: o 1.º campo de texto preenchido (na base, ou na 1.ª língua que tenha). */
function rowName(of: Record<string, FieldSpec>, row: Row, base: string): string {
  for (const [k, spec] of Object.entries(of)) {
    if (spec.type !== "text") continue;
    const v = row[k];
    let t = "";
    if (typeof v === "string") t = v;
    else if (isObj(v)) {
      const first = Object.values(v).find((x) => typeof x === "string" && x.trim());
      t = typeof v[base] === "string" && (v[base] as string).trim() ? (v[base] as string) : ((first as string | undefined) ?? "");
    }
    if (t.trim()) return t.trim();
  }
  return "";
}

export function ListField({ def, value, onChange, ctx }: Props) {
  const label = fieldLabel(ctx.name, def);
  const of = def.of ?? {};
  const rows: Row[] = Array.isArray(value) ? value.filter(isObj) : [];
  const ids = rows.map(rowId);
  const min = def.min ?? 0;
  const max = def.max;
  const canAdd = max === undefined || rows.length < max;
  const canRemove = rows.length > min;

  const withIssues = new Set(ids.filter((id) => issuesUnder({ ...ctx, path: joinPath(ctx.path, id) }).length > 0));
  const [open, setOpen] = useState<Set<string>>(() => new Set(withIssues));
  // Um 422 novo abre os itens onde há problemas.
  const issueKey = [...withIssues].join("|");
  useEffect(() => {
    if (!issueKey) return;
    setOpen((o) => new Set([...o, ...issueKey.split("|")]));
  }, [issueKey]);

  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Linhas sem `_id` (não devia acontecer) ganham um ao serem mexidas.
  const withIds = (list: Row[]): Row[] => list.map((r) => (typeof r._id === "string" && r._id ? r : { ...r, _id: newShortId() }));

  const add = () => {
    const row: Row = { _id: newShortId(), ...defaultValues(of) };
    setOpen((o) => new Set([...o, row._id as string]));
    onChange([...withIds(rows), row]);
  };
  const remove = (id: string) => onChange(withIds(rows).filter((_, i) => ids[i] !== id));
  const edit = (id: string, name: string, v: unknown, key?: string) => {
    const next = rows.map((r, i) => {
      if (ids[i] !== id) return r;
      const copy: Row = { ...r };
      if (v === undefined) delete copy[name];
      else copy[name] = v;
      return copy;
    });
    onChange(next, key);
  };
  const move = (from: string, to: string, position: "before" | "after") => {
    const list = withIds(rows);
    const a = ids.indexOf(from);
    const b = ids.indexOf(to);
    if (a < 0 || b < 0 || a === b) return;
    const [item] = list.splice(a, 1);
    const target = list.findIndex((_, i) => i === (b > a ? b - 1 : b));
    list.splice(target + (position === "after" ? 1 : 0), 0, item);
    onChange(list);
  };

  const countText = `${rows.length}${max !== undefined ? ` de ${max}` : ""}`;
  return (
    <FieldShell label={label} right={<Side warn={rows.length < min}>{countText}</Side>} issues={issuesAt(ctx)}>
      {rows.length > 0 ? (
        <SortableList<Row>
          items={rows}
          getId={(r) => ids[rows.indexOf(r)]}
          getLabel={(r) => rowName(of, r, ctx.base) || `Item ${rows.indexOf(r) + 1}`}
          onMove={move}
          disabled={ctx.disabled}
          className="flex flex-col gap-2"
          renderItem={(row, rc) => {
            const id = ids[rows.indexOf(row)];
            const name = rowName(of, row, ctx.base);
            const shown = name || `Item ${rc.index + 1}`;
            const rowCtx: FieldCtx = { ...ctx, path: joinPath(ctx.path, id) };
            const isOpen = open.has(id);
            const bad = withIssues.has(id);
            const miss = Object.entries(of).some(([k, spec]) => missingLocales(row[k], spec, ctx.languages, ctx.base).length > 0);
            const bodyId = `lb-${id}`;
            return (
              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-center gap-0.5 px-1 py-0.5">
                  <DragHandle handle={rc.handle} />
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    onClick={() => toggle(id)}
                    className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left text-sm font-medium text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-zinc-100"
                  >
                    <Icon name="chevronRight" className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    <span className="truncate">{name || <span className="font-normal text-zinc-400">Sem texto</span>}</span>
                    {miss ? <Badge tone="amber">Por traduzir</Badge> : null}
                    {bad ? <Badge tone="red">Problema</Badge> : null}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${shown}`}
                    title={canRemove ? "Remover" : `Tem de ficar pelo menos ${min}`}
                    disabled={ctx.disabled || !canRemove}
                    onClick={() => remove(id)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                </div>
                {isOpen ? (
                  <div id={bodyId} className="border-t border-zinc-200 p-3 dark:border-zinc-700">
                    <FieldsForm fields={of} values={row} ctx={rowCtx} onField={(n, v, key) => edit(id, n, v, key)} />
                  </div>
                ) : null}
              </div>
            );
          }}
        />
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        icon="plus"
        className={`min-h-10 ${rows.length ? "mt-2" : ""}`}
        disabled={ctx.disabled || !canAdd}
        onClick={add}
      >
        {addLabel(ctx.name)}
      </Button>
    </FieldShell>
  );
}
