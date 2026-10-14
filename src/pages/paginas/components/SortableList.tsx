/**
 * Lista plana ordenável: o `SortableTree` sem "dentro". Mesma pega, mesma linha azul, mesmos sensores
 * (rato, toque longo, teclado com anúncios em português). `onMove` só recebe `before`/`after`.
 * Usada pelos grupos da lista lateral e por tudo o que é uma lista simples (itens, componentes…).
 */
import { useCallback, type ReactNode } from "react";
import { SortableTree, type RowContext, type SortableTreeProps } from "./SortableTree";

export type ListPosition = "before" | "after";

export interface SortableListProps<T>
  extends Pick<SortableTreeProps<T>, "items" | "getId" | "getLabel" | "canDrag" | "disabled" | "renderOverlay" | "className" | "rowClassName" | "instructions"> {
  renderItem: (item: T, ctx: RowContext) => ReactNode;
  onMove: (from: string, to: string, position: ListPosition) => void;
  canDrop?: (from: string, to: string, position: ListPosition) => boolean;
}

const LIST_INSTRUCTIONS =
  "Para mover, prima Espaço. Use as setas para cima e para baixo para escolher o sítio. Prima Espaço para largar ou Esc para cancelar.";

export function SortableList<T>({ renderItem, onMove, canDrop, instructions = LIST_INSTRUCTIONS, ...rest }: SortableListProps<T>) {
  const move = useCallback((from: string, to: string, p: "before" | "after" | "inside") => {
    if (p !== "inside") onMove(from, to, p);
  }, [onMove]);
  const drop = useCallback(
    (from: string, to: string, p: "before" | "after" | "inside") => p !== "inside" && from !== to && (canDrop ? canDrop(from, to, p) : true),
    [canDrop],
  );
  return <SortableTree {...rest} instructions={instructions} renderRow={renderItem} onMove={move} canDrop={drop} />;
}
