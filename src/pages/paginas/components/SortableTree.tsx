/**
 * Ordenar e aninhar por arrasto — o ÚNICO sítio do construtor onde se usa `useSortable`.
 * `SortableList` (lista plana) é uma casca fina por cima deste. Reutilizado pela lista lateral (F11),
 * pelos itens da página (F12), pelos itens de listas (F13) e pelos componentes (F14).
 *
 * O contrato é simples: recebe as linhas JÁ achatadas, pela ordem em que se vêem; desenha cada linha
 * com `renderRow` (a pega `⋮⋮` é o `<DragHandle handle={ctx.handle} />`); quando se larga, chama
 * `onMove(from, to, position)` — `before`/`after` (linha azul) ou `inside` (contorno tracejado). Quem
 * chama é que muda os dados (pelo reducer, para entrar no desfazer); isto só decide o gesto.
 *
 * Sensores: rato/caneta (arrasta após 6 px), toque (toque longo, 250 ms) e teclado (Espaço, setas ↑↓;
 * → põe dentro, ← tira; Espaço larga, Esc cancela), com anúncios em português para leitores de ecrã.
 * As linhas não se deslocam durante o arrasto — a linha azul marca o sítio, como no protótipo.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, type SortingStrategy } from "@dnd-kit/sortable";
import { Icon } from "../../../ui/icons.jsx";
import type { DropPosition } from "../state/tree";

export type { DropPosition };
export type HandleProps = HTMLAttributes<HTMLElement>;

export interface RowContext {
  index: number;
  depth: number;
  isDragging: boolean;
  /** Onde cairia o que se está a arrastar, se for largado agora sobre ESTA linha. */
  drop: DropPosition | null;
  /** Props da pega (`null` = esta linha não se arrasta). Passar a `<DragHandle>`. */
  handle: HandleProps | null;
}

export interface SortableTreeProps<T> {
  /** Linhas visíveis, achatadas, pela ordem em que aparecem. */
  items: readonly T[];
  getId: (item: T) => string;
  /** Nível de aninhamento (0 = primeiro). Só serve a posição da linha azul. */
  getDepth?: (item: T) => number;
  /** Nome falado nos anúncios ("Pegou em Obras"). */
  getLabel: (item: T) => string;
  renderRow: (item: T, ctx: RowContext) => ReactNode;
  onMove: (from: string, to: string, position: DropPosition) => void;
  /** Recusa gestos que a regra do negócio não deixa (ciclos, profundidade…). Por omissão tudo. */
  canDrop?: (from: string, to: string, position: DropPosition) => boolean;
  /** Linhas que não se arrastam (continuam a poder ser alvo). Por omissão todas. */
  canDrag?: (item: T) => boolean;
  /** Desliga o arrasto (p.ex. com uma pesquisa ativa). */
  disabled?: boolean;
  /** O que acompanha o dedo/rato; por omissão uma etiqueta com `getLabel`. */
  renderOverlay?: (item: T) => ReactNode;
  className?: string;
  rowClassName?: string;
  /** Instruções para leitores de ecrã ao focar a pega. */
  instructions?: string;
  /** Recuo por nível, em px, da linha azul. */
  indentPx?: number;
}

const DEFAULT_INSTRUCTIONS =
  "Para mover, prima Espaço. Use as setas para cima e para baixo para escolher o sítio; a seta para a direita põe dentro do item e a seta para a esquerda tira. Prima Espaço para largar ou Esc para cancelar.";

const POS_TEXT: Record<DropPosition, string> = { before: "antes de", after: "depois de", inside: "dentro de" };

// Sem deslocar as linhas: quem marca o sítio é a linha azul / o contorno.
const stay: SortingStrategy = () => null;

// Rato e caneta arrastam logo; o dedo só depois do toque longo (o `TouchSensor`), senão não se faz scroll.
const basePointer = PointerSensor.activators[0];
class MouseOrPenSensor extends PointerSensor {
  static activators = [
    {
      eventName: basePointer.eventName,
      handler: ((ev, opts) => (ev.nativeEvent.pointerType === "touch" ? false : basePointer.handler(ev, opts))) as typeof basePointer.handler,
    },
  ];
}

const collide: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : closestCenter(args);
};

