/**
 * Os campos de um objeto de valores (`v` de um componente, uma linha de lista, `specialData`): um
 * `FieldRenderer` por campo, pela ordem do catálogo, e os campos `seo` agrupados no fim numa caixa
 * "Google (SEO)". `ctx.path` é o prefixo do objeto; cada campo ganha o seu (`childCtx`).
 */
import { Icon } from "../../../ui/icons.jsx";
import type { FieldSpec, FieldSpecs } from "../state/types";
import { childCtx, isObj } from "./ctx";
import { FieldRenderer } from "./FieldRenderer";
import type { FieldChange, FieldCtx } from "./types";

interface Props {
  fields: FieldSpecs;
  values: unknown;
  /** Um campo mudou. `key` = o `path` do campo (junção no desfazer); sem `key`, gesto discreto. */
  onField: (name: string, value: unknown, key?: string) => void;
  /** Contexto base; `path` é o prefixo dos valores. */
  ctx: FieldCtx;
}

export function FieldsForm({ fields, values, onField, ctx }: Props) {
  const v = isObj(values) ? values : {};
  const entries = Object.entries(fields);
  const render = ([name, def]: [string, FieldSpec]) => {
    const change: FieldChange = (value, key) => onField(name, value, key);
    return <FieldRenderer key={name} def={def} value={v[name]} onChange={change} ctx={childCtx(ctx, name)} />;
  };
  const plain = entries.filter(([, d]) => !d.seo);
  const seo = entries.filter(([, d]) => !!d.seo);
  return (
    <div className="flex flex-col gap-4">
      {plain.map(render)}
      {seo.length > 0 ? (
        <section
          aria-label="Google (SEO)"
          className="flex flex-col gap-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-600 dark:bg-zinc-800/40"
        >
          <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <Icon name="search" className="h-3.5 w-3.5" />
            Google (SEO)
          </h4>
          {seo.map(render)}
        </section>
      ) : null}
    </div>
  );
}
