import { useState, useMemo, useEffect, createContext, useContext, type ReactNode, type HTMLAttributes } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getApiError } from '../lib/apiError'
import { Icon } from '../ui/icons.jsx'
import { Card, Button, IconButton, Badge, Input, Modal, PageHeader, EmptyState } from '../ui/ui.jsx'
import { useGetCustomers } from '../gen/backoffice/hooks/useGetCustomers.js'
import { useGetGymExercises } from '../gen/backoffice/hooks/useGetGymExercises.js'
import { postGymExercises } from '../gen/backoffice/hooks/usePostGymExercises.js'
import { putGymExercisesId } from '../gen/backoffice/hooks/usePutGymExercisesId.js'
import { deleteGymExercisesId } from '../gen/backoffice/hooks/useDeleteGymExercisesId.js'
import { useGetGymPrograms } from '../gen/backoffice/hooks/useGetGymPrograms.js'
import { postGymPrograms } from '../gen/backoffice/hooks/usePostGymPrograms.js'
import { deleteGymProgramsId } from '../gen/backoffice/hooks/useDeleteGymProgramsId.js'
import { postGymProgramsProgramidWorkouts } from '../gen/backoffice/hooks/usePostGymProgramsProgramidWorkouts.js'
import { patchGymProgramsReorder } from '../gen/backoffice/hooks/usePatchGymProgramsReorder.js'
import { patchGymProgramsProgramidWorkoutsReorder } from '../gen/backoffice/hooks/usePatchGymProgramsProgramidWorkoutsReorder.js'
import { axiosInstance } from '@kubb/plugin-client/clients/axios'
import { useAuth } from '../context/AuthContext'
import { CmsCombo } from '../components/CmsCombo'
import { CmsTranslationsModal } from '../components/CmsTranslationsModal'
import { ensureCmsName } from '../lib/gymCms'
import { useGetSettingsLanguages } from '../hooks/useSettingsLanguages'
import { putGymWorkoutsId } from '../gen/backoffice/hooks/usePutGymWorkoutsId.js'
import { deleteGymWorkoutsId } from '../gen/backoffice/hooks/useDeleteGymWorkoutsId.js'
import { useGetGymWorkoutTemplates } from '../gen/backoffice/hooks/useGetGymWorkoutTemplates.js'
import { postGymWorkoutTemplates } from '../gen/backoffice/hooks/usePostGymWorkoutTemplates.js'
import { putGymWorkoutTemplatesId } from '../gen/backoffice/hooks/usePutGymWorkoutTemplatesId.js'
import { deleteGymWorkoutTemplatesId } from '../gen/backoffice/hooks/useDeleteGymWorkoutTemplatesId.js'
import { useGetGymPlanos } from '../gen/backoffice/hooks/useGetGymPlanos.js'
import { postGymPlanos } from '../gen/backoffice/hooks/usePostGymPlanos.js'
import { putGymPlanosId } from '../gen/backoffice/hooks/usePutGymPlanosId.js'
import { deleteGymPlanosId } from '../gen/backoffice/hooks/useDeleteGymPlanosId.js'
import { postGymPlanosIdAssign } from '../gen/backoffice/hooks/usePostGymPlanosIdAssign.js'
import type { GymPlano } from '../gen/backoffice/types/GymPlano.js'
import { useGetGymClientsCustomeridStats } from '../gen/backoffice/hooks/useGetGymClientsCustomeridStats.js'
import { useGetGymClientsCustomeridLogs } from '../gen/backoffice/hooks/useGetGymClientsCustomeridLogs.js'
import { useGetGymMuscleGroups } from '../gen/backoffice/hooks/useGetGymMuscleGroups.js'
import { postGymMuscleGroups } from '../gen/backoffice/hooks/usePostGymMuscleGroups.js'
import { putGymMuscleGroupsId } from '../gen/backoffice/hooks/usePutGymMuscleGroupsId.js'
import { deleteGymMuscleGroupsId } from '../gen/backoffice/hooks/useDeleteGymMuscleGroupsId.js'
import type { GymExercise } from '../gen/backoffice/types/GymExercise.js'
import type { GymExercisePreset } from '../gen/backoffice/types/GymExercisePreset.js'
import type { GymMuscleGroup } from '../gen/backoffice/types/GymMuscleGroup.js'
import type { GymProgram } from '../gen/backoffice/types/GymProgram.js'
import type { GymWorkout } from '../gen/backoffice/types/GymWorkout.js'
import { MediaGallery, uploadPendingMedia, type MediaItem } from '../components/MediaGallery'
import { Combobox } from '../components/Combobox'
import { DateRangePicker, type DateRange } from '../components/DateRangePicker'
import { format } from 'date-fns'

// Paleta de cores sugeridas para grupos/subgrupos — usada para dar uma cor
// aleatória por defeito ao criar (o user pode sempre mudar).
const GROUP_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981',
  '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E',
]
const randomColor = () => GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]

// Grupo muscular (de topo ou subgrupo via parentId).
type Group = GymMuscleGroup

// ── Contexto dos grupos musculares (carregados da API) ───────────────────────
type GymGroupsCtx = {
  groups: Group[]
  topGroups: Group[]
  names: string[]
  colorOf: (name?: string) => string
  subGroupsOf: (groupName?: string) => Group[]
}
const GymGroupsContext = createContext<GymGroupsCtx>({
  groups: [], topGroups: [], names: [], colorOf: () => '#6B7280', subGroupsOf: () => [],
})
const useGymGroups = () => useContext(GymGroupsContext)

function GymGroupsProvider({ children }: { children: ReactNode }) {
  const { data } = useGetGymMuscleGroups()
  const groups = (data ?? []) as Group[]
  const value = useMemo<GymGroupsCtx>(() => {
    const colorMap = new Map(groups.map((g) => [g.name, g.color]))
    const topGroups = groups.filter((g) => !g.parentId)
    const idByName = new Map(groups.map((g) => [g.name, g.muscleGroupId]))
    const childrenByParent = new Map<string, Group[]>()
    for (const g of groups) {
      if (!g.parentId) continue
      const arr = childrenByParent.get(g.parentId) ?? []
      arr.push(g)
      childrenByParent.set(g.parentId, arr)
    }
    return {
      groups,
      topGroups,
      names: topGroups.map((g) => g.name),
      colorOf: (name?: string) => (name && colorMap.get(name)) || '#6B7280',
      subGroupsOf: (groupName?: string) => {
        const id = groupName ? idByName.get(groupName) : undefined
        return id ? childrenByParent.get(id) ?? [] : []
      },
    }
  }, [groups])
  return <GymGroupsContext.Provider value={value}>{children}</GymGroupsContext.Provider>
}

type Tab = 'programas' | 'catalogo' | 'treinos' | 'planos' | 'progresso'

// Preset em edição no formulário (campos como string para permitir vazio = "—").
type PresetDraft = { id: string; name: string; sets: string; reps: string; weight: string; rest: string }
const emptyPreset = (): PresetDraft => ({ id: newUid(), name: '', sets: '', reps: '', weight: '', rest: '' })

type DraftExercise = {
  uid: string
  exerciseId?: string | null
  name: string
  group: string
  subGroup?: string | null
  sets: number
  reps: number
  weight: number
  rest: number
  media?: MediaItem[]
}

let draftSeq = 0
const newUid = () => `d${Date.now()}_${draftSeq++}`

// ── Dias da semana (0=Dom … 6=Sáb, ordem de apresentação a começar na Segunda) ──
const WEEK_DAYS: { value: number; short: string; label: string }[] = [
  { value: 1, short: 'Seg', label: 'Segunda' },
  { value: 2, short: 'Ter', label: 'Terça' },
  { value: 3, short: 'Qua', label: 'Quarta' },
  { value: 4, short: 'Qui', label: 'Quinta' },
  { value: 5, short: 'Sex', label: 'Sexta' },
  { value: 6, short: 'Sáb', label: 'Sábado' },
  { value: 0, short: 'Dom', label: 'Domingo' },
]
const sortDays = (days: number[]) => {
  const order = (d: number) => (d === 0 ? 7 : d) // Domingo no fim
  return [...days].sort((a, b) => order(a) - order(b))
}