function startY(ev: Event | null | undefined): number | null {
  if (!ev) return null;
  if ("touches" in ev) {
    const t = (ev as TouchEvent).touches?.[0] ?? (ev as TouchEvent).changedTouches?.[0];
    return t ? t.clientY : null;
  }
  if ("clientY" in ev && typeof (ev as MouseEvent).clientY === "number") return (ev as MouseEvent).clientY;
  return null;
}

// ── pega ──────────────────────────────────────────────────────────────────────

/** A pega `⋮⋮`, igual em todo o lado. `describedBy` = id do texto da linha (o nome fica só "Mover"). */
export function DragHandle({ handle, describedBy, className = "" }: { handle: HandleProps | null; describedBy?: string; className?: string }) {
  const size = "h-10 w-8 [@media(hover:none)]:w-10 shrink-0";
  if (!handle) return <span aria-hidden="true" className={`${size} ${className}`} />;
  const described = [handle["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <button
      type="button"
      {...handle}
      aria-label="Mover"
      aria-describedby={described}
      title="Arrastar para mudar a ordem"
      className={`${size} inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-grab active:cursor-grabbing touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${className}`}
    >
      <Icon name="grip" className="w-4 h-4" />
    </button>
  );
}

// ── linha ─────────────────────────────────────────────────────────────────────

interface RowProps<T> {
  item: T;
  id: string;
  index: number;
  depth: number;
  draggable: boolean;
  drop: DropPosition | null;
  indentPx: number;
  className: string;
  register: (id: string, el: HTMLElement | null) => void;
  renderRow: SortableTreeProps<T>["renderRow"];
}

function Row<T>({ item, id, index, depth, draggable, drop, indentPx, className, register, renderRow }: RowProps<T>) {
  const { setNodeRef, attributes, listeners, isDragging } = useSortable({
    id,
    disabled: { draggable: !draggable },
    attributes: { roleDescription: "item ordenável" },
  });
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      setNodeRef(el);
      register(id, el);
    },
    [setNodeRef, register, id],
  );
  const handle: HandleProps | null = draggable ? ({ ...attributes, ...listeners } as HandleProps) : null;
  const lineStyle: CSSProperties = { left: depth * indentPx };
  return (
    <div ref={setRef} data-sortable-row={id} className={`relative ${isDragging ? "opacity-40" : ""} ${className}`}>
      {renderRow(item, { index, depth, isDragging, drop, handle })}
      {drop === "before" && <span aria-hidden="true" style={lineStyle} className="pointer-events-none absolute right-0 -top-px z-10 h-0.5 rounded-full bg-accent" />}
      {drop === "after" && <span aria-hidden="true" style={lineStyle} className="pointer-events-none absolute right-0 -bottom-px z-10 h-0.5 rounded-full bg-accent" />}
      {drop === "inside" && <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-dashed border-accent bg-accent/5" />}
    </div>
  );
}

// ── árvore ────────────────────────────────────────────────────────────────────

