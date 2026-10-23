import type { ReactNode } from "react";

/** Classe de um botão do selector de período (também usada pelo botão «Personalizado» do Financeiro). */
export const periodBtnClass = (active: boolean, extra = "") =>
  `${extra} px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
    active ? "bg-accent text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
  }`.trim();

/**
 * Selector de período em segmentos («Hoje · 7 dias · …»), partilhado pelas Estatísticas e pelo Financeiro.
 * `children` entra no fim da mesma barra (ex.: o botão «Personalizado» com o seu separador).
 */
export function PeriodSelector<K extends string>({
  presets,
  value,
  onChange,
  children,
}: {
  presets: { key: K; label: string }[];
  value: string;
  onChange: (key: K) => void;
  children?: ReactNode;
}) {
  return (
    <div className="inline-flex flex-wrap items-center rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-white dark:bg-zinc-900">
      {presets.map((p) => (
        <button key={p.key} type="button" aria-pressed={value === p.key} onClick={() => onChange(p.key)} className={periodBtnClass(value === p.key)}>
          {p.label}
        </button>
      ))}
      {children}
    </div>
  );
}
