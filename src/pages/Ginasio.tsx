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
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getApiError } from '../lib/apiError'
import { Icon } from '../ui/icons.jsx'
import { Card, Button, IconButton, Badge, Input, Modal, EmptyState, Avatar, BADGE_TONES } from '../ui/ui.jsx'
import { usePageSubtitle } from '../context/PageMetaContext'
import { usePagination, Pagination } from '../components/Pagination'
import { LineChart, DonutChart } from '../ui/charts.jsx'
import { useGetCustomers } from '../gen/backoffice/hooks/useGetCustomers.js'
import { useGetGymExercises } from '../gen/backoffice/hooks/useGetGymExercises.js'
import { postGymExercises } from '../gen/backoffice/hooks/usePostGymExercises.js'
import { putGymExercisesId } from '../gen/backoffice/hooks/usePutGymExercisesId.js'
import { deleteGymExercisesId } from '../gen/backoffice/hooks/useDeleteGymExercisesId.js'
import { useGetGymPrograms } from '../gen/backoffice/hooks/useGetGymPrograms.js'
import { postGymProgramsProgramidWorkouts } from '../gen/backoffice/hooks/usePostGymProgramsProgramidWorkouts.js'
import { putGymProgramsId } from '../gen/backoffice/hooks/usePutGymProgramsId.js'
import { patchGymProgramsIdActive } from '../gen/backoffice/hooks/usePatchGymProgramsIdActive.js'
import { deleteGymProgramsId } from '../gen/backoffice/hooks/useDeleteGymProgramsId.js'
import { CmsCombo } from '../components/CmsCombo'
import { CmsTranslationsModal } from '../components/CmsTranslationsModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GuardButton } from '../components/GuardButton'
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
import type { GymSetRow } from '../gen/backoffice/types/GymSetRow.js'
import type { GymMuscleGroup } from '../gen/backoffice/types/GymMuscleGroup.js'
import type { GymProgram } from '../gen/backoffice/types/GymProgram.js'
import type { GymWorkoutTemplate } from '../gen/backoffice/types/GymWorkoutTemplate.js'
import type { GymWorkoutExercise } from '../gen/backoffice/types/GymWorkoutExercise.js'
import { type MediaItem } from '../components/MediaGallery'
import { Combobox } from '../components/Combobox'
import { DatePicker } from '../components/DatePicker'
import { format } from 'date-fns'
import { useGetUsersMe } from '../gen/backoffice/hooks/useGetUsersMe.js'
import { buildPlanPrintHtml, printPlan } from '../lib/planPdf'

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

export type GinasioView = 'catalogo' | 'treinos' | 'planos' | 'clientes'

// Série-a-série: cada série tem reps/peso/descanso próprios (campos string p/ vazio).
// Série composta (dropset): drop=true + passos; `rest` é o descanso após a série toda.
type SetStepDraft = { reps: string; weight: string; rest: string }
type SetRowDraft = { reps: string; weight: string; rest: string; drop: boolean; steps: SetStepDraft[] }

// Preset em edição no formulário (campos como string para permitir vazio = "—").
// type 'strength' = séries/reps/peso · 'time' = duração (ex: prancha, mobilidade).
// mode 'uniform' = séries iguais · 'perSet' = série-a-série (usa `setRows`, com dropsets).
type PresetDraft = { id: string; name: string; contentKey: string | null; type: 'strength' | 'time'; mode: 'uniform' | 'perSet'; sets: string; reps: string; weight: string; rest: string; duration: string; notes: string; setRows: SetRowDraft[] }
const emptyPreset = (): PresetDraft => ({ id: newUid(), name: '', contentKey: null, type: 'strength', mode: 'uniform', sets: '', reps: '', weight: '', rest: '', duration: '', notes: '', setRows: [] })

// Mínimo para um preset poder ser guardado: nome + trabalho real prescrito —
// duração>0 (tempo) ou séries+reps (força, uniform ou série-a-série). Evita
// criar/guardar um exercício com presets "vazios" (só o nome, sem prescrição).
function presetIsComplete(p: PresetDraft): boolean {
  if (!p.name.trim()) return false
  if (p.type === 'time') {
    const d = parseFloat(p.duration)
    return p.duration.trim() !== '' && !Number.isNaN(d) && d > 0
  }
  if (p.mode === 'perSet') {
    // Cada série tem de ter reps — numa composta (dropset), as reps reais vivem
    // no 1.º passo (`steps`), não no campo `reps` da linha (que fica obsoleto
    // assim que a série passa a composta).
    return p.setRows.length > 0 && p.setRows.every((r) =>
      r.drop ? r.steps.length > 0 && r.steps.every((s) => s.reps.trim() !== '') : r.reps.trim() !== '',
    )
  }
  return p.sets.trim() !== '' && p.reps.trim() !== ''
}

// ── Conversões série-a-série (draft ⇄ API) ─────────────────────────────────────
const numOr0 = (v: string) => (v === '' ? 0 : Number(v))
const emptySetRow = (seed?: { reps?: string; weight?: string; rest?: string }): SetRowDraft => ({
  reps: seed?.reps || '10', weight: seed?.weight || '0', rest: seed?.rest || '60', drop: false, steps: [],
})
function setRowsToApi(rows: SetRowDraft[]): GymSetRow[] {
  return rows.map((r) =>
    r.drop
      ? { drop: true, reps: numOr0(r.steps[0]?.reps ?? ''), weight: numOr0(r.steps[0]?.weight ?? ''), rest: numOr0(r.rest), steps: r.steps.map((s) => ({ reps: numOr0(s.reps), weight: numOr0(s.weight), rest: numOr0(s.rest) })) }
      : { drop: false, reps: numOr0(r.reps), weight: numOr0(r.weight), rest: numOr0(r.rest), steps: [] },
  )
}
function apiToSetRowDrafts(rows?: GymSetRow[] | null): SetRowDraft[] {
  return (rows ?? []).map((r) => ({
    reps: r.reps != null ? String(r.reps) : '',
    weight: r.weight != null ? String(r.weight) : '',
    rest: r.rest != null ? String(r.rest) : '',
    drop: !!r.drop,
    steps: (r.steps ?? []).map((s) => ({ reps: s.reps != null ? String(s.reps) : '', weight: s.weight != null ? String(s.weight) : '', rest: s.rest != null ? String(s.rest) : '' })),
  }))
}
// Resumo legível de uma prescrição série-a-série.
function setRowsResumo(rows: GymSetRow[]): string {
  if (!rows.length) return '–'
  const parts = rows.map((r) => (r.drop ? (r.steps ?? []).map((s) => s.reps ?? 0).join('-') + '↓' : `${r.reps ?? 0}`))
  const weights = rows.flatMap((r) => (r.drop ? (r.steps ?? []).map((s) => s.weight) : [r.weight])).filter((w): w is number => w != null && w > 0)
  let wTxt = ''
  if (weights.length) { const mn = Math.min(...weights), mx = Math.max(...weights); wTxt = mn === mx ? ` · ${mn}kg` : ` · ${mn}-${mx}kg` }
  return `${rows.length} séries (${parts.join(' · ')})${wTxt}`
}

