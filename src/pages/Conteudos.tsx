import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import kubbFetch from '@kubb/plugin-client/clients/axios'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { Icon } from '../ui/icons.jsx'
import { Card, Modal, Input, Button, PageHeader, EmptyState } from '../ui/ui.jsx'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api'

// ─── Types ───────────────────────────────────────────────────────────────────

type Section = { sectionId: string; parentId: string | null; name: string; sortOrder: number }
type ContentEntry = { entryId: string; key: string; locale: string | null; value: string; type: string; sectionId: string | null }
type GroupedEntry = { key: string; type: string; translations: Record<string, string> }
type EntryForm = { key: string; type: string; translations: { locale: string; value: string }[]; sectionId: string | null }
type SectionForm = { name: string; parentId: string | null }

const LOCALES = ['pt', 'en', 'es', 'fr', 'de', 'it']
const LOCALE_LABEL: Record<string, string> = { pt: 'PT', en: 'EN', es: 'ES', fr: 'FR', de: 'DE', it: 'IT' }
const TYPE_LABEL: Record<string, string> = { text: 'Texto', richtext: 'Texto rico', image: 'Imagem' }

const emptyEntry = (sectionId: string | null): EntryForm => ({
  key: '', type: 'text', translations: [{ locale: 'pt', value: '' }], sectionId,
})
const emptySection = (parentId: string | null): SectionForm => ({ name: '', parentId })

const inputCls = 'w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100'

