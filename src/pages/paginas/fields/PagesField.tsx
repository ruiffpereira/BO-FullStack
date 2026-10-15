/** `pages`: lista de páginas com caixas de seleção e máximo; os rascunhos ficam assinalados. */
import { useId } from "react";
import type { FieldSpec } from "../state/types";
import { issuesUnder } from "./ctx";
import { fieldLabel } from "./labels";
import { FieldShell, Side } from "./shared";
import type { FieldChange, FieldCtx } from "./types";

interface Props {
  def: FieldSpec;
  value: unknown;
  onChange: FieldChange;
  ctx: FieldCtx;
}

export function PagesField({ def, value, onChange, ctx }: Props) {
  const uid = useId();
  const label = fieldLabel(ctx.name, def);
  const chosen: string[] = Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
  const max = def.max;
  const full = max !== undefined && chosen.length >= max;
  // A home não é um cartão; só aparece se já estiver escolhida.
  const list = ctx.pages.filter((p) => !p.isHome || chosen.includes(p.id));
  const gone = chosen.filter((id) => !ctx.pages.some((p) => p.id === id));

  const toggle = (id: string, on: boolean) => onChange(on ? [...chosen, id] : chosen.filter((x) => x !== id));

  return (
    <FieldShell
      label={label}
      labelId={`${uid}-l`}
      right={<Side warn={def.min !== undefined && chosen.length < def.min}>{max !== undefined ? `${chosen.length} de ${max}` : chosen.length}</Side>}
      issues={issuesUnder(ctx)}
    >
      <div role="group" aria-labelledby={`${uid}-l`} className="flex flex-col gap-1.5">
        {list.map((p) => {
          const on = chosen.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 ${!on && full ? "opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-accent"
                checked={on}
                disabled={ctx.disabled || (!on && full)}
                onChange={(e) => toggle(p.id, e.target.checked)}
              />
              <span className="min-w-0 flex-1 text-sm text-zinc-800 dark:text-zinc-100">
                <span className="block truncate">{p.title}</span>
                <small className="block truncate text-[11.5px] text-zinc-400">{p.status === "draft" ? "Rascunho · só aparece quando for publicada" : p.path}</small>
              </span>
            </label>
          );
        })}
        {gone.map((id) => (
          <label key={id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-500/50 dark:text-red-300">
            <input type="checkbox" className="h-4 w-4 accent-accent" checked disabled={ctx.disabled} onChange={() => toggle(id, false)} />
            Página que já não existe
          </label>
        ))}
        {list.length === 0 && gone.length === 0 ? <p className="text-sm text-zinc-400">Ainda não há páginas para escolher.</p> : null}
      </div>
    </FieldShell>
  );
}
