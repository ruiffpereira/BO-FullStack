/**
 * `text` e `md`. Com `i18n`: uma caixa por língua do tenant (base primeiro), selo da língua, amarelo +
 * "Por traduzir" quando falta, contador "N por traduzir". Sem `i18n`: uma caixa, "Igual em todas as
 * línguas". O `md` leva a barra Negrito · Itálico · Lista, que actua na caixa que tem o foco.
 */
import { useEffect, useId, useRef } from "react";
import { Input } from "../../../ui/ui.jsx";
import { missingLocales } from "../state/missing";
import { isObj, issuesAt, issuesUnder, localeIssues } from "./ctx";
import { fieldLabel } from "./labels";
import { applyMd, type MdAction } from "./md";
import { boxCls, errCls, FieldShell, LangBadge, Issues, missCls, Side } from "./shared";
import type { FieldCtx, FieldChange } from "./types";
import type { FieldSpec } from "../state/types";

interface Props {
  def: FieldSpec;
  value: unknown;
  onChange: FieldChange;
  ctx: FieldCtx;
}

type Box = HTMLInputElement | HTMLTextAreaElement;

const MD_BUTTONS: { action: MdAction; label: string; title: string; face: JSX.Element | string }[] = [
  { action: "bold", label: "Negrito", title: "Negrito", face: <b>N</b> },
  { action: "italic", label: "Itálico", title: "Itálico", face: <i>I</i> },
  { action: "list", label: "Lista", title: "Lista", face: "• Lista" },
];

function MdBar({ onAction, disabled }: { onAction: (a: MdAction) => void; disabled?: boolean }) {
  return (
    <div role="toolbar" aria-label="Formatação" className="mb-1.5 flex gap-1">
      {MD_BUTTONS.map((b) => (
        <button
          key={b.action}
          type="button"
          title={b.title}
          aria-label={b.label}
          disabled={disabled}
          // Sem roubar o foco à caixa onde se está a escrever.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction(b.action)}
          className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-transparent px-2.5 text-[13px] text-zinc-600 hover:border-zinc-200 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {b.face}
        </button>
      ))}
    </div>
  );
}

function Counter({ len, max }: { len: number; max?: number }) {
  if (!max || len < max * 0.8) return null;
  return <span className={`mt-0.5 block text-right text-[11px] ${len > max ? "font-semibold text-red-600 dark:text-red-400" : "text-zinc-400"}`}>{len}/{max}</span>;
}

export function TextField({ def, value, onChange, ctx }: Props) {
  const isMd = def.type === "md";
  const i18n = !!def.i18n;
  const uid = useId();
  const label = fieldLabel(ctx.name, def);
  const max = def.max ?? (isMd ? ctx.defaults?.mdMax : ctx.defaults?.textMax);
  const all = issuesUnder(ctx);
  const own = issuesAt(ctx);

  // Caixa com foco (para a barra do md) e selecção a repor depois de reescrever.
  const focused = useRef<{ el: Box; lang: string | null } | null>(null);
  const boxes = useRef(new Map<string | null, Box>());
  const reselect = useRef<{ el: Box; start: number; end: number } | null>(null);
  useEffect(() => {
    const r = reselect.current;
    if (!r) return;
    reselect.current = null;
    r.el.focus();
    r.el.setSelectionRange(r.start, r.end);
  });

  const map: Record<string, string> = i18n && isObj(value) ? (value as Record<string, string>) : {};
  const single = !i18n ? (typeof value === "string" ? value : "") : "";
  const missing = i18n ? missingLocales(value, def, ctx.languages, ctx.base) : [];
  const multi = ctx.languages.length > 1;

  const write = (lang: string | null, text: string) => {
    if (lang === null) return onChange(text, ctx.path);
    const next = { ...map };
    if (text === "") delete next[lang];
    else next[lang] = text;
    onChange(next, ctx.path);
  };

  const onBar = (action: MdAction) => {
    const f = focused.current ?? (() => {
      const el = boxes.current.get(i18n ? ctx.base : null);
      return el ? { el, lang: i18n ? ctx.base : null } : null;
    })();
    if (!f) return;
    const r = applyMd(f.el.value, f.el.selectionStart ?? f.el.value.length, f.el.selectionEnd ?? f.el.value.length, action);
    reselect.current = { el: f.el, start: r.start, end: r.end };
    write(f.lang, r.text);
  };

  const box = (lang: string | null, text: string, miss: boolean, aria: string, id?: string) => {
    const common = {
      id,
      "data-fp": ctx.path,
      "data-fl": lang ?? "",
      "aria-label": id ? undefined : aria,
      value: text,
      disabled: ctx.disabled,
      placeholder: miss ? "Por traduzir" : "",
      "aria-invalid": own.length > 0 || undefined,
      onFocus: (e: { currentTarget: Box }) => { focused.current = { el: e.currentTarget, lang }; },
      onChange: (e: { target: Box }) => write(lang, e.target.value),
    };
    const cls = `${miss ? missCls : ""} ${own.length && lang === null ? errCls : ""}`;
    if (!isMd && !def.multiline) return <Input {...common} className={`min-h-10 ${cls}`} />;
    const ref = (el: Box | null) => { if (el) boxes.current.set(lang, el); else boxes.current.delete(lang); };
    return <textarea ref={ref} rows={3} {...common} className={`${boxCls} ${cls} resize-y`} />;
  };

  if (!i18n) {
    return (
      <FieldShell label={label} htmlFor={`${uid}-f`} right={<Side>Igual em todas as línguas</Side>} issues={own}>
        {isMd ? <MdBar onAction={onBar} disabled={ctx.disabled} /> : null}
        {box(null, single, false, label, `${uid}-f`)}
        <Counter len={single.length} max={max} />
      </FieldShell>
    );
  }

  const labelId = `${uid}-l`;
  return (
    <FieldShell
      label={label}
      labelId={labelId}
      right={
        multi ? (
          <Side warn={missing.length > 0}>{missing.length ? `${missing.length} por traduzir` : "Traduzido"}</Side>
        ) : null
      }
      issues={own.filter((i) => !i.locale)}
    >
      <div role="group" aria-labelledby={labelId}>
        {isMd ? <MdBar onAction={onBar} disabled={ctx.disabled} /> : null}
        <div className="flex flex-col gap-2">
          {ctx.languages.map((lang) => {
            const miss = missing.includes(lang);
            const text = typeof map[lang] === "string" ? map[lang] : "";
            const li = localeIssues(all, lang);
            return (
              <div key={lang} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                {multi ? <LangBadge lang={lang} missing={miss} /> : null}
                <div className="min-w-0 flex-1">
                  {box(lang, text, miss, `${label} (${lang.toUpperCase()})`)}
                  <Counter len={text.length} max={max} />
                  <Issues list={li} className="mt-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </FieldShell>
  );
}