export function SortableTree<T>({
  items,
  getId,
  getDepth,
  getLabel,
  renderRow,
  onMove,
  canDrop,
  canDrag,
  disabled = false,
  renderOverlay,
  className = "",
  rowClassName = "",
  instructions = DEFAULT_INSTRUCTIONS,
  indentPx = 14,
}: SortableTreeProps<T>) {
  const sensors = useSensors(
    useSensor(MouseOrPenSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => items.map(getId), [items, getId]);
  const byId = useMemo(() => new Map(items.map((it) => [getId(it), it])), [items, getId]);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) rowEls.current.set(id, el);
    else rowEls.current.delete(id);
  }, []);

  const allow = useCallback((from: string, to: string, p: DropPosition) => (canDrop ? canDrop(from, to, p) : from !== to), [canDrop]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; position: DropPosition } | null>(null);
  const overRef = useRef(over);
  overRef.current = over;
  // Teclado: a seta → pede "dentro" (a ← desfaz). Só conta quando o gesto veio do teclado.
  const nest = useRef(false);
  const lastMove = useRef<DragMoveEvent | null>(null);

  /** Onde cai, segundo o ponteiro (zona da linha) ou, no teclado, segundo o sentido do movimento. */
  const resolve = useCallback(
    (e: Pick<DragMoveEvent, "active" | "over" | "delta" | "activatorEvent">): { id: string; position: DropPosition } | null => {
      if (!e.over) return null;
      const from = String(e.active.id);
      const to = String(e.over.id);
      if (from === to) return null;
      const insideOk = allow(from, to, "inside");
      const y0 = startY(e.activatorEvent);
      if (y0 === null) {
        if (nest.current && insideOk) return { id: to, position: "inside" };
        const dir: DropPosition = ids.indexOf(to) > ids.indexOf(from) ? "after" : "before";
        if (allow(from, to, dir)) return { id: to, position: dir };
        return insideOk ? { id: to, position: "inside" } : null;
      }
      const r = rowEls.current.get(to)?.getBoundingClientRect() ?? e.over.rect;
      const f = r.height > 0 ? (y0 + e.delta.y - r.top) / r.height : 0.5;
      if (insideOk && f > 0.28 && f < 0.72) return { id: to, position: "inside" };
      const side: DropPosition = f < 0.5 ? "before" : "after";
      if (allow(from, to, side)) return { id: to, position: side };
      return insideOk ? { id: to, position: "inside" } : null;
    },
    [allow, ids],
  );

  const update = useCallback((next: { id: string; position: DropPosition } | null) => {
    const cur = overRef.current;
    if (cur?.id === next?.id && cur?.position === next?.position) return;
    setOver(next);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      nest.current = e.key === "ArrowRight";
      // As setas laterais não mexem o item (não há `dragMove`): recalcula-se com o último movimento.
      if (lastMove.current) update(resolve(lastMove.current));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeId, resolve, update]);

  const reset = () => {
    setActiveId(null);
    setOver(null);
    nest.current = false;
    lastMove.current = null;
  };

  const label = (id: unknown): string => {
    const it = byId.get(String(id));
    return it === undefined ? "item" : getLabel(it);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Pegou em ${label(active.id)}.`,
    onDragOver: ({ active, over: o }) => {
      if (!o) return `${label(active.id)} já não está sobre nenhum item.`;
      if (String(o.id) === String(active.id)) return `${label(active.id)} está no sítio onde estava.`;
      const cur = overRef.current;
      const text = cur && cur.id === String(o.id) ? POS_TEXT[cur.position] : "sobre";
      return `${label(active.id)} está ${text} ${label(o.id)}.`;
    },
    onDragEnd: ({ active, over: o }) => {
      const cur = overRef.current;
      if (!o || !cur) return `${label(active.id)} ficou no mesmo sítio.`;
      return `${label(active.id)} foi largado ${POS_TEXT[cur.position]} ${label(o.id)}.`;
    },
    onDragCancel: ({ active }) => `Movimento cancelado. ${label(active.id)} ficou no mesmo sítio.`,
  };

  const activeItem = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      accessibility={{ announcements, screenReaderInstructions: { draggable: instructions } }}
      onDragStart={({ active }) => {
        nest.current = false;
        setActiveId(String(active.id));
      }}
      onDragMove={(e) => {
        lastMove.current = e;
        update(resolve(e));
      }}
      // Com o teclado o `over` do último `dragMove` chega um passo atrasado; o `dragOver` traz o certo.
      onDragOver={(e) => {
        lastMove.current = e;
        update(resolve(e));
      }}
      onDragEnd={(e) => {
        const r = resolve(e);
        const from = String(e.active.id);
        reset();
        if (r && allow(from, r.id, r.position)) onMove(from, r.id, r.position);
      }}
      onDragCancel={reset}
    >
      <SortableContext items={ids} strategy={stay}>
        <div className={className}>
          {items.map((item, index) => {
            const id = ids[index];
            return (
              <Row
                key={id}
                item={item}
                id={id}
                index={index}
                depth={getDepth ? getDepth(item) : 0}
                draggable={!disabled && (canDrag ? canDrag(item) : true)}
                drop={over && over.id === id && activeId !== id ? over.position : null}
                indentPx={indentPx}
                className={rowClassName}
                register={register}
                renderRow={renderRow}
              />
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeItem === undefined ? null : renderOverlay ? (
          renderOverlay(activeItem)
        ) : (
          <div className="inline-flex max-w-[260px] items-center gap-2 rounded-lg border border-accent/40 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-lg dark:bg-zinc-900 dark:text-zinc-100">
            <Icon name="grip" className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="truncate">{getLabel(activeItem)}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
