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
import { Card, Button, IconButton, Badge, Input, Select, Modal, PageHeader, EmptyState } from '../ui/ui.jsx'
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
import { putGymWorkoutsId } from '../gen/backoffice/hooks/usePutGymWorkoutsId.js'
import { deleteGymWorkoutsId } from '../gen/backoffice/hooks/useDeleteGymWorkoutsId.js'
import { useGetGymWorkoutTemplates } from '../gen/backoffice/hooks/useGetGymWorkoutTemplates.js'
import { postGymWorkoutTemplates } from '../gen/backoffice/hooks/usePostGymWorkoutTemplates.js'
import { putGymWorkoutTemplatesId } from '../gen/backoffice/hooks/usePutGymWorkoutTemplatesId.js'
import { deleteGymWorkoutTemplatesId } from '../gen/backoffice/hooks/useDeleteGymWorkoutTemplatesId.js'
import { postGymWorkoutTemplatesIdAssign } from '../gen/backoffice/hooks/usePostGymWorkoutTemplatesIdAssign.js'
import { useGetGymClientsCustomeridStats } from '../gen/backoffice/hooks/useGetGymClientsCustomeridStats.js'
import { useGetGymClientsCustomeridLogs } from '../gen/backoffice/hooks/useGetGymClientsCustomeridLogs.js'
import { useGetGymMuscleGroups } from '../gen/backoffice/hooks/useGetGymMuscleGroups.js'
import { postGymMuscleGroups } from '../gen/backoffice/hooks/usePostGymMuscleGroups.js'
import { putGymMuscleGroupsId } from '../gen/backoffice/hooks/usePutGymMuscleGroupsId.js'
import { deleteGymMuscleGroupsId } from '../gen/backoffice/hooks/useDeleteGymMuscleGroupsId.js'
import type { GymExercise } from '../gen/backoffice/types/GymExercise.js'
import type { GymMuscleGroup } from '../gen/backoffice/types/GymMuscleGroup.js'
import type { GymProgram } from '../gen/backoffice/types/GymProgram.js'
import type { GymWorkout } from '../gen/backoffice/types/GymWorkout.js'
import { MediaGallery, type MediaItem } from '../components/MediaGallery'
import { Combobox } from '../components/Combobox'

// ── Contexto dos grupos musculares (carregados da API) ───────────────────────
type GymGroupsCtx = { groups: GymMuscleGroup[]; names: string[]; colorOf: (name?: string) => string }
const GymGroupsContext = createContext<GymGroupsCtx>({ groups: [], names: [], colorOf: () => '#6B7280' })
const useGymGroups = () => useContext(GymGroupsContext)

function GymGroupsProvider({ children }: { children: ReactNode }) {
  const { data } = useGetGymMuscleGroups()
  const groups = (data ?? []) as GymMuscleGroup[]
  const value = useMemo<GymGroupsCtx>(() => {
    const colorMap = new Map(groups.map((g) => [g.name, g.color]))
    return {
      groups,
      names: groups.map((g) => g.name),
      colorOf: (name?: string) => (name && colorMap.get(name)) || '#6B7280',
    }
  }, [groups])
  return <GymGroupsContext.Provider value={value}>{children}</GymGroupsContext.Provider>
}

type Tab = 'programas' | 'catalogo' | 'treinos' | 'progresso'

type DraftExercise = {
  uid: string
  exerciseId?: string | null
  name: string
  group: string
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
  const { groups } = useGymGroups()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3B82F6')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#3B82F6')

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/muscle-groups' }] })

  const create = useMutation({
    mutationFn: () => postGymMuscleGroups({ name: newName.trim(), color: newColor }),
    onSuccess: () => { invalidate(); setNewName(''); toast.success('Grupo criado') },
    onError: (e) => toast.error(getApiError(e)),
  })
  const saveEdit = useMutation({
    mutationFn: (id: string) => putGymMuscleGroupsId(id, { name: editName.trim(), color: editColor }),
    onSuccess: () => { invalidate(); setEditId(null); toast.success('Grupo atualizado') },
    onError: (e) => toast.error(getApiError(e)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteGymMuscleGroupsId(id),
    onSuccess: () => { invalidate(); toast.success('Grupo eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <Modal open={open} onClose={onClose} title="Grupos musculares" footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="space-y-4">
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.muscleGroupId} className="flex items-center gap-2">
              {editId === g.muscleGroupId ? (
                <>
                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-8 h-8 rounded border-0 bg-transparent p-0 cursor-pointer shrink-0" />
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:border-accent" />
                  <Button size="sm" isLoading={saveEdit.isPending} disabled={!editName.trim()} onClick={() => saveEdit.mutate(g.muscleGroupId)}>Guardar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: g.color }} />
                  <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 truncate">{g.name}</span>
                  <IconButton icon="edit" label="Editar" onClick={() => { setEditId(g.muscleGroupId); setEditName(g.name); setEditColor(g.color) }} />
                  <IconButton icon="trash" label="Eliminar" onClick={() => remove.mutate(g.muscleGroupId)} />
                </>
              )}
            </div>
          ))}
          {groups.length === 0 && <p className="text-sm text-zinc-400 text-center py-2">Ainda não há grupos.</p>}
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex items-end gap-2">
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-9 h-9 rounded border-0 bg-transparent p-0 cursor-pointer shrink-0" title="Cor do grupo" />
          <Input label="Novo grupo" value={newName} onChange={(ev: any) => setNewName(ev.target.value)} placeholder="Ex: Antebraço" className="flex-1" />
          <Button icon="plus" isLoading={create.isPending} disabled={!newName.trim()} onClick={() => create.mutate()}>Adicionar</Button>
        </div>
      </div>
    </Modal>
  )
}

function CatalogoTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useGetGymExercises()
  const exercises = (data ?? []) as GymExercise[]
  const { names, colorOf } = useGymGroups()

  const [open, setOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [editing, setEditing] = useState<GymExercise | null>(null)
  const [name, setName] = useState('')
  const [group, setGroup] = useState<string>('')
  const [active, setActive] = useState(true)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [dSets, setDSets] = useState('')
  const [dReps, setDReps] = useState('')
  const [dRest, setDRest] = useState('')
  const [dWeight, setDWeight] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/exercises' }] })

  const startCreate = () => {
    setEditing(null); setName(''); setGroup(names[0] ?? ''); setActive(true)
    setMedia([]); setDSets(''); setDReps(''); setDRest(''); setDWeight(''); setOpen(true)
  }
  const startEdit = (e: GymExercise) => {
    setEditing(e); setName(e.name); setGroup(e.muscleGroup); setActive(e.active ?? true)
    setMedia((e.media ?? []) as MediaItem[])
    setDSets(e.defaultSets != null ? String(e.defaultSets) : '')
    setDReps(e.defaultReps != null ? String(e.defaultReps) : '')
    setDRest(e.defaultRest != null ? String(e.defaultRest) : '')
    setDWeight(e.defaultWeight != null ? String(e.defaultWeight) : '')
    setOpen(true)
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(), muscleGroup: group, active, media,
        defaultSets: dSets === '' ? null : Number(dSets),
        defaultReps: dReps === '' ? null : Number(dReps),
        defaultRest: dRest === '' ? null : Number(dRest),
        defaultWeight: dWeight === '' ? null : Number(dWeight),
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
                      {!e.active && <Badge tone="neutral">Inactivo</Badge>}
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
          <Input label="Nome" value={name} onChange={(ev: any) => setName(ev.target.value)} placeholder="Ex: Supino inclinado" />
          <Select label="Grupo muscular" value={group} onChange={(ev: any) => setGroup(ev.target.value)}>
            {names.length === 0 && <option value="">(cria um grupo primeiro)</option>}
            {names.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
          <MediaGallery value={media} onChange={setMedia} module="gym" />
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <NumField label="Séries" value={dSets} onChange={setDSets} />
              <NumField label="Reps" value={dReps} onChange={setDReps} />
              <NumField label="Descanso (s)" value={dRest} onChange={setDRest} />
              <NumField label="Peso sug. (kg)" value={dWeight} onChange={setDWeight} />
            </div>
            <p className="text-xs text-zinc-400 mt-1">Deixa em branco o que não se aplica (ex: alongamentos sem peso ou reps).</p>
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
// Workout editor modal (create/edit a workout with exercises)
function WorkoutModal({ open, onClose, programId, workout, catalog, onSaved }: {
  open: boolean
  onClose: () => void
  programId: string
  workout: GymWorkout | null
  catalog: GymExercise[]
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [days, setDays] = useState<number[]>([])
  const [rows, setRows] = useState<DraftExercise[]>([])
  const [picker, setPicker] = useState<string>('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Reset when (re)opened or when editing a different workout
  useEffect(() => {
    if (!open) return
    setName(workout?.name ?? '')
    setDays(workout?.daysOfWeek ?? [])
    setRows(
      (workout?.exercises ?? []).map((e) => ({
        uid: newUid(),
        exerciseId: e.exerciseId ?? null, name: e.name, group: e.group,
        sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
        media: ((e as any).media ?? []) as MediaItem[],
      })),
    )
    setPicker('')
  }, [open, workout?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const addFromCatalog = () => {
    const ex = catalog.find((c) => c.exerciseId === picker)
    if (!ex) return
    setRows((r) => [...r, {
      uid: newUid(),
      exerciseId: ex.exerciseId, name: ex.name, group: ex.muscleGroup,
      sets: ex.defaultSets ?? 3, reps: ex.defaultReps ?? 10,
      weight: ex.defaultWeight ?? 0, rest: ex.defaultRest ?? 60,
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
      const body = { name: name.trim(), daysOfWeek: days, exercises: rows }
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={workout ? 'Editar treino' : 'Novo treino'}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button isLoading={save.isPending} disabled={!name.trim() || rows.length === 0} onClick={() => save.mutate()}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Nome do treino" value={name} onChange={(ev: any) => setName(ev.target.value)} placeholder="Ex: Push A" />

        <DaySelector value={days} onChange={setDays} />

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select label="Adicionar exercício do catálogo" value={picker} onChange={(ev: any) => setPicker(ev.target.value)}>
              <option value="">Escolher exercício…</option>
              {catalog.filter((c) => c.active !== false).map((c) => (
                <option key={c.exerciseId} value={c.exerciseId}>{c.name} · {c.muscleGroup}</option>
              ))}
            </Select>
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
                          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1 truncate">{row.name}</span>
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
  const [rows, setRows] = useState<DraftExercise[]>([])
  const [picker, setPicker] = useState<string>('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (!open) return
    setName(template?.name ?? '')
    setRows(
      (template?.exercises ?? []).map((e) => ({
        uid: newUid(),
        exerciseId: e.exerciseId ?? null, name: e.name, group: e.group,
        sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
        media: ((e as any).media ?? []) as MediaItem[],
      })),
    )
    setPicker('')
  }, [open, template?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const addFromCatalog = () => {
    const ex = catalog.find((c) => c.exerciseId === picker)
    if (!ex) return
    setRows((r) => [...r, {
      uid: newUid(),
      exerciseId: ex.exerciseId, name: ex.name, group: ex.muscleGroup,
      sets: ex.defaultSets ?? 3, reps: ex.defaultReps ?? 10,
      weight: ex.defaultWeight ?? 0, rest: ex.defaultRest ?? 60,
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
      const body = { name: name.trim(), exercises: rows } as any
      if (template) return putGymWorkoutTemplatesId(template.id, body)
      return postGymWorkoutTemplates(body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [{ url: '/gym/workout-templates' }] })
      onSaved(); onClose()
      toast.success(template ? 'Grupo de treino atualizado' : 'Grupo de treino criado')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <Modal open={open} onClose={onClose} title={template ? 'Editar grupo de treino' : 'Novo grupo de treino'} width="max-w-2xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button isLoading={save.isPending} disabled={!name.trim() || rows.length === 0} onClick={() => save.mutate()}>Guardar</Button></>}>
      <div className="space-y-4">
        <Input label="Nome do treino" value={name} onChange={(ev: any) => setName(ev.target.value)} placeholder="Ex: Push A" />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select label="Adicionar exercício do catálogo" value={picker} onChange={(ev: any) => setPicker(ev.target.value)}>
              <option value="">Escolher exercício…</option>
              {catalog.filter((c) => c.active !== false).map((c) => (
                <option key={c.exerciseId} value={c.exerciseId}>{c.name} · {c.muscleGroup}</option>
              ))}
            </Select>
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
                          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1 truncate">{row.name}</span>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: [{ url: '/gym/workout-templates' }] }); toast.success('Grupo de treino eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{templates.length} grupo{templates.length === 1 ? '' : 's'} de treino reutilizáveis</p>
        <Button icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo grupo de treino</Button>
      </div>
      {isLoading ? (
        <Card className="p-8 text-center text-zinc-400">A carregar…</Card>
      ) : templates.length === 0 ? (
        <EmptyState icon="folder" title="Sem grupos de treino" desc="Cria grupos de treino reutilizáveis e atribui-os aos clientes na tab Programas." action={<Button icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo grupo de treino</Button>} />
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

  const [newProgOpen, setNewProgOpen] = useState(false)
  const [progName, setProgName] = useState('')
  const [workoutModal, setWorkoutModal] = useState<{ programId: string; workout: GymWorkout | null } | null>(null)
  const [assignProgramId, setAssignProgramId] = useState<string | null>(null)
  const [assignTemplateId, setAssignTemplateId] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: [{ url: '/gym/programs' }] })
  const assign = useMutation({
    mutationFn: () => postGymWorkoutTemplatesIdAssign(assignTemplateId, { programId: assignProgramId! }),
    onSuccess: () => { invalidate(); setAssignProgramId(null); setAssignTemplateId(''); toast.success('Treino atribuído ao cliente') },
    onError: (e) => toast.error(getApiError(e)),
  })

  const createProgram = useMutation({
    mutationFn: () => postGymPrograms({ name: progName.trim(), customerId, owner: 'coach' }),
    onSuccess: () => { invalidate(); setNewProgOpen(false); setProgName(''); toast.success('Programa criado') },
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
        <Button icon="plus" onClick={() => setNewProgOpen(true)}>Atribuir programa</Button>
      </div>

      {ordered.length === 0 ? (
        <EmptyState icon="folder" title="Sem programas" desc="Cria um programa de treino e atribui-o a este cliente." action={<Button icon="plus" onClick={() => setNewProgOpen(true)}>Atribuir programa</Button>} />
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
                        <span className="text-xs text-zinc-400">{p.workouts.length} treino{p.workouts.length === 1 ? '' : 's'}</span>
                        <div className="ml-auto flex items-center gap-1">
                          {p.owner === 'coach' && (
                            <>
                              <Button size="sm" variant="ghost" icon="layers" onClick={() => { setAssignProgramId(p.id); setAssignTemplateId('') }}>Template</Button>
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
        subtitle="Cria um grupo de treino para este cliente (só leitura na app dele)."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewProgOpen(false)}>Cancelar</Button>
            <Button isLoading={createProgram.isPending} disabled={!progName.trim()} onClick={() => createProgram.mutate()}>Criar</Button>
          </>
        }
      >
        <Input label="Nome do programa" value={progName} onChange={(ev: any) => setProgName(ev.target.value)} placeholder="Ex: Treino 1" />
      </Modal>

      {workoutModal && (
        <WorkoutModal
          open
          onClose={() => setWorkoutModal(null)}
          programId={workoutModal.programId}
          workout={workoutModal.workout}
          catalog={catalog}
          onSaved={invalidate}
        />
      )}

      <Modal
        open={assignProgramId !== null}
        onClose={() => setAssignProgramId(null)}
        title="Atribuir grupo de treino"
        subtitle="Copia um grupo de treino reutilizável para este programa do cliente."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignProgramId(null)}>Cancelar</Button>
            <Button isLoading={assign.isPending} disabled={!assignTemplateId} onClick={() => assign.mutate()}>Atribuir</Button>
          </>
        }
      >
        {templates.length === 0 ? (
          <p className="text-sm text-zinc-400">Ainda não há grupos de treino. Cria um na tab “Treinos”.</p>
        ) : (
          <Combobox
            value={assignTemplateId}
            onChange={setAssignTemplateId}
            options={templates.map((t) => ({ value: t.id, label: `${t.name} · ${t.exercises.length} exercícios` }))}
            placeholder="Escolher grupo de treino…"
            searchPlaceholder="Pesquisar…"
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
export function Ginasio() {
  const [tab, setTab] = useState<Tab>('programas')
  const [customerId, setCustomerId] = useState('')
  const { data: custData } = useGetCustomers()
  const customers = (custData?.rows ?? []) as { customerId: string; name: string }[]

  const tabs: { key: Tab; label: string; icon: string; needsClient: boolean }[] = [
    { key: 'programas', label: 'Programas', icon: 'folder', needsClient: true },
    { key: 'catalogo', label: 'Catálogo', icon: 'grid', needsClient: false },
    { key: 'treinos', label: 'Treinos', icon: 'layers', needsClient: false },
    { key: 'progresso', label: 'Progresso', icon: 'trend', needsClient: true },
  ]

  return (
    <GymGroupsProvider>
    <div className="space-y-6">
      <PageHeader title="Ginásio" subtitle="Catálogo de exercícios, programas atribuídos e progresso dos clientes." />

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
      {tab === 'programas' && (customerId ? <ProgramasTab customerId={customerId} /> : <EmptyState icon="user" title="Escolhe um cliente" desc="Selecciona um cliente para gerir os seus programas de treino." />)}
      {tab === 'progresso' && (customerId ? <ProgressoTab customerId={customerId} /> : <EmptyState icon="user" title="Escolhe um cliente" desc="Selecciona um cliente para ver o seu progresso." />)}
    </div>
    </GymGroupsProvider>
  )
}
