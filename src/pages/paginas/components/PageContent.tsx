/**
 * Centro, vista da página (F12): cabeçalho (nome, endereço, estado, nº de blocos), separadores
 * Conteúdo | Definições e SEO, e a pilha da página — Topo trancado em cima, os itens ordenáveis
 * (`SortableList`) com "＋" entre eles, "Adicionar bloco" no fim e Rodapé trancado em baixo.
 *
 * Tudo o que altera dados passa por `apply(op)` (reducer → desfazer). Nomes acessíveis: o botão
 * principal de cada cartão tem o nome do bloco ("Editar …") e o pormenor (resumo, selos) fica em
 * `aria-describedby` — nenhum botão leva "páginas" no nome (ver ListColumn).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge, Button, Modal, Tabs } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { useBuilder } from "../state/store";
import { blockSummary, buildDuplicateItem, buildSeparateItem, selFor } from "../state/blocks";
import { blockUsage } from "../state/listing";
import { pagePath, pageTitle } from "../state/tree";
import type { Block, Item, PartName, Page } from "../state/types";
import { BlockThumb } from "./BlockThumb";
import { DragHandle, type HandleProps } from "./SortableTree";
import { SortableList } from "./SortableList";

type PageTab = "content" | "settings";

interface Props {
  page: Page;
  /** Separador com que abre (o "SEO" do caminho dos editores leva às definições). */
  initialTab?: PageTab;
  /** Abre a paleta para inserir na posição `at`. */
  onAdd: (at: number) => void;
  /** Item acabado de criar (destaca-se e faz scroll). */
  flash: string | null;
  onFlash: (itemId: string) => void;
}

// ── menu "⋯" ──────────────────────────────────────────────────────────────────

interface MenuAction {
  id: string;
  label: string;
  icon: string;
  danger?: boolean;
  onSelect: () => void;
}

