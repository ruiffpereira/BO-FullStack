import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAnchoredMenu } from "./useAnchoredMenu";
import { Icon } from "../ui/icons.jsx";

// ----------------------------------------------------------------------------
// Seletor de hora compacto (popover, sem control nativo do dispositivo).
// Grelha de 15 min (06:00–23:45) + o valor atual, sempre incluído. `before`/`after`
// (HH:MM) restringem as opções (ex.: fecho > abertura). Posicionamento via
// useAnchoredMenu (portal + flip-up) — não fica cortado dentro de modais.
// ----------------------------------------------------------------------------

const BASE_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++)
    for (const m of [0, 15, 30, 45]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  return out;
})();

const timeOptions = (value?: string | null) => {
  const set = new Set(BASE_TIMES);
  if (value) set.add(value);
  return [...set].sort();
};

export function TimeField({
  value,
  onChange,
  before,
  after,
  tone = "default",
}: {
  value: string;
  onChange: (v: string) => void;
  before?: string;
  after?: string;
  tone?: "default" | "lunch";
}) {
  const [open, setOpen] = useState(false);
  const opts = timeOptions(value).filter(
    (t) => (before == null || t < before) && (after == null || t > after),
  );
  const activeIndex = opts.indexOf(value);
  const { anchorRef, menuRef, style } = useAnchoredMenu<HTMLButtonElement>(open, [open, opts.length], activeIndex);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toneCls =
    tone === "lunch"
      ? "border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 hover:border-amber-400"
      : "border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 hover:border-accent";

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg border pl-2.5 pr-2 py-1.5 text-[13px] font-medium tabular-nums transition ${toneCls}`}
      >
        {value || "--:--"}
        <Icon name="chevronDown" className={`w-3.5 h-3.5 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ ...style, width: "6.5rem" }}
            className="max-h-52 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-1 animate-[pop_.12s_ease]"
          >
            {opts.map((t, i) => (
              <button
                key={t}
                type="button"
                data-idx={i}
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] tabular-nums transition ${
                  t === value
                    ? "bg-accent text-white font-medium"
                    : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
