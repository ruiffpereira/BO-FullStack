import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { getApiError } from "../lib/apiError";
import { useAuth } from "../context/AuthContext";
import { Icon } from "../ui/icons.jsx";
import { PageHeader } from "../ui/ui.jsx";
import { usePageSubtitle } from "../context/PageMetaContext";
import { useWriteGuard } from "../hooks/useWriteGuard";
import { getCmsSectionsQueryKey } from "../gen/backoffice/hooks/useGetCmsSections.js";
import { getCmsEntriesQueryKey } from "../gen/backoffice/hooks/useGetCmsEntries.js";
import { useDeleteCmsEntriesKey } from "../gen/backoffice/hooks/useDeleteCmsEntriesKey.js";
import { deleteCmsEntries } from "../gen/backoffice/hooks/useDeleteCmsEntries.js";
import { postCmsSections } from "../gen/backoffice/hooks/usePostCmsSections.js";
import { patchCmsSectionsId } from "../gen/backoffice/hooks/usePatchCmsSectionsId.js";
import { patchCmsSectionsReorder } from "../gen/backoffice/hooks/usePatchCmsSectionsReorder.js";
import { patchCmsEntriesReorder } from "../gen/backoffice/hooks/usePatchCmsEntriesReorder.js";
import { useDeleteCmsSectionsId } from "../gen/backoffice/hooks/useDeleteCmsSectionsId.js";
import { EmailsPanel } from "../components/EmailsPanel";
import { NotificationsPanel } from "../components/NotificationsPanel";
import { CMS_TABS, ConfirmAction, ConteudosView, Section, SectionForm, emptySection } from "./conteudos/model";
import { LinguasPanel } from "./conteudos/LinguasPanel";
import { SiteIconCard } from "./conteudos/SiteIconCard";
import { CmsReferencesModal } from "./conteudos/CmsReferencesModal";

import { EntriesPanel } from "./conteudos/EntriesPanel";
import { MobileSectionsSheet, SectionsSidebar } from "./conteudos/SectionsPanels";
import { ImportModal } from "./conteudos/ImportModal";
import { EntryModal } from "./conteudos/EntryModal";
import { SectionModal } from "./conteudos/SectionModal";
import { CmsConfirmDialog } from "./conteudos/CmsConfirmDialog";
import { useEntryEditor } from "./conteudos/useEntryEditor";
import { useCmsData } from "./conteudos/useCmsData";
import { useCmsImport } from "./conteudos/useCmsImport";
import { useLanguageDraft } from "./conteudos/useLanguageDraft";
import { downloadCsvTemplate } from "./conteudos/importFile";

export type { ConteudosView } from "./conteudos/model";

// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * Página "Conteúdos" (core). Cada tab de CMS vive na sua própria rota
 * (`/conteudos`, `/conteudos/produtos|servicos|ginasio|linguas|emails|
 * notificacoes`, T2.6 — última página da Fase 2 da sidebar com submenus) — a
 * navegação entre vistas já não é feita por `Tabs` de topo, é a sidebar
 * (`NavItemGroup`/`Shell.tsx`); a página só recebe a vista pedida via `view`.
 * ÚNICA página desta fase com gating POR SUBITEM (produtos/serviços/ginásio
 * continuam atrás de VIEW_PRODUCTS/VIEW_SCHEDULE/VIEW_GYM, como as tabs
 * antigas) — `SUBMENU["/conteudos"]` espelha esse gating com `perm` por
 * subitem (`src/lib/navigation.ts`), e o guard do `Shell.tsx` já redireciona
 * um subitem sem permissão para o 1.º permitido. O fallback abaixo (mesmo
 * padrão do `FinanceiroPage`) é só defensivo, para o caso de a página ser
 * renderizada fora desse guard (ex.: testes).
 */
