import { useState, useMemo, useEffect } from "react";
import { useGetCmsSections } from "../../gen/backoffice/hooks/useGetCmsSections.js";
import { useGetCmsEntries } from "../../gen/backoffice/hooks/useGetCmsEntries.js";
import { useCmsReferencesCounts } from "../../hooks/useCmsReferences";
import { ConteudosView, SITE_ICON_KEY, getSectionPath, groupEntries } from "./model";

/** Dados do CMS para o separador activo: secções, entradas (agrupadas por key), filtros e ordem local. */
export function useCmsData({ activeTab, selectedSectionId, searchQuery }: { activeTab: ConteudosView; selectedSectionId: string | null; searchQuery: string }) {
  const { data: allSections = [], isLoading: sectionsLoading } =
    useGetCmsSections();
  const { data: allEntries = [], isLoading: entriesLoading } =
    useGetCmsEntries();

  // Filter sections and entries by active tab context
  const sections = useMemo(
    () => allSections.filter((s) => s.context === activeTab),
    [allSections, activeTab],
  );

  // Collect all section IDs for the current tab (including descendant sections)
  const tabSectionIds = useMemo(
    () => new Set(sections.map((s) => s.sectionId)),
    [sections],
  );

  const entries = useMemo(
    () =>
      allEntries.filter((e) => {
        // O ícone do site tem cartão dedicado no topo do tab "website" — não
        // duplicar como entrada solta na tabela/pesquisa.
        if (e.key === SITE_ICON_KEY) return false;
        if (e.sectionId != null) return tabSectionIds.has(e.sectionId);
        const context = e.key.startsWith("product.")
          ? "product"
          : e.key.startsWith("service.")
            ? "service"
            : e.key.startsWith("gym.")
              ? "gym"
              : "website";
        return context === activeTab;
      }),
    [allEntries, activeTab, tabSectionIds],
  );

  const rootSections = useMemo(
    () =>
      sections
        .filter((s) => !s.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [sections],
  );

  const isSearching = searchQuery.trim().length > 0;

  const grouped = useMemo(() => {
    const source = isSearching
      ? entries
      : selectedSectionId === null
        ? entries
        : entries.filter((e) => e.sectionId === selectedSectionId);

    const all = groupEntries(source);
    if (!isSearching) return all;

    const q = searchQuery.toLowerCase();
    return all.filter(
      (g) =>
        g.key.toLowerCase().includes(q) ||
        Object.values(g.translations).some((v) => v.toLowerCase().includes(q)),
    );
  }, [entries, selectedSectionId, searchQuery, isSearching]);

  const selectedSection = sections.find(
    (s) => s.sectionId === selectedSectionId,
  );
  const breadcrumb = useMemo(
    () => getSectionPath(sections, selectedSectionId),
    [sections, selectedSectionId],
  );
  const totalGroupedCount = useMemo(
    () => groupEntries(entries).length,
    [entries],
  );

  // Local entry order for optimistic DnD reordering
  const [orderedKeys, setOrderedKeys] = useState<string[]>([]);
  useEffect(() => {
    const newKeys = grouped.map((g) => g.key);
    setOrderedKeys((prev) =>
      prev.length === newKeys.length && prev.every((k, i) => k === newKeys[i])
        ? prev
        : newKeys,
    );
  }, [grouped]);
  const displayGrouped = useMemo(() => {
    if (orderedKeys.length === 0) return grouped;
    const map = new Map(grouped.map((g) => [g.key, g]));
    return orderedKeys.flatMap((k) => {
      const g = map.get(k);
      return g ? [g] : [];
    });
  }, [grouped, orderedKeys]);

  const canDragEntries = !isSearching;

  const refCountKeys = useMemo(
    () =>
      activeTab === "product" || activeTab === "service" || activeTab === "gym"
        ? grouped.map((g) => g.key)
        : [],
    [activeTab, grouped],
  );
  const { data: refCounts = {} } = useCmsReferencesCounts(refCountKeys);

  return {
    allSections, sectionsLoading, allEntries, entriesLoading, sections, entries, rootSections, isSearching, grouped,
    selectedSection, breadcrumb, totalGroupedCount, orderedKeys, setOrderedKeys, displayGrouped, canDragEntries, refCounts,
  };
}
