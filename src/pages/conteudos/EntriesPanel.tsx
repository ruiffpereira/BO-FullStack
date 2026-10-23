import { DndContext, DragEndEvent, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Icon } from "../../ui/icons.jsx";
import { Card, EmptyState } from "../../ui/ui.jsx";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { ConfirmAction, ConteudosView, GroupedEntry, Section, TYPE_LABEL, localeLabel } from "./model";
import { SortableEntryRow } from "./SectionTree";

/** Painel direito do CMS: cabeçalho (contagem, apagar visíveis, nova entrada, pesquisa) + tabela (md+) / cartões (mobile). */
export function EntriesPanel({
  activeTab, isSearching, searchQuery, setSearchQuery, breadcrumb, setSelectedSectionId, selectSection,
  grouped, displayGrouped, tableLocale, defaultLang, canDragEntries, entriesLoading, allSections, refCounts,
  sensors, onEntryDragEnd, bulkDeletePending, deleteEntryPending, confirmAction, setConfirmAction,
  openCreateEntry, openEditEntry, setRefsKey, emptyDesc,
}: {
  activeTab: ConteudosView;
  isSearching: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  breadcrumb: Section[];
  setSelectedSectionId: (id: string | null) => void;
  selectSection: (id: string | null) => void;
  grouped: GroupedEntry[];
  displayGrouped: GroupedEntry[];
  tableLocale: string | null;
  defaultLang: string;
  canDragEntries: boolean;
  entriesLoading: boolean;
  allSections: Section[];
  refCounts: Record<string, number>;
  sensors: ReturnType<typeof useSensors>;
  onEntryDragEnd: (event: DragEndEvent) => void;
  bulkDeletePending: boolean;
  deleteEntryPending: boolean;
  confirmAction: ConfirmAction | null;
  setConfirmAction: (a: ConfirmAction | null) => void;
  openCreateEntry: () => void;
  openEditEntry: (g: GroupedEntry) => void;
  setRefsKey: (k: string | null) => void;
  emptyDesc: string;
}) {
  return (
            <div className="flex-1 min-w-0 md:flex md:flex-col md:min-h-0">
              <Card className="overflow-hidden md:flex md:flex-col md:flex-1 md:min-h-0">
                {/* Panel header */}
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {!isSearching && breadcrumb.length > 0 ? (
                        <nav className="flex items-center gap-1 flex-wrap">
                          <button
                            onClick={() => setSelectedSectionId(null)}
                            className="text-xs text-zinc-400 hover:text-accent transition-colors"
                          >
                            Todas
                          </button>
                          {breadcrumb.map((crumb, i) => (
                            <span
                              key={crumb.sectionId}
                              className="flex items-center gap-1"
                            >
                              <Icon
                                name="chevronRight"
                                className="w-3 h-3 text-zinc-300 dark:text-zinc-600 shrink-0"
                              />
                              {i < breadcrumb.length - 1 ? (
                                <button
                                  onClick={() => selectSection(crumb.sectionId)}
                                  className="text-xs text-zinc-400 hover:text-accent transition-colors"
                                >
                                  {crumb.name}
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                                  {crumb.name}
                                </span>
                              )}
                            </span>
                          ))}
                        </nav>
                      ) : (
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {isSearching
                            ? "Resultados da pesquisa"
                            : "Todas as entradas"}
                        </p>
                      )}
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {grouped.length}{" "}
                        {grouped.length === 1 ? "entrada" : "entradas"}
                        {tableLocale &&
                          ` · coluna: ${localeLabel(tableLocale)}`}
                        {isSearching && " em todas as secções"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {grouped.length > 0 && (
                        <GuardIconButton
                          icon={bulkDeletePending ? "loader" : "trash"}
                          label="Eliminar todas as entradas visíveis"
                          title="Eliminar todas as entradas visíveis"
                          onClick={() =>
                            setConfirmAction({
                              type: "bulkDelete",
                              count: grouped.length,
                              keys: grouped.map((g) => g.key),
                            })
                          }
                          disabled={bulkDeletePending}
                          className="!w-7 !h-7 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                        />
                      )}
                      <GuardButton icon="plus" size="sm" onClick={openCreateEntry}>
                        <span className="hidden sm:inline">Nova entrada</span>
                        <span className="sm:hidden">Nova</span>
                      </GuardButton>
                    </div>
                  </div>

                  <div className="relative">
                    <Icon
                      name="search"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Pesquisar por key ou conteúdo…"
                      className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg pl-9 pr-8 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400"
                    />
                    {isSearching && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        title="Limpar pesquisa"
                      >
                        <Icon name="x" className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Tablet/Desktop: table ── */}
                <div className="hidden md:block md:flex-1 md:min-h-0 md:overflow-auto">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onEntryDragEnd}
                  >
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white dark:bg-zinc-900 z-10">
                        <tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                          {canDragEntries && <th className="w-5 pl-3" />}
                          {activeTab === "website" && (
                            <th className="font-medium px-5 py-3">Key</th>
                          )}
                          {activeTab === "website" && (
                            <th className="font-medium px-4 py-3">Tipo</th>
                          )}
                          {isSearching && (
                            <th className="font-medium px-4 py-3">Secção</th>
                          )}
                          {tableLocale && (
                            <th className="font-medium px-4 py-3 flex items-center gap-1">
                              {localeLabel(tableLocale)}
                              {tableLocale === defaultLang && (
                                <span className="text-amber-400 text-xs">
                                  ★
                                </span>
                              )}
                            </th>
                          )}
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <SortableContext
                        items={displayGrouped.map((g) => g.key)}
                        strategy={verticalListSortingStrategy}
                      >
                        <tbody>
                          {entriesLoading &&
                            Array.from({ length: 4 }).map((_, i) => (
                              <tr
                                key={i}
                                className="border-b border-zinc-50 dark:border-zinc-800/50"
                              >
                                {canDragEntries && (
                                  <td className="pl-3 pr-1 w-5" />
                                )}
                                {[1, 2, 3].map((j) => (
                                  <td key={j} className="px-4 py-3.5">
                                    <div
                                      className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"
                                      style={{ width: `${40 + j * 15}%` }}
                                    />
                                  </td>
                                ))}
                                <td />
                              </tr>
                            ))}
                          {!entriesLoading &&
                            displayGrouped.map((grp) => {
                              const cells = (
                                <>
                                  {activeTab === "website" && (
                                    <td className="px-5 py-3.5">
                                      <code className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded px-1.5 py-0.5">
                                        {grp.key}
                                      </code>
                                    </td>
                                  )}
                                  {activeTab === "website" && (
                                    <td className="px-4 py-3.5 text-zinc-500 text-xs">
                                      {TYPE_LABEL[grp.type] ?? grp.type}
                                    </td>
                                  )}
                                  {isSearching && (
                                    <td className="px-4 py-3.5">
                                      {grp.sectionId ? (
                                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                          {allSections.find(
                                            (s) =>
                                              s.sectionId === grp.sectionId,
                                          )?.name ?? "—"}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-zinc-300 dark:text-zinc-600">
                                          Sem secção
                                        </span>
                                      )}
                                    </td>
                                  )}
                                  {tableLocale && (
                                    <td className="px-4 py-3.5 max-w-[220px] text-xs text-zinc-600 dark:text-zinc-400">
                                      {grp.type === "image" ? (
                                        grp.translations[tableLocale] ? (
                                          <img
                                            src={grp.translations[tableLocale]}
                                            alt=""
                                            className="h-9 w-14 object-cover rounded-md border border-zinc-100 dark:border-zinc-800"
                                          />
                                        ) : (
                                          <span className="text-zinc-300 dark:text-zinc-600">
                                            —
                                          </span>
                                        )
                                      ) : (
                                        <span className="truncate block">
                                          {grp.translations[tableLocale] ?? (
                                            <span className="text-zinc-300 dark:text-zinc-600">
                                              —
                                            </span>
                                          )}
                                        </span>
                                      )}
                                    </td>
                                  )}
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center justify-end gap-1">
                                      {(activeTab === "product" ||
                                        activeTab === "service") &&
                                        (refCounts[grp.key] ?? 0) > 0 && (
                                          <button
                                            onClick={() => setRefsKey(grp.key)}
                                            title="Ver associações"
                                            className="p-1.5 rounded-lg text-zinc-400 hover:text-accent hover:bg-accent/10 transition"
                                          >
                                            <Icon
                                              name="link"
                                              className="w-4 h-4"
                                            />
                                          </button>
                                        )}
                                      <button
                                        onClick={() => openEditEntry(grp)}
                                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                      >
                                        <Icon name="edit" className="w-4 h-4" />
                                      </button>
                                      <GuardIconButton
                                        icon={deleteEntryPending && confirmAction?.type === "deleteEntry" && confirmAction.key === grp.key ? "loader" : "trash"}
                                        label="Eliminar entrada"
                                        title="Eliminar entrada"
                                        onClick={() =>
                                          setConfirmAction({
                                            type: "deleteEntry",
                                            key: grp.key,
                                          })
                                        }
                                        disabled={deleteEntryPending}
                                        className="!w-7 !h-7 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                      />
                                    </div>
                                  </td>
                                </>
                              );
                              return canDragEntries ? (
                                <SortableEntryRow key={grp.key} id={grp.key}>
                                  {cells}
                                </SortableEntryRow>
                              ) : (
                                <tr
                                  key={grp.key}
                                  className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition"
                                >
                                  {cells}
                                </tr>
                              );
                            })}
                        </tbody>
                      </SortableContext>
                    </table>
                  </DndContext>
                  {!entriesLoading && displayGrouped.length === 0 && (
                    <EmptyState
                      icon={isSearching ? "search" : "layers"}
                      title={isSearching ? "Sem resultados" : "Sem entradas"}
                      desc={emptyDesc}
                    />
                  )}
                </div>

                {/* ── Mobile: card list ── */}
                <div className="md:hidden divide-y divide-zinc-50 dark:divide-zinc-800/50">
                  {entriesLoading &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="p-4 space-y-2">
                        <div className="h-4 w-36 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                        <div className="h-3 w-52 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                      </div>
                    ))}
                  {!entriesLoading &&
                    displayGrouped.map((grp) => {
                      const preview = tableLocale
                        ? grp.translations[tableLocale]
                        : Object.values(grp.translations)[0];
                      return (
                        <div
                          key={grp.key}
                          className="flex items-start gap-3 px-4 py-3.5 cursor-pointer active:bg-zinc-50 dark:active:bg-zinc-800/40 transition"
                          onClick={() => openEditEntry(grp)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded px-1.5 py-0.5 break-all">
                                {grp.key}
                              </code>
                              <span className="text-xs text-zinc-400">
                                {TYPE_LABEL[grp.type] ?? grp.type}
                              </span>
                            </div>
                            {isSearching && grp.sectionId && (
                              <span className="inline-block text-xs px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 mb-1">
                                {allSections.find(
                                  (s) => s.sectionId === grp.sectionId,
                                )?.name ?? "—"}
                              </span>
                            )}
                            {preview && grp.type === "text" && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5">
                                {preview}
                              </p>
                            )}
                            {preview && grp.type === "image" && (
                              <img
                                src={preview}
                                alt=""
                                className="h-10 w-16 object-cover rounded border border-zinc-100 dark:border-zinc-800 mt-1.5"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 mt-0.5">
                            {(activeTab === "product" ||
                              activeTab === "service") &&
                              (refCounts[grp.key] ?? 0) > 0 && (
                                <button
                                  className="p-2 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-accent hover:bg-accent/10 transition"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRefsKey(grp.key);
                                  }}
                                >
                                  <Icon name="link" className="w-4 h-4" />
                                </button>
                              )}
                            <GuardIconButton
                              icon="trash"
                              label="Eliminar entrada"
                              title="Eliminar entrada"
                              className="!w-8 !h-8 text-zinc-300 dark:text-zinc-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                setConfirmAction({
                                  type: "deleteEntry",
                                  key: grp.key,
                                });
                              }}
                              disabled={deleteEntryPending}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {!entriesLoading && displayGrouped.length === 0 && (
                    <EmptyState
                      icon={isSearching ? "search" : "layers"}
                      title={isSearching ? "Sem resultados" : "Sem entradas"}
                      desc={emptyDesc}
                    />
                  )}
                </div>
              </Card>
            </div>
  );
}
