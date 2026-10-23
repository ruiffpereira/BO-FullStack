/**
 * Coluna da esquerda do construtor (F11): três grupos — Páginas (árvore), Blocos (pastas + biblioteca)
 * e Partes comuns (Topo/Rodapé) — que se abrem, fecham e arrastam. Tudo o que altera dados passa por
 * `apply(op)` (reducer → desfazer); a ordem e os abertos dos grupos ficam no `localStorage`
 * (conveniência por pessoa, com `try/catch`; em sessão de suporte nem isso).
 *
 * Nomes acessíveis: nenhum botão leva "páginas" no nome (o item "Páginas" da sidebar tem de continuar a
 * ser o único `getByRole("button", { name: "Páginas" })`), por isso os cabeçalhos dos grupos são texto +
 * um botão "Abrir ou fechar", e as linhas guardam o pormenor em `aria-describedby`, não no nome.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Badge, Button, Input } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { useSupportSession } from "../../../context/AuthContext";
import { NOT_CONFIGURED_HINT, useBuilder } from "../state/store";
import { VIEW_ONLY_MESSAGE } from "../../../lib/teamAccess";
import { newEntityId } from "../state/ids";
import { deletePageWithToast } from "../state/notify";
import { pageBlockers } from "../state/refs";
import { FOLDER_NAME_MAX, buildAddPage, canMoveLibrary } from "../state/ops";
import {
  blockUsage,
  descendantMissing,
  libraryRows,
  missingIndex,
  readPrefs,
  writePrefs,
  type GroupId,
  type LibRow,
  type ListPrefs,
  type MissingIndex,
} from "../state/listing";
import { MAX_DEPTH, canAddChild, canMovePage, flattenPages, pagePath, pageTitle, type PageRow } from "../state/tree";
import type { Block, Page, PartName } from "../state/types";
import { Confirm } from "./EditorBits";
import { REVEAL_ON_HOVER } from "../../../ui/reveal";
import { DragHandle, SortableTree, type HandleProps } from "./SortableTree";
import { SortableList } from "./SortableList";

const GROUP_NAME: Record<GroupId, string> = { pages: "Páginas", blocks: "Blocos", common: "Partes comuns" };

const rowBase = "group flex items-center rounded-lg transition-colors";
const rowTone = (active: boolean) => (active ? "bg-accent/10 text-accent" : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/70");
const iconBtn =
  "h-10 w-8 [@media(hover:none)]:w-10 shrink-0 inline-flex items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-40 disabled:pointer-events-none";
// Acções de linha: escondidas até ao hover/foco — mas sempre visíveis em ecrãs de toque.
const reveal = REVEAL_ON_HOVER;
const tip = "px-2 pt-1 pb-2 text-xs text-zinc-400 dark:text-zinc-500";
const headBtn = "min-h-10 !px-2";

function MissingDot() {
  return <span role="img" aria-label="Falta traduzir" title="Falta traduzir" className="ml-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500 align-middle" />;
}

const num = (limits: Record<string, unknown>, key: string, fallback: number): number => (typeof limits[key] === "number" ? (limits[key] as number) : fallback);
const without = (set: ReadonlySet<string>, id: string): ReadonlySet<string> => (set.has(id) ? new Set([...set].filter((x) => x !== id)) : set);
const toggled = (set: ReadonlySet<string>, id: string): ReadonlySet<string> => (set.has(id) ? without(set, id) : new Set(set).add(id));

// ── coluna ────────────────────────────────────────────────────────────────────

export function ListColumn({ className, onOpen, onNewBlock }: { className: string; onOpen: () => void; onNewBlock?: () => void }) {
  const { state, missing } = useBuilder();
  const persist = useSupportSession() === null;
  const [prefs, setPrefs] = useState<ListPrefs>(() => readPrefs(persist));
  const idx = useMemo(() => missingIndex(state.work, missing), [state.work, missing]);

  const change = useCallback(
    (update: (p: ListPrefs) => ListPrefs) =>
      setPrefs((p) => {
        const next = update(p);
        writePrefs(next, persist);
        return next;
      }),
    [persist],
  );

  const groupMissing: Record<GroupId, boolean> = { pages: idx.pages.size > 0, blocks: idx.blocks.size > 0, common: idx.parts.size > 0 };

  return (
    <nav
      aria-label="Páginas do site"
      className={`${className} flex-col w-full min-[860px]:w-[232px] min-[1180px]:w-[300px] shrink-0 min-h-0 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900`}
    >
      <SortableList<GroupId>
        items={prefs.order}
        getId={(g) => g}
        getLabel={(g) => GROUP_NAME[g]}
        rowClassName="mb-1"
        onMove={(from, to, position) =>
          change((p) => {
            const rest = p.order.filter((g) => g !== from);
            rest.splice(rest.indexOf(to as GroupId) + (position === "after" ? 1 : 0), 0, from as GroupId);
            return { ...p, order: rest };
          })
        }
        renderItem={(g, ctx) => {
          const shell: Shell = {
            id: g,
            handle: ctx.handle,
            open: !prefs.closed.includes(g),
            missing: groupMissing[g],
            onToggle: () => change((p) => ({ ...p, closed: p.closed.includes(g) ? p.closed.filter((x) => x !== g) : [...p.closed, g] })),
          };
          if (g === "pages") return <PagesGroup shell={shell} idx={idx} onOpen={onOpen} />;
          if (g === "blocks") return <BlocksGroup shell={shell} idx={idx} onOpen={onOpen} onNewBlock={onNewBlock} />;
          return <CommonGroup shell={shell} idx={idx} onOpen={onOpen} />;
        }}
      />
    </nav>
  );
}

// ── grupo ─────────────────────────────────────────────────────────────────────

interface Shell {
  id: GroupId;
  handle: HandleProps | null;
  open: boolean;
  missing: boolean;
  onToggle: () => void;
}

function GroupShell({ shell, actions, children }: { shell: Shell; actions?: ReactNode; children: ReactNode }) {
  const { id, handle, open, missing, onToggle } = shell;
  const titleId = `grp-${id}`;
  const bodyId = `grp-body-${id}`;
  return (
    <section aria-labelledby={titleId} className="rounded-lg">
      <div className="flex items-center">
        <DragHandle handle={handle} describedBy={titleId} />
        <button type="button" aria-expanded={open} aria-controls={bodyId} aria-label="Abrir ou fechar" aria-describedby={titleId} onClick={onToggle} className={iconBtn}>
          <Icon name={open ? "chevronDown" : "chevronRight"} className="h-4 w-4" />
        </button>
        <span id={titleId} onClick={onToggle} className="flex min-h-10 flex-1 cursor-pointer select-none items-center text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">
          {GROUP_NAME[id]}
          {missing && <MissingDot />}
        </span>
        {actions}
      </div>
      {open && <div id={bodyId}>{children}</div>}
    </section>
  );
}

// ── Páginas ───────────────────────────────────────────────────────────────────

/** A árvore achatada sem os ramos fechados. */
function visibleRows(pages: readonly Page[], closed: ReadonlySet<string>): PageRow[] {
  const out: PageRow[] = [];
  let hideBelow: number | null = null;
  for (const row of flattenPages(pages)) {
    if (hideBelow !== null) {
      if (row.depth > hideBelow) continue;
      hideBelow = null;
    }
    out.push(row);
    if (closed.has(row.page.id)) hideBelow = row.depth;
  }
  return out;
}

