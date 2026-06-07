import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { Icon } from '../ui/icons.jsx'
import { Card, Modal, Input, Button, PageHeader, EmptyState } from '../ui/ui.jsx'
import { useGetCmsSections, getCmsSectionsQueryKey } from '../gen/backoffice/hooks/useGetCmsSections.js'
import { useGetCmsEntries, getCmsEntriesQueryKey } from '../gen/backoffice/hooks/useGetCmsEntries.js'
import { putCmsEntries } from '../gen/backoffice/hooks/usePutCmsEntries.js'
import { useDeleteCmsEntriesKey } from '../gen/backoffice/hooks/useDeleteCmsEntriesKey.js'
import { postCmsSections } from '../gen/backoffice/hooks/usePostCmsSections.js'
import { patchCmsSectionsId } from '../gen/backoffice/hooks/usePatchCmsSectionsId.js'
import { useDeleteCmsSectionsId } from '../gen/backoffice/hooks/useDeleteCmsSectionsId.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api'

// ─── Types ───────────────────────────────────────────────────────────────────

type Section = { sectionId: string; parentId: string | null; name: string; sortOrder: number }
type ContentEntry = { entryId: string; key: string; locale: string | null; value: string; type: string; sectionId: string | null }
type GroupedEntry = { key: string; type: string; translations: Record<string, string>; sectionId: string | null }
type EntryForm = { key: string; type: string; translations: { locale: string; value: string }[]; sectionId: string | null }
type SectionForm = { name: string; parentId: string | null }

const LOCALES = ['pt', 'en', 'es', 'fr', 'de', 'it']
const LOCALE_LABEL: Record<string, string> = { pt: 'PT', en: 'EN', es: 'ES', fr: 'FR', de: 'DE', it: 'IT' }
const TYPE_LABEL: Record<string, string> = { text: 'Texto', image: 'Imagem' }

const emptyEntry = (sectionId: string | null): EntryForm => ({
  key: '', type: 'text', translations: [{ locale: 'pt', value: '' }], sectionId,
})
const emptySection = (parentId: string | null): SectionForm => ({ name: '', parentId })

const inputCls = 'w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100'

