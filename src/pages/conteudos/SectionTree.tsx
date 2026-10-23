import { useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "../../ui/icons.jsx";
import { GuardIconButton } from "../../components/GuardButton";
import { REVEAL_ON_HOVER, REVEAL_DIM_ON_HOVER } from "../../ui/reveal";
import { Section } from "./model";

// ─── Section tree node ────────────────────────────────────────────────────────

type SectionNodeProps = {
  section: Section;
  sections: Section[];
  selectedId: string | null;
  depth: number;
  hideActions?: boolean;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (s: Section) => void;
  onDelete: (s: Section) => void;
  dragHandle?: React.HTMLAttributes<HTMLButtonElement>;
};

/** Botões pequenos da árvore de secções; maiores em toque (alvo de 32px). */
const SECTION_ACTION_CLS = "!w-6 !h-6 [@media(hover:none)]:!w-8 [@media(hover:none)]:!h-8";

function SectionNode({
  section,
  sections,
  selectedId,
  depth,
  hideActions,
  onSelect,
  onAddChild,
  onEdit,
  onDelete,
  dragHandle,
}: SectionNodeProps) {
  const children = sections
    .filter((s) => s.parentId === section.sectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const [open, setOpen] = useState(false);
  const active = selectedId === section.sectionId;

  return (
    <div>
      <div
        onClick={() => onSelect(section.sectionId)}
        className={`group flex items-center gap-1 rounded-lg text-sm cursor-pointer transition-colors ${active ? "bg-accent/10 text-accent dark:bg-accent/15" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
        style={{
          paddingLeft: `${8 + depth * 14}px`,
          paddingRight: 4,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        {dragHandle && (
          <button
            {...dragHandle}
            onClick={(e) => e.stopPropagation()}
            className={`w-4 h-4 shrink-0 flex items-center justify-center hover:!opacity-80 cursor-grab active:cursor-grabbing touch-none transition-opacity ${REVEAL_DIM_ON_HOVER}`}
          >
            <Icon name="grip" className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          className="w-4 h-4 shrink-0 flex items-center justify-center opacity-50"
        >
          {children.length > 0 ? (
            <Icon
              name={open ? "chevronDown" : "chevronRight"}
              className="w-3 h-3"
            />
          ) : (
            <span className="w-3" />
          )}
        </button>
        <span className="flex-1 truncate font-medium">{section.name}</span>
        {!hideActions && (
          // EQ-03: adicionar/editar/apagar secção são ESCRITAS (GuardIconButton) e ficam visíveis em toque/teclado.
          <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${REVEAL_ON_HOVER}`}>
            <GuardIconButton
              icon="plus"
              label="Adicionar subsecção"
              title="Adicionar subsecção"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onAddChild(section.sectionId);
              }}
              className={SECTION_ACTION_CLS}
            />
            <GuardIconButton
              icon="edit"
              label="Editar secção"
              title="Editar secção"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onEdit(section);
              }}
              className={SECTION_ACTION_CLS}
            />
            <GuardIconButton
              icon="trash"
              label="Apagar secção"
              title="Apagar secção"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onDelete(section);
              }}
              className={`${SECTION_ACTION_CLS} hover:text-red-500`}
            />
          </div>
        )}
      </div>
      {open && children.length > 0 && (
        <SortableContext
          items={children.map((c) => c.sectionId)}
          strategy={verticalListSortingStrategy}
        >
          {children.map((child) => (
            <SortableSectionWrapper
              key={child.sectionId}
              section={child}
              sections={sections}
              selectedId={selectedId}
              depth={depth + 1}
              hideActions={hideActions}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

export function SortableSectionWrapper(props: Omit<SectionNodeProps, "dragHandle">) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.section.sectionId,
    data: { parentId: props.section.parentId },
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <SectionNode
        {...props}
        dragHandle={
          {
            ...attributes,
            ...listeners,
          } as React.HTMLAttributes<HTMLButtonElement>
        }
      />
    </div>
  );
}

// ─── Sortable entry row ───────────────────────────────────────────────────────

export function SortableEntryRow({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition"
    >
      <td className="pl-3 pr-1 py-3.5 w-5">
        <button
          {...attributes}
          {...listeners}
          className="flex items-center justify-center text-zinc-200 dark:text-zinc-700 hover:text-zinc-400 dark:hover:text-zinc-500 cursor-grab active:cursor-grabbing touch-none transition-colors"
        >
          <Icon name="grip" className="w-4 h-4" />
        </button>
      </td>
      {children}
    </tr>
  );
}