function RowMenu({ name, actions }: { name: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  // Abre para cima quando por baixo não cabe na área com scroll (último cartão, ecrãs baixos).
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setUp(false);
      return;
    }
    const menu = root.current?.querySelector<HTMLElement>('[role="menu"]');
    const bound = root.current?.closest<HTMLElement>("[data-menu-bound]");
    if (!menu || !bound || !root.current) return;
    const m = menu.getBoundingClientRect();
    const b = bound.getBoundingClientRect();
    const t = root.current.getBoundingClientRect();
    if (m.bottom > b.bottom && t.top - m.height - 4 > b.top) setUp(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      root.current?.querySelector<HTMLElement>("button")?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div ref={root} className="relative shrink-0 self-center">
      <button
        type="button"
        aria-label={`Mais opções de ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Mais opções"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Icon name="dots" className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" aria-label={`Opções de ${name}`} onKeyDown={onMenuKey} className={`absolute right-0 z-30 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 ${up ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
              className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                a.danger ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon name={a.icon} className="h-4 w-4 shrink-0" />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── "＋" entre itens ──────────────────────────────────────────────────────────

function InsertBar({ at, onAdd }: { at: number; onAdd: (at: number) => void }) {
  return (
    <div className="relative flex h-6 items-center justify-center">
      <button
        type="button"
        aria-label="Adicionar bloco aqui"
        title="Adicionar bloco aqui"
        onClick={() => onAdd(at)}
        className="group relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full opacity-50 hover:opacity-100 focus:opacity-100 focus:outline-none [@media(hover:none)]:opacity-100"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-500 group-hover:border-accent group-hover:text-accent group-focus-visible:ring-2 group-focus-visible:ring-accent/40 dark:border-zinc-600 dark:bg-zinc-900">
          <Icon name="plus" className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  );
}

// ── cartões ───────────────────────────────────────────────────────────────────

const cardBase = "flex items-stretch rounded-xl border bg-white transition-shadow dark:bg-zinc-900";
const mainBtn =
  "flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pr-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

function SpecialTile() {
  return (
    <span aria-hidden="true" className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
      <Icon name="layers" className="h-5 w-5" />
    </span>
  );
}

/** "Falta EN" — uma etiqueta por língua em falta. */
function MissingBadges({ locales }: { locales: readonly string[] }) {
  return (
    <>
      {locales.map((l) => (
        <Badge key={l} tone="amber">Falta {l.toUpperCase()}</Badge>
      ))}
    </>
  );
}

interface CardProps {
  item: Item;
  index: number;
  handle: HandleProps | null;
  flashed: boolean;
  block: Block | null;
  uses: number;
  missingLocales: readonly string[];
  specialLabel: string;
  specialDesc: string;
  summary: string;
  onOpen: () => void;
  onAdd: (at: number) => void;
  actions: MenuAction[];
}

function ItemCard({ item, index, handle, flashed, block, uses, missingLocales, specialLabel, specialDesc, summary, onOpen, onAdd, actions }: CardProps) {
  const special = item.kind === "special";
  const name = special ? specialLabel : block?.name || "Sem nome";
  const titleId = `it-${item.id}`;
  const subId = `it-sub-${item.id}`;
  const tagsId = `it-tags-${item.id}`;
  return (
    <div>
      <InsertBar at={index} onAdd={onAdd} />
      <div className={`${cardBase} ${flashed ? "border-accent ring-2 ring-accent/40" : "border-zinc-200 dark:border-zinc-700"} ${item.hidden ? "border-dashed" : ""}`}>
        <DragHandle handle={handle} describedBy={titleId} className="self-center" />
        <button type="button" aria-label={`Editar ${name}`} aria-describedby={`${subId} ${tagsId}`} onClick={onOpen} className={`${mainBtn} ${item.hidden ? "opacity-60" : ""}`}>
          {special || !block ? <SpecialTile /> : <BlockThumb block={block} />}
          <span className="min-w-0 flex-1">
            <span id={titleId} className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{name}</span>
            <span id={subId} aria-hidden="true" className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{special ? specialDesc : summary}</span>
            <span id={tagsId} aria-hidden="true" className="mt-1 flex flex-wrap gap-1.5 empty:hidden">
              {special && <Badge tone="violet">Especial</Badge>}
              {uses > 1 && (
                <Badge tone="blue">
                  <Icon name="link" className="h-3 w-3" />
                  Partilhado em {uses}
                </Badge>
              )}
              {item.hidden && <Badge>Escondido aqui</Badge>}
              <MissingBadges locales={missingLocales} />
            </span>
          </span>
        </button>
        <RowMenu name={name} actions={actions} />
      </div>
    </div>
  );
}

const PART_META: Record<PartName, { name: string; hint: string; sub: string }> = {
  topo: { name: "Topo", hint: "Fica sempre em cima", sub: "igual em todas as páginas" },
  rodape: { name: "Rodapé", hint: "Fica sempre em baixo", sub: "igual em todas as páginas" },
};

function PinnedCard({ part, onOpen }: { part: PartName; onOpen: () => void }) {
  const { state, catalog, missing } = useBuilder();
  const data = state.work.parts[part] as { layout?: number; bg?: string; comps?: unknown[] } | null;
  const meta = PART_META[part];
  const locales = [...new Set(missing.filter((m) => m.entity === "part" && m.id === part).map((m) => m.locale))];
  const subId = `part-sub-${part}-c`;
  return (
    <div className={`${cardBase} border-dashed border-zinc-300 bg-zinc-50/70 dark:border-zinc-700 dark:bg-zinc-900/60`}>
      <span title={meta.hint} className="inline-flex h-10 w-8 shrink-0 items-center justify-center self-center text-zinc-400 [@media(hover:none)]:w-10">
        <Icon name="lock" className="h-4 w-4" />
        <span className="sr-only">{meta.hint}</span>
      </span>
      <button type="button" aria-label={`Editar ${meta.name.toLowerCase()} do site`} aria-describedby={subId} onClick={onOpen} className={mainBtn}>
        <BlockThumb block={{ layout: data?.layout ?? 1, bg: data?.bg ?? "claro", comps: data?.comps ?? [] }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{meta.name}</span>
          <span id={subId} aria-hidden="true" className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
            Parte comum · {blockSummary({ comps: data?.comps ?? [] }, catalog)} · {meta.sub}
          </span>
          {locales.length > 0 && (
            <span aria-hidden="true" className="mt-1 flex flex-wrap gap-1.5">
              <MissingBadges locales={locales} />
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

// ── vista ─────────────────────────────────────────────────────────────────────

export function PageContent({ page, initialTab = "content", onAdd, flash, onFlash }: Props) {
  const { state, lang, catalog, manifest, missing, apply, select } = useBuilder();
  const work = state.work;
  const [tab, setTab] = useState<PageTab>(initialTab);
  const [retire, setRetire] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);

  const items = work.items[page.id] ?? [];
  const usage = useMemo(() => blockUsage(work), [work]);
  const blockById = useMemo(() => new Map(work.blocks.map((b) => [b.id, b])), [work.blocks]);
  const missingBy = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const m of missing) {
      if (m.entity !== "block" && m.entity !== "item") continue;
      const key = `${m.entity}:${m.id}`;
      const list = out.get(key) ?? [];
      if (!list.includes(m.locale)) list.push(m.locale);
      out.set(key, list);
    }
    return out;
  }, [missing]);

  useEffect(() => {
    if (!flash) return;
    const el = [...(body.current?.querySelectorAll<HTMLElement>("[data-sortable-row]") ?? [])].find((n) => n.dataset.sortableRow === flash);
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [flash]);

  const nBlocks = items.filter((it) => it.kind === "block").length;
  const nSpecials = items.length - nBlocks;
  const countText = `${nBlocks} ${nBlocks === 1 ? "bloco" : "blocos"}${nSpecials ? ` · ${nSpecials} ${nSpecials === 1 ? "especial" : "especiais"}` : ""}`;

  const nameOf = (it: Item): string =>
    it.kind === "special" ? manifest?.specials?.[it.specialType ?? ""]?.label ?? it.specialType ?? "Especial" : blockById.get(it.blockId ?? "")?.name || "Sem nome";

  const duplicate = (it: Item) => {
    const op = buildDuplicateItem(work, page.id, it.id);
    if (!op) return;
    apply(op);
    onFlash(op.item.id);
    toast.success(it.kind === "special" ? "Duplicado logo a seguir." : "Criada uma cópia logo a seguir. É um bloco novo: mudar um não muda o outro.");
  };
  const separate = (it: Item) => {
    const op = buildSeparateItem(work, page.id, it.id);
    if (!op) return;
    apply(op);
    onFlash(it.id);
    toast.success("Esta página passou a ter a sua própria cópia. As outras ficam com o original.");
  };
  const toggleHidden = (it: Item) => {
    apply({ type: "hideItem", pageId: page.id, itemId: it.id, hidden: !it.hidden });
    toast.success(it.hidden ? "Volta a aparecer nesta página." : "Escondido nesta página. Continua guardado e nas outras páginas.");
  };

  const toRetire = retire ? items.find((it) => it.id === retire) ?? null : null;
  const retireUses = toRetire?.blockId ? usage.get(toRetire.blockId) ?? 0 : 0;
  const confirmRetire = () => {
    if (!toRetire) return;
    apply({ type: "removeItem", pageId: page.id, itemId: toRetire.id });
    toast.success(toRetire.kind === "special" ? "Retirado desta página." : retireUses > 1 ? "Retirado desta página." : `Retirado. «${nameOf(toRetire)}» continua em Blocos, sem uso.`);
    setRetire(null);
  };

  const open = (it: Item) => select({ libId: null, sel: selFor(it) });

  const footerNote: ReactNode = items.length === 0 && (
    <div className="my-3 flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center dark:border-zinc-700">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Esta página ainda não tem blocos.</p>
      <Button className="min-h-10" icon="plus" onClick={() => onAdd(0)}>Adicionar bloco</Button>
    </div>
  );

  return (
    <>
      <div className="shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{pageTitle(page, lang.defaultLanguage)}</h2>
          <Badge tone={page.status === "published" ? "green" : "neutral"}>{page.status === "published" ? "Publicada" : "Rascunho"}</Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          <span className="font-mono text-[13px]">{pagePath(work.pages, page.id)}</span> · {countText}
        </p>
        <div className="mt-3">
          <Tabs
            tabs={[
              { id: "content", label: "Conteúdo" },
              { id: "settings", label: "Definições e SEO" },
            ]}
            value={tab}
            onChange={(id: string) => setTab(id as PageTab)}
          />
        </div>
      </div>

      <div ref={body} data-menu-bound className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {tab === "settings" ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            O endereço, o estado e o SEO desta página chegam na próxima fatia.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                title="Ver as definições e o SEO desta página"
                onClick={() => setTab("settings")}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                SEO —
              </button>
              <span className="min-w-[200px] flex-1 text-xs text-zinc-500 dark:text-zinc-400">
                A página de cima para baixo. Clica num bloco para o editar; arrasta pela pega para mudar a ordem.
              </span>
            </div>

            <PinnedCard part="topo" onOpen={() => select({ libId: null, sel: { kind: "part", id: "topo" } })} />

            <SortableList<Item>
              items={items}
              getId={(it) => it.id}
              getLabel={nameOf}
              onMove={(from, to, position) => apply({ type: "moveItem", pageId: page.id, from, to, position })}
              renderItem={(it, ctx) => {
                const block = it.kind === "block" ? blockById.get(it.blockId ?? "") ?? null : null;
                const uses = it.blockId ? usage.get(it.blockId) ?? 0 : 0;
                const def = it.kind === "special" ? manifest?.specials?.[it.specialType ?? ""] : undefined;
                const actions: MenuAction[] = [
                  { id: "dup", label: "Duplicar", icon: "copy", onSelect: () => duplicate(it) },
                  ...(it.kind === "block" && uses > 1 ? [{ id: "sep", label: "Usar uma cópia só nesta página", icon: "link", onSelect: () => separate(it) }] : []),
                  { id: "hide", label: it.hidden ? "Mostrar nesta página" : "Esconder nesta página", icon: it.hidden ? "eye" : "eyeOff", onSelect: () => toggleHidden(it) },
                  { id: "retire", label: "Retirar desta página", icon: "x", danger: true, onSelect: () => setRetire(it.id) },
                ];
                return (
                  <ItemCard
                    item={it}
                    index={ctx.index}
                    handle={ctx.handle}
                    flashed={flash === it.id}
                    block={block}
                    uses={uses}
                    missingLocales={missingBy.get(it.kind === "special" ? `item:${it.id}` : `block:${it.blockId}`) ?? []}
                    specialLabel={nameOf(it)}
                    specialDesc={def?.desc || (def ? "Especial deste site" : "Este especial já não existe no site")}
                    summary={block ? blockSummary(block, catalog) : ""}
                    onOpen={() => open(it)}
                    onAdd={onAdd}
                    actions={actions}
                  />
                );
              }}
            />

            {footerNote}
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => onAdd(items.length)}
                className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-600 hover:border-accent hover:bg-accent/5 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-zinc-600 dark:text-zinc-300"
              >
                <Icon name="plus" className="h-4 w-4" />
                Adicionar bloco
              </button>
            )}
            <div className="mt-3 pb-20">
              <PinnedCard part="rodape" onOpen={() => select({ libId: null, sel: { kind: "part", id: "rodape" } })} />
            </div>
          </>
        )}
      </div>

      <Modal
        open={toRetire !== null}
        onClose={() => setRetire(null)}
        width="max-w-sm"
        title={toRetire ? `Retirar «${nameOf(toRetire)}» desta página?` : "Retirar"}
        footer={
          <>
            <Button variant="ghost" className="min-h-10" onClick={() => setRetire(null)}>Cancelar</Button>
            <Button variant="danger" className="min-h-10" onClick={confirmRetire}>Retirar</Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {!toRetire
            ? ""
            : toRetire.kind === "special"
              ? "O especial e o que preencheste nele deixam de existir. Não fica na biblioteca."
              : retireUses > 1
                ? "O bloco continua guardado em Blocos e nas outras páginas."
                : "O bloco continua guardado em Blocos, sem uso."}
        </p>
      </Modal>
    </>
  );
}
