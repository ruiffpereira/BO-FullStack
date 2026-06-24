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
import { Card, Button, IconButton, Badge, Input, Modal, PageHeader, EmptyState, Avatar, BADGE_TONES } from '../ui/ui.jsx'
import { AreaChart, DonutChart } from '../ui/charts.jsx'
import { useGetCustomers } from '../gen/backoffice/hooks/useGetCustomers.js'
import { useGetGymExercises } from '../gen/backoffice/hooks/useGetGymExercises.js'
import { postGymExercises } from '../gen/backoffice/hooks/usePostGymExercises.js'
import { putGymExercisesId } from '../gen/backoffice/hooks/usePutGymExercisesId.js'
import { deleteGymExercisesId } from '../gen/backoffice/hooks/useDeleteGymExercisesId.js'
import { useGetGymPrograms } from '../gen/backoffice/hooks/useGetGymPrograms.js'
import { postGymPrograms } from '../gen/backoffice/hooks/usePostGymPrograms.js'
import { deleteGymProgramsId } from '../gen/backoffice/hooks/useDeleteGymProgramsId.js'
import { postGymProgramsProgramidWorkouts } from '../gen/backoffice/hooks/usePostGymProgramsProgramidWorkouts.js'
import { putGymProgramsId } from '../gen/backoffice/hooks/usePutGymProgramsId.js'
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
import { useGetGymMuscleGroups } from '../gen/backoffice/hooks/useGetGymMuscleGroups.js'
import { postGymMuscleGroups } from '../gen/backoffice/hooks/usePostGymMuscleGroups.js'
import { putGymMuscleGroupsId } from '../gen/backoffice/hooks/usePutGymMuscleGroupsId.js'
import { deleteGymMuscleGroupsId } from '../gen/backoffice/hooks/useDeleteGymMuscleGroupsId.js'
import type { GymExercise } from '../gen/backoffice/types/GymExercise.js'
import type { GymExercisePreset } from '../gen/backoffice/types/GymExercisePreset.js'
import type { GymMuscleGroup } from '../gen/backoffice/types/GymMuscleGroup.js'
import type { GymProgram } from '../gen/backoffice/types/GymProgram.js'
import type { GymWorkout } from '../gen/backoffice/types/GymWorkout.js'
import { type MediaItem } from '../components/MediaGallery'
import { Combobox } from '../components/Combobox'
import { DateRangePicker, type DateRange } from '../components/DateRangePicker'
import { DatePicker } from '../components/DatePicker'
import { format } from 'date-fns'

