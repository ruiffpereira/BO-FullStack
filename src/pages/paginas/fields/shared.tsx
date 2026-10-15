/**
 * Peças comuns dos campos: o invólucro (rótulo + extras à direita + dica + issues), a lista de issues
 * do `422`, o selo "por traduzir" e as classes das caixas. Primitivas de `ui.jsx` onde existem.
 */
import type { ReactNode } from "react";
import type { Issue } from "../state/types";

/** Caixa de texto — as mesmas classes do `Input` de `ui.jsx` (que não tem versão multilinha). */
export const boxCls =
  "w-full min-h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition disabled:opacity-60";
/** Falta tradução / ficheiro: tracejado e amarelo. */
export const missCls = "!border-dashed !border-amber-300 !bg-amber-50/70 dark:!border-amber-500/40 dark:!bg-amber-500/10 placeholder:!text-amber-700 dark:placeholder:!text-amber-300";
/** Há um issue do servidor neste campo. */
export const errCls = "!border-red-400 dark:!border-red-500/70";

export const warnText = "text-amber-700 dark:text-amber-300";

/** Selo da língua ("PT"). Amarelo quando falta traduzir. */
export function LangBadge({ lang, missing }: { lang: string; missing?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-md border px-1.5 text-[11px] font-bold uppercase tracking-wide sm:mt-1.5 ${
        missing
          ? "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
          : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {lang}
    </span>
  );
}

export function Issues({ list, className = "" }: { list: readonly Issue[]; className?: string }) {
  if (!list.length) return null;
  return (
    <ul className={`space-y-1 ${className}`}>
      {list.map((i, k) => (
        <li key={`${i.code}-${i.path ?? ""}-${i.locale ?? ""}-${k}`} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {i.locale ? <span className="font-semibold uppercase">{i.locale} · </span> : null}
          {i.message}
        </li>
      ))}
    </ul>
  );
}

interface ShellProps {
  label: string;
  /** Liga o rótulo à caixa (campos de uma só caixa). */
  htmlFor?: string;
  /** Id do rótulo, para `aria-labelledby` nos campos de várias caixas. */
  labelId?: string;
  /** À direita do rótulo: "Igual em todas as línguas", "2 por traduzir", "3 de 12"… */
  right?: ReactNode;
  hint?: ReactNode;
  issues?: readonly Issue[];
  children: ReactNode;
  className?: string;
}

export function FieldShell({ label, htmlFor, labelId, right, hint, issues = [], children, className = "" }: ShellProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        {htmlFor ? (
          <label htmlFor={htmlFor} id={labelId} className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
        ) : (
          <span id={labelId} className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </span>
        )}
        {right}
      </div>
      {children}
      {hint ? <p className="mt-1 text-xs text-zinc-400">{hint}</p> : null}
      <Issues list={issues} className="mt-1.5" />
    </div>
  );
}

/** O texto pequeno à direita do rótulo. `warn` = amarelo (falta traduzir / carregar). */
export function Side({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return <span className={`whitespace-nowrap text-[11px] font-semibold ${warn ? warnText : "text-zinc-400"}`}>{children}</span>;
}