export function Conteudos({ view }: { view: ConteudosView }) {
  const { readOnly: writeLocked, message: writeMessage } = useWriteGuard();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  usePageSubtitle("Gere o conteúdo do site, produtos e serviços em múltiplos idiomas.");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Active tab
  const visibleTabs = CMS_TABS.filter(
    (t) => t.permission === null || hasPermission(t.permission),
  );
  const requestedTab = CMS_TABS.find((t) => t.id === view);
  const activeTab: ConteudosView =
    requestedTab &&
    (requestedTab.permission === null || hasPermission(requestedTab.permission))
      ? view
      : (visibleTabs[0]?.id ?? "website");

  // Section / search state
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  // References modal state
  const [refsKey, setRefsKey] = useState<string | null>(null);

  const {
    importFileRef, importModal, setImportModal, importRows, importSkipped, importMut, handleImportFile,
  } = useCmsImport(activeTab);

  // Section modal state
  const [sectionModal, setSectionModal] = useState(false);
  const [editSection, setEditSection] = useState<Section | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionForm>(
    emptySection(null),
  );

  // Confirm delete dialog
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );

  const {
    langData, saveLangs, selectedLangs, defaultLang, hasLangChanges, LOCALES, toggleLang, handleSetDefault, handleSaveLangs,
  } = useLanguageDraft();

  // Reset section selection when switching tabs
  useEffect(() => {
    setSelectedSectionId(null);
    setSearchQuery("");
  }, [activeTab]);

  // Navigate to a section — always clears the search so the section contents are visible
  const selectSection = (id: string | null) => {
    setSelectedSectionId(id);
    setSearchQuery("");
  };

  // ─── Queries ───────────────────────────────────────────────────────────────

  const {
    allSections, sectionsLoading, allEntries, entriesLoading, sections, rootSections, isSearching, grouped,
    selectedSection, breadcrumb, totalGroupedCount, orderedKeys, setOrderedKeys, displayGrouped, canDragEntries, refCounts,
  } = useCmsData({ activeTab, selectedSectionId, searchQuery });

  // Entrada (modal de criar/editar)
  const {
    entryModal, editEntryKey, entryForm, setEntryForm, uploadingIdx, saveEntryMut, closeEntryModal,
    openCreateEntry, openEditEntry, setTranslation, handleImagePick, handleImagePickerClick, handleSaveEntry,
  } = useEntryEditor({ activeTab, LOCALES, selectedSectionId, allEntries });

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const deleteEntryMut = useDeleteCmsEntriesKey({
    mutation: {
      onSuccess: () => {
        setConfirmAction(null);
        toast.success("Entrada eliminada");
        qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() });
      },
      onError: (e: any) => {
        setConfirmAction(null);
        const status = e?.response?.status;
        const details = e?.response?.data?.details;
        if (status === 409 && details) {
          const parts: string[] = [];
          if (details.products > 0)
            parts.push(
              `${details.products} produto${details.products > 1 ? "s" : ""}`,
            );
          if (details.services > 0)
            parts.push(
              `${details.services} serviço${details.services > 1 ? "s" : ""}`,
            );
          if (details.gym > 0)
            parts.push(
              `${details.gym} item${details.gym > 1 ? "s" : ""} de ginásio`,
            );
          toast.error(
            `Não é possível eliminar: esta entrada está associada a ${parts.join(" e ")}`,
          );
        } else {
          toast.error(getApiError(e));
        }
      },
    },
  });

  const saveSectionMut = useMutation({
    mutationFn: async (f: SectionForm & { id?: string }) => {
      if (f.id) {
        await patchCmsSectionsId(f.id, {
          name: f.name,
          parentId: f.parentId,
        });
      } else {
        // Línguas/emails/notificações não têm secções (o botão nem aparece nesses separadores).
        if (activeTab === "linguas" || activeTab === "emails" || activeTab === "notificacoes") return;
        await postCmsSections({
          name: f.name,
          parentId: f.parentId,
          context: activeTab,
        });
      }
    },
    onSuccess: () => {
      toast.success("Secção guardada");
      qc.invalidateQueries({ queryKey: getCmsSectionsQueryKey() });
      closeSectionModal();
    },
    onError: (e: any) => toast.error(getApiError(e)),
  });

  const deleteSectionMut = useDeleteCmsSectionsId({
    mutation: {
      onSuccess: (_, { id }) => {
        setConfirmAction(null);
        toast.success("Secção eliminada");
        qc.invalidateQueries({ queryKey: getCmsSectionsQueryKey() });
        qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() });
        if (selectedSectionId === id) setSelectedSectionId(null);
      },
      onError: (e: any) => {
        setConfirmAction(null);
        toast.error(getApiError(e));
      },
    },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (keys: string[]) =>
      deleteCmsEntries({ keys }),
    onSuccess: ({ deleted, skipped }) => {
      setConfirmAction(null);
      toast.success(
        `${deleted} entr${deleted === 1 ? "ada eliminada" : "adas eliminadas"}${skipped > 0 ? ` · ${skipped} em uso ignoradas` : ""}`,
      );
      qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() });
      qc.invalidateQueries({ queryKey: getCmsSectionsQueryKey() });
    },
    onError: () => {
      setConfirmAction(null);
      toast.error("Erro ao eliminar entradas");
    },
  });

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeSec = sections.find((s) => s.sectionId === String(active.id));
    const overSec = sections.find((s) => s.sectionId === String(over.id));
    if (!activeSec || !overSec || activeSec.parentId !== overSec.parentId)
      return;

    const siblings = sections
      .filter((s) => s.parentId === activeSec.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const oldIdx = siblings.findIndex((s) => s.sectionId === String(active.id));
    const newIdx = siblings.findIndex((s) => s.sectionId === String(over.id));
    const reordered = arrayMove(siblings, oldIdx, newIdx);

    qc.setQueryData<Section[]>(getCmsSectionsQueryKey(), (old = []) =>
      old.map((s) => {
        const idx = reordered.findIndex((r) => r.sectionId === s.sectionId);
        return idx >= 0 ? { ...s, sortOrder: idx } : s;
      }),
    );

    patchCmsSectionsReorder(
      {
        orders: reordered.map((s, i) => ({ id: s.sectionId, sortOrder: i })),
      },
    ).catch(() => {
      toast.error("Erro ao reordenar secções");
      qc.invalidateQueries({ queryKey: getCmsSectionsQueryKey() });
    });
  }

  function handleEntryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = orderedKeys.indexOf(String(active.id));
    const newIdx = orderedKeys.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;

    const newOrder = arrayMove(orderedKeys, oldIdx, newIdx);
    setOrderedKeys(newOrder);

    patchCmsEntriesReorder(
      { orders: newOrder.map((key, i) => ({ key, sortOrder: i })) },
    ).catch(() => {
      toast.error("Erro ao reordenar entradas");
      setOrderedKeys(orderedKeys);
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const closeSectionModal = () => {
    setSectionModal(false);
    setEditSection(null);
    setSectionForm(emptySection(null));
  };

  const openCreateSection = (parentId: string | null = null) => {
    setEditSection(null);
    setSectionForm(emptySection(parentId));
    setSectionModal(true);
  };

  const openEditSection = (s: Section) => {
    setEditSection(s);
    setSectionForm({ name: s.name, parentId: s.parentId ?? null });
    setSectionModal(true);
  };

  const handleDeleteSection = (s: Section) => {
    setConfirmAction({ type: "deleteSection", section: s });
  };

  const handleConfirmDelete = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "deleteEntry")
      deleteEntryMut.mutate({ key: confirmAction.key });
    else if (confirmAction.type === "deleteSection")
      deleteSectionMut.mutate({ id: confirmAction.section.sectionId });
    else if (confirmAction.type === "bulkDelete")
      bulkDeleteMut.mutate(confirmAction.keys);
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionForm.name.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }
    saveSectionMut.mutate({ ...sectionForm, id: editSection?.sectionId });
  };

  const emptyDesc = isSearching
    ? `Nenhuma entrada encontrada para "${searchQuery}".`
    : selectedSection
      ? `Ainda não há entradas em "${selectedSection.name}".`
      : `Cria a primeira entrada de conteúdo em "${CMS_TABS.find((t) => t.id === activeTab)?.label}".`;

  // Default language - only show in default lang column in table
  const tableLocale =
    defaultLang && selectedLangs.includes(defaultLang)
      ? defaultLang
      : (selectedLangs[0] ?? null);

  // Locale "seleccionado na página" para o ícone do site (cartão fixo, único
  // valor — não traduzido por língua como as outras entradas).
  const iconLocale = tableLocale ?? defaultLang ?? "pt";

  const sectionsProps = {
    sections, rootSections, selectedSectionId, totalGroupedCount, sectionsLoading, sensors,
    onDragEnd: handleSectionDragEnd, selectSection, openCreateSection, openEditSection, onDelete: handleDeleteSection,
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    // CMS (md+): o Shell dá a altura (`fillConteudos`) e o painel de entradas enche o que sobra — scroll interno, sem alturas do viewport.
    <div className="md:flex md:flex-col md:h-full md:min-h-0">
      <PageHeader>
        {activeTab !== "linguas" && activeTab !== "emails" && activeTab !== "notificacoes" && (
          <button
            onClick={() => importFileRef.current?.click()}
            disabled={writeLocked}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 text-sm text-zinc-500 hover:border-accent hover:text-accent transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-zinc-300 disabled:hover:text-zinc-500"
            title={writeLocked ? writeMessage : "Importar CSV ou Excel"}
          >
            <Icon name="upload" className="w-4 h-4" />
            <span className="hidden sm:inline">Importar</span>
          </button>
        )}
      </PageHeader>

      {/* ── Línguas tab ── */}
      {activeTab === "linguas" && (
        <LinguasPanel
          available={langData?.available ?? []}
          selected={selectedLangs}
          defaultLang={defaultLang}
          onToggle={toggleLang}
          onSetDefault={handleSetDefault}
          onSave={handleSaveLangs}
          isSaving={saveLangs.isPending}
          hasChanges={hasLangChanges}
        />
      )}

      {/* ── Emails tab ── */}
      {activeTab === "emails" && <EmailsPanel />}

      {/* ── Notificações tab ── */}
      {activeTab === "notificacoes" && <NotificationsPanel />}

      {/* ── CMS content (hidden on línguas/emails/notificações tabs) ── */}
      {activeTab !== "linguas" && activeTab !== "emails" && activeTab !== "notificacoes" && (
        <>
          {/* ── Ícone do site (cartão fixo, só no tab "website") ── */}
          {activeTab === "website" && (
            <SiteIconCard entries={allEntries} locale={iconLocale} />
          )}

          {/* ── Mobile section selector ── */}
          <button
            onClick={() => setMobileTreeOpen(true)}
            className="md:hidden w-full flex items-center gap-3 mb-3 px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-left transition hover:border-zinc-300 dark:hover:border-zinc-600 active:bg-zinc-50 dark:active:bg-zinc-800/60"
          >
            <Icon name="layers" className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="flex-1 font-medium text-zinc-700 dark:text-zinc-200 truncate">
              {selectedSection?.name ?? "Todas as secções"}
            </span>
            <span className="text-xs text-zinc-400 tabular-nums">
              {grouped.length}
            </span>
            <Icon
              name="chevronDown"
              className="w-4 h-4 text-zinc-400 shrink-0"
            />
          </button>

          <div className="flex flex-col md:flex-row gap-4 items-start md:items-stretch md:flex-1 md:min-h-[24rem]">
            {/* ── Left: section tree (tablet/desktop) ── */}
            <SectionsSidebar {...sectionsProps} />

            {/* ── Right: entries panel ── */}
            <EntriesPanel
              activeTab={activeTab}
              isSearching={isSearching}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              breadcrumb={breadcrumb}
              setSelectedSectionId={setSelectedSectionId}
              selectSection={selectSection}
              grouped={grouped}
              displayGrouped={displayGrouped}
              tableLocale={tableLocale}
              defaultLang={defaultLang}
              canDragEntries={canDragEntries}
              entriesLoading={entriesLoading}
              allSections={allSections}
              refCounts={refCounts as Record<string, number>}
              sensors={sensors}
              onEntryDragEnd={handleEntryDragEnd}
              bulkDeletePending={bulkDeleteMut.isPending}
              deleteEntryPending={deleteEntryMut.isPending}
              confirmAction={confirmAction}
              setConfirmAction={setConfirmAction}
              openCreateEntry={openCreateEntry}
              openEditEntry={openEditEntry}
              setRefsKey={setRefsKey}
              emptyDesc={emptyDesc}
            />
          </div>

          {/* ── Mobile section bottom sheet ── */}
          {mobileTreeOpen && (
            <MobileSectionsSheet
              {...sectionsProps}
              onClose={() => setMobileTreeOpen(false)}
            />
          )}
        </>
      )}

      <input
        ref={importFileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* ── Modal: import CSV/Excel ── */}
      {importModal && (
        <ImportModal
          rows={importRows}
          skipped={importSkipped}
          isPending={importMut.isPending}
          onClose={() => setImportModal(false)}
          onImport={() => importMut.mutate()}
          onDownloadTemplate={downloadCsvTemplate}
        />
      )}

      {/* ── Modal: entry ── */}
      {entryModal && (
        <EntryModal
          entryForm={entryForm}
          setEntryForm={setEntryForm}
          editEntryKey={editEntryKey}
          activeTab={activeTab}
          sections={sections}
          defaultLang={defaultLang}
          uploadingIdx={uploadingIdx}
          isSaving={saveEntryMut.isPending}
          onClose={closeEntryModal}
          onSubmit={handleSaveEntry}
          setTranslation={setTranslation}
          onPickImage={handleImagePick}
          onPickerClick={handleImagePickerClick}
        />
      )}

      {/* ── Modal: section ── */}
      {sectionModal && (
        <SectionModal
          editSection={editSection}
          sections={sections}
          sectionForm={sectionForm}
          setSectionForm={setSectionForm}
          activeTab={activeTab}
          isSaving={saveSectionMut.isPending}
          onClose={closeSectionModal}
          onSubmit={handleSaveSection}
        />
      )}

      {refsKey && (
        <CmsReferencesModal cmsKey={refsKey} onClose={() => setRefsKey(null)} />
      )}

      {/* ── Confirm delete dialog ── */}
      <CmsConfirmDialog
        confirmAction={confirmAction}
        isPending={
          confirmAction?.type === "deleteEntry"
            ? deleteEntryMut.isPending
            : confirmAction?.type === "deleteSection"
              ? deleteSectionMut.isPending
              : confirmAction?.type === "bulkDelete"
                ? bulkDeleteMut.isPending
                : false
        }
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
