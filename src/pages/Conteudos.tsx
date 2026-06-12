import { useState, useMemo, useEffect, useRef } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { pickImageFile, supportsFilePicker } from '../lib/filePicker'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Modal, Input, Button, PageHeader, EmptyState } from '../ui/ui.jsx'
import { useGetSettingsLanguages, usePutSettingsLanguages } from '../hooks/useSettingsLanguages'
import { LangFlag } from '../utils/langFlag'
import { useGetCmsSections, getCmsSectionsQueryKey } from '../gen/backoffice/hooks/useGetCmsSections.js'
import { useGetCmsEntries, getCmsEntriesQueryKey } from '../gen/backoffice/hooks/useGetCmsEntries.js'
import { putCmsEntries } from '../gen/backoffice/hooks/usePutCmsEntries.js'
import { useDeleteCmsEntriesKey } from '../gen/backoffice/hooks/useDeleteCmsEntriesKey.js'
import { postCmsSections } from '../gen/backoffice/hooks/usePostCmsSections.js'
import { patchCmsSectionsId } from '../gen/backoffice/hooks/usePatchCmsSectionsId.js'
import { useDeleteCmsSectionsId } from '../gen/backoffice/hooks/useDeleteCmsSectionsId.js'
import { uploadImage } from '../gen/backoffice/hooks/useUploadImage.js'
import { useNavigate } from 'react-router-dom'
import { toSlug } from '../utils/slug'
import { useCmsReferences, useCmsReferencesCounts } from '../hooks/useCmsReferences'
import { WEBSITE_TEMPLATE } from '../templates/websiteTemplate'
import { postCmsSetup } from '../gen/backoffice/hooks/usePostCmsSetup.js'

// ─── Types ───────────────────────────────────────────────────────────────────

type CmsContext = 'website' | 'product' | 'service'
type TabId = CmsContext | 'linguas'
type Section = { sectionId: string; parentId: string | null; name: string; sortOrder: number; context: CmsContext }
type ContentEntry = { entryId: string; key: string; locale: string | null; value: string; type: string; sectionId: string | null }
type GroupedEntry = { key: string; type: string; translations: Record<string, string>; sectionId: string | null }
type EntryForm = { key: string; type: string; translations: { locale: string; value: string }[]; sectionId: string | null }
type SectionForm = { name: string; parentId: string | null }

const TYPE_LABEL: Record<string, string> = { text: 'Texto', image: 'Imagem' }

const CMS_TABS: { id: TabId; label: string; icon: string; permission: string | null }[] = [
  { id: 'website',  label: 'Website',  icon: 'globe',    permission: null },
  { id: 'product',  label: 'Loja',     icon: 'store',    permission: 'VIEW_PRODUCTS' },
  { id: 'service',  label: 'Barbeiro', icon: 'scissors', permission: 'VIEW_SCHEDULE' },
  { id: 'linguas',  label: 'Línguas',  icon: 'globe',    permission: null },
]

