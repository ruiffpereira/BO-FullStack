import { Button, Modal } from "../../ui/ui.jsx";
import { DndContext, DragEndEvent, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Icon } from "../../ui/icons.jsx";
import { Card } from "../../ui/ui.jsx";
import { Section } from "./model";
import { SortableSectionWrapper } from "./SectionTree";

type SectionsProps = {
  sections: Section[];
  rootSections: Section[];
  selectedSectionId: string | null;
  totalGroupedCount: number;
  sectionsLoading: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  selectSection: (id: string | null) => void;
  openCreateSection: (parentId?: string | null) => void;
  openEditSection: (s: Section) => void;
  onDelete: (s: Section) => void;
};

/** Árvore de secções à esquerda (tablet/desktop). */
export function SectionsSidebar({ sections, rootSections, selectedSectionId, totalGroupedCount, sectionsLoading, sensors, onDragEnd, selectSection, openCreateSection, openEditSection, onDelete }: SectionsProps) {
  return (
            <div className="hidden md:flex md:flex-col md:w-48 lg:w-60 md:shrink-0 md:min-h-0">
              <Card className="overflow-hidden md:flex md:flex-col md:flex-1 md:min-h-0">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Secções
                  </span>
                  <button
                    onClick={() => openCreateSection(null)}
                    className="p-1 rounded text-zinc-400 hover:text-accent hover:bg-accent/10 transition"
                    title="Nova secção"
                  >
                    <Icon name="plus" className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-1.5 space-y-0.5 md:overflow-y-auto md:flex-1 md:min-h-0">
                  <div
                    onClick={() => selectSection(null)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${selectedSectionId === null ? "bg-accent/10 text-accent" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
                  >
                    <Icon name="layers" className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">Todas</span>
                    <span className="ml-auto text-xs opacity-60">
                      {totalGroupedCount}
                    </span>
                  </div>

                  {sectionsLoading && (
                    <div className="space-y-1 px-2 py-1">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"
                        />
                      ))}
                    </div>
                  )}

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                  >
                    <SortableContext
                      items={rootSections.map((s) => s.sectionId)}
                      strategy={verticalListSortingStrategy}
                    >
                      {rootSections.map((s) => (
                        <SortableSectionWrapper
                          key={s.sectionId}
                          section={s}
                          sections={sections}
                          selectedId={selectedSectionId}
                          depth={0}
                          onSelect={selectSection}
                          onAddChild={(parentId) => openCreateSection(parentId)}
                          onEdit={openEditSection}
                          onDelete={onDelete}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>

                  {!sectionsLoading && sections.length === 0 && (
                    <p className="text-xs text-zinc-400 text-center py-3 px-2">
                      Sem secções.
                      <br />
                      Clica + para criar.
                    </p>
                  )}
                </div>
              </Card>
            </div>
  );
}

/**
 * Secções no telemóvel: a `Modal` partilhada (no ecrã pequeno ancora em baixo, como folha), aberta pelo selector
 * «Todas as secções». «Nova secção» vai no rodapé.
 */
export function MobileSectionsSheet({ sections, rootSections, selectedSectionId, totalGroupedCount, sectionsLoading, sensors, onDragEnd, selectSection, openCreateSection, openEditSection, onDelete, onClose }: SectionsProps & { onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Secções"
      width="max-w-lg"
      footer={
        <Button
          variant="ghost"
          size="sm"
          icon="plus"
          onClick={() => {
            openCreateSection(null);
            onClose();
          }}
        >
          Nova secção
        </Button>
      }
    >
      <div>

        <div
          onClick={() => {
            selectSection(null);
            onClose();
          }}
          className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm cursor-pointer transition-colors ${selectedSectionId === null ? "bg-accent/10 text-accent" : "text-zinc-600 dark:text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800/60"}`}
        >
          <Icon name="layers" className="w-4 h-4 shrink-0" />
          <span className="font-medium flex-1">
            Todas as entradas
          </span>
          <span className="text-xs opacity-60 tabular-nums">
            {totalGroupedCount}
          </span>
        </div>

        {sectionsLoading && (
          <div className="space-y-2 px-3 py-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-5 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={rootSections.map((s) => s.sectionId)}
            strategy={verticalListSortingStrategy}
          >
            {rootSections.map((s) => (
              <SortableSectionWrapper
                key={s.sectionId}
                section={s}
                sections={sections}
                selectedId={selectedSectionId}
                depth={0}
                hideActions
                onSelect={(id) => {
                  selectSection(id);
                  onClose();
                }}
                onAddChild={(parentId) => {
                  openCreateSection(parentId);
                  onClose();
                }}
                onEdit={(sec) => {
                  openEditSection(sec);
                  onClose();
                }}
                onDelete={onDelete}
              />
            ))}
          </SortableContext>
        </DndContext>

        {!sectionsLoading && sections.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-6">
            Ainda não há secções.
          </p>
        )}

      </div>
    </Modal>
  );
}
