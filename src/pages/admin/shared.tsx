import { useState } from "react";
import { Icon } from "../../ui/icons.jsx";

// ─── Shared helpers ───────────────────────────────────────────────────────────
export function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[34rem]">{children}</table>
      </div>
    </div>
  );
}
export function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td
        colSpan={cols}
        className="px-4 py-8 text-center text-zinc-400 text-sm"
      >
        Nenhum registo encontrado.
      </td>
    </tr>
  );
}
export function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800/50">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3.5">
              <div
                className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"
                style={{ width: `${60 + j * 10}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
export function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 font-mono text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
    >
      {value.slice(0, 8)}…
      <Icon name={copied ? "check" : "image"} className="w-3 h-3" />
    </button>
  );
}

// ─── Tokens tab ───────────────────────────────────────────────────────────────
export function formatDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("pt-PT", { dateStyle: "medium" })
}

export const fmtDateTime = (s: string) => new Date(s).toLocaleString("pt-PT");