// Paleta de cores sugeridas para grupos/subgrupos — usada para dar uma cor
// aleatória por defeito ao criar (o user pode sempre mudar).
// Paleta igual à do protótipo do ginásio.
const GROUP_COLORS = [
  '#2A6FDB', '#1F8A5B', '#D97757', '#E6B450', '#7C5CDB', '#0EA5A4', '#64748B', '#DB2777',
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

type Tab = 'catalogo' | 'treinos' | 'planos' | 'clientes'

// Preset em edição no formulário (campos como string para permitir vazio = "—").
// type 'strength' = séries/reps/peso · 'time' = duração (ex: prancha, mobilidade).
type PresetDraft = { id: string; name: string; contentKey: string | null; type: 'strength' | 'time'; sets: string; reps: string; weight: string; rest: string; duration: string; notes: string }
const emptyPreset = (): PresetDraft => ({ id: newUid(), name: '', contentKey: null, type: 'strength', sets: '', reps: '', weight: '', rest: '', duration: '', notes: '' })

type DraftExercise = {
  uid: string
  exerciseId?: string | null
  name: string
  group: string
  subGroup?: string | null
  type: 'strength' | 'time'
  sets: number
  reps: number
  weight: number
  rest: number
  duration: number
  notes?: string | null
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
// Modal de UM grupo muscular (nome + cor livre + subgrupos como chips) — estilo
// do protótipo. O nome é traduzível (CMS); a cor é escolhida livremente pelo user.
function GrupoModal({ grupo, onClose }: { grupo: Group | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { subGroupsOf } = useGymGroups()
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  const [name, setName] = useState(grupo?.name ?? '')
  const [contentKey, setContentKey] = useState<string | null>((grupo as any)?.contentKey ?? null)
  const [color, setColor] = useState(grupo?.color ?? randomColor())
  type SubDraft = { uid: string; muscleGroupId?: string; name: string; contentKey: string | null }
  const [subs, setSubs] = useState<SubDraft[]>(() =>
    grupo ? subGroupsOf(grupo.name).map((s) => ({ uid: newUid(), muscleGroupId: s.muscleGroupId, name: s.name, contentKey: (s as any).contentKey ?? null })) : [],
  )
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [novoSubName, setNovoSubName] = useState('')
  const [novoSubKey, setNovoSubKey] = useState<string | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/muscle-groups' }] })
  const addSub = () => { if (!novoSubName.trim()) return; setSubs((s) => [...s, { uid: newUid(), name: novoSubName.trim(), contentKey: novoSubKey }]); setNovoSubName(''); setNovoSubKey(null) }
  const delSub = (sd: SubDraft) => {
    if (sd.muscleGroupId) setRemovedIds((r) => [...r, sd.muscleGroupId!])
    setSubs((s) => s.filter((x) => x.uid !== sd.uid))
  }

  const save = useMutation({
    mutationFn: async () => {
      const key = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      let groupId = grupo?.muscleGroupId
      if (grupo) {
        await putGymMuscleGroupsId(grupo.muscleGroupId, { name: name.trim(), color, contentKey: key } as any)
      } else {
        const created = await postGymMuscleGroups({ name: name.trim(), color, contentKey: key } as any)
        groupId = (created as any).muscleGroupId
      }
      // Cria os subgrupos novos (nome via CMS) com parentId do grupo.
      for (const sd of subs.filter((x) => !x.muscleGroupId)) {
        const sk = await ensureCmsName(sd.contentKey ?? null, 'gym', sd.name, defaultLang)
        await postGymMuscleGroups({ name: sd.name.trim(), color, parentId: groupId, contentKey: sk } as any)
      }
      // Apaga os subgrupos removidos.
      for (const id of removedIds) await deleteGymMuscleGroupsId(id)
    },
    onSuccess: () => { invalidate(); onClose(); toast.success(grupo ? 'Grupo atualizado' : 'Grupo criado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <Modal open onClose={onClose} width="max-w-md" title={grupo ? 'Editar grupo muscular' : 'Novo grupo muscular'} subtitle="Define o grupo, a cor e os subgrupos."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" isLoading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate()}>{grupo ? 'Guardar' : 'Criar'}</Button></>}>
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1"><CmsCombo label="Nome do grupo" context="gym" value={contentKey} name={name} onChange={(k, nm) => { setContentKey(k); setName(nm) }} placeholder="Ex: Peito" /></div>
          <div>
            <span className="block text-[11px] font-medium text-zinc-500 mb-1">Cor</span>
            <label className="relative inline-flex w-9 h-9 cursor-pointer" title="Cor do grupo (à escolha)">
              <span className="w-9 h-9 rounded-full border-2 border-white dark:border-zinc-900 shadow ring-1 ring-zinc-200 dark:ring-zinc-700" style={{ background: color }} />
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </label>
          </div>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-zinc-500 mb-2">Subgrupos <span className="text-zinc-400 font-normal">(opcional)</span></span>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {subs.map((s) => (
              <span key={s.uid} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200">
                {s.name}
                <button type="button" onClick={() => delSub(s)} className="text-zinc-400 hover:text-red-500 text-base leading-none">×</button>
              </span>
            ))}
            {subs.length === 0 && <span className="text-sm text-zinc-400">Sem subgrupos.</span>}
          </div>
          <div className="flex gap-2">
            <div className="flex-1"><CmsCombo context="gym" value={novoSubKey} name={novoSubName} onChange={(k, nm) => { setNovoSubKey(k); setNovoSubName(nm) }} placeholder="Ex: Superior" onSubmit={addSub} /></div>
            <Button variant="secondary" icon="plus" onClick={addSub}>Adicionar</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function CatalogoTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useGetGymExercises()
  const exercises = (data ?? []) as GymExercise[]
  const { colorOf, topGroups, groups } = useGymGroups()

  const [open, setOpen] = useState(false)
  const [grupoModal, setGrupoModal] = useState<{ group: Group | null } | null>(null)
  const [confirmDel, setConfirmDel] = useState<GymExercise | null>(null)
  const [editing, setEditing] = useState<GymExercise | null>(null)
  const [name, setName] = useState('')
  const [contentKey, setContentKey] = useState<string | null>(null)
  // Relação por id (fonte de verdade); o nome é só display/cache no backend.
  const [groupId, setGroupId] = useState<string>('')
  const [subGroupId, setSubGroupId] = useState<string>('')
  const [active, setActive] = useState(true)
  const [presets, setPresets] = useState<PresetDraft[]>([])
  // Layout do protótipo: sidebar de grupos (filtro) + pesquisa + cards expansíveis.
  const [grupoSel, setGrupoSel] = useState<string>('todos')
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  // Editor de preset inline (padrão do protótipo): cartões compactos + editor ao abrir.
  const [presetEdit, setPresetEdit] = useState<{ form: PresetDraft; isNew: boolean } | null>(null)
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  const presetResumo = (p: GymExercisePreset) =>
    (p as any).type === 'time'
      ? `${(p as any).duration ?? 0}s${p.rest ? ` · ${p.rest}s desc.` : ''}`
      : `${p.sets ?? '–'}×${p.reps ?? '–'}${p.weight ? ` · ${p.weight}kg` : ''}${p.rest ? ` · ${p.rest}s` : ''}`
  const draftResumo = (p: PresetDraft) =>
    p.type === 'time'
      ? `${p.duration || '–'}s${p.rest ? ` · ${p.rest}s desc.` : ''}`
      : `${p.sets || '–'}×${p.reps || '–'}${p.weight ? ` · ${p.weight}kg` : ''}${p.rest ? ` · ${p.rest}s` : ''}`
  const togCls = (on: boolean) => `py-1.5 rounded-lg border text-xs font-medium transition ${on ? 'border-accent bg-accent/[0.06] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`
  const setEditField = (patch: Partial<PresetDraft>) => setPresetEdit((pe) => (pe ? { ...pe, form: { ...pe.form, ...patch } } : pe))
  const savePresetEdit = () => {
    if (!presetEdit) return
    const f = presetEdit.form
    setPresets((ps) => (ps.some((x) => x.id === f.id) ? ps.map((x) => (x.id === f.id ? f : x)) : [...ps, f]))
    setPresetEdit(null)
  }

  const subs = groups.filter((g) => g.parentId === groupId)

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/exercises' }] })

  const toPresetDraft = (p: GymExercisePreset): PresetDraft => ({
    id: p.id || newUid(),
    name: p.name,
    contentKey: (p as any).contentKey ?? null,
    type: (p as any).type === 'time' ? 'time' : 'strength',
    sets: p.sets != null ? String(p.sets) : '',
    reps: p.reps != null ? String(p.reps) : '',
    weight: p.weight != null ? String(p.weight) : '',
    rest: p.rest != null ? String(p.rest) : '',
    duration: (p as any).duration != null ? String((p as any).duration) : '',
    notes: (p as any).notes ?? '',
  })

  const startCreate = () => {
    setEditing(null); setName(''); setContentKey(null); setGroupId(''); setSubGroupId(''); setActive(true)
    setPresets([]); setPresetEdit(null); setOpen(true)
  }
  const startEdit = (e: GymExercise) => {
    // Fallback p/ legados sem id: resolve pelo nome guardado.
    const gid = (e as any).muscleGroupId ?? topGroups.find((g) => g.name === e.muscleGroup)?.muscleGroupId ?? ''
    setEditing(e); setName(e.name); setContentKey((e as any).contentKey ?? null); setGroupId(gid); setSubGroupId((e as any).subGroupId ?? ''); setActive(e.active ?? true)
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

  const numOrNull = (v: string) => (v === '' ? null : Number(v))

  const save = useMutation({
    mutationFn: async () => {
      // O nome de cada preset é traduzível (CMS): garante a chave ao Guardar.
      const cleanPresets = await Promise.all(
        presets.filter((p) => p.name.trim()).map(async (p) => {
          const pk = await ensureCmsName(p.contentKey, 'gym', p.name, defaultLang)
          return {
            id: p.id, name: p.name.trim(), contentKey: pk, type: p.type,
            sets: numOrNull(p.sets), reps: numOrNull(p.reps),
            weight: numOrNull(p.weight), rest: numOrNull(p.rest),
            duration: numOrNull(p.duration), notes: p.notes.trim() || null,
          }
        }),
      )
      const key = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      const body = {
        name: name.trim(), contentKey: key, muscleGroupId: groupId, subGroupId: subGroupId || null, active, media: [],
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

  const filtered = useMemo(() => {
    const sel = topGroups.find((g) => g.muscleGroupId === grupoSel)
    return exercises.filter((e) =>
      (grupoSel === 'todos' || e.muscleGroup === sel?.name) &&
      e.name.toLowerCase().includes(q.toLowerCase()),
    )
  }, [exercises, grupoSel, q, topGroups])
  const countByGroup = (gName: string) => exercises.filter((e) => e.muscleGroup === gName).length

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-5">
        {/* Sidebar de grupos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-400">Grupos</h3>
            <IconButton icon="plus" label="Novo grupo" onClick={() => setGrupoModal({ group: null })} className="w-7 h-7" />
          </div>
          <div className="space-y-0.5">
            <button onClick={() => setGrupoSel('todos')} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${grupoSel === 'todos' ? 'bg-accent/10 text-accent' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <Icon name="grid" className="w-4 h-4" />Todos
              <span className="ml-auto text-xs text-zinc-400 tabular-nums">{exercises.length}</span>
            </button>
            {topGroups.map((g) => (
              <div key={g.muscleGroupId} className={`group/grp flex items-center gap-1 rounded-lg transition ${grupoSel === g.muscleGroupId ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                <button onClick={() => setGrupoSel(g.muscleGroupId)} className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium flex-1 min-w-0 text-left ${grupoSel === g.muscleGroupId ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(g.name) }} />
                  <span className="truncate">{g.name}</span>
                </button>
                <span className="opacity-0 group-hover/grp:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                  <IconButton icon="edit" label="Editar grupo" onClick={() => setGrupoModal({ group: g })} className="w-6 h-6" />
                </span>
                <span className="text-xs text-zinc-400 tabular-nums pr-2">{countByGroup(g.name)}</span>
              </div>
            ))}
            {topGroups.length === 0 && <p className="text-xs text-zinc-400 px-3 py-2">Sem grupos. Cria com o + acima.</p>}
          </div>
        </div>

        {/* Lista de exercícios */}
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar exercício…" className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100" />
            <Button icon="plus" onClick={startCreate}>Novo exercício</Button>
          </div>

          {isLoading ? (
            <Card className="p-8 text-center text-zinc-400">A carregar…</Card>
          ) : filtered.length === 0 ? (
            <EmptyState icon="box" title="Sem exercícios" desc="Cria exercícios para os usar nos treinos dos clientes." action={<Button icon="plus" onClick={startCreate}>Novo exercício</Button>} />
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => {
                const isOpen = expanded === e.exerciseId
                return (
                  <Card key={e.exerciseId} className="overflow-hidden">
                    <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30" onClick={() => setExpanded(isOpen ? null : e.exerciseId)}>
                      <span className="w-9 h-9 rounded-lg shrink-0" style={{ background: colorOf(e.muscleGroup) }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 dark:text-white truncate">{e.name}</p>
                        <p className="text-xs text-zinc-400">{e.muscleGroup}{e.subGroup ? ` · ${e.subGroup}` : ''}</p>
                      </div>
                      {!e.active && <Badge tone="neutral">Inactivo</Badge>}
                      <Badge tone="neutral">{e.presets?.length ?? 0} preset{(e.presets?.length ?? 0) === 1 ? '' : 's'}</Badge>
                      <span onClick={(ev) => ev.stopPropagation()}>
                        <IconButton icon="edit" label="Editar" onClick={() => startEdit(e)} />
                      </span>
                      <Icon name="chevronDown" className={`w-4 h-4 text-zinc-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                    {isOpen && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-zinc-50 dark:border-zinc-800/50">
                        {(e.presets?.length ?? 0) > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {e.presets!.map((p) => (
                              <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                                <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${(p as any).type === 'time' ? 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300' : 'bg-accent/10 text-accent'}`}>{(p as any).type === 'time' ? 'T' : 'F'}</span>
                                <div className="min-w-0"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{p.name}</p><p className="text-xs text-zinc-400 tabular-nums">{presetResumo(p)}</p></div>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-zinc-400 mt-2">Sem presets.</p>}
                        <div className="flex justify-end mt-3 gap-1">
                          <Button variant="ghost" size="sm" icon="edit" onClick={() => startEdit(e)}>Gerir presets</Button>
                          <Button variant="ghost" size="sm" icon="trash" className="text-red-500" onClick={() => setConfirmDel(e)}>Eliminar</Button>
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar exercício' : 'Novo exercício'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button isLoading={save.isPending} disabled={!name.trim() || !groupId || presets.filter((p) => p.name.trim()).length === 0} onClick={() => save.mutate()}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <CmsCombo label="Nome" context="gym" value={contentKey} name={name} onChange={(key, nm) => { setContentKey(key); setName(nm) }} placeholder="Escrever nome…" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[11px] font-medium text-zinc-500 mb-1">Grupo muscular</span>
              <Combobox
                value={groupId}
                onChange={(v) => { setGroupId(v); setSubGroupId('') }}
                options={topGroups.map((g) => ({ value: g.muscleGroupId, label: g.name }))}
                placeholder={topGroups.length === 0 ? '(cria um grupo primeiro)' : 'Escolher grupo…'}
                searchPlaceholder="Pesquisar grupo…"
              />
            </div>
            <div>
              <span className="block text-[11px] font-medium text-zinc-500 mb-1">Subgrupo (opcional)</span>
              {subs.length === 0 ? (
                <div className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm text-zinc-400">— sem subgrupos —</div>
              ) : (
                <Combobox
                  value={subGroupId}
                  onChange={setSubGroupId}
                  options={[{ value: '', label: 'Nenhum' }, ...subs.map((s) => ({ value: s.muscleGroupId, label: s.name }))]}
                  placeholder="— nenhum —"
                  searchPlaceholder="Pesquisar subgrupo…"
                />
              )}
            </div>
          </div>

          {/* Presets — cartões compactos + editor inline (padrão do protótipo) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-500">Presets ({presets.length})</span>
              <Button size="sm" variant="ghost" icon="plus" onClick={() => setPresetEdit({ form: emptyPreset(), isNew: true })}>Adicionar preset</Button>
            </div>
            {presets.length === 0 && !presetEdit ? (
              <p className="text-xs text-amber-600 dark:text-amber-500 border border-dashed border-amber-300 dark:border-amber-500/40 rounded-lg p-3 text-center">É obrigatório pelo menos um preset (ex: “Iniciante”, “Avançado”). Presets de “tempo” servem para pranchas/mobilidade.</p>
            ) : (
              <div className="space-y-1.5">
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${p.type === 'time' ? 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300' : 'bg-accent/10 text-accent'}`}>{p.type === 'time' ? 'T' : 'F'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{p.name || 'Sem nome'}</p>
                      <p className="text-xs text-zinc-400 tabular-nums">{draftResumo(p)}{p.notes ? ` · ${p.notes}` : ''}</p>
                    </div>
                    <IconButton icon="edit" label="Editar preset" onClick={() => setPresetEdit({ form: { ...p }, isNew: false })} />
                    <IconButton icon="trash" label="Remover preset" onClick={() => setPresets((ps) => ps.filter((x) => x.id !== p.id))} />
                  </div>
                ))}
              </div>
            )}

            {presetEdit && (
              <div className="border border-accent/30 bg-accent/[0.02] rounded-xl p-3 space-y-3">
                <p className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">{presetEdit.isNew ? 'Novo preset' : 'Editar preset'}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setEditField({ type: 'strength' })} className={togCls(presetEdit.form.type === 'strength')}>Força (séries/reps)</button>
                  <button type="button" onClick={() => setEditField({ type: 'time' })} className={togCls(presetEdit.form.type === 'time')}>Tempo (duração)</button>
                </div>
                <CmsCombo label="Nome do preset" context="gym" value={presetEdit.form.contentKey} name={presetEdit.form.name} onChange={(k, nm) => setEditField({ contentKey: k, name: nm })} placeholder="Ex: Iniciante" />
                {presetEdit.form.type === 'time' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="Duração (s)" value={presetEdit.form.duration} onChange={(v) => setEditField({ duration: v })} />
                    <NumField label="Descanso (s)" value={presetEdit.form.rest} onChange={(v) => setEditField({ rest: v })} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <NumField label="Séries" value={presetEdit.form.sets} onChange={(v) => setEditField({ sets: v })} />
                    <NumField label="Reps" value={presetEdit.form.reps} onChange={(v) => setEditField({ reps: v })} />
                    <NumField label="Descanso (s)" value={presetEdit.form.rest} onChange={(v) => setEditField({ rest: v })} />
                    <NumField label="Peso (kg)" value={presetEdit.form.weight} onChange={(v) => setEditField({ weight: v })} />
                  </div>
                )}
                <Input label="Notas (opcional)" value={presetEdit.form.notes} onChange={(ev: any) => setEditField({ notes: ev.target.value })} placeholder="Ex: cadência 2-0-2" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPresetEdit(null)}>Cancelar</Button>
                  <Button size="sm" icon="check" disabled={!presetEdit.form.name.trim()} onClick={savePresetEdit}>Guardar preset</Button>
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={active} onChange={(ev) => setActive(ev.target.checked)} />
            Activo (visível na app do cliente)
          </label>
        </div>
      </Modal>

      {grupoModal && <GrupoModal grupo={grupoModal.group} onClose={() => setGrupoModal(null)} />}

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar exercício?"
        footer={<><Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancelar</Button><Button variant="danger" isLoading={remove.isPending} onClick={() => { if (confirmDel) remove.mutate(confirmDel.exerciseId); setConfirmDel(null) }}>Eliminar</Button></>}
      >
        <p className="text-sm text-zinc-500">Tens a certeza que queres eliminar <strong className="text-zinc-800 dark:text-zinc-100">{confirmDel?.name}</strong>? Esta ação não pode ser revertida.</p>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Valores prescritos a partir de um preset (com fallbacks). Mantém-se editável.
const presetValues = (p?: GymExercisePreset): Partial<DraftExercise> => ({
  type: (p as any)?.type === 'time' ? 'time' : 'strength',
  sets: p?.sets ?? 3,
  reps: p?.reps ?? 10,
  weight: p?.weight ?? 0,
  rest: p?.rest ?? 60,
  duration: (p as any)?.duration ?? 0,
  notes: (p as any)?.notes ?? null,
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
function WorkoutModal({ open, onClose, programId, workout, mode = 'weekly', catalog, templates, onSaved }: {
  open: boolean
  onClose: () => void
  programId: string
  workout: GymWorkout | null
  mode?: 'weekly' | 'free'
  catalog: GymExercise[]
  templates: GymWorkout[]
  onSaved: () => void
}) {
  const { colorOf } = useGymGroups()
  const [name, setName] = useState('')
  const [contentKey, setContentKey] = useState<string | null>(null)
  const [days, setDays] = useState<number[]>([])
  const [dayLabel, setDayLabel] = useState('')
  const [rows, setRows] = useState<DraftExercise[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Reset when (re)opened or when editing a different workout
  useEffect(() => {
    if (!open) return
    setName(workout?.name ?? '')
    setContentKey((workout as any)?.contentKey ?? null)
    setDays(workout?.daysOfWeek ?? [])
    setDayLabel((workout as any)?.dayLabel ?? '')
    setRows(
      (workout?.exercises ?? []).map((e) => ({
        uid: newUid(),
        exerciseId: e.exerciseId ?? null, name: e.name, group: e.group,
        subGroup: (e as any).subGroup ?? null,
        type: (e as any).type === 'time' ? 'time' : 'strength',
        sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
        duration: (e as any).duration ?? 0, notes: (e as any).notes ?? null,
        media: ((e as any).media ?? []) as MediaItem[],
      })),
    )
    setAddOpen(false)
  }, [open, workout?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Associa um treino existente: copia exercícios (snapshot) + nome/chave se vazio.
  const associateTemplate = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId)
    if (!t) return
    const copied: DraftExercise[] = t.exercises.map((e) => ({
      uid: newUid(), exerciseId: e.exerciseId ?? null, name: e.name, group: e.group, subGroup: (e as any).subGroup ?? null,
      type: (e as any).type === 'time' ? 'time' : 'strength',
      sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
      duration: (e as any).duration ?? 0, notes: (e as any).notes ?? null,
      media: ((e as any).media ?? []) as MediaItem[],
    }))
    setRows((r) => [...r, ...copied])
    if (!name.trim()) {
      setName(t.name)
      setContentKey((t as any).contentKey ?? null)
    }
  }

  const addExercise = (ex: GymExercise) => {
    const p0 = ex.presets?.[0]
    setRows((r) => [...r, {
      uid: newUid(),
      exerciseId: ex.exerciseId, name: ex.name, group: ex.muscleGroup, subGroup: ex.subGroup ?? null,
      type: (p0 as any)?.type === 'time' ? 'time' : 'strength',
      sets: p0?.sets ?? ex.defaultSets ?? 3, reps: p0?.reps ?? ex.defaultReps ?? 10,
      weight: p0?.weight ?? ex.defaultWeight ?? 0, rest: p0?.rest ?? ex.defaultRest ?? 60,
      duration: (p0 as any)?.duration ?? 0, notes: (p0 as any)?.notes ?? null,
      media: (ex.media ?? []) as MediaItem[],
    }])
    setAddOpen(false)
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
      const body = {
        name: name.trim(), contentKey: key,
        daysOfWeek: mode === 'weekly' ? days : [],
        dayLabel: mode === 'free' ? (dayLabel.trim() || 'Dia') : null,
        exercises: rows,
      } as any
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

  // Modo "weekly": treino precisa de dia(s) da semana. Modo "free": basta o rótulo.
  const canSave = !!name.trim() && rows.length > 0 && (mode === 'weekly' ? days.length > 0 : !!dayLabel.trim())

  if (!open) return null

  const totalSeries = rows.reduce((s, r) => s + (r.type === 'time' ? 0 : (r.sets || 0)), 0)
  const gruposUsados = [...new Set(rows.map((r) => r.group))].filter(Boolean)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar</button>
        <div className="sm:ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button isLoading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>{workout ? 'Guardar treino' : 'Criar treino'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div>
          <Card className="p-4 mb-4 space-y-3">
            <CmsCombo label="Nome do treino" context="gym" value={contentKey} name={name} onChange={(key, nm) => { setContentKey(key); setName(nm) }} placeholder="Escrever nome…" />
            {templates.length > 0 && (
              <Combobox label="Associar treino existente (copia exercícios)" value="" onChange={associateTemplate} options={templates.map((t) => ({ value: t.id, label: `${t.name} · ${t.exercises.length} ex.` }))} placeholder="Escolher treino…" searchPlaceholder="Pesquisar treino…" />
            )}
            {mode === 'weekly' ? (
              <div>
                <DaySelector value={days} onChange={setDays} />
                {days.length === 0 && <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-1">Escolhe pelo menos um dia da semana.</p>}
              </div>
            ) : (
              <Input label="Rótulo do dia" value={dayLabel} onChange={(ev: any) => setDayLabel(ev.target.value)} placeholder="Ex: Dia 1" />
            )}
          </Card>

          {rows.length === 0 ? (
            <Card><EmptyState icon="layers" title="Treino vazio" desc="Adiciona exercícios da tua biblioteca." action={<Button icon="plus" onClick={() => setAddOpen(true)}>Adicionar exercício</Button>} /></Card>
          ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onRowsDragEnd}>
            <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <Sortable key={row.uid} id={row.uid} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900">
                    {(handle) => (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <DragHandle {...handle} />
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 text-xs font-semibold" style={{ background: colorOf(row.group) }}>{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{row.name}</p>
                            <p className="text-[11px] text-zinc-400">{row.group}{row.subGroup ? ` · ${row.subGroup}` : ''}</p>
                          </div>
                          <PresetPicker
                            exercise={catalog.find((c) => c.exerciseId === row.exerciseId) as GymExercise | undefined}
                            onPick={(p) => update(row.uid, presetValues(p))}
                          />
                          <IconButton icon="trash" label="Remover" onClick={() => removeRow(row.uid)} />
                        </div>
                        <div className="flex items-center gap-1.5 mb-2 pl-10">
                          <button type="button" onClick={() => update(row.uid, { type: 'strength' })} className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${row.type !== 'time' ? 'border-accent bg-accent/[0.06] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}>Força</button>
                          <button type="button" onClick={() => update(row.uid, { type: 'time' })} className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${row.type === 'time' ? 'border-accent bg-accent/[0.06] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}>Tempo</button>
                        </div>
                        <div className={`grid gap-2 pl-10 ${row.type === 'time' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                          {((row.type === 'time'
                            ? [['Duração (s)', 'duration'], ['Descanso (s)', 'rest']]
                            : [['Séries', 'sets'], ['Reps', 'reps'], ['Peso (kg)', 'weight'], ['Descanso (s)', 'rest']]) as [string, 'sets' | 'reps' | 'weight' | 'rest' | 'duration'][]).map(([label, field]) => (
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
                        <input
                          value={row.notes ?? ''}
                          onChange={(ev) => update(row.uid, { notes: ev.target.value })}
                          placeholder="Notas (opcional)"
                          className="mt-2 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:border-accent text-zinc-800 dark:text-zinc-100 placeholder-zinc-400"
                        />
                      </>
                    )}
                  </Sortable>
                ))}
              </div>
            </SortableContext>
            <Button variant="outline" icon="plus" className="w-full mt-2" onClick={() => setAddOpen(true)}>Adicionar exercício</Button>
          </DndContext>
          )}
        </div>

        <div>
          <Card className="p-4 lg:sticky lg:top-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-3">Resumo</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Exercícios</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{rows.length}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Séries totais</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{totalSeries}</span></div>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-xs text-zinc-400 mb-2">Grupos trabalhados</p>
              <div className="flex flex-wrap gap-1.5">
                {gruposUsados.map((g) => <span key={g} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-white" style={{ background: colorOf(g) }}>{g}</span>)}
                {gruposUsados.length === 0 && <span className="text-sm text-zinc-400">—</span>}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <AddExercicioModal open={addOpen} catalog={catalog} onClose={() => setAddOpen(false)} onAdd={addExercise} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de "Adicionar exercício" (pesquisa + filtro por grupo) — só exercícios
// já criados na biblioteca. Usado no builder de treino/plano.
function AddExercicioModal({ open, catalog, onClose, onAdd }: {
  open: boolean
  catalog: GymExercise[]
  onClose: () => void
  onAdd: (ex: GymExercise) => void
}) {
  const { topGroups, colorOf } = useGymGroups()
  const [q, setQ] = useState('')
  const [grupo, setGrupo] = useState('todos')
  const filtered = useMemo(() => {
    const sel = topGroups.find((g) => g.muscleGroupId === grupo)
    return catalog.filter((c) =>
      c.active !== false &&
      (grupo === 'todos' || c.muscleGroup === sel?.name) &&
      c.name.toLowerCase().includes(q.toLowerCase()),
    )
  }, [catalog, q, grupo, topGroups])

  return (
    <Modal open={open} onClose={onClose} width="max-w-lg" title="Adicionar exercício" subtitle="Só podes adicionar exercícios já criados na biblioteca.">
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar exercício…" className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100" />
        <div className="sm:w-40">
          <Combobox value={grupo} onChange={setGrupo} options={[{ value: 'todos', label: 'Todos' }, ...topGroups.map((g) => ({ value: g.muscleGroupId, label: g.name }))]} placeholder="Grupo" searchPlaceholder="Pesquisar grupo…" />
        </div>
      </div>
      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto -mx-1 px-1">
        {filtered.map((e) => (
          <button key={e.exerciseId} onClick={() => onAdd(e)} className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-accent hover:bg-accent/[0.03] transition text-left">
            <span className="w-8 h-8 rounded-lg shrink-0" style={{ background: colorOf(e.muscleGroup) }} />
            <div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{e.name}</p><p className="text-xs text-zinc-400">{e.muscleGroup} · {e.presets?.length ?? 0} preset{(e.presets?.length ?? 0) === 1 ? '' : 's'}</p></div>
            <Icon name="plus" className="w-4 h-4 text-accent" />
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-zinc-400 text-center py-6">Nenhum exercício encontrado.</p>}
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Workout template editor (reusable, not tied to a client) — full-screen
function WorkoutTemplateModal({ open, onClose, template, catalog, onSaved, onCreated }: {
  open: boolean
  onClose: () => void
  template: GymWorkout | null
  catalog: GymExercise[]
  onSaved: () => void
  onCreated?: (t: GymWorkout) => void
}) {
  const { colorOf } = useGymGroups()
  const [name, setName] = useState('')
  const [contentKey, setContentKey] = useState<string | null>(null)
  const [rows, setRows] = useState<DraftExercise[]>([])
  const [addOpen, setAddOpen] = useState(false)
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
        type: (e as any).type === 'time' ? 'time' : 'strength',
        sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
        duration: (e as any).duration ?? 0, notes: (e as any).notes ?? null,
        media: ((e as any).media ?? []) as MediaItem[],
      })),
    )
    setAddOpen(false)
  }, [open, template?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const addExercise = (ex: GymExercise) => {
    const p0 = ex.presets?.[0]
    setRows((r) => [...r, {
      uid: newUid(),
      exerciseId: ex.exerciseId, name: ex.name, group: ex.muscleGroup, subGroup: ex.subGroup ?? null,
      type: (p0 as any)?.type === 'time' ? 'time' : 'strength',
      sets: p0?.sets ?? ex.defaultSets ?? 3, reps: p0?.reps ?? ex.defaultReps ?? 10,
      weight: p0?.weight ?? ex.defaultWeight ?? 0, rest: p0?.rest ?? ex.defaultRest ?? 60,
      duration: (p0 as any)?.duration ?? 0, notes: (p0 as any)?.notes ?? null,
      media: (ex.media ?? []) as MediaItem[],
    }])
    setAddOpen(false)
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
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: [{ url: '/gym/workout-templates' }] })
      if (!template && onCreated && result) onCreated(result as unknown as GymWorkout)
      onSaved(); onClose()
      toast.success(template ? 'Treino atualizado' : 'Treino criado')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  if (!open) return null

  const totalSeries = rows.reduce((s, r) => s + (r.type === 'time' ? 0 : (r.sets || 0)), 0)
  const gruposUsados = [...new Set(rows.map((r) => r.group))].filter(Boolean)

  return (
    <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar aos treinos</button>
          <div className="sm:ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button isLoading={save.isPending} disabled={!name.trim() || rows.length === 0} onClick={() => save.mutate()}>{template ? 'Guardar treino' : 'Criar treino'}</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          <div>
            <Card className="p-4 mb-4">
              <CmsCombo label="Nome do treino" context="gym" value={contentKey} name={name} onChange={(key, nm) => { setContentKey(key); setName(nm) }} placeholder="Ex: Push A (Peito/Ombro/Tríceps)" />
            </Card>

            {rows.length === 0 ? (
              <Card><EmptyState icon="layers" title="Treino vazio" desc="Adiciona exercícios da tua biblioteca." action={<Button icon="plus" onClick={() => setAddOpen(true)}>Adicionar exercício</Button>} /></Card>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onRowsDragEnd}>
                <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {rows.map((row, i) => (
                      <Sortable key={row.uid} id={row.uid} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900">
                        {(handle) => (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <DragHandle {...handle} />
                              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: colorOf(row.group) }}><span className="text-xs font-semibold">{i + 1}</span></span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{row.name}</p>
                                <p className="text-[11px] text-zinc-400">{row.group}{row.subGroup ? ` · ${row.subGroup}` : ''}</p>
                              </div>
                              <PresetPicker exercise={catalog.find((c) => c.exerciseId === row.exerciseId) as GymExercise | undefined} onPick={(p) => update(row.uid, presetValues(p))} />
                              <IconButton icon="trash" label="Remover" onClick={() => removeRow(row.uid)} />
                            </div>
                            <div className="flex items-center gap-1.5 mb-2 pl-9">
                              <button type="button" onClick={() => update(row.uid, { type: 'strength' })} className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${row.type !== 'time' ? 'border-accent bg-accent/[0.06] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}>Força</button>
                              <button type="button" onClick={() => update(row.uid, { type: 'time' })} className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${row.type === 'time' ? 'border-accent bg-accent/[0.06] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}>Tempo</button>
                            </div>
                            <div className={`grid gap-2 pl-9 ${row.type === 'time' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                              {((row.type === 'time' ? [['Duração (s)', 'duration'], ['Descanso (s)', 'rest']] : [['Séries', 'sets'], ['Reps', 'reps'], ['Peso (kg)', 'weight'], ['Descanso (s)', 'rest']]) as [string, 'sets' | 'reps' | 'weight' | 'rest' | 'duration'][]).map(([label, field]) => (
                                <label key={field} className="block">
                                  <span className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</span>
                                  <input type="number" min={0} value={row[field]} onChange={(ev) => update(row.uid, { [field]: Number(ev.target.value) } as Partial<DraftExercise>)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:border-accent" />
                                </label>
                              ))}
                            </div>
                            <input value={row.notes ?? ''} onChange={(ev) => update(row.uid, { notes: ev.target.value })} placeholder="Notas (opcional)" className="mt-2 ml-9 w-[calc(100%-2.25rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:border-accent text-zinc-800 dark:text-zinc-100 placeholder-zinc-400" />
                          </>
                        )}
                      </Sortable>
                    ))}
                  </div>
                </SortableContext>
                <Button variant="outline" icon="plus" className="w-full mt-2" onClick={() => setAddOpen(true)}>Adicionar exercício</Button>
              </DndContext>
            )}
          </div>

          <div>
            <Card className="p-4 lg:sticky lg:top-4">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-3">Resumo</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Exercícios</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{rows.length}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Séries totais</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{totalSeries}</span></div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-xs text-zinc-400 mb-2">Grupos trabalhados</p>
                <div className="flex flex-wrap gap-1.5">
                  {gruposUsados.map((g) => <span key={g} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-white" style={{ background: colorOf(g) }}>{g}</span>)}
                  {gruposUsados.length === 0 && <span className="text-sm text-zinc-400">—</span>}
                </div>
              </div>
            </Card>
          </div>
        </div>

      <AddExercicioModal open={addOpen} catalog={catalog} onClose={() => setAddOpen(false)} onAdd={addExercise} />
    </div>
  )
}

// Reusable workout templates tab
function TreinosTab() {
  const qc = useQueryClient()
  const { colorOf } = useGymGroups()
  const { data, isLoading } = useGetGymWorkoutTemplates()
  const templates = (data ?? []) as GymWorkout[]
  const { data: catalogData } = useGetGymExercises()
  const catalog = (catalogData ?? []) as GymExercise[]

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GymWorkout | null>(null)
  const [confirmDel, setConfirmDel] = useState<GymWorkout | null>(null)

  const remove = useMutation({
    mutationFn: (id: string) => deleteGymWorkoutTemplatesId(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [{ url: '/gym/workout-templates' }] }); toast.success('Treino eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  // Editor inline (substitui a lista) — não é overlay fixo, mantém o menu da app.
  if (open) {
    return <WorkoutTemplateModal open onClose={() => { setOpen(false); setEditing(null) }} template={editing} catalog={catalog} onSaved={() => {}} />
  }

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="p-5 group hover:shadow-md transition-all flex flex-col">
              <div className="flex items-start justify-between">
                <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><Icon name="layers" className="w-5 h-5" /></span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <IconButton icon="trash" label="Eliminar" onClick={() => setConfirmDel(t)} className="hover:text-red-500" />
                </div>
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mt-3">{t.name}</h3>
              <p className="text-[13px] text-zinc-500 mt-0.5">{t.exercises.length} exercício{t.exercises.length === 1 ? '' : 's'}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(t.muscleGroups ?? []).map((g) => <span key={g} className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(g) }} title={g} />)}
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800 flex-1 flex items-end">
                <Button variant="ghost" size="sm" icon="edit" onClick={() => { setEditing(t); setOpen(true) }} className="-ml-2">Abrir treino</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar treino?"
        footer={<><Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancelar</Button><Button variant="danger" isLoading={remove.isPending} onClick={() => { if (confirmDel) remove.mutate(confirmDel.id); setConfirmDel(null) }}>Eliminar</Button></>}
      >
        <p className="text-sm text-zinc-500">Tens a certeza que queres eliminar <strong className="text-zinc-800 dark:text-zinc-100">{confirmDel?.name}</strong>? Esta ação não pode ser revertida.</p>
      </Modal>
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
  const [workoutModal, setWorkoutModal] = useState<{ programId: string; workout: GymWorkout | null; mode: 'weekly' | 'free' } | null>(null)
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
  const [confirmDel, setConfirmDel] = useState<{ kind: 'program' | 'workout'; id: string; name: string } | null>(null)

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

  if (workoutModal) {
    return (
      <WorkoutModal
        open
        onClose={() => setWorkoutModal(null)}
        programId={workoutModal.programId}
        workout={workoutModal.workout}
        mode={workoutModal.mode}
        catalog={catalog}
        templates={templates}
        onSaved={invalidate}
      />
    )
  }

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
                              <Button size="sm" variant="secondary" icon="plus" onClick={() => setWorkoutModal({ programId: p.id, workout: null, mode: (p as any).mode === 'free' ? 'free' : 'weekly' })}>Treino</Button>
                            </>
                          )}
                          <IconButton icon="trash" label="Eliminar programa" onClick={() => setConfirmDel({ kind: 'program', id: p.id, name: p.name })} />
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
                                            <IconButton icon="edit" label="Editar" onClick={() => setWorkoutModal({ programId: p.id, workout: w, mode: (p as any).mode === 'free' ? 'free' : 'weekly' })} />
                                            <IconButton icon="trash" label="Eliminar" onClick={() => setConfirmDel({ kind: 'workout', id: w.id, name: w.name })} />
                                          </>
                                        )}
                                      </div>
                                      {(w as any).dayLabel ? (
                                        <div className="mb-2"><span className="text-[11px] font-semibold text-accent">{(w as any).dayLabel}</span></div>
                                      ) : (w.daysOfWeek ?? []).length > 0 ? (
                                        <div className="mb-2"><DayChips days={w.daysOfWeek ?? []} /></div>
                                      ) : null}
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {(w.muscleGroups ?? []).map((g) => <GroupChip key={g} group={g} />)}
                                      </div>
                                      <ul className="text-xs text-zinc-500 space-y-0.5">
                                        {w.exercises.slice(0, 4).map((e) => (
                                          <li key={e.id} className="truncate">{e.name} · {(e as any).type === 'time' ? `${(e as any).duration ?? 0}s` : `${e.sets}×${e.reps}${e.weight ? ` · ${e.weight}kg` : ''}`}</li>
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

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={confirmDel?.kind === 'program' ? 'Eliminar programa?' : 'Eliminar treino?'}
        footer={<><Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancelar</Button><Button variant="danger" isLoading={removeProgram.isPending || removeWorkout.isPending} onClick={() => { if (confirmDel) { if (confirmDel.kind === 'program') removeProgram.mutate(confirmDel.id); else removeWorkout.mutate(confirmDel.id) } setConfirmDel(null) }}>Eliminar</Button></>}
      >
        <p className="text-sm text-zinc-500">Tens a certeza que queres eliminar <strong className="text-zinc-800 dark:text-zinc-100">{confirmDel?.name}</strong>? Esta ação não pode ser revertida.</p>
      </Modal>

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
function StatCard({ icon, tone = 'blue', label, value, sub }: { icon: string; tone?: keyof typeof BADGE_TONES; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${BADGE_TONES[tone]}`}><Icon name={icon} className="w-5 h-5" /></span>
        <div className="min-w-0"><p className="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">{value}</p><p className="text-[13px] text-zinc-500 truncate">{label}</p></div>
      </div>
      {sub && <p className="text-xs text-zinc-400 mt-2">{sub}</p>}
    </Card>
  )
}

// Detalhe de uma sessão: por exercício, comparação feito vs anterior vs plano.
type SessaoExercise = {
  exerciseName?: string; group?: string | null; type?: string
  weight?: number; reps?: number; duration?: number
  prevWeight?: number | null; prevReps?: number | null; prevDuration?: number | null
  planWeight?: number | null; planReps?: number | null; planDuration?: number | null
}
type SessaoDetail = {
  logId?: string; workoutName?: string; date?: string
  durationMin?: number; totalSets?: number; volume?: number; status?: string
  exercises?: SessaoExercise[]
}
function SessaoModal({ sessao, onClose, colorOf }: { sessao: SessaoDetail; onClose: () => void; colorOf: (g: string) => string }) {
  const exs = sessao.exercises ?? []
  return (
    <Modal open onClose={onClose} title={sessao.workoutName} subtitle={`${sessao.date} · ${sessao.durationMin ?? 0} min`} width="max-w-lg"
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="flex items-center gap-3 mb-4">
        <Badge tone={sessao.status === 'complete' ? 'green' : 'amber'}>{sessao.status === 'complete' ? 'Completo' : 'Parcial'}</Badge>
        <span className="text-sm text-zinc-500">Volume <strong className="text-zinc-800 dark:text-zinc-100">{(sessao.volume ?? 0) >= 1000 ? `${((sessao.volume ?? 0) / 1000).toFixed(1)}k` : (sessao.volume ?? 0)} kg</strong></span>
      </div>
      {exs.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-6">Sem detalhe de exercícios.</p>
      ) : (
        <div className="space-y-2.5">
          {exs.map((e, i) => {
            const isTime = e.type === 'time'
            const done = isTime ? (e.duration ?? 0) : (e.weight ?? 0)
            const prev = isTime ? e.prevDuration : e.prevWeight
            const plan = isTime ? e.planDuration : e.planWeight
            const unit = isTime ? 's' : ' kg'
            const delta = prev != null ? Math.round((done - prev) * 10) / 10 : null
            const maxv = Math.max(done, prev ?? 0, plan ?? 0) * 1.12 || 1
            const pct = (v: number) => Math.max(0, (v / maxv) * 100)
            const meets = plan != null ? done >= plan : null
            return (
              <div key={i} className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    {e.group && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(e.group) }} />}
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-white truncate">{e.exerciseName}</p>
                      <p className="text-xs text-zinc-400">{isTime ? `${e.duration ?? 0}s` : `${e.reps ?? 0} reps`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-base font-semibold tabular-nums text-zinc-900 dark:text-white">{done}{unit}</span>
                    {delta != null && delta !== 0 && (
                      <span className={`text-[11px] font-semibold ${delta > 0 ? 'text-green-500' : 'text-red-400'}`}>{delta > 0 ? '↑ +' : '↓ '}{delta}{unit}</span>
                    )}
                  </div>
                </div>
                {/* Barras: anterior (cinza) + feito (verde/âmbar), linha do plano */}
                <div className="mt-2.5 relative space-y-1.5">
                  {plan != null && plan > 0 && (
                    <div className="absolute -top-1 -bottom-1 z-10" style={{ left: `${pct(plan)}%` }}><div className="w-px h-full border-l border-dashed border-accent/80" /></div>
                  )}
                  {prev != null && (
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"><div className="h-full rounded-full bg-zinc-300 dark:bg-zinc-600" style={{ width: `${pct(prev)}%` }} /></div>
                  )}
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct(done)}%`, background: meets === false ? '#E6B450' : '#1F8A5B' }} /></div>
                </div>
                <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[10px] text-zinc-400">
                  {prev != null && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />Anterior {prev}{unit}</span>}
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: meets === false ? '#E6B450' : '#1F8A5B' }} />Feito {done}{unit}</span>
                  {plan != null && plan > 0 && <span className="flex items-center gap-1 font-medium text-accent"><span className="w-2.5 border-t border-dashed border-accent" />Plano {plan}{unit}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

function ProgressoTab({ customerId }: { customerId: string }) {
  const { colorOf } = useGymGroups()
  const { data: stats, isLoading } = useGetGymClientsCustomeridStats(customerId, { query: { enabled: !!customerId } })
  const [exSel, setExSel] = useState<string>('')
  const [sessao, setSessao] = useState<SessaoDetail | null>(null)

  const loadSeries = stats?.loadSeries ?? []
  const selectedSeries = loadSeries.find((s) => s.exerciseName === exSel) ?? loadSeries[0]

  if (isLoading) return <Card className="p-8 text-center text-zinc-400">A carregar progresso…</Card>

  const byGroup = stats?.byGroup ?? []
  const records = stats?.records ?? []
  const sessions = stats?.sessions ?? []
  const progress = stats?.progress ?? []
  const adherence = stats?.adherence ?? { percent: 0, done: 0, expected: 0 }

  const totalGroupSets = byGroup.reduce((s, g) => s + (g.sets ?? 0), 0)
  const donut = byGroup.map((g) => ({ nome: g.group ?? '—', v: totalGroupSets ? Math.round(((g.sets ?? 0) / totalGroupSets) * 100) : 0, cor: colorOf(g.group ?? '') }))
  // Últimas (até) 7 sessões do exercício selecionado — peso máximo por sessão.
  const areaPoints = (selectedSeries?.points ?? []).slice(-7).map((p) => ({ m: (p.date ?? '').slice(5), v: p.weight ?? 0 }))
  // Peso prescrito pelo plano para o exercício selecionado (linha de referência verde).
  const planWeight = progress.find((p) => p.exerciseName === selectedSeries?.exerciseName)?.planWeight ?? null
  // Com uma só sessão, mostra na mesma uma linha plana nesse peso máximo.
  const areaData = areaPoints.length === 1 ? [{ m: '', v: areaPoints[0].v }, areaPoints[0]] : areaPoints
  const kfmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)
  const adPct = adherence.percent ?? 0
  const adTone: 'green' | 'amber' | 'red' = adPct >= 80 ? 'green' : adPct >= 50 ? 'amber' : 'red'

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard icon="check" tone={adTone} label="Adesão (ritmo)" value={`${adPct}%`} sub={`${adherence.done ?? 0}/${adherence.expected ?? 0} sessões no plano`} />
        <StatCard icon="star" tone="amber" label="Recordes (PRs)" value={records.length} sub="recordes pessoais" />
      </div>

      {/* Evolução de carga + volume por grupo */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">Evolução de carga</h3>
              <p className="text-[13px] text-zinc-500">Peso máximo nos últimos treinos</p>
            </div>
            {loadSeries.length > 0 && (
              <div className="w-full sm:w-56">
                <Combobox
                  value={selectedSeries?.exerciseName ?? ''}
                  onChange={setExSel}
                  options={loadSeries.map((s) => ({ value: s.exerciseName, label: s.exerciseName }))}
                />
              </div>
            )}
          </div>
          {areaPoints.length >= 1 ? (
            <AreaChart data={areaData} valueKey="v" labelKey="m" format={(n: number) => `${n} kg`} height={220} yAxis refLine={planWeight && planWeight > 0 ? planWeight : null} refColor="#1F8A5B" refLabel="Plano" />
          ) : (
            <p className="text-sm text-zinc-400 py-10 text-center">Sem dados de carga ainda.</p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">Volume por grupo</h3>
          <p className="text-[13px] text-zinc-500 mb-5">Distribuição das séries</p>
          {totalGroupSets > 0 ? (
            <DonutChart data={donut} />
          ) : (
            <p className="text-sm text-zinc-400">Sem séries registadas.</p>
          )}
        </Card>
      </div>

      {/* Recordes pessoais + Histórico de treinos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2"><Icon name="star" className="w-4 h-4 text-amber-500" />Recordes pessoais</h3>
          {records.length === 0 ? (
            <p className="text-sm text-zinc-400">Sem registos ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {records.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</span>
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    {r.group && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(r.group) }} />}
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{r.exerciseName}</p>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-white tabular-nums">{r.weight} kg</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2"><Icon name="clock" className="w-4 h-4 text-zinc-400" />Histórico de treinos</h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-400">Sem histórico.</p>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => {
                const up = (s.exercises ?? []).filter((e) => {
                  const isTime = e.type === 'time'
                  const done = isTime ? (e.duration ?? 0) : (e.weight ?? 0)
                  const prev = isTime ? e.prevDuration : e.prevWeight
                  return prev != null && done > prev
                }).length
                return (
                  <button key={s.logId} onClick={() => setSessao(s)} className="w-full flex items-center gap-3 py-2 px-1 -mx-1 rounded-lg border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition text-left">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'complete' ? 'bg-emerald-500' : 'bg-amber-400'}`} title={s.status === 'complete' ? 'Completo' : 'Parcial'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-800 dark:text-zinc-100 truncate">{s.workoutName}</p>
                      <p className="text-xs text-zinc-400">{s.date} · {s.durationMin} min · {kfmt(s.volume ?? 0)} kg</p>
                    </div>
                    {up > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"><Icon name="arrowUp" className="w-3 h-3" />{up}</span>}
                    <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {sessao && <SessaoModal sessao={sessao} onClose={() => setSessao(null)} colorOf={colorOf} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Planos — modelo dia-cêntrico: cada dia (semana fixa: Seg…Dom; livre: Dia N)
// atribui um Treino existente (snapshot reutilizado) ou fica descanso. Os
// exercícios não se editam aqui — cria-se/escolhe-se um Treino da biblioteca.
type DiaDraft = {
  uid: string
  label: string
  dayIndex: number | null         // semana: 0..6 (0=Dom); livre: null
  treinoId: string | null         // template de origem (para "treinos distintos")
  treinoName: string | null
  treinoContentKey: string | null
  rows: DraftExercise[]           // snapshot do treino; [] = descanso
}

const snapshotRows = (exs: any[]): DraftExercise[] => (exs ?? []).map((e) => ({
  uid: newUid(), exerciseId: e.exerciseId ?? null, name: e.name, group: e.group, subGroup: (e as any).subGroup ?? null,
  type: (e as any).type === 'time' ? 'time' : 'strength',
  sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
  duration: (e as any).duration ?? 0, notes: (e as any).notes ?? null,
  media: ((e as any).media ?? []) as MediaItem[],
}))

// Datas (período do plano do cliente) — dois inputs nativos (início/fim), estilo da app.
const todayISO = () => format(new Date(), 'yyyy-MM-dd')
const addDaysISO = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); return format(new Date(y, (m ?? 1) - 1, (d ?? 1) + n), 'yyyy-MM-dd') }
const weeksBetweenISO = (a: string, b: string) => (a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 6048e5)) : 0)
const fmtBR = (iso: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

// Modal: escolher um treino existente (ou criar novo) para um dia
function PickTreinoModal({ open, title, templates, onClose, onPick, onEdit, onCriarNovo }: {
  open: boolean
  title?: string
  templates: GymWorkout[]
  onClose: () => void
  onPick: (t: GymWorkout) => void
  onEdit: (t: GymWorkout) => void
  onCriarNovo: () => void
}) {
  const { colorOf } = useGymGroups()
  const [q, setQ] = useState('')
  useEffect(() => { if (open) setQ('') }, [open])
  const filtered = templates.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal open={open} onClose={onClose} width="max-w-lg" title={title ?? 'Atribuir treino ao dia'} subtitle="Reutiliza um treino existente (Usar), edita uma cópia (Editar) ou cria um novo.">
      <button onClick={onCriarNovo} className="w-full flex items-center gap-3 p-3 mb-3 rounded-lg border border-dashed border-accent/40 text-accent hover:bg-accent/[0.04] transition">
        <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center"><Icon name="plus" className="w-4 h-4" /></span>
        <span className="text-sm font-medium">Criar treino novo (só para este plano)</span>
      </button>
      <Input value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="Procurar treino…" />
      <div className="space-y-1.5 max-h-[44vh] overflow-y-auto mt-3 -mx-1 px-1">
        {filtered.map((t) => {
          const grupos = [...new Set((t.exercises ?? []).map((e) => e.group))].filter(Boolean)
          return (
            <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition">
              <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="layers" className="w-4 h-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{t.name}</p>
                <div className="flex items-center gap-2"><p className="text-xs text-zinc-400">{(t.exercises ?? []).length} exercícios</p><span className="flex gap-1">{grupos.slice(0, 5).map((g) => <span key={g} className="w-2 h-2 rounded-full" style={{ background: colorOf(g) }} />)}</span></div>
              </div>
              <Button variant="ghost" size="sm" icon="edit" onClick={() => onEdit(t)}>Editar</Button>
              <Button variant="secondary" size="sm" onClick={() => onPick(t)}>Usar</Button>
            </div>
          )
        })}
        {!filtered.length && <p className="text-sm text-zinc-400 text-center py-6">Nenhum treino. Cria um novo acima.</p>}
      </div>
    </Modal>
  )
}

function PlanoModal({ open, onClose, plano, catalog, templates, onSaved }: {
  open: boolean
  onClose: () => void
  plano: GymPlano | null
  catalog: GymExercise[]
  templates: GymWorkout[]
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const { colorOf } = useGymGroups()
  const [name, setName] = useState('')
  const [contentKey, setContentKey] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'weekly' | 'free'>('weekly')
  const [dias, setDias] = useState<DiaDraft[]>([])
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [editTreino, setEditTreino] = useState<{ diaUid: string; seed?: { name: string; contentKey: string | null; rows: DraftExercise[] } } | null>(null)
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  const buildWeeklyDays = (workouts: GymPlano['workouts']): DiaDraft[] =>
    WEEK_DAYS.map((wd) => {
      const w = (workouts ?? []).find((x) => (x.daysOfWeek ?? []).includes(wd.value))
      return {
        uid: newUid(), label: wd.label, dayIndex: wd.value, treinoId: null,
        treinoName: w?.name ?? null,
        treinoContentKey: w ? ((w as any).contentKey ?? null) : null,
        rows: w ? snapshotRows(w.exercises ?? []) : [],
      }
    })

  useEffect(() => {
    if (!open) return
    setName(plano?.name ?? '')
    setContentKey((plano as any)?.contentKey ?? null)
    setNote(plano?.note ?? '')
    const m = (plano as any)?.mode === 'free' ? 'free' : 'weekly'
    setMode(m)
    if (!plano) {
      setDias(buildWeeklyDays([]))
    } else if (m === 'free') {
      setDias((plano.workouts ?? []).map((w, i) => ({
        uid: newUid(), label: (w as any).dayLabel || `Dia ${i + 1}`, dayIndex: null,
        treinoId: null, treinoName: w.name, treinoContentKey: (w as any).contentKey ?? null,
        rows: snapshotRows(w.exercises ?? []),
      })))
    } else {
      setDias(buildWeeklyDays(plano.workouts ?? []))
    }
    setPickFor(null); setEditTreino(null)
  }, [open, plano?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trocar Semana ↔ Dias livres preservando os treinos já atribuídos.
  const mudarTipo = (novo: 'weekly' | 'free') => {
    if (novo === mode) return
    setMode(novo)
    setDias((prev) => {
      const assigned = prev.filter((d) => d.rows.length > 0)
      if (novo === 'free') {
        if (!assigned.length) return [1, 2, 3].map((n) => ({ uid: newUid(), label: `Dia ${n}`, dayIndex: null, treinoId: null, treinoName: null, treinoContentKey: null, rows: [] }))
        return assigned.map((d, i) => ({ ...d, uid: newUid(), label: `Dia ${i + 1}`, dayIndex: null }))
      }
      // weekly: preenche os primeiros dias da semana com os treinos atribuídos
      return buildWeeklyDays([]).map((wd, i) => {
        const a = assigned[i]
        return a ? { ...wd, treinoId: a.treinoId, treinoName: a.treinoName, treinoContentKey: a.treinoContentKey, rows: a.rows } : wd
      })
    })
  }
  const assignTreino = (diaUid: string, t: GymWorkout) =>
    setDias((d) => d.map((x) => x.uid === diaUid ? {
      ...x, treinoId: t.id, treinoName: t.name, treinoContentKey: (t as any).contentKey ?? null, rows: snapshotRows(t.exercises ?? []),
    } : x))
  const clearTreino = (diaUid: string) =>
    setDias((d) => d.map((x) => x.uid === diaUid ? { ...x, treinoId: null, treinoName: null, treinoContentKey: null, rows: [] } : x))
  const renameDia = (diaUid: string, label: string) => setDias((d) => d.map((x) => x.uid === diaUid ? { ...x, label } : x))
  const addDiaLivre = () => setDias((d) => [...d, { uid: newUid(), label: `Dia ${d.length + 1}`, dayIndex: null, treinoId: null, treinoName: null, treinoContentKey: null, rows: [] }])
  const removeDia = (diaUid: string) => setDias((d) => d.filter((x) => x.uid !== diaUid))
  const saveTreinoEdit = (diaUid: string, nm: string, key: string | null, rows: DraftExercise[]) =>
    setDias((d) => d.map((x) => x.uid === diaUid ? { ...x, treinoName: nm.trim() || 'Treino', treinoContentKey: key, rows } : x))

  const diasComTreino = dias.filter((d) => d.rows.length > 0)
  const treinosDistintos = new Set(diasComTreino.map((d) => d.treinoId ?? d.treinoName ?? d.uid)).size
  const canSave = !!name.trim() && diasComTreino.length > 0

  const save = useMutation({
    mutationFn: async () => {
      const planoKey = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      const workouts = await Promise.all(diasComTreino.map(async (d) => {
        const wkey = await ensureCmsName(d.treinoContentKey, 'gym', d.treinoName?.trim() || 'Treino', defaultLang)
        return {
          name: d.treinoName?.trim() || 'Treino', contentKey: wkey,
          daysOfWeek: mode === 'weekly' && d.dayIndex !== null ? [d.dayIndex] : [],
          dayLabel: mode === 'free' ? (d.label.trim() || 'Dia') : null,
          exercises: d.rows.map((r) => ({
            exerciseId: r.exerciseId, name: r.name, group: r.group, subGroup: r.subGroup,
            type: r.type, sets: r.sets, reps: r.reps, weight: r.weight, rest: r.rest,
            duration: r.duration, notes: r.notes, media: r.media,
          })),
        }
      }))
      const body = { name: name.trim(), contentKey: planoKey, note: note || null, mode, workouts } as any
      if (plano) return putGymPlanosId(plano.id, body)
      return postGymPlanos(body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [{ url: '/gym/planos' }] }); onSaved(); onClose(); toast.success(plano ? 'Plano atualizado' : 'Plano criado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  if (!open) return null

  // "Editar treino" / "Criar treino novo" / "Editar" no picker: edita um treino
  // (snapshot só deste plano) em ecrã cheio — sem afetar a biblioteca. Se houver
  // `seed` usa-o como base; senão usa o treino atual do dia.
  if (editTreino) {
    const d = dias.find((x) => x.uid === editTreino.diaUid)
    const seed = editTreino.seed
    return (
      <DiaTreinoEditor
        initialName={seed ? seed.name : (d?.treinoName ?? '')}
        initialContentKey={seed ? seed.contentKey : (d?.treinoContentKey ?? null)}
        initialRows={seed ? seed.rows : (d?.rows ?? [])}
        catalog={catalog}
        onSave={(nm, key, rows) => { saveTreinoEdit(editTreino.diaUid, nm, key, rows); setEditTreino(null) }}
        onClose={() => setEditTreino(null)}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar aos planos</button>
        <div className="sm:ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button isLoading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>{plano ? 'Guardar plano' : 'Criar plano'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div>
          <Card className="p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CmsCombo label="Nome do plano" context="gym" value={contentKey} name={name} onChange={(key, nm) => { setContentKey(key); setName(nm) }} placeholder="Ex: Push/Pull/Legs" />
              <Input label="Nota (opcional)" value={note} onChange={(ev: any) => setNote(ev.target.value)} placeholder="Ex: Hipertrofia" />
            </div>
            <div className="mt-3">
              <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Estrutura</span>
              <div className="grid grid-cols-2 gap-2 max-w-xs">
                <button type="button" onClick={() => mudarTipo('weekly')} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition ${mode === 'weekly' ? 'border-accent bg-accent/[0.04] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}><Icon name="calendar" className="w-4 h-4" />Semana fixa</button>
                <button type="button" onClick={() => mudarTipo('free')} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition ${mode === 'free' ? 'border-accent bg-accent/[0.04] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}><Icon name="layers" className="w-4 h-4" />Dias livres</button>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            {dias.map((d) => {
              const grupos = [...new Set(d.rows.map((r) => r.group))].filter(Boolean)
              return (
                <Card key={d.uid} className="p-3 flex items-center gap-3">
                  <span className="w-11 shrink-0 text-center">
                    {mode === 'weekly'
                      ? <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{d.label.slice(0, 3)}</span>
                      : <input value={d.label} onChange={(e) => renameDia(d.uid, e.target.value)} className="w-11 text-center text-xs font-semibold bg-transparent text-zinc-700 dark:text-zinc-200 focus:outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800 rounded" />}
                  </span>
                  <div className="w-px self-stretch bg-zinc-100 dark:bg-zinc-800" />
                  {d.rows.length > 0 ? (
                    <>
                      <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="layers" className="w-[18px] h-[18px]" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 dark:text-white truncate">{d.treinoName}</p>
                        <div className="flex items-center gap-2"><p className="text-xs text-zinc-400">{d.rows.length} exercícios</p><span className="flex gap-1">{grupos.slice(0, 5).map((g) => <span key={g} className="w-2 h-2 rounded-full" style={{ background: colorOf(g) }} />)}</span></div>
                      </div>
                      <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditTreino({ diaUid: d.uid })}>Editar treino</Button>
                      <Button variant="ghost" size="sm" onClick={() => setPickFor(d.uid)}>Trocar</Button>
                      <IconButton icon="x" label="Remover treino" onClick={() => clearTreino(d.uid)} />
                    </>
                  ) : (
                    <button onClick={() => setPickFor(d.uid)} className="flex-1 flex items-center gap-2 py-1.5 text-sm text-zinc-400 hover:text-accent transition">
                      <Icon name="plus" className="w-4 h-4" />Atribuir treino <span className="text-zinc-300 dark:text-zinc-600">· ou descanso</span>
                    </button>
                  )}
                  {mode === 'free' && <IconButton icon="trash" label="Remover dia" onClick={() => removeDia(d.uid)} className="hover:text-red-500" />}
                </Card>
              )
            })}
            {mode === 'free' && <Button variant="outline" icon="plus" className="w-full" onClick={addDiaLivre}>Adicionar dia</Button>}
          </div>
        </div>

        <div>
          <Card className="p-4 lg:sticky lg:top-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-3">Resumo do plano</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Estrutura</span><span className="font-medium text-zinc-800 dark:text-zinc-100">{mode === 'weekly' ? 'Semana fixa' : 'Dias livres'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Dias de treino</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{diasComTreino.length}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Treinos distintos</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{treinosDistintos}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Dias de descanso</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{dias.length - diasComTreino.length}</span></div>
            </div>
          </Card>
        </div>
      </div>

      <PickTreinoModal
        open={pickFor !== null}
        templates={templates}
        onClose={() => setPickFor(null)}
        onPick={(t) => { if (pickFor) assignTreino(pickFor, t); setPickFor(null) }}
        onEdit={(t) => { if (pickFor) setEditTreino({ diaUid: pickFor, seed: { name: t.name, contentKey: (t as any).contentKey ?? null, rows: snapshotRows(t.exercises ?? []) } }); setPickFor(null) }}
        onCriarNovo={() => { if (pickFor) setEditTreino({ diaUid: pickFor, seed: { name: '', contentKey: null, rows: [] } }); setPickFor(null) }}
      />
    </div>
  )
}

function PlanosTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useGetGymPlanos()
  const planos = (data ?? []) as GymPlano[]
  const { data: catalogData } = useGetGymExercises()
  const catalog = (catalogData ?? []) as GymExercise[]
  const { data: templatesData } = useGetGymWorkoutTemplates()
  const templates = (templatesData ?? []) as GymWorkout[]

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GymPlano | null>(null)
  const [confirmDel, setConfirmDel] = useState<GymPlano | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/planos' }] })
  const remove = useMutation({
    mutationFn: (id: string) => deleteGymPlanosId(id),
    onSuccess: () => { invalidate(); toast.success('Plano eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  if (open) {
    return <PlanoModal open onClose={() => setOpen(false)} plano={editing} catalog={catalog} templates={templates} onSaved={invalidate} />
  }

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {planos.map((p) => {
            const livre = (p as any).mode === 'free'
            return (
              <Card key={p.id} className="p-5 group hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="calendar" className="w-5 h-5" /></span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-zinc-900 dark:text-white truncate">{p.name}</h3>
                      <p className="text-[13px] text-zinc-500">{livre ? 'Dias livres' : 'Semana fixa'} · {p.workouts.length} treino{p.workouts.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <IconButton icon="trash" label="Eliminar" onClick={() => setConfirmDel(p)} className="hover:text-red-500" />
                  </div>
                </div>
                {p.note && <p className="text-xs text-zinc-400 mt-2">{p.note}</p>}
                <div className="flex flex-wrap gap-1 mt-4">
                  {livre
                    ? p.workouts.map((w, i) => (
                        <div key={w.id} className="flex-1 min-w-[40px] rounded-lg px-1.5 py-2 text-center bg-accent/[0.07]" title={w.name}>
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase truncate">{(w as any).dayLabel || `Dia ${i + 1}`}</p>
                          <Icon name="layers" className="w-3.5 h-3.5 text-accent mx-auto mt-1" />
                        </div>
                      ))
                    : WEEK_DAYS.map((wd) => {
                        const w = p.workouts.find((x) => (x.daysOfWeek ?? []).includes(wd.value))
                        return (
                          <div key={wd.value} className={`flex-1 min-w-[40px] rounded-lg px-1.5 py-2 text-center ${w ? 'bg-accent/[0.07]' : 'bg-zinc-50 dark:bg-zinc-800/40'}`} title={w ? w.name : 'Descanso'}>
                            <p className="text-[10px] font-semibold text-zinc-400 uppercase">{wd.short}</p>
                            {w ? <Icon name="layers" className="w-3.5 h-3.5 text-accent mx-auto mt-1" /> : <span className="block text-[10px] text-zinc-300 dark:text-zinc-600 mt-1">—</span>}
                          </div>
                        )
                      })}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800 text-[13px]">
                  <span className="text-zinc-500">{p.workouts.length} treino{p.workouts.length === 1 ? '' : 's'}</span>
                  <Button variant="ghost" size="sm" icon="edit" onClick={() => { setEditing(p); setOpen(true) }} className="-mr-2">Abrir</Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar plano?"
        footer={<><Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancelar</Button><Button variant="danger" isLoading={remove.isPending} onClick={() => { if (confirmDel) remove.mutate(confirmDel.id); setConfirmDel(null) }}>Eliminar</Button></>}
      >
        <p className="text-sm text-zinc-500">Tens a certeza que queres eliminar <strong className="text-zinc-800 dark:text-zinc-100">{confirmDel?.name}</strong>? Esta ação não pode ser revertida.</p>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor de treino in-memory (ecrã cheio) — edita uma lista de exercícios e
// devolve-a via onSave, sem tocar na biblioteca. Usado pelo editor de plano do
// cliente ("Editar treino" / "Criar treino novo" por dia).
function DiaTreinoEditor({ initialName, initialContentKey, initialRows, catalog, onSave, onClose }: {
  initialName: string
  initialContentKey: string | null
  initialRows: DraftExercise[]
  catalog: GymExercise[]
  onSave: (name: string, contentKey: string | null, rows: DraftExercise[]) => void
  onClose: () => void
}) {
  const { colorOf } = useGymGroups()
  const [name, setName] = useState(initialName)
  const [contentKey, setContentKey] = useState<string | null>(initialContentKey)
  const [rows, setRows] = useState<DraftExercise[]>(initialRows)
  const [addOpen, setAddOpen] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const addExercise = (ex: GymExercise) => {
    const p0 = ex.presets?.[0]
    setRows((r) => [...r, {
      uid: newUid(), exerciseId: ex.exerciseId, name: ex.name, group: ex.muscleGroup, subGroup: ex.subGroup ?? null,
      type: (p0 as any)?.type === 'time' ? 'time' : 'strength',
      sets: p0?.sets ?? ex.defaultSets ?? 3, reps: p0?.reps ?? ex.defaultReps ?? 10,
      weight: p0?.weight ?? ex.defaultWeight ?? 0, rest: p0?.rest ?? ex.defaultRest ?? 60,
      duration: (p0 as any)?.duration ?? 0, notes: (p0 as any)?.notes ?? null,
      media: (ex.media ?? []) as MediaItem[],
    }])
    setAddOpen(false)
  }
  const update = (uid: string, patch: Partial<DraftExercise>) => setRows((r) => r.map((row) => (row.uid === uid ? { ...row, ...patch } : row)))
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

  const totalSeries = rows.reduce((s, r) => s + (r.type === 'time' ? 0 : (r.sets || 0)), 0)
  const gruposUsados = [...new Set(rows.map((r) => r.group))].filter(Boolean)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar ao plano</button>
        <div className="sm:ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!name.trim() || rows.length === 0} onClick={() => onSave(name, contentKey, rows)}>Guardar treino</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div>
          <Card className="p-4 mb-4">
            <CmsCombo label="Nome do treino" context="gym" value={contentKey} name={name} onChange={(k, nm) => { setContentKey(k); setName(nm) }} placeholder="Ex: Push A (Peito/Ombro/Tríceps)" />
          </Card>

          {rows.length === 0 ? (
            <Card><EmptyState icon="layers" title="Treino vazio" desc="Adiciona exercícios da tua biblioteca." action={<Button icon="plus" onClick={() => setAddOpen(true)}>Adicionar exercício</Button>} /></Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onRowsDragEnd}>
              <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {rows.map((row, i) => (
                    <Sortable key={row.uid} id={row.uid} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900">
                      {(handle) => (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <DragHandle {...handle} />
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: colorOf(row.group) }}><span className="text-xs font-semibold">{i + 1}</span></span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{row.name}</p>
                              <p className="text-[11px] text-zinc-400">{row.group}{row.subGroup ? ` · ${row.subGroup}` : ''}</p>
                            </div>
                            <PresetPicker exercise={catalog.find((c) => c.exerciseId === row.exerciseId) as GymExercise | undefined} onPick={(p) => update(row.uid, presetValues(p))} />
                            <IconButton icon="trash" label="Remover" onClick={() => removeRow(row.uid)} />
                          </div>
                          <div className="flex items-center gap-1.5 mb-2 pl-9">
                            <button type="button" onClick={() => update(row.uid, { type: 'strength' })} className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${row.type !== 'time' ? 'border-accent bg-accent/[0.06] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}>Força</button>
                            <button type="button" onClick={() => update(row.uid, { type: 'time' })} className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${row.type === 'time' ? 'border-accent bg-accent/[0.06] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}>Tempo</button>
                          </div>
                          <div className={`grid gap-2 pl-9 ${row.type === 'time' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                            {((row.type === 'time' ? [['Duração (s)', 'duration'], ['Descanso (s)', 'rest']] : [['Séries', 'sets'], ['Reps', 'reps'], ['Peso (kg)', 'weight'], ['Descanso (s)', 'rest']]) as [string, 'sets' | 'reps' | 'weight' | 'rest' | 'duration'][]).map(([label, field]) => (
                              <label key={field} className="block">
                                <span className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</span>
                                <input type="number" min={0} value={row[field]} onChange={(ev) => update(row.uid, { [field]: Number(ev.target.value) } as Partial<DraftExercise>)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:border-accent" />
                              </label>
                            ))}
                          </div>
                          <input value={row.notes ?? ''} onChange={(ev) => update(row.uid, { notes: ev.target.value })} placeholder="Notas (opcional)" className="mt-2 ml-9 w-[calc(100%-2.25rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:border-accent text-zinc-800 dark:text-zinc-100 placeholder-zinc-400" />
                        </>
                      )}
                    </Sortable>
                  ))}
                </div>
              </SortableContext>
              <Button variant="outline" icon="plus" className="w-full mt-2" onClick={() => setAddOpen(true)}>Adicionar exercício</Button>
            </DndContext>
          )}
        </div>

        <div>
          <Card className="p-4 lg:sticky lg:top-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-3">Resumo</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Exercícios</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{rows.length}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Séries totais</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{totalSeries}</span></div>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-xs text-zinc-400 mb-2">Grupos trabalhados</p>
              <div className="flex flex-wrap gap-1.5">
                {gruposUsados.map((g) => <span key={g} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-white" style={{ background: colorOf(g) }}>{g}</span>)}
                {gruposUsados.length === 0 && <span className="text-sm text-zinc-400">—</span>}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <AddExercicioModal open={addOpen} catalog={catalog} onClose={() => setAddOpen(false)} onAdd={addExercise} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor do plano DE UM CLIENTE (o Programa ativo). Dia-cêntrico: cada dia
// atribui/edita um treino (snapshot isolado — não afeta a biblioteca). Grava
// substituindo os treinos do programa (delete + repost) + nome/nota/modo.
function ClientePlanoEditor({ program, customer, templates, catalog, onClose, onSaved }: {
  program: GymProgram
  customer: { customerId: string; name: string }
  templates: GymWorkout[]
  catalog: GymExercise[]
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const { colorOf } = useGymGroups()
  const [name, setName] = useState(program.name ?? '')
  const [contentKey, setContentKey] = useState<string | null>((program as any).contentKey ?? null)
  const [note, setNote] = useState((program as any).note ?? '')
  const [mode, setMode] = useState<'weekly' | 'free'>((program as any).mode === 'free' ? 'free' : 'weekly')
  const [inicio, setInicio] = useState<string>(((program as any).startDate as string) || todayISO())
  const [fim, setFim] = useState<string>(((program as any).endDate as string) || addDaysISO(todayISO(), 84))
  const [dias, setDias] = useState<DiaDraft[]>([])
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [editTreino, setEditTreino] = useState<{ diaUid: string; seed?: { name: string; contentKey: string | null; rows: DraftExercise[] } } | null>(null)
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  const buildWeeklyDays = (workouts: GymProgram['workouts']): DiaDraft[] =>
    WEEK_DAYS.map((wd) => {
      const w = (workouts ?? []).find((x) => (x.daysOfWeek ?? []).includes(wd.value))
      return {
        uid: newUid(), label: wd.label, dayIndex: wd.value, treinoId: null,
        treinoName: w?.name ?? null,
        treinoContentKey: w ? ((w as any).contentKey ?? null) : null,
        rows: w ? snapshotRows(w.exercises ?? []) : [],
      }
    })

  useEffect(() => {
    const m = (program as any).mode === 'free' ? 'free' : 'weekly'
    if (m === 'free') {
      setDias((program.workouts ?? []).map((w, i) => ({
        uid: newUid(), label: (w as any).dayLabel || `Dia ${i + 1}`, dayIndex: null,
        treinoId: null, treinoName: w.name, treinoContentKey: (w as any).contentKey ?? null,
        rows: snapshotRows(w.exercises ?? []),
      })))
    } else {
      setDias(buildWeeklyDays(program.workouts ?? []))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const mudarTipo = (novo: 'weekly' | 'free') => {
    if (novo === mode) return
    setMode(novo)
    setDias((prev) => {
      const assigned = prev.filter((d) => d.rows.length > 0)
      if (novo === 'free') {
        if (!assigned.length) return [1, 2, 3].map((n) => ({ uid: newUid(), label: `Dia ${n}`, dayIndex: null, treinoId: null, treinoName: null, treinoContentKey: null, rows: [] }))
        return assigned.map((d, i) => ({ ...d, uid: newUid(), label: `Dia ${i + 1}`, dayIndex: null }))
      }
      return buildWeeklyDays([]).map((wd, i) => {
        const a = assigned[i]
        return a ? { ...wd, treinoId: a.treinoId, treinoName: a.treinoName, treinoContentKey: a.treinoContentKey, rows: a.rows } : wd
      })
    })
  }
  const assignTreino = (diaUid: string, t: GymWorkout) =>
    setDias((d) => d.map((x) => x.uid === diaUid ? { ...x, treinoId: t.id, treinoName: t.name, treinoContentKey: (t as any).contentKey ?? null, rows: snapshotRows(t.exercises ?? []) } : x))
  const clearTreino = (diaUid: string) => setDias((d) => d.map((x) => x.uid === diaUid ? { ...x, treinoId: null, treinoName: null, treinoContentKey: null, rows: [] } : x))
  const renameDia = (diaUid: string, label: string) => setDias((d) => d.map((x) => x.uid === diaUid ? { ...x, label } : x))
  const addDiaLivre = () => setDias((d) => [...d, { uid: newUid(), label: `Dia ${d.length + 1}`, dayIndex: null, treinoId: null, treinoName: null, treinoContentKey: null, rows: [] }])
  const removeDia = (diaUid: string) => setDias((d) => d.filter((x) => x.uid !== diaUid))
  const saveTreinoEdit = (diaUid: string, nm: string, key: string | null, rows: DraftExercise[]) =>
    setDias((d) => d.map((x) => x.uid === diaUid ? { ...x, treinoName: nm.trim() || 'Treino', treinoContentKey: key, rows } : x))

  const diasComTreino = dias.filter((d) => d.rows.length > 0)
  const datasInvalidas = !!inicio && !!fim && fim < inicio
  const canSave = !!name.trim() && diasComTreino.length > 0 && !datasInvalidas

  const save = useMutation({
    mutationFn: async () => {
      const planoKey = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      await putGymProgramsId(program.id, { name: name.trim(), contentKey: planoKey, note: note || null, mode, startDate: inicio || null, endDate: fim || null } as any)
      for (const w of (program.workouts ?? [])) await deleteGymWorkoutsId(w.id)
      for (const d of diasComTreino) {
        const wkey = await ensureCmsName(d.treinoContentKey, 'gym', d.treinoName?.trim() || 'Treino', defaultLang)
        await postGymProgramsProgramidWorkouts(program.id, {
          name: d.treinoName?.trim() || 'Treino', contentKey: wkey,
          daysOfWeek: mode === 'weekly' && d.dayIndex !== null ? [d.dayIndex] : [],
          dayLabel: mode === 'free' ? (d.label.trim() || 'Dia') : null,
          exercises: d.rows.map((r) => ({
            exerciseId: r.exerciseId, name: r.name, group: r.group, subGroup: r.subGroup,
            type: r.type, sets: r.sets, reps: r.reps, weight: r.weight, rest: r.rest,
            duration: r.duration, notes: r.notes, media: r.media,
          })),
        } as any)
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [{ url: '/gym/programs' }] }); toast.success('Plano do cliente atualizado'); onSaved(); onClose() },
    onError: (e) => toast.error(getApiError(e)),
  })

  // "Editar treino" / "Criar treino novo" → editor de treino em ecrã cheio.
  if (editTreino) {
    const d = dias.find((x) => x.uid === editTreino.diaUid)
    const seed = editTreino.seed
    return (
      <DiaTreinoEditor
        initialName={seed ? seed.name : (d?.treinoName ?? '')}
        initialContentKey={seed ? seed.contentKey : (d?.treinoContentKey ?? null)}
        initialRows={seed ? seed.rows : (d?.rows ?? [])}
        catalog={catalog}
        onSave={(nm, key, rows) => { saveTreinoEdit(editTreino.diaUid, nm, key, rows); setEditTreino(null) }}
        onClose={() => setEditTreino(null)}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar</button>
        <div className="sm:ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button isLoading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>Guardar plano do cliente</Button>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/[0.05] border border-accent/15">
        <Avatar name={customer.name} size={36} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">A editar o plano de {customer.name}</p>
          <p className="text-xs text-zinc-500">As alterações (exercícios, dias) ficam <strong>só para este cliente</strong> — a biblioteca não é afetada.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div>
          <Card className="p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CmsCombo label="Nome do plano" context="gym" value={contentKey} name={name} onChange={(key, nm) => { setContentKey(key); setName(nm) }} placeholder="Ex: PPL do cliente" />
              <Input label="Nota (opcional)" value={note} onChange={(ev: any) => setNote(ev.target.value)} placeholder="Ex: Hipertrofia" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <label className="block"><span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Início</span><DatePicker value={inicio} max={fim || undefined} onChange={setInicio} /></label>
              <label className="block"><span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Fim</span><DatePicker value={fim} min={inicio || undefined} onChange={setFim} /></label>
            </div>
            {datasInvalidas && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><Icon name="ban" className="w-3.5 h-3.5" />A data de fim tem de ser depois do início.</p>}
            <div className="mt-3">
              <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Estrutura</span>
              <div className="grid grid-cols-2 gap-2 max-w-xs">
                <button type="button" onClick={() => mudarTipo('weekly')} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition ${mode === 'weekly' ? 'border-accent bg-accent/[0.04] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}><Icon name="calendar" className="w-4 h-4" />Semana fixa</button>
                <button type="button" onClick={() => mudarTipo('free')} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition ${mode === 'free' ? 'border-accent bg-accent/[0.04] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}><Icon name="layers" className="w-4 h-4" />Dias livres</button>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            {dias.map((d) => {
              const grupos = [...new Set(d.rows.map((r) => r.group))].filter(Boolean)
              return (
                <Card key={d.uid} className="p-3 flex items-center gap-3">
                  <span className="w-11 shrink-0 text-center">
                    {mode === 'weekly'
                      ? <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{d.label.slice(0, 3)}</span>
                      : <input value={d.label} onChange={(e) => renameDia(d.uid, e.target.value)} className="w-11 text-center text-xs font-semibold bg-transparent text-zinc-700 dark:text-zinc-200 focus:outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800 rounded" />}
                  </span>
                  <div className="w-px self-stretch bg-zinc-100 dark:bg-zinc-800" />
                  {d.rows.length > 0 ? (
                    <>
                      <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="layers" className="w-[18px] h-[18px]" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 dark:text-white truncate">{d.treinoName}</p>
                        <div className="flex items-center gap-2"><p className="text-xs text-zinc-400">{d.rows.length} exercícios</p><span className="flex gap-1">{grupos.slice(0, 5).map((g) => <span key={g} className="w-2 h-2 rounded-full" style={{ background: colorOf(g) }} />)}</span></div>
                      </div>
                      <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditTreino({ diaUid: d.uid })}>Editar treino</Button>
                      <Button variant="ghost" size="sm" onClick={() => setPickFor(d.uid)}>Trocar</Button>
                      <IconButton icon="x" label="Remover treino" onClick={() => clearTreino(d.uid)} />
                    </>
                  ) : (
                    <button onClick={() => setPickFor(d.uid)} className="flex-1 flex items-center gap-2 py-1.5 text-sm text-zinc-400 hover:text-accent transition">
                      <Icon name="plus" className="w-4 h-4" />Atribuir treino <span className="text-zinc-300 dark:text-zinc-600">· ou descanso</span>
                    </button>
                  )}
                  {mode === 'free' && <IconButton icon="trash" label="Remover dia" onClick={() => removeDia(d.uid)} className="hover:text-red-500" />}
                </Card>
              )
            })}
            {mode === 'free' && <Button variant="outline" icon="plus" className="w-full" onClick={addDiaLivre}>Adicionar dia</Button>}
          </div>
        </div>

        <div>
          <Card className="p-4 lg:sticky lg:top-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-3">Resumo</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Estrutura</span><span className="font-medium text-zinc-800 dark:text-zinc-100">{mode === 'weekly' ? 'Semana fixa' : 'Dias livres'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Dias de treino</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{diasComTreino.length}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Descanso</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{dias.length - diasComTreino.length}</span></div>
            </div>
          </Card>
        </div>
      </div>

      <PickTreinoModal
        open={pickFor !== null}
        templates={templates}
        onClose={() => setPickFor(null)}
        onPick={(t) => { if (pickFor) assignTreino(pickFor, t); setPickFor(null) }}
        onEdit={(t) => { if (pickFor) setEditTreino({ diaUid: pickFor, seed: { name: t.name, contentKey: (t as any).contentKey ?? null, rows: snapshotRows(t.exercises ?? []) } }); setPickFor(null) }}
        onCriarNovo={() => { if (pickFor) setEditTreino({ diaUid: pickFor, seed: { name: '', contentKey: null, rows: [] } }); setPickFor(null) }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Clientes — lista de cards → detalhe (ClienteProgresso) + atribuir/editar plano.
// O "plano ativo do cliente" = o Programa ativo (snapshot). "Editar plano" abre
// o editor do programa em ecrã cheio; "Atribuir/Mudar plano" copia um Plano.
type Cliente = { customerId: string; name: string }

// Modal: escolher um Plano para atribuir ao cliente (cria/define programa ativo).
function AtribuirPlanoModal({ open, customer, planos, onClose, onSaved }: {
  open: boolean
  customer: Cliente | null
  planos: GymPlano[]
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [sel, setSel] = useState<string | null>(null)
  const [de, setDe] = useState(todayISO())
  const [ate, setAte] = useState(addDaysISO(todayISO(), 84))
  useEffect(() => { if (open) { setSel(null); setDe(todayISO()); setAte(addDaysISO(todayISO(), 84)) } }, [open])
  const erroData = ate < de
  const assign = useMutation({
    mutationFn: () => postGymPlanosIdAssign(sel!, { customerId: customer!.customerId, startDate: de || null, endDate: ate || null } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [{ url: '/gym/programs' }] }); toast.success('Plano atribuído ao cliente'); onSaved(); onClose() },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Modal open={open} onClose={onClose} width="max-w-lg" title="Atribuir plano" subtitle={customer ? `Cliente: ${customer.name}` : ''}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" isLoading={assign.isPending} disabled={!sel || erroData} onClick={() => assign.mutate()}>Guardar</Button></>}>
      <div className="space-y-2 max-h-[42vh] overflow-y-auto -mx-1 px-1">
        {planos.length === 0 && <p className="text-sm text-zinc-400 text-center py-6">Sem planos. Cria um plano primeiro na tab “Planos”.</p>}
        {planos.map((p) => {
          const livre = (p as any).mode === 'free'
          const dias = (p.workouts ?? []).length
          return (
            <button key={p.id} onClick={() => setSel(p.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${sel === p.id ? 'border-accent bg-accent/[0.04]' : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
              <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="calendar" className="w-[18px] h-[18px]" /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{p.name}</p><p className="text-xs text-zinc-400">{dias} dia{dias === 1 ? '' : 's'} · {livre ? 'Dias livres' : 'Semana fixa'}</p></div>
              {sel === p.id && <Icon name="check" className="w-4 h-4 text-accent ml-auto" />}
            </button>
          )
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">Duração do plano</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-xs text-zinc-400 mb-1.5">Início</span><DatePicker value={de} max={ate || undefined} onChange={setDe} /></label>
          <label className="block"><span className="block text-xs text-zinc-400 mb-1.5">Fim</span><DatePicker value={ate} min={de || undefined} onChange={setAte} /></label>
        </div>
        {erroData
          ? <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><Icon name="ban" className="w-3.5 h-3.5" />A data de fim tem de ser depois do início.</p>
          : <p className="text-xs text-zinc-400 mt-1.5">{weeksBetweenISO(de, ate)} semanas · {fmtBR(de)} → {fmtBR(ate)}</p>}
      </div>
    </Modal>
  )
}

// Card de um cliente na lista: plano ativo (badge) + adesão.
function ClienteCard({ customer, onOpen, onAssign }: { customer: Cliente; onOpen: () => void; onAssign: () => void }) {
  const { data: programsData } = useGetGymPrograms({ customerId: customer.customerId }, { query: { enabled: !!customer.customerId } })
  const active = ((programsData ?? []) as GymProgram[]).find((p) => (p as any).active)
  const planoNome = active?.name ?? null
  const { data: stats } = useGetGymClientsCustomeridStats(customer.customerId, { query: { enabled: !!planoNome } })
  const adesao: number | null = (stats as any)?.adherence?.percent ?? null
  return (
    <Card className="p-5 group hover:shadow-md transition-all cursor-pointer" onClick={onOpen}>
      <div className="flex items-center gap-3">
        <Avatar name={customer.name} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-zinc-900 dark:text-white truncate">{customer.name}</h3>
          <p className="text-[13px] text-zinc-500">{planoNome ? 'Plano ativo' : 'Sem plano'}</p>
        </div>
        <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 group-hover:text-accent" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        {planoNome ? <Badge tone="blue" dot>{planoNome}</Badge> : <Badge tone="amber" dot>Sem plano</Badge>}
      </div>
      {planoNome && adesao != null && (
        <div className="mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800">
          <div className="flex items-center justify-between text-[13px] mb-1.5"><span className="text-zinc-500">Adesão</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{adesao}%</span></div>
          <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${adesao}%`, background: adesao >= 80 ? '#1F8A5B' : adesao >= 50 ? '#E6B450' : '#D97757' }} /></div>
        </div>
      )}
      <div className="mt-3 flex justify-end" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" icon="calendar" onClick={onAssign} className="-mr-2">{planoNome ? 'Mudar plano' : 'Atribuir plano'}</Button>
      </div>
    </Card>
  )
}

// Detalhe do cliente: cabeçalho com ações + dashboard de progresso.
function ClienteProgresso({ customer, onBack, onAtribuir, onEditar }: { customer: Cliente; onBack: () => void; onAtribuir: () => void; onEditar: () => void }) {
  const { data: programsData } = useGetGymPrograms({ customerId: customer.customerId }, { query: { enabled: !!customer.customerId } })
  const active = ((programsData ?? []) as GymProgram[]).find((p) => (p as any).active)
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar aos clientes</button>

      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar name={customer.name} size={56} />
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white truncate">{customer.name}</h2>
            <p className="text-sm text-zinc-500">
              {active && (active as any).startDate
                ? `Plano ${(active as any).startDate} → ${(active as any).endDate || 'atual'}`
                : 'Plano e progresso do cliente'}
            </p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
            {active ? <Badge tone="blue" dot>{active.name}</Badge> : <Badge tone="amber" dot>Sem plano</Badge>}
            {active && <Button variant="outline" size="sm" icon="edit" onClick={onEditar}>Editar plano</Button>}
            <Button variant={active ? 'ghost' : 'outline'} size="sm" icon="calendar" onClick={onAtribuir}>{active ? 'Mudar plano' : 'Atribuir plano'}</Button>
          </div>
        </div>
      </Card>

      <ProgressoTab customerId={customer.customerId} />
    </div>
  )
}

// Busca o programa ativo do cliente e abre o editor de plano em ecrã cheio.
function ClientePlanoEditorLoader({ customer, onClose }: { customer: Cliente; onClose: () => void }) {
  const { data: programsData, isLoading } = useGetGymPrograms({ customerId: customer.customerId }, { query: { enabled: !!customer.customerId } })
  const { data: templatesData } = useGetGymWorkoutTemplates()
  const { data: catalogData } = useGetGymExercises()
  const active = ((programsData ?? []) as GymProgram[]).find((p) => (p as any).active)

  if (isLoading) return <Card className="p-8 text-center text-zinc-400">A carregar plano…</Card>
  if (!active) {
    return (
      <div className="space-y-4">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar ao cliente</button>
        <Card><EmptyState icon="calendar" title="Sem plano ativo" desc="Atribui um plano ao cliente antes de o editares." /></Card>
      </div>
    )
  }
  return (
    <ClientePlanoEditor
      program={active}
      customer={customer}
      templates={(templatesData ?? []) as GymWorkout[]}
      catalog={(catalogData ?? []) as GymExercise[]}
      onClose={onClose}
      onSaved={() => {}}
    />
  )
}

function ClientesTab({ customers }: { customers: Cliente[] }) {
  const [sel, setSel] = useState<Cliente | null>(null)
  const [atribuir, setAtribuir] = useState<Cliente | null>(null)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const { data: planosData } = useGetGymPlanos()
  const planos = (planosData ?? []) as GymPlano[]

  // "Editar plano" → editor do programa ativo do cliente em ecrã cheio.
  if (editing) {
    return <ClientePlanoEditorLoader customer={editing} onClose={() => setEditing(null)} />
  }

  if (sel) {
    return (
      <>
        <ClienteProgresso customer={sel} onBack={() => setSel(null)} onAtribuir={() => setAtribuir(sel)} onEditar={() => setEditing(sel)} />
        <AtribuirPlanoModal open={!!atribuir} customer={atribuir} planos={planos} onClose={() => setAtribuir(null)} onSaved={() => {}} />
      </>
    )
  }

  return (
    <div>
      <p className="text-sm text-zinc-500 mb-4">{customers.length} cliente{customers.length === 1 ? '' : 's'}</p>
      {customers.length === 0 ? (
        <EmptyState icon="user" title="Sem clientes" desc="Os clientes aparecem aqui para lhes atribuíres planos e veres o progresso." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((c) => (
            <ClienteCard key={c.customerId} customer={c} onOpen={() => setSel(c)} onAssign={() => setAtribuir(c)} />
          ))}
        </div>
      )}
      <AtribuirPlanoModal open={!!atribuir} customer={atribuir} planos={planos} onClose={() => setAtribuir(null)} onSaved={() => {}} />
    </div>
  )
}

export function Ginasio() {
  const [tab, setTab] = useState<Tab>('catalogo')
  const { data: custData } = useGetCustomers()
  const customers = (custData?.rows ?? []) as { customerId: string; name: string }[]

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'catalogo', label: 'Exercícios', icon: 'grid' },
    { key: 'treinos', label: 'Treinos', icon: 'layers' },
    { key: 'planos', label: 'Planos', icon: 'calendar' },
    { key: 'clientes', label: 'Clientes', icon: 'user' },
  ]

  return (
    <GymGroupsProvider>
    <div className="space-y-6">
      <PageHeader title="Ginásio" subtitle="Exercícios, treinos, planos e progresso dos clientes." />

      <div className="flex gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 w-full lg:w-auto lg:inline-flex overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t.key ? 'bg-white dark:bg-zinc-900 text-accent shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
          >
            <Icon name={t.icon} className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'catalogo' && <CatalogoTab />}
      {tab === 'treinos' && <TreinosTab />}
      {tab === 'planos' && <PlanosTab />}
      {tab === 'clientes' && <ClientesTab customers={customers} />}
    </div>
    </GymGroupsProvider>
  )
}