type DraftExercise = {
  uid: string
  exerciseId?: string | null
  name: string
  group: string
  subGroup?: string | null
  type: 'strength' | 'time'
  mode: 'uniform' | 'perSet'
  sets: number
  reps: number
  weight: number
  rest: number
  duration: number
  notes?: string | null
  setRows?: GymSetRow[] | null
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

// Input numérico compacto (sem label) para as tabelas série-a-série.
const SET_NUM_CLS = 'w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm tabular-nums px-2 py-1.5 focus:outline-none focus:border-accent'
function SetNum({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="number" min={0} value={value} placeholder="—" onChange={(e) => onChange(e.target.value)} className={SET_NUM_CLS} />
}

// ── Editor série-a-série (com séries compostas / dropsets) ─────────────────────
// Cada série pode ser normal (reps/peso/desc.) ou composta (vários passos, ex.
// dropset). `rest` é sempre o descanso DEPOIS da série inteira. Tudo é registado.
function SetRowsEditor({ rows, onChange }: { rows: SetRowDraft[]; onChange: (rows: SetRowDraft[]) => void }) {
  const setRow = (i: number, patch: Partial<SetRowDraft>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => { const last = rows[rows.length - 1]; onChange([...rows, emptySetRow(last && !last.drop ? { reps: last.reps, weight: last.weight, rest: last.rest } : undefined)]) }
  const delRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
  const toggleDrop = (i: number) => setRow(i, rows[i].drop
    ? { drop: false }
    : { drop: true, steps: [{ reps: rows[i].reps || '12', weight: rows[i].weight || '40', rest: '0' }, { reps: '8', weight: String(Math.round((Number(rows[i].weight) || 40) * 0.8)), rest: '0' }] })
  const setStep = (i: number, j: number, patch: Partial<SetStepDraft>) => setRow(i, { steps: rows[i].steps.map((s, sj) => (sj === j ? { ...s, ...patch } : s)) })
  const addStep = (i: number) => { const last = rows[i].steps[rows[i].steps.length - 1]; setRow(i, { steps: [...rows[i].steps, { reps: String(Math.max(1, (Number(last?.reps) || 8) - 2)), weight: String(Math.round((Number(last?.weight) || 30) * 0.85)), rest: '0' }] }) }
  const delStep = (i: number, j: number) => setRow(i, { steps: rows[i].steps.filter((_, sj) => sj !== j) })

  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-2">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-medium text-zinc-500 tabular-nums">Série {i + 1}</span>
            {r.drop && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 font-medium">Composta</span>}
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => toggleDrop(i)} title={r.drop ? 'Tornar série normal' : 'Tornar série composta (dropset)'} className={`w-6 h-6 flex items-center justify-center rounded ${r.drop ? 'text-amber-500' : 'text-zinc-400 hover:text-accent'}`}><Icon name="layers" className="w-3.5 h-3.5" /></button>
              {rows.length > 1 && <button type="button" onClick={() => delRow(i)} title="Remover série" className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500"><Icon name="trash" className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
          {!r.drop ? (
            <div className="grid grid-cols-3 gap-2">
              <label className="block"><span className="block text-[10px] text-zinc-400 mb-0.5">Reps</span><SetNum value={r.reps} onChange={(v) => setRow(i, { reps: v })} /></label>
              <label className="block"><span className="block text-[10px] text-zinc-400 mb-0.5">Peso (kg)</span><SetNum value={r.weight} onChange={(v) => setRow(i, { weight: v })} /></label>
              <label className="block"><span className="block text-[10px] text-zinc-400 mb-0.5">Desc. (s)</span><SetNum value={r.rest} onChange={(v) => setRow(i, { rest: v })} /></label>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[16px_1fr_1fr_1fr_22px] gap-2 px-0.5 text-[10px] text-zinc-400"><span /><span>Reps</span><span>Peso (kg)</span><span>Desc. (s)</span><span /></div>
              {r.steps.map((s, j) => (
                <div key={j} className="grid grid-cols-[16px_1fr_1fr_1fr_22px] gap-2 items-center">
                  <span className="text-[10px] text-zinc-400 tabular-nums text-center">{j + 1}</span>
                  <SetNum value={s.reps} onChange={(v) => setStep(i, j, { reps: v })} />
                  <SetNum value={s.weight} onChange={(v) => setStep(i, j, { weight: v })} />
                  <SetNum value={s.rest} onChange={(v) => setStep(i, j, { rest: v })} />
                  <div className="flex justify-center">{r.steps.length > 1 && <button type="button" onClick={() => delStep(i, j)} title="Remover passo" className="w-5 h-6 flex items-center justify-center text-zinc-400 hover:text-red-500"><Icon name="x" className="w-3 h-3" /></button>}</div>
                </div>
              ))}
              <div className="flex justify-end items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-zinc-400">Após série (s)</span>
                <input type="number" min={0} value={r.rest} onChange={(e) => setRow(i, { rest: e.target.value })} className={SET_NUM_CLS + ' w-16'} />
              </div>
              <button type="button" onClick={() => addStep(i)} className="w-full py-1.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 text-[12px] text-zinc-500 hover:border-accent hover:text-accent transition flex items-center justify-center gap-1.5"><Icon name="plus" className="w-3 h-3" />Adicionar passo</button>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addRow} className="w-full mt-1 py-1.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 text-[13px] text-zinc-500 hover:border-accent hover:text-accent transition flex items-center justify-center gap-1.5"><Icon name="plus" className="w-3.5 h-3.5" />Adicionar série</button>
    </div>
  )
}

// Bloco partilhado de campos de prescrição de força/tempo (com toggle série-a-série),
// usado tanto no editor de preset do catálogo como no "Ajustar p/ este treino".
function StrengthFields({
  mode, setRows, sets, reps, weight, rest,
  onMode, onSetRows, onSets, onReps, onWeight, onRest,
}: {
  mode: 'uniform' | 'perSet'; setRows: SetRowDraft[]; sets: string; reps: string; weight: string; rest: string
  onMode: (m: 'uniform' | 'perSet') => void; onSetRows: (r: SetRowDraft[]) => void
  onSets: (v: string) => void; onReps: (v: string) => void; onWeight: (v: string) => void; onRest: (v: string) => void
}) {
  const goPerSet = () => {
    onMode('perSet')
    if (!setRows.length) {
      const n = Math.max(1, Math.min(20, Number(sets) || 3))
      onSetRows(Array.from({ length: n }, () => emptySetRow({ reps: reps || '10', weight: weight || '0', rest: rest || '60' })))
    }
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Séries</span>
        <div className="inline-flex p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs">
          <button type="button" onClick={() => onMode('uniform')} className={`px-2.5 py-1 rounded-md font-medium transition ${mode === 'uniform' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}>Iguais</button>
          <button type="button" onClick={goPerSet} className={`px-2.5 py-1 rounded-md font-medium transition ${mode === 'perSet' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}>Série a série</button>
        </div>
      </div>
      {mode === 'perSet' ? (
        <SetRowsEditor rows={setRows} onChange={onSetRows} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <NumField label="Séries" value={sets} onChange={onSets} />
          <NumField label="Reps" value={reps} onChange={onReps} />
          <NumField label="Descanso (s)" value={rest} onChange={onRest} />
          <NumField label="Peso (kg)" value={weight} onChange={onWeight} />
        </div>
      )}
    </div>
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
  const [contentKey, setContentKey] = useState<string | null>(grupo?.contentKey ?? null)
  const [color, setColor] = useState(grupo?.color ?? randomColor())
  type SubDraft = { uid: string; muscleGroupId?: string; name: string; contentKey: string | null }
  const [subs, setSubs] = useState<SubDraft[]>(() =>
    grupo ? subGroupsOf(grupo.name).map((s) => ({ uid: newUid(), muscleGroupId: s.muscleGroupId, name: s.name, contentKey: s.contentKey ?? null })) : [],
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
        await putGymMuscleGroupsId(grupo.muscleGroupId, { name: name.trim(), color, contentKey: key })
      } else {
        const created = await postGymMuscleGroups({ name: name.trim(), color, contentKey: key })
        groupId = created.muscleGroupId
      }
      // Cria os subgrupos novos (nome via CMS) com parentId do grupo.
      for (const sd of subs.filter((x) => !x.muscleGroupId)) {
        const sk = await ensureCmsName(sd.contentKey ?? null, 'gym', sd.name, defaultLang)
        await postGymMuscleGroups({ name: sd.name.trim(), color, parentId: groupId, contentKey: sk })
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
  const [presets, setPresets] = useState<PresetDraft[]>([])
  // Layout do protótipo: sidebar de grupos (filtro) + pesquisa + cards expansíveis.
  const [grupoSel, setGrupoSel] = useState<string>('todos')
  const [q, setQ] = useState('')
  // Editor de preset inline (padrão do protótipo): cartões compactos + editor ao abrir.
  const [presetEdit, setPresetEdit] = useState<{ form: PresetDraft; isNew: boolean } | null>(null)
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  const presetResumo = (p: GymExercisePreset) =>
    p.type === 'time'
      ? `${p.reps ? `${p.reps}× ` : ''}${p.duration ?? 0}s${p.rest ? ` · ${p.rest}s desc.` : ''}`
      : p.mode === 'perSet' && (p.setRows?.length)
        ? setRowsResumo(p.setRows)
        : `${p.sets ?? '–'}×${p.reps ?? '–'}${p.weight ? ` · ${p.weight}kg` : ''}${p.rest ? ` · ${p.rest}s` : ''}`
  const draftResumo = (p: PresetDraft) =>
    p.type === 'time'
      ? `${p.reps ? `${p.reps}× ` : ''}${p.duration || '–'}s${p.rest ? ` · ${p.rest}s desc.` : ''}`
      : p.mode === 'perSet' && p.setRows.length
        ? setRowsResumo(setRowsToApi(p.setRows))
        : `${p.sets || '–'}×${p.reps || '–'}${p.weight ? ` · ${p.weight}kg` : ''}${p.rest ? ` · ${p.rest}s` : ''}`
  const togCls = (on: boolean) => `py-1.5 rounded-lg border text-xs font-medium transition ${on ? 'border-accent bg-accent/[0.06] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`
  const setEditField = (patch: Partial<PresetDraft>) => setPresetEdit((pe) => (pe ? { ...pe, form: { ...pe.form, ...patch } } : pe))
  const savePresetEdit = () => {
    if (!presetEdit) return
    const f = presetEdit.form
    setPresets((ps) => (ps.some((x) => x.id === f.id) ? ps.map((x) => (x.id === f.id ? f : x)) : [...ps, f]))
    setPresetEdit(null)
  }
  // Lista efetiva de presets incluindo o rascunho aberto (se válido) — o "Criar
  // exercício"/"Guardar alterações" faz o commit implícito do preset em edição,
  // para que preencher 1 preset + guardar seja UM clique só.
  const presetsWithOpenDraft = (): PresetDraft[] => {
    if (!presetEdit || !presetEdit.form.name.trim()) return presets
    const f = presetEdit.form
    return presets.some((x) => x.id === f.id) ? presets.map((x) => (x.id === f.id ? f : x)) : [...presets, f]
  }
  // Payload que seria mesmo enviado ao guardar (presets nomeados, incl. o
  // rascunho aberto) — gate mínimo do botão principal: nome + grupo + ≥1
  // preset e TODOS completos (reps+séries ou duração, consoante tipo/modo).
  const payloadPresets = presetsWithOpenDraft().filter((p) => p.name.trim())
  const canCreate = !!name.trim() && !!groupId && payloadPresets.length > 0 && payloadPresets.every(presetIsComplete)

  const subs = groups.filter((g) => g.parentId === groupId)

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/exercises' }] })

  const toPresetDraft = (p: GymExercisePreset): PresetDraft => ({
    id: p.id || newUid(),
    name: p.name,
    contentKey: p.contentKey ?? null,
    type: p.type === 'time' ? 'time' : 'strength',
    mode: p.mode === 'perSet' && p.setRows?.length ? 'perSet' : 'uniform',
    sets: p.sets != null ? String(p.sets) : '',
    reps: p.reps != null ? String(p.reps) : '',
    weight: p.weight != null ? String(p.weight) : '',
    rest: p.rest != null ? String(p.rest) : '',
    duration: p.duration != null ? String(p.duration) : '',
    notes: p.notes ?? '',
    setRows: apiToSetRowDrafts(p.setRows),
  })

  const startCreate = () => {
    setEditing(null); setName(''); setContentKey(null); setGroupId(''); setSubGroupId('')
    // Abre já com um rascunho de preset vazio (em vez de null) — ao criar um
    // exercício de raiz o utilizador vai precisar de pelo menos um preset de
    // qualquer forma, por isso o form já vem pronto a preencher.
    setPresets([]); setPresetEdit({ form: emptyPreset(), isNew: true }); setOpen(true)
  }
  const startEdit = (e: GymExercise) => {
    // Fallback p/ legados sem id: resolve pelo nome guardado.
    const gid = e.muscleGroupId ?? topGroups.find((g) => g.name === e.muscleGroup)?.muscleGroupId ?? ''
    setEditing(e); setName(e.name); setContentKey(e.contentKey ?? null); setGroupId(gid); setSubGroupId(e.subGroupId ?? '')
    // Limpa qualquer rascunho de preset que tenha ficado aberto (ex: de um
    // "Novo exercício" cancelado sem fechar o form) — editar carrega sempre os
    // presets reais da API, nunca deve herdar um rascunho de outra sessão do modal.
    setPresetEdit(null)
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
    // `overridePresets`, quando presente, ganha à `presets` do estado — usado pelo
    // botão único de guardar, que comita o rascunho de preset aberto e guarda no
    // mesmo clique (o `setPresets` é assíncrono, por isso não dá para confiar no
    // `presets` do closure logo a seguir a um `setPresets`).
    mutationFn: async (overridePresets?: PresetDraft[]) => {
      const activePresets = overridePresets ?? presets
      // O nome de cada preset é traduzível (CMS): garante a chave ao Guardar.
      const cleanPresets = await Promise.all(
        activePresets.filter((p) => p.name.trim()).map(async (p): Promise<GymExercisePreset> => {
          const pk = await ensureCmsName(p.contentKey, 'gym', p.name, defaultLang)
          const perSet = p.type === 'strength' && p.mode === 'perSet' && p.setRows.length > 0
          return {
            id: p.id, name: p.name.trim(), contentKey: pk, type: p.type,
            mode: perSet ? 'perSet' : 'uniform',
            sets: numOrNull(p.sets), reps: numOrNull(p.reps),
            weight: numOrNull(p.weight), rest: numOrNull(p.rest),
            duration: numOrNull(p.duration), notes: p.notes.trim() || null,
            setRows: perSet ? setRowsToApi(p.setRows) : null,
          }
        }),
      )
      const key = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      const body = {
        // O exercício fica sempre visível na app do cliente (sem toggle de ativo/inativo).
        name: name.trim(), contentKey: key, muscleGroupId: groupId, subGroupId: subGroupId || null, active: true, media: [],
        presets: cleanPresets,
      }
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
  const pg = usePagination(filtered, { resetKey: `${q}|${grupoSel}` })
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
            <>
            <div className="space-y-2">
              {pg.pageItems.map((e) => (
                <Card key={e.exerciseId} className="overflow-hidden">
                  <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30" onClick={() => startEdit(e)}>
                    <span className="w-9 h-9 rounded-lg shrink-0" style={{ background: colorOf(e.muscleGroup) }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-white truncate">{e.name}</p>
                      <p className="text-xs text-zinc-400">{e.muscleGroup}{e.subGroup ? ` · ${e.subGroup}` : ''}</p>
                    </div>
                    <Badge tone="neutral">{e.presets?.length ?? 0} preset{(e.presets?.length ?? 0) === 1 ? '' : 's'}</Badge>
                    <span onClick={(ev) => ev.stopPropagation()} className="flex items-center gap-1">
                      <IconButton icon="edit" label="Editar" onClick={() => startEdit(e)} />
                      <IconButton icon="trash" label="Eliminar" className="hover:text-red-500" onClick={() => setConfirmDel(e)} />
                    </span>
                  </div>
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-zinc-50 dark:border-zinc-800/50">
                    {(e.presets?.length ?? 0) > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {e.presets!.map((p) => (
                          <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                            <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${p.type === 'time' ? 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300' : 'bg-accent/10 text-accent'}`}>{p.type === 'time' ? 'T' : 'F'}</span>
                            <div className="min-w-0"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{p.name}</p><p className="text-xs text-zinc-400 tabular-nums">{presetResumo(p)}</p></div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-zinc-400 mt-2">Sem presets.</p>}
                  </div>
                </Card>
              ))}
            </div>
            <Pagination {...pg} />
            </>
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
            <Button
              isLoading={save.isPending}
              disabled={!canCreate}
              onClick={() => {
                // Comita primeiro o rascunho de preset aberto (se válido) para o
                // array, e só depois guarda — um único clique cobre os dois passos.
                const finalPresets = presetsWithOpenDraft()
                if (presetEdit && presetEdit.form.name.trim()) { setPresets(finalPresets); setPresetEdit(null) }
                save.mutate(finalPresets)
              }}
            >
              {editing ? 'Guardar alterações' : 'Criar exercício'}
            </Button>
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
              {(!presetEdit || presetEdit.form.name.trim()) && (
                <Button
                  size="sm" variant="ghost" icon="plus"
                  onClick={() => {
                    // Se já há um rascunho válido aberto, comita-o antes de abrir um
                    // novo — assim dá para encadear vários presets sem um botão
                    // "Guardar preset" à parte.
                    if (presetEdit && presetEdit.form.name.trim()) savePresetEdit()
                    setPresetEdit({ form: emptyPreset(), isNew: true })
                  }}
                >
                  Adicionar preset
                </Button>
              )}
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
                  <div className="grid grid-cols-3 gap-2">
                    <NumField label="Repetições" value={presetEdit.form.reps} onChange={(v) => setEditField({ reps: v })} />
                    <NumField label="Duração (s)" value={presetEdit.form.duration} onChange={(v) => setEditField({ duration: v })} />
                    <NumField label="Descanso (s)" value={presetEdit.form.rest} onChange={(v) => setEditField({ rest: v })} />
                  </div>
                ) : (
                  <StrengthFields
                    mode={presetEdit.form.mode} setRows={presetEdit.form.setRows}
                    sets={presetEdit.form.sets} reps={presetEdit.form.reps} weight={presetEdit.form.weight} rest={presetEdit.form.rest}
                    onMode={(m) => setEditField({ mode: m })} onSetRows={(r) => setEditField({ setRows: r })}
                    onSets={(v) => setEditField({ sets: v })} onReps={(v) => setEditField({ reps: v })}
                    onWeight={(v) => setEditField({ weight: v })} onRest={(v) => setEditField({ rest: v })}
                  />
                )}
                <Input label="Notas (opcional)" value={presetEdit.form.notes} onChange={(ev: any) => setEditField({ notes: ev.target.value })} placeholder="Ex: cadência 2-0-2" />
                {/* Sem botão "Guardar preset": este rascunho fica comitado
                    automaticamente ao clicar "Adicionar preset" outra vez (para
                    encadear mais um) ou no botão final do modal — um só clique. */}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPresetEdit(null)}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
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
const presetValues = (p?: GymExercisePreset): Partial<DraftExercise> => {
  const perSet = p?.mode === 'perSet' && !!p?.setRows?.length
  return {
    type: p?.type === 'time' ? 'time' : 'strength',
    mode: perSet ? 'perSet' : 'uniform',
    sets: p?.sets ?? 3,
    reps: p?.reps ?? 10,
    weight: p?.weight ?? 0,
    rest: p?.rest ?? 60,
    duration: p?.duration ?? 0,
    notes: p?.notes ?? null,
    setRows: perSet ? (p!.setRows ?? null) : null,
  }
}

// Mapeia um exercício de um DTO (treino/template/plano) para uma linha editável,
// preservando type/mode/setRows (snapshot completo — tudo é registado).
const dtoToRow = (e: GymWorkoutExercise): DraftExercise => ({
  uid: newUid(), exerciseId: e.exerciseId ?? null, name: e.name, group: e.group, subGroup: e.subGroup ?? null,
  type: e.type === 'time' ? 'time' : 'strength',
  mode: e.mode === 'perSet' ? 'perSet' : 'uniform',
  sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
  duration: e.duration ?? 0, notes: e.notes ?? null,
  setRows: e.setRows ?? null,
  media: (e.media ?? []) as MediaItem[],
})
// Serializa uma linha editável para o payload de exercício da API (com setRows).
const rowToPayload = (r: DraftExercise) => ({
  exerciseId: r.exerciseId, name: r.name, group: r.group, subGroup: r.subGroup ?? null,
  type: r.type, mode: r.mode, sets: r.sets, reps: r.reps, weight: r.weight, rest: r.rest,
  duration: r.duration, notes: r.notes, setRows: r.setRows ?? null, media: r.media,
})

// ─────────────────────────────────────────────────────────────────────────────
// "Personalizado" = a prescrição da linha não corresponde a nenhum preset do
// exercício (foi ajustada à mão para este treino). Comparamos com os valores que
// aplicar o preset produziria (presetValues), para um preset aplicado coincidir.
function presetMatchesRow(p: GymExercisePreset, r: DraftExercise): boolean {
  const pv = presetValues(p)
  if (pv.type !== r.type) return false
  if (r.type === 'time') return pv.duration === r.duration && pv.rest === r.rest
  if ((pv.mode === 'perSet') !== (r.mode === 'perSet')) return false
  if (pv.mode === 'perSet') return JSON.stringify(pv.setRows ?? []) === JSON.stringify(r.setRows ?? [])
  return pv.sets === r.sets && pv.reps === r.reps && pv.weight === r.weight && pv.rest === r.rest
}
function matchedPreset(catalog: GymExercise[], r: DraftExercise): GymExercisePreset | null {
  const ex = catalog.find((c) => c.exerciseId === r.exerciseId)
  return (ex?.presets ?? []).find((p) => presetMatchesRow(p, r)) ?? null
}
function isPersonalizado(catalog: GymExercise[], r: DraftExercise): boolean {
  const ex = catalog.find((c) => c.exerciseId === r.exerciseId)
  const presets = ex?.presets ?? []
  return presets.length > 0 && !presets.some((p) => presetMatchesRow(p, r))
}

// Modal "Ajustar p/ este treino" — mesmos campos da criação/edição de preset.
// Substitui a prescrição da linha só neste treino (marca-a como Personalizado).
function AjustarModal({ row, onClose, onSave }: {
  row: DraftExercise | null
  onClose: () => void
  onSave: (patch: Partial<DraftExercise>) => void
}) {
  const [type, setType] = useState<'strength' | 'time'>('strength')
  const [mode, setMode] = useState<'uniform' | 'perSet'>('uniform')
  const [sets, setSets] = useState('0')
  const [reps, setReps] = useState('0')
  const [weight, setWeight] = useState('0')
  const [rest, setRest] = useState('0')
  const [duration, setDuration] = useState('0')
  const [notes, setNotes] = useState('')
  const [setRows, setSetRows] = useState<SetRowDraft[]>([])
  useEffect(() => {
    if (!row) return
    setType(row.type); setMode(row.mode === 'perSet' ? 'perSet' : 'uniform')
    setSets(String(row.sets)); setReps(String(row.reps))
    setWeight(String(row.weight)); setRest(String(row.rest)); setDuration(String(row.duration))
    setNotes(row.notes ?? ''); setSetRows(apiToSetRowDrafts(row.setRows))
  }, [row])
  if (!row) return null
  const togCls = (on: boolean) => `py-1.5 rounded-lg border text-xs font-medium transition ${on ? 'border-accent bg-accent/[0.06] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`
  const save = () => {
    const perSet = type === 'strength' && mode === 'perSet' && setRows.length > 0
    onSave({
      type, mode: perSet ? 'perSet' : 'uniform',
      sets: Number(sets), reps: Number(reps), weight: Number(weight), rest: Number(rest),
      duration: Number(duration), notes: notes.trim() || null,
      setRows: perSet ? setRowsToApi(setRows) : null,
    })
  }
  return (
    <Modal open onClose={onClose} width="max-w-md" title="Ajustar p/ este treino" subtitle={row.name}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" onClick={save}>Guardar</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setType('strength')} className={togCls(type === 'strength')}>Força (séries/reps)</button>
          <button type="button" onClick={() => setType('time')} className={togCls(type === 'time')}>Tempo (duração)</button>
        </div>
        {type === 'time' ? (
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Duração (s)" value={duration} onChange={setDuration} />
            <NumField label="Descanso (s)" value={rest} onChange={setRest} />
          </div>
        ) : (
          <StrengthFields
            mode={mode} setRows={setRows} sets={sets} reps={reps} weight={weight} rest={rest}
            onMode={setMode} onSetRows={setSetRows} onSets={setSets} onReps={setReps} onWeight={setWeight} onRest={setRest}
          />
        )}
        <Input label="Notas (opcional)" value={notes} onChange={(e: any) => setNotes(e.target.value)} placeholder="Ex: cadência 2-0-2" />
      </div>
    </Modal>
  )
}

// Lista partilhada de exercícios de um treino (preset + resumo + Ajustar +
// Personalizado + drag). Usada por todos os editores de treino. Opera em `rows`.
function ExerciseRowsEditor({ rows, setRows, catalog }: {
  rows: DraftExercise[]
  setRows: (updater: DraftExercise[] | ((prev: DraftExercise[]) => DraftExercise[])) => void
  catalog: GymExercise[]
}) {
  const { colorOf } = useGymGroups()
  const [addOpen, setAddOpen] = useState(false)
  const [adjust, setAdjust] = useState<DraftExercise | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const addExercise = (ex: GymExercise) => {
    const p0 = ex.presets?.[0]
    setRows((r) => [...r, {
      uid: newUid(), exerciseId: ex.exerciseId, name: ex.name, group: ex.muscleGroup, subGroup: ex.subGroup ?? null,
      media: (ex.media ?? []) as MediaItem[], ...presetValues(p0),
    } as DraftExercise])
    setAddOpen(false)
  }
  const update = (uid: string, patch: Partial<DraftExercise>) => setRows((r) => r.map((row) => (row.uid === uid ? { ...row, ...patch } : row)))
  const removeRow = (uid: string) => setRows((r) => r.filter((row) => row.uid !== uid))
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setRows((r) => {
      const oldIdx = r.findIndex((x) => x.uid === active.id)
      const newIdx = r.findIndex((x) => x.uid === over.id)
      return oldIdx < 0 || newIdx < 0 ? r : arrayMove(r, oldIdx, newIdx)
    })
  }
  const applyPreset = (uid: string, ex: GymExercise, presetId: string) => {
    const p = (ex.presets ?? []).find((x) => x.id === presetId)
    if (p) update(uid, presetValues(p))
  }

  if (rows.length === 0) {
    return (
      <>
        <Card><EmptyState icon="layers" title="Treino vazio" desc="Adiciona exercícios da tua biblioteca." action={<Button icon="plus" onClick={() => setAddOpen(true)}>Adicionar exercício</Button>} /></Card>
        <AddExercicioModal open={addOpen} catalog={catalog} onClose={() => setAddOpen(false)} onAdd={addExercise} />
      </>
    )
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {rows.map((row, i) => {
              const ex = catalog.find((c) => c.exerciseId === row.exerciseId)
              const presets = ex?.presets ?? []
              const matched = presets.find((p) => presetMatchesRow(p, row)) ?? null
              const personalizado = presets.length > 0 && !matched
              const resumo = row.type === 'time'
                ? `${row.reps ? `${row.reps}× ` : ''}${row.duration}s · ${row.rest}s desc.`
                : row.mode === 'perSet' && row.setRows?.length
                  ? setRowsResumo(row.setRows)
                  : `${row.sets}×${row.reps} · ${row.weight}kg · ${row.rest}s`
              return (
                <Sortable key={row.uid} id={row.uid} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900">
                  {(handle) => (
                    <>
                      <div className="flex items-center gap-2">
                        <DragHandle {...handle} />
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: colorOf(row.group) }}><span className="text-xs font-semibold">{i + 1}</span></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{row.name}</p>
                          <p className="text-[11px] text-zinc-400">{row.group}{row.subGroup ? ` · ${row.subGroup}` : ''}</p>
                        </div>
                        <IconButton icon="trash" label="Remover" onClick={() => removeRow(row.uid)} />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-2 pl-10">
                        {presets.length > 0 && (
                          <div className="w-32 shrink-0">
                            <Combobox value={matched?.id ?? ''} onChange={(id) => applyPreset(row.uid, ex!, id)} options={presets.map((p) => ({ value: p.id, label: p.name }))} placeholder="Preset…" searchPlaceholder="Pesquisar…" />
                          </div>
                        )}
                        <span className="text-xs text-zinc-500 tabular-nums">{resumo}</span>
                        {personalizado && <Badge tone="amber" dot>Personalizado</Badge>}
                        <button type="button" onClick={() => setAdjust(row)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Icon name="edit" className="w-3.5 h-3.5" />Ajustar p/ este treino</button>
                      </div>
                    </>
                  )}
                </Sortable>
              )
            })}
          </div>
        </SortableContext>
        <Button variant="outline" icon="plus" className="w-full mt-2" onClick={() => setAddOpen(true)}>Adicionar exercício</Button>
      </DndContext>
      <AddExercicioModal open={addOpen} catalog={catalog} onClose={() => setAddOpen(false)} onAdd={addExercise} />
      <AjustarModal row={adjust} onClose={() => setAdjust(null)} onSave={(patch) => { if (adjust) update(adjust.uid, patch); setAdjust(null) }} />
    </>
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
  template: GymWorkoutTemplate | null
  catalog: GymExercise[]
  onSaved: () => void
  onCreated?: (t: GymWorkoutTemplate) => void
}) {
  const { colorOf } = useGymGroups()
  const [name, setName] = useState('')
  const [contentKey, setContentKey] = useState<string | null>(null)
  const [rows, setRows] = useState<DraftExercise[]>([])
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  useEffect(() => {
    if (!open) return
    setName(template?.name ?? '')
    setContentKey(template?.contentKey ?? null)
    setRows((template?.exercises ?? []).map(dtoToRow))
  }, [open, template?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: async () => {
      const key = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      const body = { name: name.trim(), contentKey: key, exercises: rows.map(rowToPayload) }
      if (template) return putGymWorkoutTemplatesId(template.id, body)
      return postGymWorkoutTemplates(body)
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: [{ url: '/gym/workout-templates' }] })
      if (!template && onCreated && result) onCreated(result)
      onSaved(); onClose()
      toast.success(template ? 'Treino atualizado' : 'Treino criado')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  if (!open) return null

  const totalSeries = rows.reduce((s, r) => s + (r.type === 'time' ? 0 : (r.sets || 0)), 0)
  const gruposUsados = [...new Set(rows.map((r) => r.group))].filter(Boolean)
  const personalizadosCount = rows.filter((r) => isPersonalizado(catalog, r)).length

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

            <ExerciseRowsEditor rows={rows} setRows={setRows} catalog={catalog} />
          </div>

          <div>
            <Card className="p-4 lg:sticky lg:top-4">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-3">Resumo</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Exercícios</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{rows.length}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Séries totais</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{totalSeries}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Personalizados</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{personalizadosCount}</span></div>
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
    </div>
  )
}

// Reusable workout templates tab ("Dia de Treino" na sidebar — cada item É um
// dia de treino reutilizável, conjunto de exercícios sem dias fixos).
function TreinosTab() {
  const qc = useQueryClient()
  const { colorOf } = useGymGroups()
  const { data, isLoading } = useGetGymWorkoutTemplates()
  const templates = (data ?? []) as GymWorkoutTemplate[]
  const { data: catalogData } = useGetGymExercises()
  const catalog = (catalogData ?? []) as GymExercise[]

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GymWorkoutTemplate | null>(null)
  const [confirmDel, setConfirmDel] = useState<GymWorkoutTemplate | null>(null)
  const [q, setQ] = useState('')

  const remove = useMutation({
    mutationFn: (id: string) => deleteGymWorkoutTemplatesId(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [{ url: '/gym/workout-templates' }] }); toast.success('Treino eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  const filtered = useMemo(
    () => templates.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())),
    [templates, q],
  )
  const pg = usePagination(filtered, { resetKey: q })

  // Editor inline (substitui a lista) — não é overlay fixo, mantém o menu da app.
  if (open) {
    return <WorkoutTemplateModal open onClose={() => { setOpen(false); setEditing(null) }} template={editing} catalog={catalog} onSaved={() => {}} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" className="w-[18px] h-[18px]" /></span>
          <input
            aria-label="Procurar dia de treino"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Procurar dia de treino…"
            className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-transparent rounded-lg text-sm pl-10 pr-3 py-2 focus:bg-white dark:focus:bg-zinc-900 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none text-zinc-800 dark:text-zinc-100"
          />
        </div>
        <p className="text-sm text-zinc-500 sm:ml-auto">{filtered.length} dia{filtered.length === 1 ? '' : 's'} de treino reutilizáve{filtered.length === 1 ? 'l' : 'is'}</p>
        <Button icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo dia de treino</Button>
      </div>
      {isLoading ? (
        <Card className="p-8 text-center text-zinc-400">A carregar…</Card>
      ) : templates.length === 0 ? (
        <EmptyState icon="folder" title="Sem dias de treino" desc="Cria dias de treino reutilizáveis (conjuntos de exercícios) para usar nos Planos e atribuir aos clientes." action={<Button icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo dia de treino</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search" title="Sem resultados" desc="Não há dias de treino que correspondam à pesquisa." />
      ) : (
        <div>
          <Card className="overflow-hidden divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {pg.pageItems.map((t) => (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => { setEditing(t); setOpen(true) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(t); setOpen(true) } }}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 cursor-pointer"
              >
                <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="layers" className="w-[18px] h-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">{t.name}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-zinc-400">{t.exercises.length} exercício{t.exercises.length === 1 ? '' : 's'}</p>
                    <span className="flex gap-1">{(t.muscleGroups ?? []).map((g) => <span key={g} className="w-2 h-2 rounded-full" style={{ background: colorOf(g) }} title={g} />)}</span>
                  </div>
                </div>
                <span onClick={(e) => e.stopPropagation()}>
                  <IconButton icon="trash" label="Eliminar" onClick={() => setConfirmDel(t)} className="hover:text-red-500" />
                </span>
                <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 shrink-0" />
              </div>
            ))}
          </Card>
          <Pagination {...pg} />
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
  sets?: { weight?: number; reps?: number; duration?: number }[]
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
            const sets = e.sets ?? []
            const done = isTime ? (e.duration ?? 0) : (e.weight ?? 0)
            // "Anterior" só conta com carga real (>0) — evita comparar contra 0 e mostrar "+X" falso.
            const prevRaw = isTime ? e.prevDuration : e.prevWeight
            const prev = prevRaw && prevRaw > 0 ? prevRaw : null
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
                      {sets.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {sets.map((s, si) => (
                            <span key={si} className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                              {isTime ? `${s.duration ?? 0}s` : (s.weight ? `${s.weight}×${s.reps ?? 0}` : `${s.reps ?? 0} reps`)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">{isTime ? `${e.duration ?? 0}s` : `${e.reps ?? 0} reps`}</p>
                      )}
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
  // Séries visíveis no gráfico (vazio = todas). Clicar na legenda alterna cada uma.
  const [shownSeries, setShownSeries] = useState<number[]>([])
  const toggleSeries = (k: number) => setShownSeries((sel) => (sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]))

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
  // Últimas (até) 7 sessões do exercício selecionado, cada uma com as suas séries.
  const sessoes = (selectedSeries?.sessions ?? []).slice(-7)
  const lineLabels = sessoes.map((s) => (s.date ?? '').slice(5))
  // Uma linha por índice de série (Série 1, 2, …); falha quando a sessão teve menos séries.
  const LINE_COLORS = ['#2A6FDB', '#1F8A5B', '#D97757', '#7C5CDB', '#E6B450', '#0EA5A4']
  const maxSets = sessoes.length ? Math.min(6, Math.max(...sessoes.map((s) => s.sets?.length ?? 0))) : 0
  const lineSeries = Array.from({ length: maxSets }, (_, k) => ({
    name: `Série ${k + 1}`,
    color: LINE_COLORS[k % LINE_COLORS.length],
    values: sessoes.map((s) => (s.sets?.[k]?.weight ?? null)) as (number | null)[],
  }))
  // Filtro da legenda: sem seleção → todas; com seleção → só as escolhidas.
  const sel = shownSeries.filter((k) => k < maxSets)
  const visibleSeries = sel.length === 0 ? lineSeries : lineSeries.filter((_, k) => sel.includes(k))
  // % e Δkg de cada série (1.ª → última sessão com valor).
  const kgFmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))
  const sgn = (n: number) => (n >= 0 ? '+' : '')
  const lineStats = lineSeries.map((ls) => {
    const present = ls.values.filter((v): v is number => v != null)
    if (present.length < 1) return { dkg: 0, pct: 0 }
    const first = present[0], last = present[present.length - 1]
    return { dkg: last - first, pct: first > 0 ? Math.round(((last - first) / first) * 100) : 0 }
  })
  // % e kg totais de FORÇA = variação da 1RM estimada média (Epley) 1.ª → última sessão.
  const e1rms = sessoes.map((s) => s.e1rm ?? 0).filter((x) => x > 0)
  const totKg = e1rms.length ? Math.round(e1rms[e1rms.length - 1] - e1rms[0]) : 0
  const totPct = e1rms.length && e1rms[0] > 0 ? Math.round(((e1rms[e1rms.length - 1] - e1rms[0]) / e1rms[0]) * 100) : 0
  const totTone = totPct > 0 ? 'green' : totPct < 0 ? 'red' : 'neutral'
  // Peso prescrito pelo plano para o exercício selecionado (linha de referência verde).
  const planWeight = progress.find((p) => p.exerciseName === selectedSeries?.exerciseName)?.planWeight ?? null
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
              <p className="text-[13px] text-zinc-500">Peso por série ao longo dos treinos</p>
            </div>
            {loadSeries.length > 0 && (
              <div className="w-full sm:w-56">
                <Combobox
                  value={selectedSeries?.exerciseName ?? ''}
                  onChange={(v) => { setExSel(v); setShownSeries([]) }}
                  options={loadSeries.map((s) => ({ value: s.exerciseName, label: s.exerciseName }))}
                />
              </div>
            )}
          </div>
          {sessoes.length >= 1 ? (
            <>
              {/* Total de força (1RM estimada — Epley): % + kg */}
              <div className="flex items-center gap-2 mb-2">
                <Badge tone={totTone === 'green' ? 'green' : totTone === 'red' ? 'red' : 'neutral'} dot>
                  Força {sgn(totPct)}{totPct}% · {sgn(totKg)}{totKg} kg
                </Badge>
                <span className="text-[11px] text-zinc-400">1RM estimada (média das séries)</span>
              </div>
              <LineChart labels={lineLabels} series={visibleSeries} height={220} format={(n: number) => `${n} kg`} refLine={planWeight && planWeight > 0 ? planWeight : null} refColor="#1F8A5B" refLabel="Plano" />
              {/* Legenda clicável: alterna cada série; sem seleção mostra todas. */}
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                {lineSeries.map((ls, k) => {
                  const on = sel.length === 0 || sel.includes(k)
                  return (
                    <button key={k} type="button" onClick={() => toggleSeries(k)} title="Mostrar/ocultar esta série"
                      className={`flex items-center gap-1.5 text-xs rounded-lg px-1.5 py-0.5 transition ${on ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'opacity-40 hover:opacity-70'}`}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ls.color }} />
                      <span className="text-zinc-600 dark:text-zinc-300">{ls.name}</span>
                      <span className={`tabular-nums font-medium ${lineStats[k].dkg > 0 ? 'text-emerald-600 dark:text-emerald-400' : lineStats[k].dkg < 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                        {sgn(lineStats[k].pct)}{lineStats[k].pct}% · {sgn(lineStats[k].dkg)}{kgFmt(lineStats[k].dkg)} kg
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
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
  workoutId?: string | null       // id do treino já existente no programa (preserva o id ao guardar)
  treinoName: string | null
  treinoContentKey: string | null
  rows: DraftExercise[]           // snapshot do treino; [] = descanso
}

const snapshotRows = (exs: GymWorkoutExercise[]): DraftExercise[] => (exs ?? []).map(dtoToRow)

// Datas (período do plano do cliente) — dois inputs nativos (início/fim), estilo da app.
const todayISO = () => format(new Date(), 'yyyy-MM-dd')
const addDaysISO = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); return format(new Date(y, (m ?? 1) - 1, (d ?? 1) + n), 'yyyy-MM-dd') }
const weeksBetweenISO = (a: string, b: string) => (a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 6048e5)) : 0)
const fmtBR = (iso: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

// Modal: escolher um treino existente (ou criar novo) para um dia
function PickTreinoModal({ open, title, templates, onClose, onPick, onEdit, onCriarNovo }: {
  open: boolean
  title?: string
  templates: GymWorkoutTemplate[]
  onClose: () => void
  onPick: (t: GymWorkoutTemplate) => void
  onEdit: (t: GymWorkoutTemplate) => void
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
  templates: GymWorkoutTemplate[]
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
        workoutId: w?.id ?? null,
        treinoName: w?.name ?? null,
        treinoContentKey: w ? (w.contentKey ?? null) : null,
        rows: w ? snapshotRows(w.exercises ?? []) : [],
      }
    })

  useEffect(() => {
    if (!open) return
    setName(plano?.name ?? '')
    setContentKey(plano?.contentKey ?? null)
    setNote(plano?.note ?? '')
    const m: 'weekly' | 'free' = plano?.mode === 'free' ? 'free' : 'weekly'
    setMode(m)
    if (!plano) {
      setDias(buildWeeklyDays([]))
    } else if (m === 'free') {
      setDias((plano.workouts ?? []).map((w, i) => ({
        uid: newUid(), label: w.dayLabel || `Dia ${i + 1}`, dayIndex: null,
        treinoId: null, treinoName: w.name, treinoContentKey: w.contentKey ?? null,
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
  const assignTreino = (diaUid: string, t: GymWorkoutTemplate) =>
    setDias((d) => d.map((x) => x.uid === diaUid ? {
      ...x, treinoId: t.id, treinoName: t.name, treinoContentKey: t.contentKey ?? null, rows: snapshotRows(t.exercises ?? []),
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
          exercises: d.rows.map(rowToPayload),
        }
      }))
      const body = { name: name.trim(), contentKey: planoKey, note: note || null, mode, workouts }
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
        onEdit={(t) => { if (pickFor) setEditTreino({ diaUid: pickFor, seed: { name: t.name, contentKey: t.contentKey ?? null, rows: snapshotRows(t.exercises ?? []) } }); setPickFor(null) }}
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
  const templates = (templatesData ?? []) as GymWorkoutTemplate[]

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GymPlano | null>(null)
  const [confirmDel, setConfirmDel] = useState<GymPlano | null>(null)
  const [q, setQ] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/planos' }] })
  const remove = useMutation({
    mutationFn: (id: string) => deleteGymPlanosId(id),
    onSuccess: () => { invalidate(); toast.success('Plano eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  const filtered = useMemo(
    () => planos.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [planos, q],
  )
  const pg = usePagination(filtered, { resetKey: q, pageSize: 12 })

  if (open) {
    return <PlanoModal open onClose={() => setOpen(false)} plano={editing} catalog={catalog} templates={templates} onSaved={invalidate} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" className="w-[18px] h-[18px]" /></span>
          <input
            aria-label="Procurar plano"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Procurar plano…"
            className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-transparent rounded-lg text-sm pl-10 pr-3 py-2 focus:bg-white dark:focus:bg-zinc-900 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none text-zinc-800 dark:text-zinc-100"
          />
        </div>
        <p className="text-sm text-zinc-500 sm:ml-auto">{filtered.length} plano{filtered.length === 1 ? '' : 's'} de treino</p>
        <Button icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo plano</Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-zinc-400">A carregar…</Card>
      ) : planos.length === 0 ? (
        <EmptyState icon="folder" title="Sem planos" desc="Cria um plano (conjunto de treinos por dias da semana) e atribui-o a clientes." action={<Button icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo plano</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search" title="Sem resultados" desc="Não há planos que correspondam à pesquisa." />
      ) : (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pg.pageItems.map((p) => {
              const livre = p.mode === 'free'
              return (
                <Card
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { setEditing(p); setOpen(true) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(p); setOpen(true) } }}
                  className="p-3.5 group hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="calendar" className="w-4 h-4" /></span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-zinc-900 dark:text-white truncate" title={p.note || undefined}>{p.name}</h3>
                        <p className="text-xs text-zinc-500 truncate">{livre ? 'Dias livres' : 'Semana fixa'} · {p.workouts.length} treino{p.workouts.length === 1 ? '' : 's'}{p.note ? ` · ${p.note}` : ''}</p>
                      </div>
                    </div>
                    <span onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <IconButton icon="trash" label="Eliminar" onClick={() => setConfirmDel(p)} className="hover:text-red-500 w-7 h-7" />
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {livre
                      ? p.workouts.map((w, i) => (
                          <div key={w.id} className="flex-1 min-w-[32px] rounded-md px-1 py-1 text-center bg-accent/[0.07]" title={w.name}>
                            <p className="text-[9px] font-semibold text-zinc-400 uppercase truncate">{w.dayLabel || `D${i + 1}`}</p>
                            <Icon name="layers" className="w-3 h-3 text-accent mx-auto mt-0.5" />
                          </div>
                        ))
                      : WEEK_DAYS.map((wd) => {
                          const w = p.workouts.find((x) => (x.daysOfWeek ?? []).includes(wd.value))
                          return (
                            <div key={wd.value} className={`flex-1 min-w-[32px] rounded-md px-1 py-1 text-center ${w ? 'bg-accent/[0.07]' : 'bg-zinc-50 dark:bg-zinc-800/40'}`} title={w ? w.name : 'Descanso'}>
                              <p className="text-[9px] font-semibold text-zinc-400 uppercase">{wd.short}</p>
                              {w ? <Icon name="layers" className="w-3 h-3 text-accent mx-auto mt-0.5" /> : <span className="block text-[9px] text-zinc-300 dark:text-zinc-600 mt-0.5">—</span>}
                            </div>
                          )
                        })}
                  </div>
                </Card>
              )
            })}
          </div>
          <Pagination {...pg} />
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

  const totalSeries = rows.reduce((s, r) => s + (r.type === 'time' ? 0 : (r.sets || 0)), 0)
  const gruposUsados = [...new Set(rows.map((r) => r.group))].filter(Boolean)
  const personalizadosCount = rows.filter((r) => isPersonalizado(catalog, r)).length

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

          <ExerciseRowsEditor rows={rows} setRows={setRows} catalog={catalog} />
        </div>

        <div>
          <Card className="p-4 lg:sticky lg:top-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-3">Resumo</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Exercícios</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{rows.length}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Séries totais</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{totalSeries}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Personalizados</span><span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{personalizadosCount}</span></div>
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
  templates: GymWorkoutTemplate[]
  catalog: GymExercise[]
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const { colorOf } = useGymGroups()
  const [name, setName] = useState(program.name ?? '')
  const [contentKey, setContentKey] = useState<string | null>(program.contentKey ?? null)
  const [note, setNote] = useState(program.note ?? '')
  const [mode, setMode] = useState<'weekly' | 'free'>(program.mode === 'free' ? 'free' : 'weekly')
  const [inicio, setInicio] = useState<string>(program.startDate || todayISO())
  const [fim, setFim] = useState<string>(program.endDate || addDaysISO(todayISO(), 84))
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
        workoutId: w?.id ?? null,
        treinoName: w?.name ?? null,
        treinoContentKey: w ? (w.contentKey ?? null) : null,
        rows: w ? snapshotRows(w.exercises ?? []) : [],
      }
    })

  useEffect(() => {
    const m = program.mode === 'free' ? 'free' : 'weekly'
    if (m === 'free') {
      setDias((program.workouts ?? []).map((w, i) => ({
        uid: newUid(), label: w.dayLabel || `Dia ${i + 1}`, dayIndex: null,
        treinoId: null, workoutId: w.id, treinoName: w.name, treinoContentKey: w.contentKey ?? null,
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
  const assignTreino = (diaUid: string, t: GymWorkoutTemplate) =>
    setDias((d) => d.map((x) => x.uid === diaUid ? { ...x, treinoId: t.id, treinoName: t.name, treinoContentKey: t.contentKey ?? null, rows: snapshotRows(t.exercises ?? []) } : x))
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
      await putGymProgramsId(program.id, { name: name.trim(), contentKey: planoKey, note: note || null, mode, startDate: inicio || null, endDate: fim || null })

      // Preserva os ids dos treinos que já existem (PATCH), cria os novos (POST)
      // e apaga os removidos (DELETE). Assim o histórico do cliente (logs por
      // workoutId) e o "treino de hoje" continuam a bater certo após editar.
      const kept = new Set<string>()
      for (const d of diasComTreino) {
        const wkey = await ensureCmsName(d.treinoContentKey, 'gym', d.treinoName?.trim() || 'Treino', defaultLang)
        const body = {
          name: d.treinoName?.trim() || 'Treino', contentKey: wkey,
          daysOfWeek: mode === 'weekly' && d.dayIndex !== null ? [d.dayIndex] : [],
          dayLabel: mode === 'free' ? (d.label.trim() || 'Dia') : null,
          exercises: d.rows.map(rowToPayload),
        }
        if (d.workoutId) {
          await putGymWorkoutsId(d.workoutId, body)
          kept.add(d.workoutId)
        } else {
          await postGymProgramsProgramidWorkouts(program.id, body)
        }
      }
      for (const w of (program.workouts ?? [])) {
        if (!kept.has(w.id)) await deleteGymWorkoutsId(w.id)
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
        onEdit={(t) => { if (pickFor) setEditTreino({ diaUid: pickFor, seed: { name: t.name, contentKey: t.contentKey ?? null, rows: snapshotRows(t.exercises ?? []) } }); setPickFor(null) }}
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
    mutationFn: () => postGymPlanosIdAssign(sel!, { customerId: customer!.customerId, startDate: de || null, endDate: ate || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [{ url: '/gym/programs' }] }); toast.success('Plano atribuído ao cliente'); onSaved(); onClose() },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Modal open={open} onClose={onClose} width="max-w-lg" title="Atribuir plano" subtitle={customer ? `Cliente: ${customer.name}` : ''}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" isLoading={assign.isPending} disabled={!sel || erroData} onClick={() => assign.mutate()}>Guardar</Button></>}>
      <div className="space-y-2 max-h-[42vh] overflow-y-auto -mx-1 px-1">
        {planos.length === 0 && <p className="text-sm text-zinc-400 text-center py-6">Sem planos. Cria um plano primeiro na tab “Planos”.</p>}
        {planos.map((p) => {
          const livre = p.mode === 'free'
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

// Helper para formatar datas em dd/MM/yy
const formatDate = (iso?: string) => iso ? format(new Date(iso + 'T00:00:00'), 'dd/MM/yy') : '—'

// Detalhe do cliente: cabeçalho com ações + dashboard de progresso.
function ClienteProgresso({ customer, onBack, onAtribuir, onEditar }: { customer: Cliente; onBack: () => void; onAtribuir: () => void; onEditar: () => void }) {
  const { data: programsData, isLoading } = useGetGymPrograms({ customerId: customer.customerId }, { query: { enabled: !!customer.customerId } })
  const qc = useQueryClient()
  const programs = ((programsData ?? []) as GymProgram[])
  const active = programs.find((p) => p.active)
  const { data: me } = useGetUsersMe()
  const { colorOf } = useGymGroups()

  const [deleteConfirm, setDeleteConfirm] = useState<GymProgram | null>(null)

  const patchActive = useMutation({
    mutationFn: (id: string) => patchGymProgramsIdActive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [{ url: '/gym/programs' }] })
      toast.success('Plano ativado')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteProgram = useMutation({
    mutationFn: (id: string) => deleteGymProgramsId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [{ url: '/gym/programs' }] })
      setDeleteConfirm(null)
      toast.success('Programa eliminado')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const handlePdf = () => {
    if (!active) return
    const html = buildPlanPrintHtml({
      program: active,
      customerName: customer.name,
      tenant: { name: me?.name, logoUrl: me?.logoUrl },
      colorOf,
    })
    printPlan(html)
  }
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar aos clientes</button>

      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar name={customer.name} size={56} />
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white truncate">{customer.name}</h2>
            <p className="text-sm text-zinc-500">
              {active && active.startDate
                ? `Plano ${formatDate(active.startDate)} → ${formatDate(active.endDate) || 'atual'}`
                : 'Plano e progresso do cliente'}
            </p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
            {active ? <Badge tone="blue" dot>{active.name}</Badge> : <Badge tone="amber" dot>Sem plano</Badge>}
            {active && <Button variant="outline" size="sm" icon="edit" onClick={onEditar}>Editar plano</Button>}
            {active && <Button variant="outline" size="sm" icon="printer" onClick={handlePdf}>PDF do plano</Button>}
            <Button variant={active ? 'ghost' : 'outline'} size="sm" icon="calendar" onClick={onAtribuir}>{active ? 'Mudar plano' : 'Atribuir plano'}</Button>
          </div>
        </div>
      </Card>

      {/* Secção Programas */}
      <Card>
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Programas</h3>
        </div>
        <div>
          {isLoading ? (
            <div className="p-5 text-center text-sm text-zinc-400">A carregar programas…</div>
          ) : programs.length === 0 ? (
            <div className="p-5 text-sm text-zinc-400">Nenhum programa atribuído ainda.</div>
          ) : (
            <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {programs.map((prog) => (
                <div key={prog.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-900 dark:text-white">{prog.name}</p>
                      {prog.active && <Badge tone="blue" dot>Ativo</Badge>}
                    </div>
                    <p className="text-xs text-zinc-400">{formatDate(prog.startDate)} → {formatDate(prog.endDate)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {!prog.active && (
                      <GuardButton
                        size="sm"
                        variant="ghost"
                        icon="check"
                        onClick={() => patchActive.mutate(prog.id)}
                        isLoading={patchActive.isPending}
                        title="Tornar este programa ativo"
                      >
                        Tornar ativo
                      </GuardButton>
                    )}
                    {!prog.active && (
                      <IconButton
                        icon="trash"
                        label="Eliminar programa"
                        className="hover:text-red-500"
                        onClick={() => setDeleteConfirm(prog)}
                      />
                    )}
                    {prog.active && (
                      <span title="Primeiro torna outro programa ativo para podes eliminar este" className="text-xs text-zinc-400">Não é possível eliminar o programa ativo</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ProgressoTab customerId={customer.customerId} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Eliminar programa?"
        description={`Queres eliminar o programa "${deleteConfirm?.name}"? O histórico de treinos registados mantém-se, mas o programa e os seus treinos prescritos desaparecem.`}
        confirmLabel="Eliminar"
        isPending={deleteProgram.isPending}
        onConfirm={() => {
          if (deleteConfirm) deleteProgram.mutate(deleteConfirm.id)
        }}
      />
    </div>
  )
}

// Busca o programa ativo do cliente e abre o editor de plano em ecrã cheio.
function ClientePlanoEditorLoader({ customer, onClose, onAtribuir }: { customer: Cliente; onClose: () => void; onAtribuir?: () => void }) {
  const { data: programsData, isLoading } = useGetGymPrograms({ customerId: customer.customerId }, { query: { enabled: !!customer.customerId } })
  const { data: templatesData } = useGetGymWorkoutTemplates()
  const { data: catalogData } = useGetGymExercises()
  const active = ((programsData ?? []) as GymProgram[]).find((p) => p.active)

  if (isLoading) return <Card className="p-8 text-center text-zinc-400">A carregar plano…</Card>
  if (!active) {
    return (
      <div className="space-y-4">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar ao cliente</button>
        <Card><EmptyState
          icon="calendar"
          title="Sem plano ativo"
          desc="Atribui um plano ao cliente antes de o editares."
          action={onAtribuir ? <Button icon="plus" onClick={onAtribuir}>Atribuir plano</Button> : undefined}
        /></Card>
      </div>
    )
  }
  return (
    <ClientePlanoEditor
      program={active}
      customer={customer}
      templates={(templatesData ?? []) as GymWorkoutTemplate[]}
      catalog={(catalogData ?? []) as GymExercise[]}
      onClose={onClose}
      onSaved={() => {}}
    />
  )
}

// Lista de clientes (T2.5 densidade, batch Ginásio §5/§6): antes cada
// `ClienteCard` disparava 2 pedidos próprios (programas ativos + stats de
// adesão) — com uma centena de clientes isso são ~200 pedidos só para
// desenhar a lista. A linha densa mostra só o que é barato (avatar + nome,
// já disponível de `useGetCustomers`); "Plano ativo"/adesão deixam de
// aparecer na lista e passam a carregar só quando se abre o cliente
// (`ClienteProgresso` já busca o programa ativo próprio, e `ProgressoTab` os
// stats) — lista leve, detalhe pesado só on-demand.
function ClientesTab({ customers }: { customers: Cliente[] }) {
  const [sel, setSel] = useState<Cliente | null>(null)
  const [atribuir, setAtribuir] = useState<Cliente | null>(null)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [q, setQ] = useState('')
  const { data: planosData } = useGetGymPlanos()
  const planos = (planosData ?? []) as GymPlano[]

  const filtered = useMemo(
    () => customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())),
    [customers, q],
  )
  const pg = usePagination(filtered, { resetKey: q })

  // "Editar plano" → editor do programa ativo do cliente em ecrã cheio.
  if (editing) {
    return <ClientePlanoEditorLoader customer={editing} onClose={() => setEditing(null)} onAtribuir={() => { setEditing(null); setAtribuir(editing) }} />
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" className="w-[18px] h-[18px]" /></span>
          <input
            aria-label="Procurar cliente"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Procurar cliente…"
            className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-transparent rounded-lg text-sm pl-10 pr-3 py-2 focus:bg-white dark:focus:bg-zinc-900 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none text-zinc-800 dark:text-zinc-100"
          />
        </div>
        <p className="text-sm text-zinc-500 sm:ml-auto">{filtered.length} cliente{filtered.length === 1 ? '' : 's'}</p>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon="user" title="Sem clientes" desc="Os clientes aparecem aqui para lhes atribuíres planos e veres o progresso." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search" title="Sem resultados" desc="Não há clientes que correspondam à pesquisa." />
      ) : (
        <div>
          <Card className="overflow-hidden divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {pg.pageItems.map((c) => (
              <div
                key={c.customerId}
                role="button"
                tabIndex={0}
                onClick={() => setSel(c)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSel(c) }}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 cursor-pointer"
              >
                <Avatar name={c.name} size={36} />
                <p className="font-medium text-zinc-900 dark:text-white truncate flex-1 min-w-0">{c.name}</p>
                <Button variant="ghost" size="sm" icon="calendar" onClick={(e?: any) => { e?.stopPropagation(); setAtribuir(c) }}>Atribuir plano</Button>
                <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 shrink-0" />
              </div>
            ))}
          </Card>
          <Pagination {...pg} />
        </div>
      )}
      <AtribuirPlanoModal open={!!atribuir} customer={atribuir} planos={planos} onClose={() => setAtribuir(null)} onSaved={() => {}} />
    </div>
  )
}

/**
 * "Ginásio" — cada separador vive na sua própria rota (`/ginasio`,
 * `/ginasio/treinos`, `/ginasio/planos`, `/ginasio/clientes` — T2.5, Fase 2
 * da sidebar com submenus) — a navegação entre vistas já não é feita por
 * `Tabs` de topo, é a sidebar (`NavItemGroup`/`Shell.tsx`); a página só
 * recebe a vista pedida via `view`. A página nunca usou `?tab=` (sem
 * redirect de deep-link legacy a fazer aqui, ao contrário de
 * Loja/Clientes/Financeiro). As mensalidades vivem no Financeiro
 * (`MensalidadesTab` de `GymMensalidade.tsx`, via `FinanceiroPage.tsx`) —
 * o antigo `MensalidadesTab` local (código morto) foi removido em 2026-07-21.
 *
 * Nota do subitem "clientes": o rótulo na sidebar é "Progresso de clientes",
 * não "Clientes" — ver o comentário em `src/lib/navigation.ts` (colisão de
 * nome acessível com o item core `/clientes`).
 */
export function Ginasio({ view }: { view: GinasioView }) {
  const { data: custData } = useGetCustomers()
  const customers = (custData?.rows ?? []) as { customerId: string; name: string }[]
  usePageSubtitle('Exercícios, treinos, planos e progresso dos clientes.')

  return (
    <GymGroupsProvider>
    <div className="space-y-6">
      {view === 'catalogo' && <CatalogoTab />}
      {view === 'treinos' && <TreinosTab />}
      {view === 'planos' && <PlanosTab />}
      {view === 'clientes' && <ClientesTab customers={customers} />}
    </div>
    </GymGroupsProvider>
  )
}