function localeLabel(code: string): string {
  return code.toUpperCase().slice(0, 2)
}

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
  section, sections, selectedId, depth, hideActions,
  onSelect, onAddChild, onEdit, onDelete,
}: {
  section: Section; sections: Section[]; selectedId: string | null; depth: number; hideActions?: boolean
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
        {!hideActions && (
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
        )}
      </div>
      {open && children.map((child) => (
        <SectionNode
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
    </div>
  )
}

// ─── Language combobox ────────────────────────────────────────────────────────

function LangCombobox({ available, selected, onAdd, disabled }: {
  available: { code: string; name: string }[]
  selected: string[]
  onAdd: (code: string) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const options = available.filter((l) => !selected.includes(l.code))
  const filtered = options.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (options.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 text-sm text-zinc-500 hover:border-accent hover:text-accent transition disabled:opacity-50"
      >
        <Icon name="plus" className="w-4 h-4" />
        Adicionar língua
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar…"
              className="w-full px-2 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 rounded-lg outline-none border-0 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma língua encontrada</p>
            )}
            {filtered.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => { onAdd(lang.code); setOpen(false); setSearch('') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left"
              >
                <LangFlag code={lang.code} className="h-4 w-auto rounded-sm shadow-sm shrink-0" />
                {lang.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Línguas panel (tab) ──────────────────────────────────────────────────────

function LinguasPanel({
  available,
  selected,
  defaultLang,
  onToggle,
  onSetDefault,
  onSave,
  isSaving,
  hasChanges,
}: {
  available: { code: string; name: string; flag: string }[]
  selected: string[]
  defaultLang: string
  onToggle: (code: string) => void
  onSetDefault: (code: string) => void
  onSave: () => void
  isSaving: boolean
  hasChanges: boolean
}) {
  return (
    <div className="max-w-lg space-y-8 py-2">
      {/* Línguas activas */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Línguas activas</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Línguas disponíveis para traduções de conteúdo
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {selected.map((code) => {
            const lang = available.find((l) => l.code === code)
            const isDefault = code === defaultLang
            return (
              <div
                key={code}
                className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-sm"
              >
                <LangFlag code={code} className="h-4 w-auto rounded-sm shadow-sm" />
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">{lang?.name ?? code}</span>
                {isDefault ? (
                  <span className="ml-0.5 text-xs text-amber-500 select-none" title="Língua padrão">★</span>
                ) : (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => onToggle(code)}
                    title={`Remover ${lang?.name ?? code}`}
                    className="ml-0.5 p-0.5 rounded text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                  >
                    <Icon name="x" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
          <LangCombobox
            available={available}
            selected={selected}
            onAdd={(code) => onToggle(code)}
            disabled={isSaving}
          />
        </div>
        <p className="text-[11px] text-zinc-400">
          A língua padrão <span className="text-amber-500">★</span> não pode ser removida sem primeiro definir outra como padrão.
        </p>
      </div>

      {/* Língua padrão */}
      {selected.length > 1 && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Língua padrão</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Usada quando não existe tradução disponível noutra língua
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map((code) => {
              const lang = available.find((l) => l.code === code)
              const isDefault = code === defaultLang
              return (
                <button
                  key={code}
                  type="button"
                  disabled={isSaving}
                  onClick={() => onSetDefault(code)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition select-none ${
                    isDefault
                      ? 'border-accent bg-accent text-white font-semibold shadow-sm cursor-default'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-accent/50'
                  }`}
                >
                  <LangFlag code={code} className={`h-4 w-auto rounded-sm ${isDefault ? 'shadow-sm' : ''}`} />
                  <span>{lang?.name ?? code}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={isSaving || !hasChanges}
          className="px-5 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40 transition"
        >
          {isSaving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ─── References modal ─────────────────────────────────────────────────────────

function CmsReferencesModal({ cmsKey, onClose }: { cmsKey: string; onClose: () => void }) {
  const { data, isLoading } = useCmsReferences(cmsKey, true)
  const navigate = useNavigate()
  const total = (data?.products.length ?? 0) + (data?.services.length ?? 0)

  const goTo = (path: string) => { onClose(); navigate(path) }

  return (
    <Modal
      open
      onClose={onClose}
      title="Associações"
      width="max-w-md"
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}
    >
      <p className="text-xs font-mono text-zinc-400 mb-4">{cmsKey}</p>
      {isLoading && <p className="text-sm text-zinc-400 py-4 text-center">A carregar…</p>}
      {!isLoading && total === 0 && (
        <p className="text-sm text-zinc-400 text-center py-4">Sem associações</p>
      )}
      {!isLoading && (data?.products.length ?? 0) > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Produtos</p>
          <div className="space-y-1">
            {data!.products.map((p) => (
              <button key={p.productId} type="button" onClick={() => goTo(`/loja?openProduct=${p.productId}`)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors text-sm text-left">
                <Icon name="store" className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="flex-1 text-zinc-800 dark:text-zinc-100 truncate">{p.name}</span>
                {p.contentKey === cmsKey && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">nome</span>}
                {p.descriptionKey === cmsKey && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">descrição</span>}
                <Icon name="chevronRight" className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
      {!isLoading && (data?.services.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Serviços</p>
          <div className="space-y-1">
            {data!.services.map((s) => (
              <button key={s.serviceId} type="button" onClick={() => goTo(`/agenda?openService=${s.serviceId}`)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors text-sm text-left">
                <Icon name="scissors" className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="flex-1 text-zinc-800 dark:text-zinc-100 truncate">{s.name}</span>
                {s.contentKey === cmsKey && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">nome</span>}
                {s.descriptionKey === cmsKey && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">descrição</span>}
                <Icon name="chevronRight" className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Conteudos() {
  const qc = useQueryClient()
  const { hasPermission, authHeader } = useAuth()
  const headers = authHeader()

  // Active tab
  const visibleTabs = CMS_TABS.filter((t) => t.permission === null || hasPermission(t.permission))
  const [activeTab, setActiveTab] = useState<TabId>('website')

  // Section / search state
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false)

  // Entry modal state
  const [entryModal, setEntryModal] = useState(false)
  const [editEntryKey, setEditEntryKey] = useState<string | null>(null)
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntry(null))
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)

  // References modal state
  const [refsKey, setRefsKey] = useState<string | null>(null)

  // Template modal state
  const [templateModal, setTemplateModal] = useState(false)

  // Section modal state
  const [sectionModal, setSectionModal] = useState(false)
  const [editSection, setEditSection] = useState<Section | null>(null)
  const [sectionForm, setSectionForm] = useState<SectionForm>(emptySection(null))

  // Language state — draft pattern: server state is source of truth, draft tracks unsaved edits
  const { data: langData } = useGetSettingsLanguages()
  const saveLangs = usePutSettingsLanguages()
  const [draft, setDraft] = useState<{ langs: string[]; defaultLang: string } | null>(null)

  // Ensure the default language is always in the selected list (new users may have nothing saved)
  const serverDefault = langData?.default ?? 'pt'
  const serverSelected = langData?.selected ?? []
  const effectiveServerSelected = serverSelected.includes(serverDefault)
    ? serverSelected
    : [serverDefault, ...serverSelected]

  // draft overrides server state while editing
  const selectedLangs = draft?.langs ?? effectiveServerSelected
  const defaultLang = draft?.defaultLang ?? serverDefault
  const hasLangChanges = draft !== null

  const LOCALES = selectedLangs

  const toggleLang = (code: string) => {
    const base = draft?.langs ?? effectiveServerSelected
    const currDefault = draft?.defaultLang ?? serverDefault
    // Cannot remove the default language — change the default first
    if (code === currDefault && base.includes(code)) return
    const next = base.includes(code) ? base.filter((c) => c !== code) : [...base, code]
    setDraft({ langs: next, defaultLang: currDefault })
  }

  const handleSetDefault = (code: string) => {
    const base = draft?.langs ?? effectiveServerSelected
    // Activating a language when it's set as default
    const next = base.includes(code) ? base : [...base, code]
    setDraft({ langs: next, defaultLang: code })
  }

  const handleSaveLangs = () => {
    if (!draft) return
    saveLangs.mutate(
      { languages: draft.langs, default: draft.defaultLang },
      {
        onSuccess: () => { toast.success('Línguas guardadas'); setDraft(null) },
        onError: () => toast.error('Erro ao guardar línguas'),
      },
    )
  }

  // Reset section selection when switching tabs
  useEffect(() => {
    setSelectedSectionId(null)
    setSearchQuery('')
  }, [activeTab])

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: allSections = [], isLoading: sectionsLoading } = useGetCmsSections()
  const { data: allEntries = [], isLoading: entriesLoading } = useGetCmsEntries()

  // Filter sections and entries by active tab context
  const sections = useMemo(
    () => (allSections as Section[]).filter((s) => s.context === activeTab),
    [allSections, activeTab],
  )

  // Collect all section IDs for the current tab (including descendant sections)
  const tabSectionIds = useMemo(() => new Set(sections.map((s) => s.sectionId)), [sections])

  const entries = useMemo(
    () => allEntries.filter((e) => {
      if (e.sectionId !== null) return tabSectionIds.has(e.sectionId)
      const context = e.key.startsWith('product.') ? 'product' : e.key.startsWith('service.') ? 'service' : 'website'
      return context === activeTab
    }),
    [allEntries, activeTab, tabSectionIds],
  )

  const rootSections = useMemo(() =>
    sections.filter((s) => !s.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
  [sections])

  const isSearching = searchQuery.trim().length > 0

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

  const selectedSection = sections.find((s) => s.sectionId === selectedSectionId)
  const breadcrumb = useMemo(() => getSectionPath(sections, selectedSectionId), [sections, selectedSectionId])

  const refCountKeys = useMemo(
    () => (activeTab === 'product' || activeTab === 'service') ? grouped.map((g) => g.key) : [],
    [activeTab, grouped],
  )
  const { data: refCounts = {} } = useCmsReferencesCounts(refCountKeys)

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
      onError: (e: any) => {
        const status = e?.response?.status
        const details = e?.response?.data?.details
        if (status === 409 && details) {
          const parts = []
          if (details.products > 0) parts.push(`${details.products} produto${details.products > 1 ? 's' : ''}`)
          if (details.services > 0) parts.push(`${details.services} serviço${details.services > 1 ? 's' : ''}`)
          toast.error(`Não é possível eliminar: esta entrada está associada a ${parts.join(' e ')}`)
        } else {
          toast.error(getApiError(e))
        }
      },
    },
  })

  const saveSectionMut = useMutation({
    mutationFn: async (f: SectionForm & { id?: string }) => {
      if (f.id) {
        await patchCmsSectionsId(f.id, { name: f.name, parentId: f.parentId } as any)
      } else {
        await postCmsSections({ name: f.name, parentId: f.parentId, context: activeTab } as any)
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

  const applyTemplateMut = useMutation({
    mutationFn: () => postCmsSetup(
      { sections: WEBSITE_TEMPLATE.sections, entries: WEBSITE_TEMPLATE.entries.map((e) => ({ ...e, locale: 'pt' })) },
      { headers: authHeader() },
    ),
    onSuccess: ({ created, skipped }) => {
      toast.success(`Template aplicado — ${created} entradas criadas${skipped > 0 ? `, ${skipped} já existiam` : ''}`)
      qc.invalidateQueries({ queryKey: getCmsSectionsQueryKey() })
      qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() })
      setTemplateModal(false)
    },
    onError: () => toast.error('Erro ao aplicar template'),
  })

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const buildTranslationsForLocales = (existing: Record<string, string>) => {
    const locales = LOCALES.length ? LOCALES : Object.keys(existing).filter((k) => k !== '_')
    const rows = locales.map((locale) => ({ locale, value: existing[locale] ?? '' }))
    // Locales not in LOCALES are kept in the DB but not shown in the UI
    return rows.length ? rows : [{ locale: '', value: '' }]
  }

  const closeEntryModal = () => {
    setEntryModal(false)
    setEditEntryKey(null)
    setEntryForm({ ...emptyEntry(selectedSectionId), translations: LOCALES.length ? LOCALES.map((l) => ({ locale: l, value: '' })) : [{ locale: '', value: '' }] })
  }
  const closeSectionModal = () => { setSectionModal(false); setEditSection(null); setSectionForm(emptySection(null)) }

  const openCreateEntry = () => {
    setEditEntryKey(null)
    setEntryForm({ ...emptyEntry(selectedSectionId), translations: LOCALES.length ? LOCALES.map((l) => ({ locale: l, value: '' })) : [{ locale: '', value: '' }] })
    setEntryModal(true)
  }

  const openEditEntry = (grp: GroupedEntry) => {
    setEditEntryKey(grp.key)
    const entry = allEntries.find((e) => e.key === grp.key)
    setEntryForm({
      key: grp.key,
      type: grp.type,
      sectionId: entry?.sectionId ?? null,
      translations: buildTranslationsForLocales(grp.translations),
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
      const { fileUrl } = await uploadImage({ image: file, module: 'cms' })
      setTranslation(idx, 'value', fileUrl)
      toast.success('Imagem carregada')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao carregar imagem')
    } finally {
      setUploadingIdx(null)
    }
  }

  const handleImagePickerClick = async (e: React.MouseEvent, idx: number) => {
    if (uploadingIdx === idx || !supportsFilePicker()) return
    e.preventDefault()
    try {
      const file = await pickImageFile()
      if (file) handleImagePick(file, idx)
    } catch {
      toast.error('Erro ao escolher imagem')
    }
  }

  const removeTranslation = (i: number) =>
    setEntryForm((f) => ({ ...f, translations: f.translations.filter((_, idx) => idx !== i) }))

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault()
    let form = entryForm
    if (!form.key.trim() && !editEntryKey && (activeTab === 'product' || activeTab === 'service')) {
      const firstValue = form.translations.find((t) => t.value.trim())?.value ?? ''
      const slug = firstValue ? toSlug(firstValue) : `${Date.now()}`
      form = { ...form, key: `${activeTab}.${slug}`, type: 'text' }
    }
    if (!form.key.trim()) { toast.error('A key é obrigatória'); return }
    saveEntryMut.mutate(form)
  }

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sectionForm.name.trim()) { toast.error('O nome é obrigatório'); return }
    saveSectionMut.mutate({ ...sectionForm, id: editSection?.sectionId })
  }

  const emptyDesc = isSearching
    ? `Nenhuma entrada encontrada para "${searchQuery}".`
    : selectedSection
      ? `Ainda não há entradas em "${selectedSection.name}".`
      : `Cria a primeira entrada de conteúdo no separador "${CMS_TABS.find((t) => t.id === activeTab)?.label}".`

  // Default language - only show in default lang column in table
  const tableLocale = defaultLang && selectedLangs.includes(defaultLang)
    ? defaultLang
    : selectedLangs[0] ?? null

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Conteúdos"
        subtitle="Gere o conteúdo do site, produtos e serviços em múltiplos idiomas."
      />

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Icon name={tab.icon as any} className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'website' && (
          <button
            onClick={() => setTemplateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 text-sm text-zinc-500 hover:border-accent hover:text-accent transition"
          >
            <Icon name="layers" className="w-4 h-4" />
            Aplicar template
          </button>
        )}
      </div>

      {/* ── Línguas tab ── */}
      {activeTab === 'linguas' && (
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

      {/* ── CMS content (hidden on línguas tab) ── */}
      {activeTab !== 'linguas' && (
      <>
      {/* ── Mobile section selector ── */}
      <button
        onClick={() => setMobileTreeOpen(true)}
        className="md:hidden w-full flex items-center gap-3 mb-3 px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-left transition hover:border-zinc-300 dark:hover:border-zinc-600 active:bg-zinc-50 dark:active:bg-zinc-800/60"
      >
        <Icon name="layers" className="w-4 h-4 text-zinc-400 shrink-0" />
        <span className="flex-1 font-medium text-zinc-700 dark:text-zinc-200 truncate">
          {selectedSection?.name ?? 'Todas as secções'}
        </span>
        <span className="text-xs text-zinc-400 tabular-nums">{grouped.length}</span>
        <Icon name="chevronDown" className="w-4 h-4 text-zinc-400 shrink-0" />
      </button>

      <div className="flex flex-col md:flex-row gap-4 items-start">

        {/* ── Left: section tree (tablet/desktop) ── */}
        <div className="hidden md:block md:w-48 lg:w-60 md:shrink-0">
          <Card className="overflow-hidden md:flex md:flex-col md:max-h-[calc(100vh-17rem)]">
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

            <div className="p-1.5 space-y-0.5 md:overflow-y-auto md:flex-1">
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
          <Card className="overflow-hidden md:flex md:flex-col md:h-[calc(100vh-17rem)]">

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
                    {tableLocale && ` · coluna: ${localeLabel(tableLocale)}`}
                    {isSearching && ' em todas as secções'}
                  </p>
                </div>
                <Button icon="plus" size="sm" onClick={openCreateEntry}>
                  <span className="hidden sm:inline">Nova entrada</span>
                  <span className="sm:hidden">Nova</span>
                </Button>
              </div>

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

            {/* ── Tablet/Desktop: table ── */}
            <div className="hidden md:block md:flex-1 md:min-h-0 md:overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-zinc-900 z-10">
                  <tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    {activeTab === 'website' && <th className="font-medium px-5 py-3">Key</th>}
                    {activeTab === 'website' && <th className="font-medium px-4 py-3">Tipo</th>}
                    {isSearching && <th className="font-medium px-4 py-3">Secção</th>}
                    {tableLocale && (
                      <th className="font-medium px-4 py-3 flex items-center gap-1">
                        {localeLabel(tableLocale)}
                        {tableLocale === defaultLang && <span className="text-amber-400 text-xs">★</span>}
                      </th>
                    )}
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
                      {activeTab === 'website' && (
                        <td className="px-5 py-3.5">
                          <code className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded px-1.5 py-0.5">{grp.key}</code>
                        </td>
                      )}
                      {activeTab === 'website' && (
                        <td className="px-4 py-3.5 text-zinc-500 text-xs">{TYPE_LABEL[grp.type] ?? grp.type}</td>
                      )}
                      {isSearching && (
                        <td className="px-4 py-3.5">
                          {grp.sectionId
                            ? <span className="text-xs px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                {allSections.find((s) => s.sectionId === grp.sectionId)?.name ?? '—'}
                              </span>
                            : <span className="text-xs text-zinc-300 dark:text-zinc-600">Sem secção</span>
                          }
                        </td>
                      )}
                      {tableLocale && (
                        <td className="px-4 py-3.5 max-w-[220px] text-xs text-zinc-600 dark:text-zinc-400">
                          {grp.type === 'image'
                            ? grp.translations[tableLocale]
                              ? <img src={grp.translations[tableLocale]} alt="" className="h-9 w-14 object-cover rounded-md border border-zinc-100 dark:border-zinc-800" />
                              : <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            : <span className="truncate block">{grp.translations[tableLocale] ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}</span>
                          }
                        </td>
                      )}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {(activeTab === 'product' || activeTab === 'service') && (refCounts[grp.key] ?? 0) > 0 && (
                            <button onClick={() => setRefsKey(grp.key)} title="Ver associações" className="p-1.5 rounded-lg text-zinc-400 hover:text-accent hover:bg-accent/10 transition">
                              <Icon name="link" className="w-4 h-4" />
                            </button>
                          )}
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
                <EmptyState icon={isSearching ? 'search' : 'layers'} title={isSearching ? 'Sem resultados' : 'Sem entradas'} desc={emptyDesc} />
              )}
            </div>

            {/* ── Mobile: card list ── */}
            <div className="md:hidden divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {entriesLoading && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <div className="h-4 w-36 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                  <div className="h-3 w-52 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                </div>
              ))}
              {!entriesLoading && grouped.map((grp) => {
                const preview = tableLocale ? grp.translations[tableLocale] : Object.values(grp.translations)[0]
                return (
                  <div
                    key={grp.key}
                    className="flex items-start gap-3 px-4 py-3.5 cursor-pointer active:bg-zinc-50 dark:active:bg-zinc-800/40 transition"
                    onClick={() => openEditEntry(grp)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <code className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded px-1.5 py-0.5 break-all">{grp.key}</code>
                        <span className="text-xs text-zinc-400">{TYPE_LABEL[grp.type] ?? grp.type}</span>
                      </div>
                      {isSearching && grp.sectionId && (
                        <span className="inline-block text-xs px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 mb-1">
                          {allSections.find((s) => s.sectionId === grp.sectionId)?.name ?? '—'}
                        </span>
                      )}
                      {preview && grp.type === 'text' && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5">{preview}</p>
                      )}
                      {preview && grp.type === 'image' && (
                        <img src={preview} alt="" className="h-10 w-16 object-cover rounded border border-zinc-100 dark:border-zinc-800 mt-1.5" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      {(activeTab === 'product' || activeTab === 'service') && (refCounts[grp.key] ?? 0) > 0 && (
                        <button
                          className="p-2 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-accent hover:bg-accent/10 transition"
                          onClick={(e) => { e.stopPropagation(); setRefsKey(grp.key) }}
                        >
                          <Icon name="link" className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        className="p-2 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`Eliminar "${grp.key}"?`)) deleteEntryMut.mutate({ key: grp.key })
                        }}
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {!entriesLoading && grouped.length === 0 && (
                <EmptyState icon={isSearching ? 'search' : 'layers'} title={isSearching ? 'Sem resultados' : 'Sem entradas'} desc={emptyDesc} />
              )}
            </div>

          </Card>
        </div>
      </div>

      {/* ── Mobile section bottom sheet ── */}
      {mobileTreeOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px] animate-[fade_.15s_ease]"
            onClick={() => setMobileTreeOpen(false)}
          />
          <div className="relative bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-2xl shadow-xl max-h-[80vh] flex flex-col animate-[pop_.18s_cubic-bezier(.2,.8,.2,1)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="font-semibold text-zinc-900 dark:text-white text-sm">Secções</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { openCreateSection(null); setMobileTreeOpen(false) }}
                  className="flex items-center gap-1 text-xs font-medium text-accent active:opacity-70 transition"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" />
                  Nova secção
                </button>
                <button
                  onClick={() => setMobileTreeOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-2 pb-2">
              <div
                onClick={() => { setSelectedSectionId(null); setMobileTreeOpen(false) }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm cursor-pointer transition-colors ${selectedSectionId === null ? 'bg-accent/10 text-accent' : 'text-zinc-600 dark:text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800/60'}`}
              >
                <Icon name="layers" className="w-4 h-4 shrink-0" />
                <span className="font-medium flex-1">Todas as entradas</span>
                <span className="text-xs opacity-60 tabular-nums">{entries.length}</span>
              </div>

              {sectionsLoading && (
                <div className="space-y-2 px-3 py-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />)}
                </div>
              )}

              {rootSections.map((s) => (
                <SectionNode
                  key={s.sectionId}
                  section={s}
                  sections={sections}
                  selectedId={selectedSectionId}
                  depth={0}
                  hideActions
                  onSelect={(id) => { setSelectedSectionId(id); setMobileTreeOpen(false) }}
                  onAddChild={(parentId) => { openCreateSection(parentId); setMobileTreeOpen(false) }}
                  onEdit={(sec) => { openEditSection(sec); setMobileTreeOpen(false) }}
                  onDelete={handleDeleteSection}
                />
              ))}

              {!sectionsLoading && sections.length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-6">
                  Ainda não há secções.
                </p>
              )}

            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* ── Modal: template ── */}
      {templateModal && (
        <Modal
          open
          onClose={() => !applyTemplateMut.isPending && setTemplateModal(false)}
          title="Aplicar template de website"
          width="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setTemplateModal(false)} disabled={applyTemplateMut.isPending}>Cancelar</Button>
              <Button onClick={() => applyTemplateMut.mutate()} disabled={applyTemplateMut.isPending}>
                {applyTemplateMut.isPending ? 'A aplicar…' : 'Aplicar'}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            <p className="text-zinc-700 dark:text-zinc-300">
              Cria automaticamente as secções e entradas base para um site de agendamentos:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {WEBSITE_TEMPLATE.sections.map((s) => (
                <div key={s.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                  <Icon name="layers" className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-xs font-medium truncate">{s.name}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{WEBSITE_TEMPLATE.sections.length}</span> secções
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{WEBSITE_TEMPLATE.entries.length}</span> entradas
            </div>
            <p className="text-xs text-zinc-400 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-lg">
              Entradas já existentes não são substituídas. Podes aplicar várias vezes sem perder conteúdo.
            </p>
          </div>
        </Modal>
      )}

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
              {(editEntryKey || activeTab === 'website') && (
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
              )}
              {activeTab === 'website' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tipo</label>
                  <select value={entryForm.type} onChange={(e) => setEntryForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
                    <option value="text">Texto</option>
                    <option value="image">Imagem</option>
                  </select>
                </div>
              )}
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
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Traduções</p>

              {entryForm.translations.map((t, i) => (
                <div key={i} className={`flex gap-2 ${entryForm.type === 'image' ? 'items-start' : 'items-center'}`}>
                  <span className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs font-bold ${
                    t.locale === defaultLang
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {t.locale ? localeLabel(t.locale) : '—'}
                    {t.locale === defaultLang && <span className="absolute text-[8px] -mt-3">★</span>}
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
                      <label
                        className={`block group ${uploadingIdx === i ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={(e) => handleImagePickerClick(e, i)}
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingIdx === i}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImagePick(f, i); e.target.value = '' }}
                        />
                        {t.value ? (
                          <div className="relative h-28 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                            <img src={t.value} alt="" className="h-full w-full object-cover" />
                            <div className={`absolute inset-0 transition-colors flex items-center justify-center ${uploadingIdx === i ? 'bg-black/55' : 'bg-black/0 group-hover:bg-black/50'}`}>
                              <span className={`text-white text-xs font-medium transition-opacity flex items-center gap-1.5 ${uploadingIdx === i ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                {uploadingIdx === i
                                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> A carregar...</>
                                  : <><Icon name="image" className="w-4 h-4" /> Trocar imagem</>}
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
          title={editSection ? 'Editar secção' : `Nova secção — ${CMS_TABS.find((t) => t.id === activeTab)?.label}`}
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

      {refsKey && (
        <CmsReferencesModal cmsKey={refsKey} onClose={() => setRefsKey(null)} />
      )}
    </div>
  )
}
