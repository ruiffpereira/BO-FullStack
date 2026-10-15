/** `choice`: botões segmentados (≤ 5 opções) ou `Select`. As opções vêm do catálogo ou do manifest (ícones). */
import { useId } from "react";
import { Select } from "../../../ui/ui.jsx";
import type { FieldSpec } from "../state/types";
import { issuesAt } from "./ctx";
import { fieldLabel, optionLabel } from "./labels";
import { FieldShell } from "./shared";
import type { FieldChange, FieldCtx } from "./types";

interface Props {
  def: FieldSpec;
  value: unknown;
  onChange: FieldChange;
  ctx: FieldCtx;
}

export const SEGMENTED_MAX = 5;

export function ChoiceField({ def, value, onChange, ctx }: Props) {
  const uid = useId();
  const label = fieldLabel(ctx.name, def);
  const options: { id: string; label: string }[] =
    def.optionsFrom === "icons" ? ctx.icons : (def.options ?? []).map((o) => ({ id: o, label: optionLabel(o) }));
  const current = typeof value === "string" ? value : typeof def.default === "string" ? def.default : "";
  const issues = issuesAt(ctx);

  if (options.length > 0 && options.length <= SEGMENTED_MAX) {
    return (
      <FieldShell label={label} labelId={`${uid}-l`} issues={issues}>
        <div role="group" aria-labelledby={`${uid}-l`} className="flex flex-wrap gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/60">
          {options.map((o) => {
            const on = o.id === current;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                disabled={ctx.disabled}
                onClick={() => !on && onChange(o.id)}
                className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60 ${
                  on ? "bg-white text-accent shadow-sm dark:bg-zinc-900" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </FieldShell>
    );
  }

  return (
    <FieldShell label={label} htmlFor={`${uid}-f`} issues={issues}>
      <Select id={`${uid}-f`} value={current} disabled={ctx.disabled} onChange={(e) => onChange(e.target.value)} className="min-h-10">
        {current === "" ? <option value="">Escolher…</option> : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}
