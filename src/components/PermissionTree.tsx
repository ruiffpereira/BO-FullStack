import { useEffect, useRef, useState } from "react";
import { Tabs } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import {
  checkState,
  indexTree,
  setNodeLevel,
  subtreeOf,
  toggleNode,
  type CheckState,
  type GrantMap,
  type TeamLevel,
  type TreeNode,
} from "../lib/teamTree";

/** Motivo mostrado num nó que o plano do tenant não inclui (`available: false`). */
export const UNAVAILABLE_REASON = "O teu plano não inclui este módulo";

/** Caixa de três estados (marcado / parcial / vazio). O `indeterminate` só se define por JS. */
function TriCheckbox({
  state,
  label,
  disabled,
  onChange,
}: {
  state: CheckState;
  label: string;
  disabled?: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "partial";
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600 accent-[var(--accent-hex,#2A6FDB)] disabled:opacity-50"
      checked={state === "on"}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

/**
 * Editor de permissões em ÁRVORE (B41 fase 2b) — o catálogo vem da API (`GET /team/catalog`); a lógica de marcar,
 * parcial e níveis é pura e vive em `lib/teamTree.ts`. Cada nó: chevron (se tem filhos) · caixa de três estados ·
 * nome · `[Ver | Editar]` (só nós com os dois níveis; só-ver mostra "Só ver"; acção mostra só a caixa).
 * Os topos começam colapsados e mostram o estado ("2 de 4"). No telemóvel é uma lista vertical e o
 * `[Ver | Editar]` desce para uma linha própria, por isso nunca transborda.
 */
export function PermissionTree({
  tree,
  value,
  onChange,
  disabled,
}: {
  tree: TreeNode[];
  value: GrantMap;
  onChange: (next: GrantMap) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const idx = indexTree(tree);

  if (tree.length === 0) {
    return <p className="text-sm text-zinc-500">Não há permissões disponíveis para dar.</p>;
  }

  const toggleOpen = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderNode = (node: TreeNode, depth: number, parentAvailable: boolean) => {
    const key = node.key;
    const state = checkState(node, value);
    const own = value[key];
    const hasChildren = (node.children ?? []).length > 0;
    const expanded = open.has(key);
    const sel = subtreeOf(node).filter((n) => n.storable && n.available);
    const marked = sel.filter((n) => value[n.key] !== undefined).length;
    const unavailable = !node.available;
    const showReason = unavailable && parentAvailable;
    const disabledRow = disabled || unavailable || sel.length === 0;

    // Tecto do pai (um filho não-acção nunca fica acima do pai).
    const sp = idx.get(key)?.storableParent ?? null;
    const parentIsView = !!sp && value[sp] === "view";
    const bothLevels = node.levels.includes("view") && node.levels.includes("edit");

    let levelControl: JSX.Element | null = null;
    if (node.storable && !node.action && own && !unavailable) {
      if (bothLevels && !parentIsView) {
        levelControl = (
          <Tabs
            size="sm"
            tabs={[
              { id: "view", label: "Ver", ariaLabel: `${node.label}: só ver` },
              { id: "edit", label: "Editar", ariaLabel: `${node.label}: editar` },
            ]}
            value={own}
            onChange={(id: string) => !disabled && onChange(setNodeLevel(tree, key, id as TeamLevel, value))}
            className={`!w-auto ${disabled ? "opacity-60 pointer-events-none" : ""}`}
          />
        );
      } else {
        levelControl = (
          <span
            className="text-xs text-zinc-500"
            title={bothLevels && parentIsView ? "O item acima só permite ver." : undefined}
          >
            Só ver
          </span>
        );
      }
    }

    return (
      <li key={key} data-node={key}>
        <div
          className={`flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between py-2.5 pr-3 ${
            unavailable ? "opacity-60" : ""
          }`}
          style={{ paddingLeft: 12 + depth * 18 }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleOpen(key)}
                aria-expanded={expanded}
                aria-label={`${expanded ? "Fechar" : "Abrir"} ${node.label}`}
                className="h-5 w-5 shrink-0 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <Icon name={expanded ? "chevronDown" : "chevronRight"} className="w-4 h-4" />
              </button>
            ) : (
              <span className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <label className="flex items-center gap-2.5 min-w-0 text-sm font-medium text-zinc-800 dark:text-zinc-100 cursor-pointer">
              <TriCheckbox
                state={state}
                label={node.label}
                disabled={disabledRow}
                onChange={() => onChange(toggleNode(tree, key, value))}
              />
              <span className="truncate">{node.label}</span>
            </label>
            {hasChildren && !unavailable && sel.length > 1 && (
              <span className="text-xs text-zinc-400 whitespace-nowrap">
                {marked} de {sel.length}
              </span>
            )}
            {showReason && <span className="text-xs text-zinc-500">· {UNAVAILABLE_REASON}</span>}
          </div>
          {levelControl && <div className="pl-[30px] sm:pl-0 shrink-0">{levelControl}</div>}
        </div>
        {hasChildren && expanded && (
          <ul className="border-l border-zinc-100 dark:border-zinc-800 ml-5">
            {node.children.map((c) => renderNode(c, depth, node.available))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <ul
      aria-label="Permissões"
      className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
    >
      {tree.map((top) => renderNode(top, 0, true))}
    </ul>
  );
}