function PagesGroup({ shell, idx, onOpen }: { shell: Shell; idx: MissingIndex; onOpen: () => void }) {
  const { state, lang, limits, catalog, manifest, select, apply, readOnly } = useBuilder();
  const pages = state.work.pages;
  const [deleting, setDeleting] = useState<string | null>(null);
  const maxDepth = num(limits, "maxDepth", MAX_DEPTH);
  const maxPages = num(limits, "pages", 200);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const rows = useMemo(() => visibleRows(pages, closed), [pages, closed]);
  const hasKids = useMemo(() => new Set(pages.map((p) => p.parentId).filter((x): x is string => !!x)), [pages]);
  const full = pages.length >= maxPages;

  const addPage = (parentId: string | null) => {
    const op = buildAddPage(state.work, lang, { parentId, maxPages, maxDepth });
    if (!op) return;
    apply(op);
    if (parentId) setClosed((c) => without(c, parentId));
    onOpen();
  };

  const actions = (
    <Button type="button" variant="ghost" size="sm" aria-label="Nova página" disabled={full || readOnly} title={readOnly ? VIEW_ONLY_MESSAGE : full ? `Limite de ${maxPages} páginas atingido` : "Criar uma página nova"} className={headBtn} onClick={() => addPage(null)}>
      <Icon name="plus" className="h-4 w-4" />
      Nova
    </Button>
  );

  return (
    <GroupShell shell={shell} actions={actions}>
      <SortableTree<PageRow>
        items={rows}
        getId={(r) => r.page.id}
        getDepth={(r) => r.depth}
        getLabel={(r) => pageTitle(r.page, lang.defaultLanguage)}
        canDrag={(r) => !r.page.isHome}
        canDrop={(from, to, position) => canMovePage(pages, from, to, position, maxDepth)}
        onMove={(from, to, position) => {
          apply({ type: "movePage", from, to, position, maxDepth });
          if (position === "inside") setClosed((c) => without(c, to));
        }}
        renderRow={(r, ctx) => {
          const p = r.page;
          const active = state.pageId === p.id && state.libId === null && state.sel?.kind !== "part";
          const titleId = `pg-${p.id}`;
          const subId = `pg-sub-${p.id}`;
          const isClosed = closed.has(p.id);
          const miss = idx.pages.has(p.id) || (isClosed && descendantMissing(pages, p.id, idx));
          const canAdd = canAddChild(pages, p.id, maxDepth) && !full;
          // «Só ver» (EQ-03): o botão fica, desactivado, com o motivo — não some nem fica activo.
          const blocked = !p.isHome && pageBlockers(state.work, catalog, manifest, p.id).length > 0;
          if (deleting === p.id) {
            // Confirmação em linha, a ocupar a linha (quebra em linhas na coluna estreita e a 390).
            return (
              <div className={`${rowBase} flex-wrap gap-2 bg-red-50/60 px-2 py-1 dark:bg-red-500/10`} style={{ paddingLeft: 8 + r.depth * 14 }}>
                <Confirm
                  text={`Apagar «${pageTitle(p, lang.defaultLanguage)}»? Os blocos continuam em Blocos.`}
                  action="Apagar"
                  onYes={() => {
                    setDeleting(null);
                    deletePageWithToast(apply, p.id, pageTitle(p, lang.defaultLanguage));
                  }}
                  onNo={() => setDeleting(null)}
                />
              </div>
            );
          }
          return (
            <div className={`${rowBase} ${rowTone(active)}`} style={{ paddingLeft: r.depth * 14 }}>
              <DragHandle handle={ctx.handle} describedBy={titleId} />
              {hasKids.has(p.id) ? (
                <button type="button" aria-expanded={!isClosed} aria-label="Abrir ou fechar o ramo" aria-describedby={titleId} onClick={() => setClosed((c) => toggled(c, p.id))} className={iconBtn}>
                  <Icon name={isClosed ? "chevronRight" : "chevronDown"} className="h-4 w-4" />
                </button>
              ) : (
                <span aria-hidden="true" className="h-10 w-8 shrink-0 [@media(hover:none)]:w-10" />
              )}
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                aria-describedby={subId}
                onClick={() => {
                  select({ pageId: p.id, libId: null, sel: { kind: "page", id: p.id } });
                  onOpen();
                }}
                className="min-h-10 min-w-0 flex-1 rounded-lg py-1 pr-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span id={titleId} className="block truncate text-sm font-medium">
                  {pageTitle(p, lang.defaultLanguage)}
                  {miss && <MissingDot />}
                </span>
                <span id={subId} aria-hidden="true" className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{pagePath(pages, p.id)}</span>
              </button>
              {p.status === "draft" && <Badge className="mr-1 shrink-0">Rascunho</Badge>}
              {canAdd ? (
                <button type="button" aria-label="Criar subpágina" aria-describedby={titleId} disabled={readOnly} title={readOnly ? VIEW_ONLY_MESSAGE : "Criar uma subpágina dentro desta"} className={`${iconBtn} ${reveal} disabled:opacity-40 disabled:cursor-not-allowed`} onClick={() => addPage(p.id)}>
                  <Icon name="plus" className="h-4 w-4" />
                </button>
              ) : (
                <span aria-hidden="true" className="h-10 w-2 shrink-0" />
              )}
              {p.isHome ? (
                <span aria-hidden="true" className="h-10 w-2 shrink-0" />
              ) : (
                <button
                  type="button"
                  aria-label="Apagar página"
                  aria-describedby={titleId}
                  disabled={readOnly}
                  title={readOnly ? VIEW_ONLY_MESSAGE : blocked ? "Não pode ser apagada — ver porquê" : "Apagar esta página"}
                  className={`${iconBtn} ${reveal} disabled:opacity-40 disabled:cursor-not-allowed`}
                  onClick={() => {
                    if (!blocked) return setDeleting(p.id);
                    select({ pageId: p.id, libId: null, sel: { kind: "page", id: p.id }, tab: "settings" });
                    onOpen();
                  }}
                >
                  <Icon name={blocked ? "lock" : "trash"} className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        }}
      />
      {rows.length === 0 && <p className={tip}>Ainda não há páginas.</p>}
      <p className={tip}>Arrasta para mudar a ordem. Larga em cima de outra para a pôr lá dentro.</p>
    </GroupShell>
  );
}

// ── Blocos ────────────────────────────────────────────────────────────────────

function usageText(components: number, uses: number): string {
  const c = `${components} ${components === 1 ? "componente" : "componentes"}`;
  return uses === 0 ? c : `${c} · em ${uses}`;
}

function BlocksGroup({ shell, idx, onOpen, onNewBlock }: { shell: Shell; idx: MissingIndex; onOpen: () => void; onNewBlock?: () => void }) {
  const { state, limits, select, apply, readOnly } = useBuilder();
  const work = state.work;
  const maxFolders = num(limits, "folders", 100);
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const rows = useMemo(() => libraryRows(work, closed, query), [work, closed, query]);
  const usage = useMemo(() => blockUsage(work), [work]);
  const searching = query.trim() !== "";
  const fullFolders = work.folders.length >= maxFolders;

  const addFolder = () => {
    const id = newEntityId();
    apply({ type: "addFolder", folder: { id, name: "Nova pasta", sortOrder: 0 } });
    setRenaming(id);
  };

  const actions = (
    <>
      <Button type="button" variant="ghost" size="sm" aria-label="Nova pasta" disabled={fullFolders || readOnly} title={readOnly ? VIEW_ONLY_MESSAGE : fullFolders ? `Limite de ${maxFolders} pastas atingido` : "Criar uma pasta para arrumar blocos"} className={headBtn} onClick={addFolder}>
        <Icon name="folder" className="h-4 w-4" />
        Pasta
      </Button>
      <Button type="button" variant="ghost" size="sm" aria-label="Novo bloco" disabled={!onNewBlock || readOnly} title={readOnly ? VIEW_ONLY_MESSAGE : onNewBlock ? "Escolher um bloco para criar" : NOT_CONFIGURED_HINT} className={headBtn} onClick={onNewBlock}>
        <Icon name="plus" className="h-4 w-4" />
        Novo
      </Button>
    </>
  );

  const folderHasMissing = (folderId: string) => work.blocks.some((b) => b.folderId === folderId && idx.blocks.has(b.id));

  return (
    <GroupShell shell={shell} actions={actions}>
      <div className="px-1 pb-2">
        <Input icon="search" aria-label="Procurar bloco" placeholder="Procurar bloco" value={query} onChange={(e: { target: { value: string } }) => setQuery(e.target.value)} className="min-h-10" />
      </div>
      <SortableTree<LibRow>
        items={rows}
        getId={(r) => r.id}
        getDepth={(r) => (r.kind === "block" ? (r.parentId ? 1 : 0) : r.kind === "empty" ? 1 : 0)}
        getLabel={(r) => (r.kind === "folder" ? r.folder.name : r.kind === "block" ? r.block.name : "Sem pasta")}
        disabled={searching || renaming !== null}
        canDrag={(r) => r.kind === "folder" || r.kind === "block"}
        canDrop={(from, to, position) => canMoveLibrary(work, from, to, position)}
        onMove={(from, to, position) => {
          apply({ type: "moveLibrary", from, to, position });
          const folder = to.startsWith("vazia:") ? to.slice(6) : to;
          if (position === "inside") setClosed((c) => without(c, folder));
        }}
        renderRow={(r, ctx) => {
          if (r.kind === "root") {
            return <p className="flex min-h-8 items-center px-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">Sem pasta</p>;
          }
          if (r.kind === "empty") {
            return <p className="flex min-h-8 items-center pl-12 text-xs text-zinc-400 dark:text-zinc-500">Arrasta blocos para aqui.</p>;
          }
          if (r.kind === "folder") {
            const f = r.folder;
            const nameId = `fold-${f.id}`;
            return (
              <div className={`${rowBase} text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/70`}>
                <DragHandle handle={ctx.handle} describedBy={nameId} />
                <button type="button" aria-expanded={r.open} aria-label="Abrir ou fechar a pasta" aria-describedby={nameId} onClick={() => setClosed((c) => toggled(c, f.id))} className={iconBtn}>
                  <Icon name={r.open ? "chevronDown" : "chevronRight"} className="h-4 w-4" />
                </button>
                <Icon name="folder" className="mr-1.5 h-4 w-4 shrink-0 text-zinc-400" />
                {renaming === f.id ? (
                  <FolderName
                    name={f.name}
                    onDone={(name) => {
                      if (name !== null) apply({ type: "renameFolder", id: f.id, name });
                      setRenaming(null);
                    }}
                  />
                ) : (
                  <button type="button" id={nameId} title="Clica para mudar o nome" onClick={() => setRenaming(f.id)} className="min-h-10 min-w-0 flex-1 truncate rounded-md text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                    {f.name}
                    {folderHasMissing(f.id) && <MissingDot />}
                  </button>
                )}
                <span className="mx-1 shrink-0 text-xs text-zinc-400">{r.count}</span>
                <button
                  type="button"
                  aria-label="Apagar pasta"
                  aria-describedby={nameId}
                  disabled={r.count > 0}
                  title={r.count > 0 ? "Tira primeiro os blocos da pasta" : "Apagar a pasta"}
                  className={`${iconBtn} ${reveal}`}
                  onClick={() => apply({ type: "deleteFolder", id: f.id })}
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            );
          }
          const b: Block = r.block;
          const active = state.libId === b.id;
          const titleId = `blk-${b.id}`;
          const subId = `blk-sub-${b.id}`;
          const uses = usage.get(b.id) ?? 0;
          return (
            <div className={`${rowBase} ${rowTone(active)}`} style={{ paddingLeft: r.parentId ? 14 : 0 }}>
              <DragHandle handle={ctx.handle} describedBy={titleId} />
              <span aria-hidden="true" className="h-10 w-2 shrink-0" />
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                aria-describedby={subId}
                onClick={() => {
                  select({ libId: b.id, sel: { kind: "block", id: b.id } });
                  onOpen();
                }}
                className="min-h-10 min-w-0 flex-1 rounded-lg py-1 pr-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span id={titleId} className="block truncate text-sm font-medium">
                  {b.name || "Sem nome"}
                  {idx.blocks.has(b.id) && <MissingDot />}
                </span>
                <span id={subId} aria-hidden="true" className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{usageText(b.comps?.length ?? 0, uses)}</span>
              </button>
              {uses === 0 && <Badge className="mr-1 shrink-0">Sem uso</Badge>}
            </div>
          );
        }}
      />
      {rows.length === 0 && <p className={tip}>{searching ? "Nenhum bloco com esse nome." : "Ainda não há blocos."}</p>}
      <p className={tip}>Arrasta para ordenar ou para dentro de uma pasta. As pastas só arrumam a lista; um bloco pode estar em várias páginas.</p>
    </GroupShell>
  );
}

/** Campo do nome da pasta: Enter ou sair do campo grava, Esc cancela. */
function FolderName({ name, onDone }: { name: string; onDone: (name: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (value: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(value);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") finish(e.currentTarget.value);
    else if (e.key === "Escape") finish(null);
  };
  return (
    <input
      ref={ref}
      defaultValue={name}
      maxLength={FOLDER_NAME_MAX}
      aria-label="Nome da pasta"
      onKeyDown={onKey}
      onBlur={(e) => finish(e.currentTarget.value)}
      className="min-h-10 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    />
  );
}

// ── Partes comuns ─────────────────────────────────────────────────────────────

const PARTS: { id: PartName; name: string; sub: string }[] = [
  { id: "topo", name: "Topo", sub: "Sempre em cima · todas as páginas" },
  { id: "rodape", name: "Rodapé", sub: "Sempre em baixo · todas as páginas" },
];

function CommonGroup({ shell, idx, onOpen }: { shell: Shell; idx: MissingIndex; onOpen: () => void }) {
  const { state, select } = useBuilder();
  return (
    <GroupShell shell={shell}>
      {PARTS.map((part) => {
        const active = state.sel?.kind === "part" && state.sel.id === part.id;
        const subId = `part-sub-${part.id}`;
        return (
          <div key={part.id} className={`${rowBase} ${rowTone(active)} pl-1`}>
            <button
              type="button"
              aria-current={active ? "true" : undefined}
              aria-describedby={subId}
              onClick={() => {
                select({ libId: null, sel: { kind: "part", id: part.id } });
                onOpen();
              }}
              className="min-h-10 min-w-0 flex-1 rounded-lg px-3 py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <span className="block truncate text-sm font-medium">
                {part.name}
                {idx.parts.has(part.id) && <MissingDot />}
              </span>
              <span id={subId} aria-hidden="true" className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{part.sub}</span>
            </button>
            <Icon name="lock" className="mr-3 h-3.5 w-3.5 shrink-0 text-zinc-400" />
          </div>
        );
      })}
      <p className={tip}>Iguais em todas as páginas. Edita-se o conteúdo; o lugar é o site que decide.</p>
    </GroupShell>
  );
}
