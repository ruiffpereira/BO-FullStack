import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { getApiError } from "../../lib/apiError";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, Badge, Input, Modal, EmptyState } from "../../ui/ui.jsx";
import { usePagination, Pagination } from "../../components/Pagination";
import { useGetGymExercises } from "../../gen/backoffice/hooks/useGetGymExercises.js";
import { CmsCombo } from "../../components/CmsCombo";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { ensureCmsName } from "../../lib/gymCms";
import { useGetSettingsLanguages } from "../../hooks/useSettingsLanguages";
import { useGetGymWorkoutTemplates, getGymWorkoutTemplatesQueryKey } from "../../gen/backoffice/hooks/useGetGymWorkoutTemplates.js";
import { postGymWorkoutTemplates } from "../../gen/backoffice/hooks/usePostGymWorkoutTemplates.js";
import { putGymWorkoutTemplatesId } from "../../gen/backoffice/hooks/usePutGymWorkoutTemplatesId.js";
import { deleteGymWorkoutTemplatesId } from "../../gen/backoffice/hooks/useDeleteGymWorkoutTemplatesId.js";
import type { GymExercise } from "../../gen/backoffice/types/GymExercise.js";
import type { GymWorkoutTemplate } from "../../gen/backoffice/types/GymWorkoutTemplate.js";
import { type MediaItem } from "../../components/MediaGallery";
import { Combobox } from "../../components/Combobox";
import { DraftExercise, SetRowDraft, apiToSetRowDrafts, dtoToRow, isPersonalizado, newUid, presetMatchesRow, presetValues, rowToPayload, setRowsResumo, setRowsToApi } from "./drafts";
import { DragHandle, NumField, Sortable, StrengthFields, WButton } from "./SetEditors";
import { useGymGroups } from "./groups";

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
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><GuardButton icon="check" onClick={save}>Guardar</GuardButton></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <WButton type="button" onClick={() => setType('strength')} className={togCls(type === 'strength')}>Força (séries/reps)</WButton>
          <WButton type="button" onClick={() => setType('time')} className={togCls(type === 'time')}>Tempo (duração)</WButton>
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
export function ExerciseRowsEditor({ rows, setRows, catalog }: {
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
                        <GuardIconButton icon="trash" label="Remover" onClick={() => removeRow(row.uid)} />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-2 pl-10">
                        {presets.length > 0 && (
                          <div className="w-32 shrink-0">
                            <Combobox value={matched?.id ?? ''} onChange={(id) => applyPreset(row.uid, ex!, id)} options={presets.map((p) => ({ value: p.id, label: p.name }))} placeholder="Preset…" searchPlaceholder="Pesquisar…" />
                          </div>
                        )}
                        <span className="text-xs text-zinc-500 tabular-nums">{resumo}</span>
                        {personalizado && <Badge tone="amber" dot>Personalizado</Badge>}
                        <WButton type="button" onClick={() => setAdjust(row)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Icon name="edit" className="w-3.5 h-3.5" />Ajustar p/ este treino</WButton>
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
          <WButton key={e.exerciseId} onClick={() => onAdd(e)} className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-accent hover:bg-accent/[0.03] transition text-left">
            <span className="w-8 h-8 rounded-lg shrink-0" style={{ background: colorOf(e.muscleGroup) }} />
            <div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{e.name}</p><p className="text-xs text-zinc-400">{e.muscleGroup} · {e.presets?.length ?? 0} preset{(e.presets?.length ?? 0) === 1 ? '' : 's'}</p></div>
            <Icon name="plus" className="w-4 h-4 text-accent" />
          </WButton>
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
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  // Baseline do dirty: snapshot do MESMO estado seeded (nunca comparar drafts
  // com DTOs da API — os uids/shapes nunca coincidem e dava dirty perpétuo).
  const dirtyBaseline = useRef<string | null>(null)
  useEffect(() => {
    if (!open) return
    const seedName = template?.name ?? ''
    const seedKey = template?.contentKey ?? null
    const seedRows = (template?.exercises ?? []).map(dtoToRow)
    setName(seedName)
    setContentKey(seedKey)
    setRows(seedRows)
    dirtyBaseline.current = JSON.stringify({ n: seedName, k: seedKey, r: seedRows })
    setDirty(false)
  }, [open, template?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Marcar dirty quando há mudanças face ao baseline
  useEffect(() => {
    if (!open || dirtyBaseline.current === null) return
    setDirty(JSON.stringify({ n: name, k: contentKey, r: rows }) !== dirtyBaseline.current)
  }, [name, contentKey, rows, open])

  // beforeunload enquanto dirty
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const handleClose = () => {
    if (dirty) {
      setConfirmClose(true)
    } else {
      onClose()
    }
  }

  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: async () => {
      const key = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      setContentKey(key) // Gravar key de imediato para evitar duplicados em retry
      const body = { name: name.trim(), contentKey: key, exercises: rows.map(rowToPayload) }
      if (template) return putGymWorkoutTemplatesId(template.id, body)
      return postGymWorkoutTemplates(body)
    },
    onSuccess: (result) => {
      // Chave gerada pelo Kubb — garante que continua a bater com a query de
      // leitura (useGetGymWorkoutTemplates) mesmo que o path mude no spec.
      qc.invalidateQueries({ queryKey: getGymWorkoutTemplatesQueryKey() })
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
    <>
    <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button onClick={handleClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar aos treinos</button>
          <div className="sm:ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
            <GuardButton isLoading={save.isPending} disabled={!name.trim() || rows.length === 0} onClick={() => { save.mutate(); setDirty(false) }}>{template ? 'Guardar treino' : 'Criar treino'}</GuardButton>
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
    <ConfirmDialog
      open={confirmClose}
      onClose={() => setConfirmClose(false)}
      title="Descartar alterações?"
      description="O que editaste aqui perde-se."
      confirmLabel="Descartar"
      variant="warning"
      onConfirm={() => {
        setConfirmClose(false)
        setDirty(false)
        onClose()
      }}
    />
    </>
  )
}

// Reusable workout templates tab ("Dia de Treino" na sidebar — cada item É um
// dia de treino reutilizável, conjunto de exercícios sem dias fixos).
export function TreinosTab() {
  const qc = useQueryClient()
  const { colorOf } = useGymGroups()
  const { data, isLoading } = useGetGymWorkoutTemplates()
  const templates = useMemo(() => (data ?? []) as GymWorkoutTemplate[], [data])
  const { data: catalogData } = useGetGymExercises()
  const catalog = (catalogData ?? []) as GymExercise[]

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GymWorkoutTemplate | null>(null)
  const [confirmDel, setConfirmDel] = useState<GymWorkoutTemplate | null>(null)
  const [q, setQ] = useState('')

  const remove = useMutation({
    mutationFn: (id: string) => deleteGymWorkoutTemplatesId(id),
    // Chave gerada pelo Kubb — garante que continua a bater com a query de leitura
    // (useGetGymWorkoutTemplates) mesmo que o path mude no spec.
    onSuccess: () => { qc.invalidateQueries({ queryKey: getGymWorkoutTemplatesQueryKey() }); toast.success('Treino eliminado') },
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
        <GuardButton icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo dia de treino</GuardButton>
      </div>
      {isLoading ? (
        <Card className="p-8 text-center text-zinc-400">A carregar…</Card>
      ) : templates.length === 0 ? (
        <EmptyState icon="folder" title="Sem dias de treino" desc="Cria dias de treino reutilizáveis (conjuntos de exercícios) para usar nos Planos e atribuir aos clientes." action={<GuardButton icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo dia de treino</GuardButton>} />
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
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(t); setOpen(true) } }}
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
                  <GuardIconButton icon="trash" label="Eliminar" onClick={() => setConfirmDel(t)} className="hover:text-red-500" />
                </span>
                <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 shrink-0" />
              </div>
            ))}
          </Card>
          <Pagination {...pg} />
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar treino?"
        description={<>Tens a certeza que queres eliminar <strong>{confirmDel?.name}</strong>? Esta ação não pode ser revertida.</>}
        confirmLabel="Eliminar"
        isPending={remove.isPending}
        onConfirm={() => {
          if (confirmDel) remove.mutate(confirmDel.id);
        }}
      />
    </div>
  )
}