function groupEntries(entries: ContentEntry[]): GroupedEntry[] {
  const map = new Map<string, GroupedEntry>()
  for (const e of entries) {
    if (!map.has(e.key)) map.set(e.key, { key: e.key, type: e.type, translations: {} })
    map.get(e.key)!.translations[e.locale ?? '_'] = e.value
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
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

  // Entry modal state
  const [entryModal, setEntryModal] = useState(false)
  const [editEntryKey, setEditEntryKey] = useState<string | null>(null)
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntry(null))

  // Section modal state
  const [sectionModal, setSectionModal] = useState(false)
  const [editSection, setEditSection] = useState<Section | null>(null)
  const [sectionForm, setSectionForm] = useState<SectionForm>(emptySection(null))

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<Section[]>({
    queryKey: ['cms-sections'],
    queryFn: async () => {
      const res = await kubbFetch<Section[]>({ method: 'GET', url: '/cms/sections', baseURL: API_BASE, headers: authHeader() })
      return res.data as Section[]
    },
  })

  const { data: entries = [], isLoading: entriesLoading } = useQuery<ContentEntry[]>({
    queryKey: ['cms-entries'],
    queryFn: async () => {
      const res = await kubbFetch<ContentEntry[]>({ method: 'GET', url: '/cms/entries', baseURL: API_BASE, headers: authHeader() })
      return res.data as ContentEntry[]
    },
  })

  const rootSections = useMemo(() =>
    sections.filter((s) => !s.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
  [sections])

  const visibleEntries = useMemo(() => {
    if (selectedSectionId === null) return entries
    return entries.filter((e) => e.sectionId === selectedSectionId)
  }, [entries, selectedSectionId])

  const grouped = useMemo(() => groupEntries(visibleEntries), [visibleEntries])

  const activeLocales = useMemo(() => {
    const s = new Set<string>()
    for (const e of visibleEntries) if (e.locale) s.add(e.locale)
    return LOCALES.filter((l) => s.has(l))
  }, [visibleEntries])

  const selectedSection = sections.find((s) => s.sectionId === selectedSectionId)

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const saveEntryMut = useMutation({
    mutationFn: async (f: EntryForm) => {
      const toSave = f.translations.filter((t) => t.value.trim())
      if (!toSave.length) throw new Error('Adiciona pelo menos um valor')
      for (const t of toSave) {
        await kubbFetch({
          method: 'PUT', url: '/cms/entries', baseURL: API_BASE,
          data: { key: f.key.trim(), locale: t.locale || null, value: t.value, type: f.type, sectionId: f.sectionId },
          headers: authHeader(),
        })
      }
    },
    onSuccess: () => { toast.success('Entrada guardada'); qc.invalidateQueries({ queryKey: ['cms-entries'] }); closeEntryModal() },
    onError: (e: any) => toast.error(e.message ?? getApiError(e)),
  })

  const deleteEntryMut = useMutation({
    mutationFn: async (key: string) => {
      await kubbFetch({ method: 'DELETE', url: `/cms/entries/${encodeURIComponent(key)}`, baseURL: API_BASE, headers: authHeader() })
    },
    onSuccess: () => { toast.success('Entrada eliminada'); qc.invalidateQueries({ queryKey: ['cms-entries'] }) },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const saveSectionMut = useMutation({
    mutationFn: async (f: SectionForm & { id?: string }) => {
      if (f.id) {
        await kubbFetch({ method: 'PATCH', url: `/cms/sections/${f.id}`, baseURL: API_BASE, data: { name: f.name, parentId: f.parentId }, headers: authHeader() })
      } else {
        await kubbFetch({ method: 'POST', url: '/cms/sections', baseURL: API_BASE, data: { name: f.name, parentId: f.parentId }, headers: authHeader() })
      }
    },
    onSuccess: () => { toast.success('Secção guardada'); qc.invalidateQueries({ queryKey: ['cms-sections'] }); closeSectionModal() },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const deleteSectionMut = useMutation({
    mutationFn: async (id: string) => {
      await kubbFetch({ method: 'DELETE', url: `/cms/sections/${id}`, baseURL: API_BASE, headers: authHeader() })
    },
    onSuccess: (_, id) => {
      toast.success('Secção eliminada')
      qc.invalidateQueries({ queryKey: ['cms-sections'] })
      qc.invalidateQueries({ queryKey: ['cms-entries'] })
      if (selectedSectionId === id) setSelectedSectionId(null)
    },
    onError: (e: any) => toast.error(getApiError(e)),
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
      deleteSectionMut.mutate(s.sectionId)
  }

  const setTranslation = (i: number, field: 'locale' | 'value', val: string) =>
    setEntryForm((f) => { const t = [...f.translations]; t[i] = { ...t[i], [field]: val }; return { ...f, translations: t } })

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

      <div className="flex gap-4 items-start">

        {/* ── Left: section tree ── */}
        <div className="w-56 shrink-0">
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
            <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {selectedSection ? selectedSection.name : 'Todas as entradas'}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {grouped.length} {grouped.length === 1 ? 'entrada' : 'entradas'}
                  {activeLocales.length > 0 && ` · ${activeLocales.map((l) => LOCALE_LABEL[l]).join(', ')}`}
                </p>
              </div>
              <Button icon="plus" size="sm" onClick={openCreateEntry}>Nova entrada</Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="font-medium px-5 py-3">Key</th>
                    <th className="font-medium px-4 py-3 hidden sm:table-cell">Tipo</th>
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
                      {activeLocales.map((l) => (
                        <td key={l} className="px-4 py-3.5 hidden md:table-cell max-w-[180px] truncate text-xs text-zinc-600 dark:text-zinc-400">
                          {grp.translations[l] ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditEntry(grp)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                            <Icon name="edit" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if (window.confirm(`Eliminar "${grp.key}"?`)) deleteEntryMut.mutate(grp.key) }}
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
                  icon="layers"
                  title="Sem entradas"
                  desc={selectedSection ? `Ainda não há entradas em "${selectedSection.name}".` : 'Cria a primeira entrada de conteúdo.'}
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
                  <option value="richtext">Texto rico</option>
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
                <div key={i} className="flex items-center gap-2">
                  <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    {LOCALE_LABEL[t.locale] ?? (t.locale ? t.locale.toUpperCase() : '—')}
                  </span>
                  {entryForm.type === 'richtext' ? (
                    <textarea
                      value={t.value}
                      onChange={(e) => setTranslation(i, 'value', e.target.value)}
                      rows={3}
                      placeholder="Texto…"
                      className={`${inputCls} flex-1 resize-none`}
                    />
                  ) : (
                    <input
                      value={t.value}
                      onChange={(e) => setTranslation(i, 'value', e.target.value)}
                      placeholder={entryForm.type === 'image' ? '/uploads/imagem.jpg' : 'Valor…'}
                      className={`${inputCls} flex-1`}
                    />
                  )}
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
              onChange={(e) => setSectionForm((f) => ({ ...f, name: e.target.value }))}
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