function groupEntries(entries: ContentEntry[]): GroupedEntry[] {
  const map = new Map<string, GroupedEntry>()
  for (const e of entries) {
    if (!map.has(e.key)) map.set(e.key, { key: e.key, type: e.type, translations: {}, sectionId: e.sectionId ?? null })
    map.get(e.key)!.translations[e.locale ?? '_'] = e.value
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function getSectionPath(sections: Section[], sectionId: string | null): Section[] {
  if (!sectionId) return []
  const path: Section[] = []
  let id: string | null = sectionId
  while (id) {
    const s = sections.find((s) => s.sectionId === id)
    if (!s) break
    path.unshift(s)
    id = s.parentId
  }
  return path
}

// ─── Section tree node ────────────────────────────────────────────────────────

function SectionNode({
  section, sections, selectedId, depth,
  onSelect, onAddChild, onEdit, onDelete,
}: {
  section: Section; sections: Section[]; selectedId: string | null; depth: number
  onSelect: (id: string) => void; onAddChild: (parentId: string) => void
  onEdit: (s: Section) => void; onDelete: (s: Section) => void
}) {
  const children = sections
    .filter((s) => s.parentId === section.sectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const [open, setOpen] = useState(true)
  const active = selectedId === section.sectionId

  return (
    <div>
      <div
        onClick={() => onSelect(section.sectionId)}
        className={`group flex items-center gap-1 rounded-lg text-sm cursor-pointer transition-colors ${active ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: 4, paddingTop: 6, paddingBottom: 6 }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
          className="w-4 h-4 shrink-0 flex items-center justify-center opacity-50"
        >
          {children.length > 0
            ? <Icon name={open ? 'chevronDown' : 'chevronRight'} className="w-3 h-3" />
            : <span className="w-3" />}
        </button>
        <span className="flex-1 truncate font-medium">{section.name}</span>
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(section.sectionId) }}
            className="p-0.5 rounded hover:text-accent"
            title="Adicionar subsecção"
          >
            <Icon name="plus" className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(section) }}
            className="p-0.5 rounded hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <Icon name="edit" className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(section) }}
            className="p-0.5 rounded hover:text-red-500"
          >
            <Icon name="trash" className="w-3 h-3" />
          </button>
        </div>
      </div>
      {open && children.map((child) => (
        <SectionNode
          key={child.sectionId}
          section={child}
          sections={sections}
          selectedId={selectedId}
          depth={depth + 1}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Conteudos() {
  const { authHeader } = useAuth()
  const qc = useQueryClient()

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Entry modal state
  const [entryModal, setEntryModal] = useState(false)
  const [editEntryKey, setEditEntryKey] = useState<string | null>(null)
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntry(null))
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)

  // Section modal state
  const [sectionModal, setSectionModal] = useState(false)
  const [editSection, setEditSection] = useState<Section | null>(null)
  const [sectionForm, setSectionForm] = useState<SectionForm>(emptySection(null))

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: sections = [], isLoading: sectionsLoading } = useGetCmsSections()
  const { data: entries = [], isLoading: entriesLoading } = useGetCmsEntries()

  const rootSections = useMemo(() =>
    sections.filter((s) => !s.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
  [sections])

  const isSearching = searchQuery.trim().length > 0

  // When searching: ignore section filter and search all entries by key or value
  const grouped = useMemo(() => {
    const source = isSearching
      ? entries
      : selectedSectionId === null ? entries : entries.filter((e) => e.sectionId === selectedSectionId)

    const all = groupEntries(source)
    if (!isSearching) return all

    const q = searchQuery.toLowerCase()
    return all.filter((g) =>
      g.key.toLowerCase().includes(q) ||
      Object.values(g.translations).some((v) => v.toLowerCase().includes(q))
    )
  }, [entries, selectedSectionId, searchQuery, isSearching])

  const activeLocales = useMemo(() => {
    const source = isSearching
      ? entries
      : selectedSectionId === null ? entries : entries.filter((e) => e.sectionId === selectedSectionId)
    const s = new Set<string>()
    for (const e of source) if (e.locale) s.add(e.locale)
    return LOCALES.filter((l) => s.has(l))
  }, [entries, selectedSectionId, isSearching])

  const selectedSection = sections.find((s) => s.sectionId === selectedSectionId)
  const breadcrumb = useMemo(() => getSectionPath(sections, selectedSectionId), [sections, selectedSectionId])

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const saveEntryMut = useMutation({
    mutationFn: async (f: EntryForm) => {
      const toSave = f.translations.filter((t) => t.value.trim())
      if (!toSave.length) throw new Error('Adiciona pelo menos um valor')
      for (const t of toSave) {
        await putCmsEntries({ key: f.key.trim(), locale: t.locale || null, value: t.value, type: f.type, sectionId: f.sectionId } as any)
      }
    },
    onSuccess: () => { toast.success('Entrada guardada'); qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() }); closeEntryModal() },
    onError: (e: any) => toast.error(e.message ?? getApiError(e)),
  })

  const deleteEntryMut = useDeleteCmsEntriesKey({
    mutation: {
      onSuccess: () => { toast.success('Entrada eliminada'); qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() }) },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  const saveSectionMut = useMutation({
    mutationFn: async (f: SectionForm & { id?: string }) => {
      if (f.id) {
        await patchCmsSectionsId(f.id, { name: f.name, parentId: f.parentId } as any)
      } else {
        await postCmsSections({ name: f.name, parentId: f.parentId } as any)
      }
    },
    onSuccess: () => { toast.success('Secção guardada'); qc.invalidateQueries({ queryKey: getCmsSectionsQueryKey() }); closeSectionModal() },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const deleteSectionMut = useDeleteCmsSectionsId({
    mutation: {
      onSuccess: (_, { id }) => {
        toast.success('Secção eliminada')
        qc.invalidateQueries({ queryKey: getCmsSectionsQueryKey() })
        qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() })
        if (selectedSectionId === id) setSelectedSectionId(null)
      },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const closeEntryModal = () => { setEntryModal(false); setEditEntryKey(null); setEntryForm(emptyEntry(selectedSectionId)) }
  const closeSectionModal = () => { setSectionModal(false); setEditSection(null); setSectionForm(emptySection(null)) }

  const openCreateEntry = () => { setEditEntryKey(null); setEntryForm(emptyEntry(selectedSectionId)); setEntryModal(true) }

  const openEditEntry = (grp: GroupedEntry) => {
    setEditEntryKey(grp.key)
    const entry = entries.find((e) => e.key === grp.key)
    setEntryForm({
      key: grp.key,
      type: grp.type,
      sectionId: entry?.sectionId ?? null,
      translations: Object.entries(grp.translations).map(([locale, value]) => ({ locale: locale === '_' ? '' : locale, value })),
    })
    setEntryModal(true)
  }

  const openCreateSection = (parentId: string | null = null) => {
    setEditSection(null); setSectionForm(emptySection(parentId)); setSectionModal(true)
  }

  const openEditSection = (s: Section) => {
    setEditSection(s); setSectionForm({ name: s.name, parentId: s.parentId }); setSectionModal(true)
  }

  const handleDeleteSection = (s: Section) => {
    if (window.confirm(`Eliminar "${s.name}"? As entradas dentro desta secção ficam sem secção.`))
      deleteSectionMut.mutate({ id: s.sectionId })
  }

  const setTranslation = (i: number, field: 'locale' | 'value', val: string) =>
    setEntryForm((f) => { const t = [...f.translations]; t[i] = { ...t[i], [field]: val }; return { ...f, translations: t } })

  const handleImagePick = async (file: File, idx: number) => {
    setUploadingIdx(idx)
    try {
      const presignRes = await fetch(`${API_BASE}/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ filename: file.name, contentType: file.type, module: 'cms', fileSize: file.size }),
      })
      if (!presignRes.ok) throw new Error('Erro ao obter URL de upload')
      const { uploadUrl, fileUrl } = await presignRes.json() as { uploadUrl: string; fileUrl: string }
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!uploadRes.ok) throw new Error('Erro ao fazer upload')
      setTranslation(idx, 'value', fileUrl)
      toast.success('Imagem carregada')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao carregar imagem')
    } finally {
      setUploadingIdx(null)
    }
  }

  const addLocale = (locale: string) => {
    if (entryForm.translations.some((t) => t.locale === locale)) return
    setEntryForm((f) => ({ ...f, translations: [...f.translations, { locale, value: '' }] }))
  }

  const removeTranslation = (i: number) =>
    setEntryForm((f) => ({ ...f, translations: f.translations.filter((_, idx) => idx !== i) }))

  const usedLocales = new Set(entryForm.translations.map((t) => t.locale))
  const availableLocales = LOCALES.filter((l) => !usedLocales.has(l))

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault()
    if (!entryForm.key.trim()) { toast.error('A key é obrigatória'); return }
    saveEntryMut.mutate(entryForm)
  }

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sectionForm.name.trim()) { toast.error('O nome é obrigatório'); return }
    saveSectionMut.mutate({ ...sectionForm, id: editSection?.sectionId })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Conteúdos"
        subtitle="Organiza o conteúdo dos sites em secções hierárquicas. Cada entrada suporta múltiplos idiomas."
      />

      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── Left: section tree ── */}
        <div className="w-full lg:w-56 lg:shrink-0">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Secções</span>
              <button
                onClick={() => openCreateSection(null)}
                className="p-1 rounded text-zinc-400 hover:text-accent hover:bg-accent/10 transition"
                title="Nova secção"
              >
                <Icon name="plus" className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-1.5 space-y-0.5">
              {/* "All" item */}
              <div
                onClick={() => setSelectedSectionId(null)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${selectedSectionId === null ? 'bg-accent/10 text-accent' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
              >
                <Icon name="layers" className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">Todas</span>
                <span className="ml-auto text-xs opacity-60">{entries.length}</span>
              </div>

              {sectionsLoading && (
                <div className="space-y-1 px-2 py-1">
                  {[1, 2, 3].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />)}
                </div>
              )}

              {rootSections.map((s) => (
                <SectionNode
                  key={s.sectionId}
                  section={s}
                  sections={sections}
                  selectedId={selectedSectionId}
                  depth={0}
                  onSelect={setSelectedSectionId}
                  onAddChild={(parentId) => openCreateSection(parentId)}
                  onEdit={openEditSection}
                  onDelete={handleDeleteSection}
                />
              ))}

              {!sectionsLoading && sections.length === 0 && (
                <p className="text-xs text-zinc-400 text-center py-3 px-2">
                  Sem secções.<br />Clica + para criar.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* ── Right: entries panel ── */}
        <div className="flex-1 min-w-0">
          <Card className="overflow-hidden">

            {/* Panel header */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3">

              {/* Title row */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {/* Breadcrumb */}
                  {!isSearching && breadcrumb.length > 0 ? (
                    <nav className="flex items-center gap-1 flex-wrap">
                      <button
                        onClick={() => setSelectedSectionId(null)}
                        className="text-xs text-zinc-400 hover:text-accent transition-colors"
                      >
                        Todas
                      </button>
                      {breadcrumb.map((crumb, i) => (
                        <span key={crumb.sectionId} className="flex items-center gap-1">
                          <Icon name="chevronRight" className="w-3 h-3 text-zinc-300 dark:text-zinc-600 shrink-0" />
                          {i < breadcrumb.length - 1 ? (
                            <button
                              onClick={() => setSelectedSectionId(crumb.sectionId)}
                              className="text-xs text-zinc-400 hover:text-accent transition-colors"
                            >
                              {crumb.name}
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{crumb.name}</span>
                          )}
                        </span>
                      ))}
                    </nav>
                  ) : (
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {isSearching ? 'Resultados da pesquisa' : 'Todas as entradas'}
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {grouped.length} {grouped.length === 1 ? 'entrada' : 'entradas'}
                    {!isSearching && activeLocales.length > 0 && ` · ${activeLocales.map((l) => LOCALE_LABEL[l]).join(', ')}`}
                    {isSearching && ` em todas as secções`}
                  </p>
                </div>
                <Button icon="plus" size="sm" onClick={openCreateEntry}>Nova entrada</Button>
              </div>

              {/* Search row */}
              <div className="relative">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por key ou conteúdo…"
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg pl-9 pr-8 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400"
                />
                {isSearching && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    title="Limpar pesquisa"
                  >
                    <Icon name="x" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="font-medium px-5 py-3">Key</th>
                    <th className="font-medium px-4 py-3 hidden sm:table-cell">Tipo</th>
                    {isSearching && (
                      <th className="font-medium px-4 py-3 hidden sm:table-cell">Secção</th>
                    )}
                    {activeLocales.map((l) => (
                      <th key={l} className="font-medium px-4 py-3 hidden md:table-cell">{LOCALE_LABEL[l]}</th>
                    ))}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {entriesLoading && Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800/50">
                      {[1, 2, 3].map((j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" style={{ width: `${40 + j * 15}%` }} />
                        </td>
                      ))}
                      <td />
                    </tr>
                  ))}
                  {!entriesLoading && grouped.map((grp) => (
                    <tr key={grp.key} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                      <td className="px-5 py-3.5">
                        <code className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded px-1.5 py-0.5">{grp.key}</code>
                      </td>
                      <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell text-xs">{TYPE_LABEL[grp.type] ?? grp.type}</td>
                      {isSearching && (
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          {grp.sectionId
                            ? <span className="text-xs px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                {sections.find((s) => s.sectionId === grp.sectionId)?.name ?? '—'}
                              </span>
                            : <span className="text-xs text-zinc-300 dark:text-zinc-600">Sem secção</span>
                          }
                        </td>
                      )}
                      {activeLocales.map((l) => (
                        <td key={l} className="px-4 py-3.5 hidden md:table-cell max-w-[180px] text-xs text-zinc-600 dark:text-zinc-400">
                          {grp.type === 'image'
                            ? grp.translations[l]
                              ? <img src={grp.translations[l]} alt="" className="h-9 w-14 object-cover rounded-md border border-zinc-100 dark:border-zinc-800" />
                              : <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            : <span className="truncate block">{grp.translations[l] ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}</span>
                          }
                        </td>
                      ))}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditEntry(grp)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                            <Icon name="edit" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if (window.confirm(`Eliminar "${grp.key}"?`)) deleteEntryMut.mutate({ key: grp.key }) }}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                          >
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!entriesLoading && grouped.length === 0 && (
                <EmptyState
                  icon={isSearching ? 'search' : 'layers'}
                  title={isSearching ? 'Sem resultados' : 'Sem entradas'}
                  desc={
                    isSearching
                      ? `Nenhuma entrada encontrada para "${searchQuery}".`
                      : selectedSection
                        ? `Ainda não há entradas em "${selectedSection.name}".`
                        : 'Cria a primeira entrada de conteúdo.'
                  }
                />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Modal: entry ── */}
      {entryModal && (
        <Modal
          open
          onClose={closeEntryModal}
          title={editEntryKey ? `Editar — ${editEntryKey}` : 'Nova entrada'}
          width="max-w-lg"
          footer={
            <>
              <Button variant="ghost" onClick={closeEntryModal}>Cancelar</Button>
              <Button type="submit" form="cms-entry-form" disabled={saveEntryMut.isPending}>
                {saveEntryMut.isPending ? 'A guardar…' : 'Guardar'}
              </Button>
            </>
          }
        >
          <form id="cms-entry-form" onSubmit={handleSaveEntry} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Key</label>
                <input
                  value={entryForm.key}
                  onChange={(e) => !editEntryKey && setEntryForm((f) => ({ ...f, key: e.target.value }))}
                  readOnly={!!editEntryKey}
                  placeholder="hero.title"
                  className={`${inputCls} ${editEntryKey ? 'opacity-60 cursor-default' : ''}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tipo</label>
                <select value={entryForm.type} onChange={(e) => setEntryForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
                  <option value="text">Texto</option>
                  <option value="image">Imagem</option>
                </select>
              </div>
              {sections.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Secção</label>
                  <select
                    value={entryForm.sectionId ?? ''}
                    onChange={(e) => setEntryForm((f) => ({ ...f, sectionId: e.target.value || null }))}
                    className={inputCls}
                  >
                    <option value="">Sem secção</option>
                    {sections.map((s) => (
                      <option key={s.sectionId} value={s.sectionId}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Traduções</p>
                {availableLocales.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {availableLocales.map((l) => (
                      <button key={l} type="button" onClick={() => addLocale(l)}
                        className="text-xs px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-accent hover:text-accent transition">
                        + {LOCALE_LABEL[l]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {entryForm.translations.map((t, i) => (
                <div key={i} className={`flex gap-2 ${entryForm.type === 'image' ? 'items-start' : 'items-center'}`}>
                  <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    {LOCALE_LABEL[t.locale] ?? (t.locale ? t.locale.toUpperCase() : '—')}
                  </span>

                  {entryForm.type === 'text' ? (
                    <textarea
                      value={t.value}
                      onChange={(e) => {
                        setTranslation(i, 'value', e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 320)}px`
                      }}
                      onFocus={(e) => {
                        e.target.style.height = 'auto'
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 320)}px`
                      }}
                      placeholder="Valor…"
                      rows={3}
                      className={`${inputCls} flex-1 resize-none overflow-y-auto min-h-[80px] max-h-[320px]`}
                    />
                  ) : entryForm.type === 'image' ? (
                    <div className="flex-1 space-y-1.5">
                      <label className="block cursor-pointer group">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImagePick(f, i) }}
                        />
                        {t.value ? (
                          <div className="relative h-28 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                            <img src={t.value} alt="" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                              <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                                <Icon name="image" className="w-4 h-4" /> Trocar imagem
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 group-hover:border-accent transition-colors flex flex-col items-center justify-center gap-2">
                            {uploadingIdx === i
                              ? <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                              : <>
                                  <Icon name="image" className="w-6 h-6 text-zinc-300 dark:text-zinc-600 group-hover:text-accent transition-colors" />
                                  <span className="text-xs text-zinc-400 group-hover:text-accent transition-colors">Clica para carregar imagem</span>
                                </>
                            }
                          </div>
                        )}
                      </label>
                    </div>
                  ) : null}

                  {entryForm.translations.length > 1 && (
                    <button type="button" onClick={() => removeTranslation(i)}
                      className="shrink-0 p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                      <Icon name="x" className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: section ── */}
      {sectionModal && (
        <Modal
          open
          onClose={closeSectionModal}
          title={editSection ? 'Editar secção' : 'Nova secção'}
          width="max-w-sm"
          footer={
            <>
              <Button variant="ghost" onClick={closeSectionModal}>Cancelar</Button>
              <Button type="submit" form="cms-section-form" disabled={saveSectionMut.isPending}>
                {saveSectionMut.isPending ? 'A guardar…' : 'Guardar'}
              </Button>
            </>
          }
        >
          <form id="cms-section-form" onSubmit={handleSaveSection} className="space-y-3">
            <Input
              label="Nome"
              value={sectionForm.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSectionForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Homepage, Hero, Serviços…"
            />
            {sections.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Secção pai (opcional)</label>
                <select
                  value={sectionForm.parentId ?? ''}
                  onChange={(e) => setSectionForm((f) => ({ ...f, parentId: e.target.value || null }))}
                  className={inputCls}
                >
                  <option value="">Raiz (sem pai)</option>
                  {sections
                    .filter((s) => s.sectionId !== editSection?.sectionId)
                    .map((s) => <option key={s.sectionId} value={s.sectionId}>{s.name}</option>)}
                </select>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  )
}
