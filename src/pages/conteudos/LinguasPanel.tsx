import { useState, useEffect, useRef } from "react";
import { Icon } from "../../ui/icons.jsx";
import { GuardButton } from "../../components/GuardButton";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import { LangFlag } from "../../utils/langFlag";

// ─── Language combobox ────────────────────────────────────────────────────────

function LangCombobox({
  available,
  selected,
  onAdd,
  disabled,
}: {
  available: { code: string; name: string }[];
  selected: string[];
  onAdd: (code: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { readOnly: writeLocked, message: writeMessage } = useWriteGuard();

  const options = available.filter((l) => !selected.includes(l.code));
  const filtered = options.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (options.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled || writeLocked}
        title={writeLocked ? writeMessage : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 text-sm text-zinc-500 hover:border-accent hover:text-accent transition disabled:opacity-50"
      >
        <Icon name="plus" className="w-4 h-4" />
        Adicionar língua
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar…"
              className="w-full px-2 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 rounded-lg outline-none border-0 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-400">
                Nenhuma língua encontrada
              </p>
            )}
            {filtered.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  onAdd(lang.code);
                  setOpen(false);
                  setSearch("");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left"
              >
                <LangFlag
                  code={lang.code}
                  className="h-4 w-auto rounded-sm shadow-sm shrink-0"
                />
                {lang.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Línguas panel (tab) ──────────────────────────────────────────────────────

export function LinguasPanel({
  available,
  selected,
  defaultLang,
  onToggle,
  onSetDefault,
  onSave,
  isSaving,
  hasChanges,
}: {
  available: { code: string; name: string; flag: string }[];
  selected: string[];
  defaultLang: string;
  onToggle: (code: string) => void;
  onSetDefault: (code: string) => void;
  onSave: () => void;
  isSaving: boolean;
  hasChanges: boolean;
}) {
  return (
    <div className="max-w-lg space-y-8 py-2">
      {/* Línguas activas */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Línguas activas
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Línguas disponíveis para traduções de conteúdo
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {selected.map((code) => {
            const lang = available.find((l) => l.code === code);
            const isDefault = code === defaultLang;
            return (
              <div
                key={code}
                className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-sm"
              >
                <LangFlag
                  code={code}
                  className="h-4 w-auto rounded-sm shadow-sm"
                />
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  {lang?.name ?? code}
                </span>
                {isDefault ? (
                  <span
                    className="ml-0.5 text-xs text-amber-500 select-none"
                    title="Língua padrão"
                  >
                    ★
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => onToggle(code)}
                    title={`Remover ${lang?.name ?? code}`}
                    className="ml-0.5 p-0.5 rounded text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                  >
                    <Icon name="x" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          <LangCombobox
            available={available}
            selected={selected}
            onAdd={(code) => onToggle(code)}
            disabled={isSaving}
          />
        </div>
        <p className="text-[11px] text-zinc-400">
          A língua padrão <span className="text-amber-500">★</span> não pode ser
          removida sem primeiro definir outra como padrão.
        </p>
      </div>

      {/* Língua padrão */}
      {selected.length > 1 && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Língua padrão
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Usada quando não existe tradução disponível noutra língua
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map((code) => {
              const lang = available.find((l) => l.code === code);
              const isDefault = code === defaultLang;
              return (
                <button
                  key={code}
                  type="button"
                  disabled={isSaving}
                  onClick={() => onSetDefault(code)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition select-none ${
                    isDefault
                      ? "border-accent bg-accent text-white font-semibold shadow-sm cursor-default"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-accent/50"
                  }`}
                >
                  <LangFlag
                    code={code}
                    className={`h-4 w-auto rounded-sm ${isDefault ? "shadow-sm" : ""}`}
                  />
                  <span>{lang?.name ?? code}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <GuardButton onClick={onSave} disabled={!hasChanges} isLoading={isSaving}>
          Guardar
        </GuardButton>
      </div>
    </div>
  );
}