// Selector de dias (toggle) usado no editor de treino
function DaySelector({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (d: number) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])
  return (
    <div>
      <span className="block text-[11px] font-medium text-zinc-500 mb-1.5">Dias da semana</span>
      <div className="flex flex-wrap gap-1.5">
        {WEEK_DAYS.map((d) => {
          const on = value.includes(d.value)
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => toggle(d.value)}
              className={
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition border ' +
                (on
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-accent')
              }
              title={d.label}
            >
              {d.short}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Wrapper genérico de item arrastável (render-prop para posicionar a pega)
function Sortable({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: (handle: HTMLAttributes<HTMLElement>) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : undefined }}
    >
      {children({ ...attributes, ...(listeners as HTMLAttributes<HTMLElement>) })}
    </div>
  )
}

const DragHandle = (props: HTMLAttributes<HTMLElement>) => (
  <button
    {...props}
    type="button"
    className="flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing touch-none transition-colors"
    title="Arrastar para reordenar"
  >
    <Icon name="grip" className="w-4 h-4" />
  </button>
)

// Chips só-leitura dos dias atribuídos a um treino
function DayChips({ days }: { days: number[] }) {
  if (!days || days.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {sortDays(days).map((d) => {
        const day = WEEK_DAYS.find((x) => x.value === d)
        if (!day) return null
        return (
          <span
            key={d}
            className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-accent/10 text-accent"
          >
            {day.short}
          </span>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Group chip
// Campo numérico opcional (vazio = não se aplica, ex: alongamentos)
function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</span>
      <input
        type="number" min={0} value={value} placeholder="—"
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:border-accent"
      />
    </label>
  )
}

function GroupChip({ group }: { group: string }) {
  const { colorOf } = useGymGroups()
  const c = colorOf(group)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${c}22`, color: c }}
    >
      {group}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Exercise catalog tab
// Modal de gestão dos grupos musculares (criar / editar / apagar)
function MuscleGroupsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { topGroups, subGroupsOf } = useGymGroups()
  const [newName, setNewName] = useState('')
  const [newContentKey, setNewContentKey] = useState<string | null>(null)
  const [newColor, setNewColor] = useState(randomColor())
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#3B82F6')
  const [editContentKey, setEditContentKey] = useState<string | null>(null)
  // Adição de subgrupo: id do grupo pai cujo formulário está aberto
  const [subParent, setSubParent] = useState<string | null>(null)
  const [subName, setSubName] = useState('')
  const [subContentKey, setSubContentKey] = useState<string | null>(null)
  const [subColor, setSubColor] = useState(randomColor())
  const [translating, setTranslating] = useState<string | null>(null)
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'
  const hasMultipleLangs = (langData?.selected?.length ?? 0) > 1

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/muscle-groups' }] })

  const create = useMutation({
    mutationFn: async () => {
      const key = await ensureCmsName(newContentKey, 'gym', newName, defaultLang)
      return postGymMuscleGroups({ name: newName.trim(), color: newColor, contentKey: key } as any)
    },
    onSuccess: () => { invalidate(); setNewName(''); setNewContentKey(null); setNewColor(randomColor()); toast.success('Grupo criado') },
    onError: (e) => toast.error(getApiError(e)),
  })
  const createSub = useMutation({
    mutationFn: async () => {
      const key = await ensureCmsName(subContentKey, 'gym', subName, defaultLang)
      return postGymMuscleGroups({ name: subName.trim(), color: subColor, parentId: subParent, contentKey: key } as any)
    },
    onSuccess: () => { invalidate(); setSubName(''); setSubContentKey(null); setSubParent(null); setSubColor(randomColor()); toast.success('Subgrupo criado') },
    onError: (e) => toast.error(getApiError(e)),
  })
  const saveEdit = useMutation({
    mutationFn: async (id: string) => {
      const key = await ensureCmsName(editContentKey, 'gym', editName, defaultLang)
      return putGymMuscleGroupsId(id, { name: editName.trim(), color: editColor, contentKey: key } as any)
    },
    onSuccess: () => { invalidate(); setEditId(null); toast.success('Grupo atualizado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  // Abre o editor de traduções de um grupo (garante a chave CMS primeiro).
  const openGroupTranslations = async (g: Group) => {
    try {
      const existing = (g as any).contentKey as string | null
      const key = await ensureCmsName(existing, 'gym', g.name, defaultLang)
      if (!existing) {
        await putGymMuscleGroupsId(g.muscleGroupId, { name: g.name, color: g.color, contentKey: key } as any)
        invalidate()
      }
      setTranslating(key)
    } catch {
      toast.error('Erro ao preparar traduções')
    }
  }
  const remove = useMutation({
    mutationFn: (id: string) => deleteGymMuscleGroupsId(id),
    onSuccess: () => { invalidate(); toast.success('Grupo eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  // Linha de um grupo/subgrupo (display ou edição inline). Função (não componente)
  // para não remontar os inputs a cada tecla e perder o foco.
  const renderRow = (g: Group, sub?: boolean) =>
    editId === g.muscleGroupId ? (
      <div className="flex items-center gap-2">
        <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-8 h-8 rounded border-0 bg-transparent p-0 cursor-pointer shrink-0" />
        <div className="flex-1"><CmsCombo context="gym" value={editContentKey} name={editName} onChange={(key, nm) => { setEditContentKey(key); setEditName(nm) }} placeholder="Nome do grupo…" /></div>
        <Button size="sm" isLoading={saveEdit.isPending} disabled={!editName.trim()} onClick={() => saveEdit.mutate(g.muscleGroupId)}>Guardar</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
      </div>
    ) : (
      <div className="flex items-center gap-2">
        <span className={(sub ? 'w-3 h-3' : 'w-4 h-4') + ' rounded-full shrink-0'} style={{ background: g.color }} />
        <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 truncate">{g.name}</span>
        {hasMultipleLangs && (
          <Button size="sm" variant="ghost" onClick={() => openGroupTranslations(g)}>Traduções</Button>
        )}
        <IconButton icon="edit" label="Editar" onClick={() => { setEditId(g.muscleGroupId); setEditName(g.name); setEditColor(g.color); setEditContentKey((g as any).contentKey ?? null) }} />
        <IconButton icon="trash" label="Eliminar" onClick={() => remove.mutate(g.muscleGroupId)} />
      </div>
    )

  return (
    <Modal open={open} onClose={onClose} title="Grupos musculares" footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="space-y-4">
        <div className="space-y-3">
          {topGroups.map((g) => {
            const subs = subGroupsOf(g.name)
            const adding = subParent === g.muscleGroupId
            return (
              <div key={g.muscleGroupId} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-2.5">
                {renderRow(g)}
                {(subs.length > 0 || adding) && (
                  <div className="mt-2 ml-5 pl-3 border-l border-zinc-200 dark:border-zinc-800 space-y-1.5">
                    {subs.map((s) => <div key={s.muscleGroupId}>{renderRow(s, true)}</div>)}
                    {adding && (
                      <div className="flex items-center gap-2 pt-1">
                        <input type="color" value={subColor} onChange={(e) => setSubColor(e.target.value)} className="w-8 h-8 rounded border-0 bg-transparent p-0 cursor-pointer shrink-0" title="Cor do subgrupo" />
                        <div className="flex-1"><CmsCombo context="gym" value={subContentKey} name={subName} onChange={(key, nm) => { setSubContentKey(key); setSubName(nm) }} placeholder="Subgrupo (ex: Peito superior)" /></div>
                        <Button size="sm" isLoading={createSub.isPending} disabled={!subName.trim()} onClick={() => createSub.mutate()}>Adicionar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setSubParent(null)}>Cancelar</Button>
                      </div>
                    )}
                  </div>
                )}
                {!adding && (
                  <button
                    type="button"
                    onClick={() => { setSubParent(g.muscleGroupId); setSubName(''); setSubContentKey(null); setSubColor(randomColor()) }}
                    className="mt-1.5 ml-5 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Icon name="plus" className="w-3 h-3" /> Subgrupo
                  </button>
                )}
              </div>
            )
          })}
          {topGroups.length === 0 && <p className="text-sm text-zinc-400 text-center py-2">Ainda não há grupos.</p>}
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex items-center gap-2">
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-9 h-9 rounded border-0 bg-transparent p-0 cursor-pointer shrink-0" title="Cor do grupo" />
          <div className="flex-1"><CmsCombo context="gym" value={newContentKey} name={newName} onChange={(key, nm) => { setNewContentKey(key); setNewName(nm) }} placeholder="Novo grupo (ex: Antebraço)" /></div>
          <Button icon="plus" isLoading={create.isPending} disabled={!newName.trim()} onClick={() => create.mutate()}>Adicionar</Button>
        </div>
      </div>
      {translating && (
        <CmsTranslationsModal cmsKey={translating} defaultLang={defaultLang} onClose={() => setTranslating(null)} />
      )}
    </Modal>
  )
}

function CatalogoTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useGetGymExercises()
  const exercises = (data ?? []) as GymExercise[]
  const { names, colorOf, subGroupsOf } = useGymGroups()

  const [open, setOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [editing, setEditing] = useState<GymExercise | null>(null)
  const [name, setName] = useState('')
  const [contentKey, setContentKey] = useState<string | null>(null)
  const [group, setGroup] = useState<string>('')
  const [subGroup, setSubGroup] = useState<string>('')
  const [active, setActive] = useState(true)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [presets, setPresets] = useState<PresetDraft[]>([])
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  const subs = subGroupsOf(group)

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/exercises' }] })

  const toPresetDraft = (p: GymExercisePreset): PresetDraft => ({
    id: p.id || newUid(),
    name: p.name,
    sets: p.sets != null ? String(p.sets) : '',
    reps: p.reps != null ? String(p.reps) : '',
    weight: p.weight != null ? String(p.weight) : '',
    rest: p.rest != null ? String(p.rest) : '',
  })

  const startCreate = () => {
    setEditing(null); setName(''); setContentKey(null); setGroup(names[0] ?? ''); setSubGroup(''); setActive(true)
    setMedia([]); setPresets([]); setOpen(true)
  }
  const startEdit = (e: GymExercise) => {
    setEditing(e); setName(e.name); setContentKey((e as any).contentKey ?? null); setGroup(e.muscleGroup); setSubGroup(e.subGroup ?? ''); setActive(e.active ?? true)
    setMedia((e.media ?? []) as MediaItem[])
    // Presets vindos da API; se vazios, semeia um a partir dos default* legados.
    const fromApi = (e.presets ?? []).map(toPresetDraft)
    const hasLegacy = e.defaultSets != null || e.defaultReps != null || e.defaultRest != null || e.defaultWeight != null
    setPresets(
      fromApi.length
        ? fromApi
        : hasLegacy
          ? [toPresetDraft({ id: newUid(), name: 'Padrão', sets: e.defaultSets ?? null, reps: e.defaultReps ?? null, weight: e.defaultWeight ?? null, rest: e.defaultRest ?? null })]
          : [],
    )
    setOpen(true)
  }

  const updatePreset = (id: string, patch: Partial<PresetDraft>) =>
    setPresets((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const numOrNull = (v: string) => (v === '' ? null : Number(v))

  const save = useMutation({
    mutationFn: async () => {
      const cleanPresets = presets
        .filter((p) => p.name.trim())
        .map((p) => ({
          id: p.id, name: p.name.trim(),
          sets: numOrNull(p.sets), reps: numOrNull(p.reps),
          weight: numOrNull(p.weight), rest: numOrNull(p.rest),
        }))
      // Upload diferido: só envia os ficheiros pendentes agora, ao Guardar.
      const cleanMedia = await uploadPendingMedia(media, 'gym')
      const key = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      const body = {
        name: name.trim(), contentKey: key, muscleGroup: group, subGroup: subGroup || null, active, media: cleanMedia,
        presets: cleanPresets,
      } as any
      if (editing) return putGymExercisesId(editing.exerciseId, body)
      return postGymExercises(body)
    },
    onSuccess: () => { invalidate(); setOpen(false); toast.success(editing ? 'Exercício atualizado' : 'Exercício criado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteGymExercisesId(id),
    onSuccess: () => { invalidate(); toast.success('Exercício eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  const grouped = useMemo(() => {
    const map = new Map<string, GymExercise[]>()
    for (const e of exercises) {
      const arr = map.get(e.muscleGroup) ?? []
      arr.push(e); map.set(e.muscleGroup, arr)
    }
    return [...map.entries()].sort((a, b) => names.indexOf(a[0]) - names.indexOf(b[0]))
  }, [exercises, names])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-zinc-500">{exercises.length} exercício{exercises.length === 1 ? '' : 's'} no catálogo</p>
        <div className="flex gap-2">
          <Button variant="secondary" icon="settings" onClick={() => setManageOpen(true)}>Grupos</Button>
          <Button icon="plus" onClick={startCreate}>Novo exercício</Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-zinc-400">A carregar…</Card>
      ) : exercises.length === 0 ? (
        <EmptyState icon="box" title="Catálogo vazio" desc="Cria exercícios para os usar nos treinos dos clientes." action={<Button icon="plus" onClick={startCreate}>Novo exercício</Button>} />
      ) : (
        <div className="space-y-5">
          {grouped.map(([g, items]) => (
            <div key={g}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(g) }} />
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{g}</h3>
                <span className="text-xs text-zinc-400">({items.length})</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((e) => (
                  <Card key={e.exerciseId} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{e.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {e.subGroup && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{e.subGroup}</span>
                        )}
                        {(e.presets?.length ?? 0) > 0 && (
                          <span className="text-[10px] text-zinc-400">{e.presets!.length} preset{e.presets!.length === 1 ? '' : 's'}</span>
                        )}
                        {!e.active && <Badge tone="neutral">Inactivo</Badge>}
                      </div>
                    </div>
                    <IconButton icon="edit" label="Editar" onClick={() => startEdit(e)} />
                    <IconButton icon="trash" label="Eliminar" onClick={() => remove.mutate(e.exerciseId)} />
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar exercício' : 'Novo exercício'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button isLoading={save.isPending} disabled={!name.trim() || !group} onClick={() => save.mutate()}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <CmsCombo label="Nome" context="gym" value={contentKey} name={name} onChange={(key, nm) => { setContentKey(key); setName(nm) }} placeholder="Escrever nome…" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[11px] font-medium text-zinc-500 mb-1">Grupo muscular</span>
              <Combobox
                value={group}
                onChange={(v) => { setGroup(v); setSubGroup('') }}
                options={names.map((g) => ({ value: g, label: g }))}
                placeholder={names.length === 0 ? '(cria um grupo primeiro)' : 'Escolher grupo…'}
                searchPlaceholder="Pesquisar grupo…"
              />
            </div>
            <div>
              <span className="block text-[11px] font-medium text-zinc-500 mb-1">Subgrupo (opcional)</span>
              {subs.length === 0 ? (
                <div className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm text-zinc-400">— sem subgrupos —</div>
              ) : (
                <Combobox
                  value={subGroup}
                  onChange={setSubGroup}
                  options={[{ value: '', label: 'Nenhum' }, ...subs.map((s) => ({ value: s.name, label: s.name }))]}
                  placeholder="— nenhum —"
                  searchPlaceholder="Pesquisar subgrupo…"
                />
              )}
            </div>
          </div>
          <MediaGallery value={media} onChange={setMedia} module="gym" />

          {/* Presets de prescrição — séries/reps/peso/descanso nomeados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-500">Presets (séries/reps/peso/descanso)</span>
              <Button size="sm" variant="secondary" icon="plus" onClick={() => setPresets((ps) => [...ps, emptyPreset()])}>Preset</Button>
            </div>
            {presets.length === 0 ? (
              <p className="text-xs text-zinc-400">Sem presets. Adiciona um ou mais (ex: “Iniciante”, “Avançado”). Ao montar o treino do cliente escolhes qual usar.</p>
            ) : (
              <div className="space-y-2">
                {presets.map((p) => (
                  <div key={p.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={p.name} onChange={(ev: any) => updatePreset(p.id, { name: ev.target.value })} placeholder="Nome do preset (ex: Iniciante)" className="flex-1" />
                      <IconButton icon="trash" label="Remover preset" onClick={() => setPresets((ps) => ps.filter((x) => x.id !== p.id))} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <NumField label="Séries" value={p.sets} onChange={(v) => updatePreset(p.id, { sets: v })} />
                      <NumField label="Reps" value={p.reps} onChange={(v) => updatePreset(p.id, { reps: v })} />
                      <NumField label="Descanso (s)" value={p.rest} onChange={(v) => updatePreset(p.id, { rest: v })} />
                      <NumField label="Peso sug. (kg)" value={p.weight} onChange={(v) => updatePreset(p.id, { weight: v })} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-zinc-400">Deixa em branco o que não se aplica (ex: alongamentos sem peso ou reps).</p>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={active} onChange={(ev) => setActive(ev.target.checked)} />
            Activo (visível na app do cliente)
          </label>
        </div>
      </Modal>

      <MuscleGroupsModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Valores prescritos a partir de um preset (com fallbacks). Mantém-se editável.
const presetValues = (p?: GymExercisePreset) => ({
  sets: p?.sets ?? 3,
  reps: p?.reps ?? 10,
  weight: p?.weight ?? 0,
  rest: p?.rest ?? 60,
})

// Selector de preset de uma linha de exercício — só aparece se o exercício do
// catálogo tiver presets. Aplicar um preset pré-preenche os 4 campos (editáveis).
function PresetPicker({ exercise, onPick }: { exercise?: GymExercise; onPick: (p: GymExercisePreset) => void }) {
  const presets = exercise?.presets ?? []
  const [val, setVal] = useState('')
  if (presets.length === 0) return null
  return (
    <Combobox
      value={val}
      onChange={(v) => {
        setVal(v)
        const p = presets.find((x) => x.id === v)
        if (p) onPick(p)
      }}
      options={presets.map((p) => ({ value: p.id, label: p.name }))}
      placeholder="Preset…"
      searchPlaceholder="Pesquisar…"
      className="w-32 shrink-0"
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Workout editor modal (create/edit a workout with exercises)
function WorkoutModal({ open, onClose, programId, workout, catalog, templates, onSaved }: {
  open: boolean
  onClose: () => void
  programId: string
  workout: GymWorkout | null
  catalog: GymExercise[]
  templates: GymWorkout[]
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [contentKey, setContentKey] = useState<string | null>(null)
  const [days, setDays] = useState<number[]>([])
  const [rows, setRows] = useState<DraftExercise[]>([])
  const [picker, setPicker] = useState<string>('')
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Reset when (re)opened or when editing a different workout
  useEffect(() => {
    if (!open) return
    setName(workout?.name ?? '')
    setContentKey((workout as any)?.contentKey ?? null)
    setDays(workout?.daysOfWeek ?? [])
    setRows(
      (workout?.exercises ?? []).map((e) => ({
        uid: newUid(),
        exerciseId: e.exerciseId ?? null, name: e.name, group: e.group,
        subGroup: (e as any).subGroup ?? null,
        sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
        media: ((e as any).media ?? []) as MediaItem[],
      })),
    )
    setPicker('')
  }, [open, workout?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Associa um treino existente: copia exercícios (snapshot) + nome/chave se vazio.
  const associateTemplate = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId)
    if (!t) return
    const copied: DraftExercise[] = t.exercises.map((e) => ({
      uid: newUid(), exerciseId: e.exerciseId ?? null, name: e.name, group: e.group, subGroup: (e as any).subGroup ?? null,
      sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
      media: ((e as any).media ?? []) as MediaItem[],
    }))
    setRows((r) => [...r, ...copied])
    if (!name.trim()) {
      setName(t.name)
      setContentKey((t as any).contentKey ?? null)
    }
  }

  const addFromCatalog = () => {
    const ex = catalog.find((c) => c.exerciseId === picker) as GymExercise | undefined
    if (!ex) return
    const p0 = ex.presets?.[0]
    setRows((r) => [...r, {
      uid: newUid(),
      exerciseId: ex.exerciseId, name: ex.name, group: ex.muscleGroup, subGroup: ex.subGroup ?? null,
      sets: p0?.sets ?? ex.defaultSets ?? 3, reps: p0?.reps ?? ex.defaultReps ?? 10,
      weight: p0?.weight ?? ex.defaultWeight ?? 0, rest: p0?.rest ?? ex.defaultRest ?? 60,
      media: (ex.media ?? []) as MediaItem[],
    }])
    setPicker('')
  }
  const update = (uid: string, patch: Partial<DraftExercise>) =>
    setRows((r) => r.map((row) => (row.uid === uid ? { ...row, ...patch } : row)))
  const removeRow = (uid: string) => setRows((r) => r.filter((row) => row.uid !== uid))
  const onRowsDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setRows((r) => {
      const oldIdx = r.findIndex((x) => x.uid === active.id)
      const newIdx = r.findIndex((x) => x.uid === over.id)
      return oldIdx < 0 || newIdx < 0 ? r : arrayMove(r, oldIdx, newIdx)
    })
  }

  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: async () => {
      const key = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      const body = { name: name.trim(), contentKey: key, daysOfWeek: days, exercises: rows }
      if (workout) return putGymWorkoutsId(workout.id, body)
      return postGymProgramsProgramidWorkouts(programId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [{ url: '/gym/programs' }] })
      onSaved(); onClose()
      toast.success(workout ? 'Treino atualizado' : 'Treino criado')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  // No programa, os treinos são obrigados a ter dia(s) da semana.
  const canSave = !!name.trim() && rows.length > 0 && days.length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={workout ? 'Editar treino' : 'Novo treino'}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button isLoading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <CmsCombo label="Nome do treino" context="gym" value={contentKey} name={name} onChange={(key, nm) => { setContentKey(key); setName(nm) }} placeholder="Escrever nome…" />

        {templates.length > 0 && (
          <Combobox
            label="Associar treino existente (copia exercícios)"
            value=""
            onChange={associateTemplate}
            options={templates.map((t) => ({ value: t.id, label: `${t.name} · ${t.exercises.length} ex.` }))}
            placeholder="Escolher treino…"
            searchPlaceholder="Pesquisar treino…"
          />
        )}

        <div>
          <DaySelector value={days} onChange={setDays} />
          {days.length === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-1">Escolhe pelo menos um dia da semana.</p>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <span className="block text-[11px] font-medium text-zinc-500 mb-1">Adicionar exercício do catálogo</span>
            <Combobox
              value={picker}
              onChange={setPicker}
              options={catalog.filter((c) => c.active !== false).map((c) => ({ value: c.exerciseId, label: `${c.name} · ${c.muscleGroup}` }))}
              placeholder="Escolher exercício…"
              searchPlaceholder="Pesquisar exercício…"
            />
          </div>
          <Button icon="plus" variant="secondary" disabled={!picker} onClick={addFromCatalog}>Adicionar</Button>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Sem exercícios. Adiciona pelo menos um.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onRowsDragEnd}>
            <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {rows.map((row) => (
                  <Sortable key={row.uid} id={row.uid} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900">
                    {(handle) => (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <DragHandle {...handle} />
                          <GroupChip group={row.group} />
                          {row.subGroup && <span className="text-[10px] text-zinc-400">{row.subGroup}</span>}
                          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1 truncate">{row.name}</span>
                          <PresetPicker
                            exercise={catalog.find((c) => c.exerciseId === row.exerciseId) as GymExercise | undefined}
                            onPick={(p) => update(row.uid, presetValues(p))}
                          />
                          <IconButton icon="trash" label="Remover" onClick={() => removeRow(row.uid)} />
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {([['Séries', 'sets'], ['Reps', 'reps'], ['Peso (kg)', 'weight'], ['Descanso (s)', 'rest']] as const).map(([label, field]) => (
                            <label key={field} className="block">
                              <span className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</span>
                              <input
                                type="number" min={0}
                                value={row[field]}
                                onChange={(ev) => update(row.uid, { [field]: Number(ev.target.value) } as Partial<DraftExercise>)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:border-accent"
                              />
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </Sortable>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Workout template editor (reusable, not tied to a client)
function WorkoutTemplateModal({ open, onClose, template, catalog, onSaved }: {
  open: boolean
  onClose: () => void
  template: GymWorkout | null
  catalog: GymExercise[]
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [contentKey, setContentKey] = useState<string | null>(null)
  const [rows, setRows] = useState<DraftExercise[]>([])
  const [picker, setPicker] = useState<string>('')
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (!open) return
    setName(template?.name ?? '')
    setContentKey((template as any)?.contentKey ?? null)
    setRows(
      (template?.exercises ?? []).map((e) => ({
        uid: newUid(),
        exerciseId: e.exerciseId ?? null, name: e.name, group: e.group,
        subGroup: (e as any).subGroup ?? null,
        sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
        media: ((e as any).media ?? []) as MediaItem[],
      })),
    )
    setPicker('')
  }, [open, template?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const addFromCatalog = () => {
    const ex = catalog.find((c) => c.exerciseId === picker) as GymExercise | undefined
    if (!ex) return
    const p0 = ex.presets?.[0]
    setRows((r) => [...r, {
      uid: newUid(),
      exerciseId: ex.exerciseId, name: ex.name, group: ex.muscleGroup, subGroup: ex.subGroup ?? null,
      sets: p0?.sets ?? ex.defaultSets ?? 3, reps: p0?.reps ?? ex.defaultReps ?? 10,
      weight: p0?.weight ?? ex.defaultWeight ?? 0, rest: p0?.rest ?? ex.defaultRest ?? 60,
      media: (ex.media ?? []) as MediaItem[],
    }])
    setPicker('')
  }
  const update = (uid: string, patch: Partial<DraftExercise>) =>
    setRows((r) => r.map((row) => (row.uid === uid ? { ...row, ...patch } : row)))
  const removeRow = (uid: string) => setRows((r) => r.filter((row) => row.uid !== uid))
  const onRowsDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setRows((r) => {
      const oldIdx = r.findIndex((x) => x.uid === active.id)
      const newIdx = r.findIndex((x) => x.uid === over.id)
      return oldIdx < 0 || newIdx < 0 ? r : arrayMove(r, oldIdx, newIdx)
    })
  }

  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: async () => {
      const key = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      const body = { name: name.trim(), contentKey: key, exercises: rows } as any
      if (template) return putGymWorkoutTemplatesId(template.id, body)
      return postGymWorkoutTemplates(body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [{ url: '/gym/workout-templates' }] })
      onSaved(); onClose()
      toast.success(template ? 'Treino atualizado' : 'Treino criado')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <Modal open={open} onClose={onClose} title={template ? 'Editar treino' : 'Novo treino'} width="max-w-2xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button isLoading={save.isPending} disabled={!name.trim() || rows.length === 0} onClick={() => save.mutate()}>Guardar</Button></>}>
      <div className="space-y-4">
        <CmsCombo label="Nome do treino" context="gym" value={contentKey} name={name} onChange={(key, nm) => { setContentKey(key); setName(nm) }} placeholder="Escrever nome…" />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <span className="block text-[11px] font-medium text-zinc-500 mb-1">Adicionar exercício do catálogo</span>
            <Combobox
              value={picker}
              onChange={setPicker}
              options={catalog.filter((c) => c.active !== false).map((c) => ({ value: c.exerciseId, label: `${c.name} · ${c.muscleGroup}` }))}
              placeholder="Escolher exercício…"
              searchPlaceholder="Pesquisar exercício…"
            />
          </div>
          <Button icon="plus" variant="secondary" disabled={!picker} onClick={addFromCatalog}>Adicionar</Button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Sem exercícios. Adiciona pelo menos um.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onRowsDragEnd}>
            <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {rows.map((row) => (
                  <Sortable key={row.uid} id={row.uid} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900">
                    {(handle) => (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <DragHandle {...handle} />
                          <GroupChip group={row.group} />
                          {row.subGroup && <span className="text-[10px] text-zinc-400">{row.subGroup}</span>}
                          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1 truncate">{row.name}</span>
                          <PresetPicker
                            exercise={catalog.find((c) => c.exerciseId === row.exerciseId) as GymExercise | undefined}
                            onPick={(p) => update(row.uid, presetValues(p))}
                          />
                          <IconButton icon="trash" label="Remover" onClick={() => removeRow(row.uid)} />
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {([['Séries', 'sets'], ['Reps', 'reps'], ['Peso (kg)', 'weight'], ['Descanso (s)', 'rest']] as const).map(([label, field]) => (
                            <label key={field} className="block">
                              <span className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</span>
                              <input type="number" min={0} value={row[field]}
                                onChange={(ev) => update(row.uid, { [field]: Number(ev.target.value) } as Partial<DraftExercise>)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:border-accent" />
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </Sortable>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </Modal>
  )
}

// Reusable workout templates tab
function TreinosTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useGetGymWorkoutTemplates()
  const templates = (data ?? []) as GymWorkout[]
  const { data: catalogData } = useGetGymExercises()
  const catalog = (catalogData ?? []) as GymExercise[]

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GymWorkout | null>(null)

  const remove = useMutation({
    mutationFn: (id: string) => deleteGymWorkoutTemplatesId(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [{ url: '/gym/workout-templates' }] }); toast.success('Treino eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{templates.length} treino{templates.length === 1 ? '' : 's'} reutilizáve{templates.length === 1 ? 'l' : 'is'}</p>
        <Button icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo treino</Button>
      </div>
      {isLoading ? (
        <Card className="p-8 text-center text-zinc-400">A carregar…</Card>
      ) : templates.length === 0 ? (
        <EmptyState icon="folder" title="Sem treinos" desc="Cria treinos reutilizáveis (conjuntos de exercícios) para usar nos Planos e atribuir aos clientes." action={<Button icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo treino</Button>} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex-1 truncate">{t.name}</span>
                <IconButton icon="edit" label="Editar" onClick={() => { setEditing(t); setOpen(true) }} />
                <IconButton icon="trash" label="Eliminar" onClick={() => remove.mutate(t.id)} />
              </div>
              <div className="flex flex-wrap gap-1 mb-2">{(t.muscleGroups ?? []).map((g) => <GroupChip key={g} group={g} />)}</div>
              <p className="text-xs text-zinc-400">{t.exercises.length} exercício{t.exercises.length === 1 ? '' : 's'}</p>
            </Card>
          ))}
        </div>
      )}
      <WorkoutTemplateModal open={open} onClose={() => setOpen(false)} template={editing} catalog={catalog} onSaved={() => {}} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Programs tab (per selected client)
function ProgramasTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient()
  const { data: programsData, isLoading } = useGetGymPrograms({ customerId }, { query: { enabled: !!customerId } })
  const { data: catalogData } = useGetGymExercises()
  const programs = (programsData ?? []) as GymProgram[]
  const catalog = (catalogData ?? []) as GymExercise[]

  const { data: templatesData } = useGetGymWorkoutTemplates()
  const templates = (templatesData ?? []) as GymWorkout[]
  const { data: planosData } = useGetGymPlanos()
  const planos = (planosData ?? []) as GymPlano[]

  const [newProgOpen, setNewProgOpen] = useState(false)
  const [progName, setProgName] = useState('')
  const [progRange, setProgRange] = useState<DateRange | undefined>(undefined)
  const openNewProg = () => { setProgName(''); setProgRange(undefined); setNewProgOpen(true) }
  const [workoutModal, setWorkoutModal] = useState<{ programId: string; workout: GymWorkout | null } | null>(null)
  const [assignPlanoProgramId, setAssignPlanoProgramId] = useState<string | null>(null)
  const [assignPlanoId, setAssignPlanoId] = useState('')

  const { authHeader } = useAuth()
  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/programs' }] })
  // Adiciona os treinos de um Plano (com dias) ao programa do cliente.
  const assignPlano = useMutation({
    mutationFn: async () => {
      const plano = planos.find((p) => p.id === assignPlanoId)
      if (!plano || !assignPlanoProgramId) return
      for (const w of plano.workouts) {
        await postGymProgramsProgramidWorkouts(assignPlanoProgramId, {
          name: w.name,
          contentKey: (w as any).contentKey ?? null,
          daysOfWeek: w.daysOfWeek ?? [],
          exercises: (w.exercises ?? []).map((e) => ({
            exerciseId: e.exerciseId, name: e.name, group: e.group, subGroup: (e as any).subGroup ?? null,
            sets: e.sets, reps: e.reps, weight: e.weight, rest: e.rest, media: (e as any).media ?? [],
          })),
        } as any)
      }
    },
    onSuccess: () => { invalidate(); setAssignPlanoProgramId(null); setAssignPlanoId(''); toast.success('Plano adicionado ao programa') },
    onError: (e) => toast.error(getApiError(e)),
  })

  // Programa ativo do cliente — o que aparece na app dele para fazer.
  // Marcar um como ativo desativa os outros (regra na API).
  const setActive = useMutation({
    mutationFn: (programId: string) =>
      axiosInstance.patch(`/gym/programs/${programId}/active`, { active: true }, { headers: authHeader(), withCredentials: true }),
    onSuccess: () => { invalidate(); toast.success('Programa ativo definido') },
    onError: (e) => toast.error(getApiError(e)),
  })

  const createProgram = useMutation({
    mutationFn: () => postGymPrograms({
      name: progName.trim(),
      customerId,
      owner: 'coach',
      startDate: progRange?.from ? format(progRange.from, 'yyyy-MM-dd') : null,
      endDate: progRange?.to ? format(progRange.to, 'yyyy-MM-dd') : null,
    } as any),
    onSuccess: () => { invalidate(); setNewProgOpen(false); setProgName(''); setProgRange(undefined); toast.success('Programa criado') },
    onError: (e) => toast.error(getApiError(e)),
  })
  const removeProgram = useMutation({
    mutationFn: (id: string) => deleteGymProgramsId(id),
    onSuccess: () => { invalidate(); toast.success('Programa eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })
  const removeWorkout = useMutation({
    mutationFn: (id: string) => deleteGymWorkoutsId(id),
    onSuccess: () => { invalidate(); toast.success('Treino eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  // Ordem local para reordenar (drag & drop) com feedback imediato
  const [ordered, setOrdered] = useState<GymProgram[]>([])
  useEffect(() => { setOrdered((programsData ?? []) as GymProgram[]) }, [programsData])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const reorderProgramsMut = useMutation({
    mutationFn: (order: string[]) => patchGymProgramsReorder({ order }),
    onError: (e) => { toast.error(getApiError(e)); invalidate() },
  })
  const reorderWorkoutsMut = useMutation({
    mutationFn: (v: { programId: string; order: string[] }) =>
      patchGymProgramsProgramidWorkoutsReorder(v.programId, { order: v.order }),
    onError: (e) => { toast.error(getApiError(e)); invalidate() },
  })

  const onProgramDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = ordered.findIndex((p) => p.id === active.id)
    const newIdx = ordered.findIndex((p) => p.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(ordered, oldIdx, newIdx)
    setOrdered(next)
    reorderProgramsMut.mutate(next.map((p) => p.id))
  }
  const onWorkoutDragEnd = (programId: string) => (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const prog = ordered.find((p) => p.id === programId)
    if (!prog) return
    const oldIdx = prog.workouts.findIndex((w) => w.id === active.id)
    const newIdx = prog.workouts.findIndex((w) => w.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const workouts = arrayMove(prog.workouts, oldIdx, newIdx)
    setOrdered(ordered.map((p) => (p.id === programId ? { ...p, workouts } : p)))
    reorderWorkoutsMut.mutate({ programId, order: workouts.map((w) => w.id) })
  }

  if (isLoading) return <Card className="p-8 text-center text-zinc-400">A carregar programas…</Card>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{programs.length} programa{programs.length === 1 ? '' : 's'}</p>
        <Button icon="plus" onClick={openNewProg}>Atribuir programa</Button>
      </div>

      {ordered.length === 0 ? (
        <EmptyState icon="folder" title="Sem programas" desc="Cria um programa de treino e atribui-o a este cliente." action={<Button icon="plus" onClick={openNewProg}>Atribuir programa</Button>} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onProgramDragEnd}>
          <SortableContext items={ordered.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-5">
              {ordered.map((p) => (
                <Sortable key={p.id} id={p.id}>
                  {(handle) => (
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <DragHandle {...handle} />
                        <Icon name="folder" className="w-4 h-4 text-accent" />
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</h3>
                        <Badge tone={p.owner === 'coach' ? 'green' : 'neutral'}>{p.owner === 'coach' ? 'Coach' : 'Cliente'}</Badge>
                        {(p as any).active && <Badge tone="green">★ Ativo</Badge>}
                        {(p as any).startDate && (p as any).endDate && (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            <Icon name="calendar" className="w-3.5 h-3.5" />
                            {format(new Date((p as any).startDate), 'dd/MM/yy')} → {format(new Date((p as any).endDate), 'dd/MM/yy')}
                          </span>
                        )}
                        <span className="text-xs text-zinc-400">{p.workouts.length} treino{p.workouts.length === 1 ? '' : 's'}</span>
                        <div className="ml-auto flex items-center gap-1">
                          {!(p as any).active && (
                            <Button size="sm" variant="ghost" icon="check" onClick={() => setActive.mutate(p.id)}>Tornar ativo</Button>
                          )}
                          {p.owner === 'coach' && (
                            <>
                              <Button size="sm" variant="ghost" icon="calendar" onClick={() => { setAssignPlanoProgramId(p.id); setAssignPlanoId('') }}>Plano</Button>
                              <Button size="sm" variant="secondary" icon="plus" onClick={() => setWorkoutModal({ programId: p.id, workout: null })}>Treino</Button>
                            </>
                          )}
                          <IconButton icon="trash" label="Eliminar programa" onClick={() => removeProgram.mutate(p.id)} />
                        </div>
                      </div>

                      {p.workouts.length === 0 ? (
                        <p className="text-sm text-zinc-400 py-2">Sem treinos neste programa.</p>
                      ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onWorkoutDragEnd(p.id)}>
                          <SortableContext items={p.workouts.map((w) => w.id)} strategy={rectSortingStrategy}>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {p.workouts.map((w) => (
                                <Sortable key={w.id} id={w.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900">
                                  {(wHandle) => (
                                    <>
                                      <div className="flex items-center gap-2 mb-1.5">
                                        {p.owner === 'coach' && <DragHandle {...wHandle} />}
                                        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 flex-1 truncate">{w.name}</span>
                                        {p.owner === 'coach' && (
                                          <>
                                            <IconButton icon="edit" label="Editar" onClick={() => setWorkoutModal({ programId: p.id, workout: w })} />
                                            <IconButton icon="trash" label="Eliminar" onClick={() => removeWorkout.mutate(w.id)} />
                                          </>
                                        )}
                                      </div>
                                      {(w.daysOfWeek ?? []).length > 0 && (
                                        <div className="mb-2"><DayChips days={w.daysOfWeek ?? []} /></div>
                                      )}
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {(w.muscleGroups ?? []).map((g) => <GroupChip key={g} group={g} />)}
                                      </div>
                                      <ul className="text-xs text-zinc-500 space-y-0.5">
                                        {w.exercises.slice(0, 4).map((e) => (
                                          <li key={e.id} className="truncate">{e.name} · {e.sets}×{e.reps}{e.weight ? ` · ${e.weight}kg` : ''}</li>
                                        ))}
                                        {w.exercises.length > 4 && <li className="text-zinc-400">+{w.exercises.length - 4} mais…</li>}
                                      </ul>
                                    </>
                                  )}
                                </Sortable>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}
                    </Card>
                  )}
                </Sortable>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Modal
        open={newProgOpen}
        onClose={() => setNewProgOpen(false)}
        title="Atribuir programa"
        subtitle="Cria um programa de treino para este cliente (só leitura na app dele)."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewProgOpen(false)}>Cancelar</Button>
            <Button isLoading={createProgram.isPending} disabled={!progName.trim() || !progRange?.from || !progRange?.to} onClick={() => createProgram.mutate()}>Criar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nome do programa" value={progName} onChange={(ev: any) => setProgName(ev.target.value)} placeholder="Ex: Treino 1" />
          <div>
            <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Período (início → fim)</span>
            <DateRangePicker value={progRange} onChange={setProgRange} />
            <p className="text-xs text-zinc-400 mt-1.5">
              {progRange?.from && progRange?.to
                ? `${format(progRange.from, 'dd/MM/yyyy')} → ${format(progRange.to, 'dd/MM/yyyy')}`
                : 'Escolhe a data de início e de fim no calendário.'}
            </p>
          </div>
        </div>
      </Modal>

      {workoutModal && (
        <WorkoutModal
          open
          onClose={() => setWorkoutModal(null)}
          programId={workoutModal.programId}
          workout={workoutModal.workout}
          catalog={catalog}
          templates={templates}
          onSaved={invalidate}
        />
      )}

      <Modal
        open={assignPlanoProgramId !== null}
        onClose={() => setAssignPlanoProgramId(null)}
        title="Adicionar plano ao programa"
        subtitle="Copia os treinos do plano (com os dias) para este programa do cliente."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignPlanoProgramId(null)}>Cancelar</Button>
            <Button isLoading={assignPlano.isPending} disabled={!assignPlanoId} onClick={() => assignPlano.mutate()}>Adicionar</Button>
          </>
        }
      >
        {planos.length === 0 ? (
          <p className="text-sm text-zinc-400">Ainda não há planos. Cria um na tab “Planos”.</p>
        ) : (
          <Combobox
            value={assignPlanoId}
            onChange={setAssignPlanoId}
            options={planos.map((p) => ({ value: p.id, label: `${p.name} · ${p.workouts.length} treino${p.workouts.length === 1 ? '' : 's'}` }))}
            placeholder="Escolher plano…"
            searchPlaceholder="Pesquisar plano…"
          />
        )}
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress tab (per selected client)
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </Card>
  )
}

function ProgressoTab({ customerId }: { customerId: string }) {
  const { colorOf } = useGymGroups()
  const { data: stats, isLoading } = useGetGymClientsCustomeridStats(customerId, { query: { enabled: !!customerId } })
  const { data: logsData } = useGetGymClientsCustomeridLogs(customerId, { query: { enabled: !!customerId } })
  const logs = (logsData ?? []) as { logId: string; workoutName: string; date: string; durationMin: number; totalSets: number }[]

  if (isLoading) return <Card className="p-8 text-center text-zinc-400">A carregar progresso…</Card>

  const summary = stats?.summary ?? {}
  const weekly = stats?.weekly ?? []
  const records = stats?.records ?? []
  const maxWeek = Math.max(1, ...weekly.map((w) => w.count ?? 0))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Treinos totais" value={summary.totalWorkouts ?? 0} />
        <StatCard label="Dias de streak" value={summary.streak ?? 0} />
        <StatCard label="Séries feitas" value={summary.totalSets ?? 0} />
        <StatCard label="Treinos/semana" value={summary.avgPerWeek ?? 0} />
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Treinos por semana</h3>
        <div className="flex items-end gap-1.5 h-28">
          {weekly.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t bg-accent/80" style={{ height: `${((w.count ?? 0) / maxWeek) * 100}%`, minHeight: 2 }} title={`${w.count ?? 0}`} />
              <span className="text-[9px] text-zinc-400">{(w.weekStart ?? '').slice(5)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Recordes pessoais</h3>
          {records.length === 0 ? (
            <p className="text-sm text-zinc-400">Sem registos ainda.</p>
          ) : (
            <ul className="space-y-2">
              {records.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  {r.group && <span className="w-2 h-2 rounded-full" style={{ background: colorOf(r.group) }} />}
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1 truncate">{r.exerciseName}</span>
                  <span className="text-sm font-semibold tabular-nums">{r.weight} kg</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Últimos treinos</h3>
          {logs.length === 0 ? (
            <p className="text-sm text-zinc-400">Sem histórico.</p>
          ) : (
            <ul className="space-y-2">
              {logs.slice(0, 8).map((l) => (
                <li key={l.logId} className="flex items-center gap-2 text-sm">
                  <Icon name="check" className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-zinc-700 dark:text-zinc-300 flex-1 truncate">{l.workoutName}</span>
                  <span className="text-xs text-zinc-400">{l.date}</span>
                  <span className="text-xs text-zinc-400">· {l.totalSets} séries</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Planos — um plano é uma lista de Treinos; cada treino tem nome, dia(s) da
// semana (obrigatório) e exercícios. Pode associar-se um Treino existente
// (copia nome + exercícios como snapshot, editável sem afetar o template) ou
// montar-se de raiz. Vários treinos podem partilhar o mesmo dia.
type PlanoTreinoDraft = { uid: string; name: string; contentKey: string | null; daysOfWeek: number[]; rows: DraftExercise[] }

function PlanoModal({ open, onClose, plano, catalog, templates, onSaved }: {
  open: boolean
  onClose: () => void
  plano: GymPlano | null
  catalog: GymExercise[]
  templates: GymWorkout[]
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [contentKey, setContentKey] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [treinos, setTreinos] = useState<PlanoTreinoDraft[]>([])
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  useEffect(() => {
    if (!open) return
    setName(plano?.name ?? '')
    setContentKey((plano as any)?.contentKey ?? null)
    setNote(plano?.note ?? '')
    setTreinos(
      (plano?.workouts ?? []).map((w) => ({
        uid: newUid(),
        name: w.name,
        contentKey: (w as any).contentKey ?? null,
        daysOfWeek: w.daysOfWeek ?? [],
        rows: (w.exercises ?? []).map((e) => ({
          uid: newUid(), exerciseId: e.exerciseId ?? null, name: e.name, group: e.group,
          subGroup: (e as any).subGroup ?? null,
          sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
          media: ((e as any).media ?? []) as MediaItem[],
        })),
      })),
    )
  }, [open, plano?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const addTreino = () => setTreinos((d) => [...d, { uid: newUid(), name: '', contentKey: null, daysOfWeek: [], rows: [] }])
  const removeTreino = (uid: string) => setTreinos((d) => d.filter((x) => x.uid !== uid))
  const patchTreino = (uid: string, patch: Partial<PlanoTreinoDraft>) =>
    setTreinos((d) => d.map((x) => (x.uid === uid ? { ...x, ...patch } : x)))
  const addRows = (treinoUid: string, rows: DraftExercise[]) =>
    setTreinos((d) => d.map((x) => (x.uid === treinoUid ? { ...x, rows: [...x.rows, ...rows] } : x)))
  const updateRow = (treinoUid: string, rowUid: string, patch: Partial<DraftExercise>) =>
    setTreinos((d) => d.map((x) => (x.uid === treinoUid ? { ...x, rows: x.rows.map((r) => (r.uid === rowUid ? { ...r, ...patch } : r)) } : x)))
  const removeRow = (treinoUid: string, rowUid: string) =>
    setTreinos((d) => d.map((x) => (x.uid === treinoUid ? { ...x, rows: x.rows.filter((r) => r.uid !== rowUid) } : x)))

  const addExercise = (treinoUid: string, exerciseId: string) => {
    const ex = catalog.find((c) => c.exerciseId === exerciseId)
    if (!ex) return
    const p0 = ex.presets?.[0]
    addRows(treinoUid, [{
      uid: newUid(), exerciseId: ex.exerciseId, name: ex.name, group: ex.muscleGroup, subGroup: ex.subGroup ?? null,
      sets: p0?.sets ?? ex.defaultSets ?? 3, reps: p0?.reps ?? ex.defaultReps ?? 10,
      weight: p0?.weight ?? ex.defaultWeight ?? 0, rest: p0?.rest ?? ex.defaultRest ?? 60,
      media: (ex.media ?? []) as MediaItem[],
    }])
  }
  // Associa um Treino existente: copia os exercícios (snapshot) e, se o treino
  // ainda não tem nome, herda o nome do template. Não afeta o template original.
  const associateTemplate = (treinoUid: string, templateId: string) => {
    const t = templates.find((x) => x.id === templateId)
    if (!t) return
    const copied: DraftExercise[] = t.exercises.map((e) => ({
      uid: newUid(), exerciseId: e.exerciseId ?? null, name: e.name, group: e.group, subGroup: (e as any).subGroup ?? null,
      sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
      media: ((e as any).media ?? []) as MediaItem[],
    }))
    setTreinos((d) => d.map((x) =>
      x.uid === treinoUid
        ? {
            ...x,
            name: x.name.trim() ? x.name : t.name,
            // Herda a chave de tradução do template se o treino ainda não tem nome próprio.
            contentKey: x.contentKey ?? (x.name.trim() ? null : ((t as any).contentKey ?? null)),
            rows: [...x.rows, ...copied],
          }
        : x,
    ))
  }

  // Um treino só é válido com dia(s) da semana e pelo menos um exercício.
  const treinoInvalid = (t: PlanoTreinoDraft) => t.daysOfWeek.length === 0 || t.rows.length === 0
  const canSave = !!name.trim() && treinos.length > 0 && treinos.every((t) => !treinoInvalid(t))

  const save = useMutation({
    mutationFn: async () => {
      const planoKey = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      const treinoKeys = await Promise.all(
        treinos.map((d) => ensureCmsName(d.contentKey, 'gym', d.name.trim() || 'Treino', defaultLang)),
      )
      const body = {
        name: name.trim(), contentKey: planoKey, note: note || null,
        workouts: treinos.map((d, i) => ({
          name: (d.name.trim() || 'Treino'), contentKey: treinoKeys[i], daysOfWeek: d.daysOfWeek,
          exercises: d.rows.map((r) => ({
            exerciseId: r.exerciseId, name: r.name, group: r.group, subGroup: r.subGroup,
            sets: r.sets, reps: r.reps, weight: r.weight, rest: r.rest, media: r.media,
          })),
        })),
      } as any
      if (plano) return putGymPlanosId(plano.id, body)
      return postGymPlanos(body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [{ url: '/gym/planos' }] }); onSaved(); onClose(); toast.success(plano ? 'Plano atualizado' : 'Plano criado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <Modal open={open} onClose={onClose} title={plano ? 'Editar plano' : 'Novo plano'} width="max-w-3xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button isLoading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>Guardar</Button></>}>
      <div className="space-y-4">
        <CmsCombo label="Nome do plano" context="gym" value={contentKey} name={name} onChange={(key, nm) => { setContentKey(key); setName(nm) }} placeholder="Escrever nome…" />
        <Input label="Nota (opcional)" value={note} onChange={(ev: any) => setNote(ev.target.value)} placeholder="Ex: Iniciantes" />

        {treinos.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-3">Sem treinos. Adiciona um treino, escolhe o(s) dia(s) e os exercícios.</p>
        )}

        {treinos.map((treino, idx) => (
          <div key={treino.uid} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-3">
            <div className="flex items-end gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-accent/10 text-accent text-xs font-semibold shrink-0 mb-1.5">{idx + 1}</span>
              <div className="flex-1">
                <CmsCombo context="gym" value={treino.contentKey} name={treino.name} onChange={(key, nm) => patchTreino(treino.uid, { contentKey: key, name: nm })} placeholder="Nome do treino…" />
              </div>
              <IconButton icon="trash" label="Remover treino" onClick={() => removeTreino(treino.uid)} className="mb-1.5" />
            </div>

            <div>
              <DaySelector value={treino.daysOfWeek} onChange={(v) => patchTreino(treino.uid, { daysOfWeek: v })} />
              {treino.daysOfWeek.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-1">Escolhe pelo menos um dia da semana.</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <Combobox
                value=""
                onChange={(v) => associateTemplate(treino.uid, v)}
                options={templates.map((t) => ({ value: t.id, label: `${t.name} · ${t.exercises.length} ex.` }))}
                placeholder="Associar treino existente"
                searchPlaceholder="Pesquisar treino…"
              />
              <Combobox
                value=""
                onChange={(v) => addExercise(treino.uid, v)}
                options={catalog.filter((c) => c.active !== false).map((c) => ({ value: c.exerciseId, label: `${c.name} · ${c.muscleGroup}` }))}
                placeholder="+ Exercício do catálogo"
                searchPlaceholder="Pesquisar exercício…"
              />
            </div>

            {treino.rows.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-2">Sem exercícios. Associa um treino existente ou adiciona do catálogo.</p>
            ) : (
              <div className="space-y-2">
                {treino.rows.map((row) => (
                  <div key={row.uid} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5 bg-white dark:bg-zinc-900">
                    <div className="flex items-center gap-2 mb-2">
                      <GroupChip group={row.group} />
                      {row.subGroup && <span className="text-[10px] text-zinc-400">{row.subGroup}</span>}
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1 truncate">{row.name}</span>
                      <PresetPicker
                        exercise={catalog.find((c) => c.exerciseId === row.exerciseId)}
                        onPick={(p) => updateRow(treino.uid, row.uid, presetValues(p))}
                      />
                      <IconButton icon="trash" label="Remover" onClick={() => removeRow(treino.uid, row.uid)} />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {([['Séries', 'sets'], ['Reps', 'reps'], ['Peso (kg)', 'weight'], ['Descanso (s)', 'rest']] as const).map(([label, field]) => (
                        <label key={field} className="block">
                          <span className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</span>
                          <input type="number" min={0} value={row[field]}
                            onChange={(ev) => updateRow(treino.uid, row.uid, { [field]: Number(ev.target.value) } as Partial<DraftExercise>)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:border-accent" />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <Button type="button" variant="secondary" icon="plus" onClick={addTreino}>Adicionar treino</Button>
      </div>
    </Modal>
  )
}

function PlanosTab({ customers }: { customers: { customerId: string; name: string }[] }) {
  const qc = useQueryClient()
  const { data, isLoading } = useGetGymPlanos()
  const planos = (data ?? []) as GymPlano[]
  const { data: catalogData } = useGetGymExercises()
  const catalog = (catalogData ?? []) as GymExercise[]
  const { data: templatesData } = useGetGymWorkoutTemplates()
  const templates = (templatesData ?? []) as GymWorkout[]

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GymPlano | null>(null)
  const [assigning, setAssigning] = useState<GymPlano | null>(null)
  const [assignCustomer, setAssignCustomer] = useState('')
  const [assignRange, setAssignRange] = useState<DateRange | undefined>(undefined)

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/planos' }] })
  const remove = useMutation({
    mutationFn: (id: string) => deleteGymPlanosId(id),
    onSuccess: () => { invalidate(); toast.success('Plano eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })
  const openAssign = (p: GymPlano) => { setAssigning(p); setAssignCustomer(''); setAssignRange(undefined) }
  const assign = useMutation({
    mutationFn: () => postGymPlanosIdAssign(assigning!.id, {
      customerId: assignCustomer,
      startDate: assignRange?.from ? format(assignRange.from, 'yyyy-MM-dd') : null,
      endDate: assignRange?.to ? format(assignRange.to, 'yyyy-MM-dd') : null,
    } as any),
    onSuccess: () => { setAssigning(null); qc.invalidateQueries({ queryKey: [{ url: '/gym/programs' }] }); toast.success('Plano atribuído ao cliente') },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{planos.length} plano{planos.length === 1 ? '' : 's'} de treino</p>
        <Button icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo plano</Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-zinc-400">A carregar…</Card>
      ) : planos.length === 0 ? (
        <EmptyState icon="folder" title="Sem planos" desc="Cria um plano (conjunto de treinos por dias da semana) e atribui-o a clientes." action={<Button icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo plano</Button>} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {planos.map((p) => (
            <Card key={p.id} className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex-1 truncate">{p.name}</span>
                <Button size="sm" variant="ghost" icon="user" onClick={() => openAssign(p)}>Atribuir</Button>
                <IconButton icon="edit" label="Editar" onClick={() => { setEditing(p); setOpen(true) }} />
                <IconButton icon="trash" label="Eliminar" onClick={() => remove.mutate(p.id)} />
              </div>
              {p.note && <p className="text-xs text-zinc-400 mb-1.5">{p.note}</p>}
              <p className="text-xs text-zinc-400">{p.workouts.length} treino{p.workouts.length === 1 ? '' : 's'}</p>
            </Card>
          ))}
        </div>
      )}

      <PlanoModal open={open} onClose={() => setOpen(false)} plano={editing} catalog={catalog} templates={templates} onSaved={invalidate} />

      <Modal
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        title="Atribuir plano a um cliente"
        subtitle="Copia o plano para um programa do cliente (editável sem afetar o plano)."
        footer={<><Button variant="ghost" onClick={() => setAssigning(null)}>Cancelar</Button><Button isLoading={assign.isPending} disabled={!assignCustomer || !assignRange?.from || !assignRange?.to} onClick={() => assign.mutate()}>Atribuir</Button></>}
      >
        <div className="space-y-4">
          <Combobox
            label="Cliente"
            value={assignCustomer}
            onChange={setAssignCustomer}
            options={customers.map((c) => ({ value: c.customerId, label: c.name }))}
            placeholder="Seleccionar cliente…"
            searchPlaceholder="Pesquisar cliente…"
          />
          <div>
            <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Período (início → fim)</span>
            <DateRangePicker value={assignRange} onChange={setAssignRange} />
            <p className="text-xs text-zinc-400 mt-1.5">
              {assignRange?.from && assignRange?.to
                ? `${format(assignRange.from, 'dd/MM/yyyy')} → ${format(assignRange.to, 'dd/MM/yyyy')}`
                : 'Escolhe início e fim no calendário.'}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export function Ginasio() {
  const [tab, setTab] = useState<Tab>('catalogo')
  const [customerId, setCustomerId] = useState('')
  const { data: custData } = useGetCustomers()
  const customers = (custData?.rows ?? []) as { customerId: string; name: string }[]

  const tabs: { key: Tab; label: string; icon: string; needsClient: boolean }[] = [
    { key: 'catalogo', label: 'Exercícios', icon: 'grid', needsClient: false },
    { key: 'treinos', label: 'Treinos', icon: 'layers', needsClient: false },
    { key: 'planos', label: 'Planos', icon: 'calendar', needsClient: false },
    { key: 'programas', label: 'Programas', icon: 'folder', needsClient: true },
    { key: 'progresso', label: 'Progresso', icon: 'trend', needsClient: true },
  ]

  return (
    <GymGroupsProvider>
    <div className="space-y-6">
      <PageHeader title="Ginásio" subtitle="Exercícios, treinos, planos, programas atribuídos e progresso dos clientes." />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white dark:bg-zinc-900 text-accent shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              <Icon name={t.icon} className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {(tab === 'programas' || tab === 'progresso') && (
          <div className="min-w-[240px]">
            <Combobox
              value={customerId}
              onChange={setCustomerId}
              options={customers.map((c) => ({ value: c.customerId, label: c.name }))}
              placeholder="Seleccionar cliente…"
              searchPlaceholder="Pesquisar cliente…"
            />
          </div>
        )}
      </div>

      {tab === 'catalogo' && <CatalogoTab />}
      {tab === 'treinos' && <TreinosTab />}
      {tab === 'planos' && <PlanosTab customers={customers} />}
      {tab === 'programas' && (customerId ? <ProgramasTab customerId={customerId} /> : <EmptyState icon="user" title="Escolhe um cliente" desc="Selecciona um cliente para gerir os seus programas de treino." />)}
      {tab === 'progresso' && (customerId ? <ProgressoTab customerId={customerId} /> : <EmptyState icon="user" title="Escolhe um cliente" desc="Selecciona um cliente para ver o seu progresso." />)}
    </div>
    </GymGroupsProvider>
  )
}
