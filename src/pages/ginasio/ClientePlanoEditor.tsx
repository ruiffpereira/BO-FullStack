import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, IconButton, Input, EmptyState, Avatar } from "../../ui/ui.jsx";
import { useGetGymExercises } from "../../gen/backoffice/hooks/useGetGymExercises.js";
import { useGetGymPrograms, getGymProgramsQueryKey } from "../../gen/backoffice/hooks/useGetGymPrograms.js";
import { postGymProgramsProgramidWorkouts } from "../../gen/backoffice/hooks/usePostGymProgramsProgramidWorkouts.js";
import { putGymProgramsId } from "../../gen/backoffice/hooks/usePutGymProgramsId.js";
import { CmsCombo } from "../../components/CmsCombo";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { ensureCmsName } from "../../lib/gymCms";
import { useGetSettingsLanguages } from "../../hooks/useSettingsLanguages";
import { putGymWorkoutsId } from "../../gen/backoffice/hooks/usePutGymWorkoutsId.js";
import { deleteGymWorkoutsId } from "../../gen/backoffice/hooks/useDeleteGymWorkoutsId.js";
import { useGetGymWorkoutTemplates } from "../../gen/backoffice/hooks/useGetGymWorkoutTemplates.js";
import type { GymExercise } from "../../gen/backoffice/types/GymExercise.js";
import type { GymProgram } from "../../gen/backoffice/types/GymProgram.js";
import type { GymWorkoutTemplate } from "../../gen/backoffice/types/GymWorkoutTemplate.js";
import { DatePicker } from "../../components/DatePicker";
import { Cliente, DiaDraft, DraftExercise, WEEK_DAYS, isPersonalizado, newUid, rowToPayload, snapshotRows } from "./drafts";
import { useGymGroups } from "./groups";
import { ExerciseRowsEditor } from "./TreinosTab";
import { WButton } from "./SetEditors";
import { PickTreinoModal } from "./PlanosTab";

// ─────────────────────────────────────────────────────────────────────────────
// Editor de treino in-memory (ecrã cheio) — edita uma lista de exercícios e
// devolve-a via onSave, sem tocar na biblioteca. Usado pelo editor de plano do
// cliente ("Editar treino" / "Criar treino novo" por dia).
export function DiaTreinoEditor({ initialName, initialContentKey, initialRows, catalog, onSave, onClose }: {
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
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  // Marcar dirty quando há mudanças
  useEffect(() => {
    const changed = name !== initialName || contentKey !== initialContentKey || rows.length !== initialRows.length || rows.some((r, i) => JSON.stringify(r) !== JSON.stringify(initialRows[i]))
    setDirty(changed)
  }, [name, contentKey, rows, initialName, initialContentKey, initialRows])

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

  const totalSeries = rows.reduce((s, r) => s + (r.type === 'time' ? 0 : (r.sets || 0)), 0)
  const gruposUsados = [...new Set(rows.map((r) => r.group))].filter(Boolean)
  const personalizadosCount = rows.filter((r) => isPersonalizado(catalog, r)).length

  return (
    <>
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={handleClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar ao plano</button>
        <div className="sm:ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <GuardButton disabled={!name.trim() || rows.length === 0} onClick={() => { onSave(name, contentKey, rows); setDirty(false) }}>Guardar treino</GuardButton>
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
  const [inicio, setInicio] = useState<string>(program.startDate || '')
  const [fim, setFim] = useState<string>(program.endDate || '')
  const [dias, setDias] = useState<DiaDraft[]>([])
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [editTreino, setEditTreino] = useState<{ diaUid: string; seed?: { name: string; contentKey: string | null; rows: DraftExercise[] } } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const { data: langData } = useGetSettingsLanguages()
  const defaultLang = langData?.default ?? 'pt'

  // Carregados da API: id dos treinos mostrados no editor (para não apagar os não-mostrados no save).
  const [loadedWorkoutIds, setLoadedWorkoutIds] = useState<Set<string>>(new Set())
  // daysOfWeek ORIGINAIS de cada treino carregado — um treino multi-dia mostrado
  // num só dia mantém os seus dias intactos ao guardar (nunca se esmaga o array).
  const originalDaysRef = useRef<Record<string, number[]>>({})
  // Treinos legados não-mostrados (>1 por dia, multi-dia). Mostra-se um aviso ao utilizador.
  const [, setNaoMostrados] = useState<{ id: string; name?: string; reason: string }[]>([])

  const buildWeeklyDays = (workouts: GymProgram['workouts']): DiaDraft[] => {
    // `loaded` = treinos DE FACTO mostrados no editor. O save só pode apagar
    // treinos deste set (loaded && removido pelo utilizador). Tudo o que não
    // couber no editor (2º+ do mesmo dia) fica FORA do set → nunca é apagado.
    const loaded = new Set<string>()
    const result = WEEK_DAYS.map((wd) => {
      const wForDay = (workouts ?? []).filter((x) => (x.daysOfWeek ?? []).includes(wd.value))
      // Um treino multi-dia ocupa só o seu 1.º dia livre; nos dias seguintes o
      // slot fica disponível para o próximo treino ainda não mostrado.
      const w = wForDay.find((x) => !loaded.has(x.id))
      if (w) {
        loaded.add(w.id)
        originalDaysRef.current[w.id] = (w.daysOfWeek ?? []).slice()
      }
      return {
        uid: newUid(), label: wd.label, dayIndex: wd.value, treinoId: null,
        workoutId: w?.id ?? null,
        treinoName: w?.name ?? null,
        treinoContentKey: w ? (w.contentKey ?? null) : null,
        rows: w ? snapshotRows(w.exercises ?? []) : [],
      }
    })
    // O que sobrou (2º+ treino num dia já ocupado em toda a semana): avisar e proteger.
    const notShown = (workouts ?? [])
      .filter((x) => !loaded.has(x.id))
      .map((x) => ({ id: x.id, name: x.name, reason: 'não coube no editor (dia partilhado)' }))
    setLoadedWorkoutIds(loaded)
    setNaoMostrados(notShown)
    return result
  }

  // Baseline do dirty: snapshot do MESMO estado seeded (nunca comparar drafts
  // com DTOs da API — os uids/shapes nunca coincidem e dava dirty perpétuo).
  const dirtyBaseline = useRef<string | null>(null)
  useEffect(() => {
    const m = program.mode === 'free' ? 'free' : 'weekly'
    let seedDias: DiaDraft[]
    if (m === 'free') {
      const loaded = new Set<string>()
      seedDias = (program.workouts ?? []).map((w, i) => {
        loaded.add(w.id)
        originalDaysRef.current[w.id] = (w.daysOfWeek ?? []).slice()
        return {
          uid: newUid(), label: w.dayLabel || `Dia ${i + 1}`, dayIndex: null,
          treinoId: null, workoutId: w.id, treinoName: w.name, treinoContentKey: w.contentKey ?? null,
          rows: snapshotRows(w.exercises ?? []),
        }
      })
      setLoadedWorkoutIds(loaded)
      setNaoMostrados([])
    } else {
      seedDias = buildWeeklyDays(program.workouts ?? [])
    }
    setDias(seedDias)
    dirtyBaseline.current = JSON.stringify({
      n: program.name ?? '', k: program.contentKey ?? null, t: program.note ?? '',
      m, i: program.startDate || '', f: program.endDate || '', d: seedDias,
    })
    setDirty(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Marcar dirty quando há mudanças face ao baseline
  useEffect(() => {
    if (dirtyBaseline.current === null) return
    setDirty(JSON.stringify({ n: name, k: contentKey, t: note, m: mode, i: inicio, f: fim, d: dias }) !== dirtyBaseline.current)
  }, [name, contentKey, note, mode, inicio, fim, dias])

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
      setContentKey(planoKey) // Gravar key de imediato para evitar duplicados em retry

      // Sem defaults silenciosos: o estado arranca das datas reais do programa
      // (ou vazio) — o que estiver nos campos é exatamente o que se grava.
      const startDate = inicio || null
      const endDate = fim || null

      await putGymProgramsId(program.id, { name: name.trim(), contentKey: planoKey, note: note || null, mode, startDate, endDate })

      // Preserva os ids dos treinos que já existem (PATCH), cria os novos (POST)
      // e apaga APENAS os treinos carregados que deixaram de existir. Os treinos
      // não-mostrados (legados) são respeitados e nunca apagados.
      const kept = new Set<string>()
      for (const d of diasComTreino) {
        if (d.workoutId && kept.has(d.workoutId)) continue // nunca 2 PUTs ao mesmo treino
        const wkey = await ensureCmsName(d.treinoContentKey, 'gym', d.treinoName?.trim() || 'Treino', defaultLang)
        setDias((dias) => dias.map((x) => x.uid === d.uid ? { ...x, treinoContentKey: wkey } : x)) // Gravar key no estado
        // Um treino multi-dia mostrado num só slot mantém os daysOfWeek ORIGINAIS
        // (editar o conteúdo não mexe nos dias); treinos de um dia seguem o slot.
        const orig = d.workoutId ? originalDaysRef.current[d.workoutId] : undefined
        const daysOfWeek = mode !== 'weekly' ? []
          : (orig && orig.length > 1) ? orig
          : d.dayIndex !== null ? [d.dayIndex] : []
        const body = {
          name: d.treinoName?.trim() || 'Treino', contentKey: wkey,
          daysOfWeek,
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
      // Apagar APENAS os treinos que foram carregados no editor E deixaram de existir.
      // Os treinos em `naoMostrados` (não-carregados) são sempre respeitados.
      for (const w of (program.workouts ?? [])) {
        if (loadedWorkoutIds.has(w.id) && !kept.has(w.id)) {
          await deleteGymWorkoutsId(w.id)
        }
      }
    },
    // Chave gerada pelo Kubb — garante que continua a bater com a query de leitura
    // (useGetGymPrograms) mesmo que o path mude no spec. Prefixo: invalida também
    // as leituras filtradas por customerId.
    onSuccess: () => { qc.invalidateQueries({ queryKey: getGymProgramsQueryKey() }); toast.success('Plano do cliente atualizado'); onSaved(); onClose() },
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
    <>
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={handleClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar</button>
        <div className="sm:ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <GuardButton isLoading={save.isPending} disabled={!canSave} onClick={() => { save.mutate(); setDirty(false) }}>Guardar plano do cliente</GuardButton>
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
                <WButton type="button" onClick={() => mudarTipo('weekly')} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition ${mode === 'weekly' ? 'border-accent bg-accent/[0.04] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}><Icon name="calendar" className="w-4 h-4" />Semana fixa</WButton>
                <WButton type="button" onClick={() => mudarTipo('free')} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition ${mode === 'free' ? 'border-accent bg-accent/[0.04] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}><Icon name="layers" className="w-4 h-4" />Dias livres</WButton>
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
                    <WButton onClick={() => setPickFor(d.uid)} className="flex-1 flex items-center gap-2 py-1.5 text-sm text-zinc-400 hover:text-accent transition">
                      <Icon name="plus" className="w-4 h-4" />Atribuir treino <span className="text-zinc-300 dark:text-zinc-600">· ou descanso</span>
                    </WButton>
                  )}
                  {mode === 'free' && <GuardIconButton icon="trash" label="Remover dia" onClick={() => removeDia(d.uid)} className="hover:text-red-500" />}
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

// Busca o programa ativo do cliente e abre o editor de plano em ecrã cheio.
export function ClientePlanoEditorLoader({ customer, onClose, onAtribuir }: { customer: Cliente; onClose: () => void; onAtribuir?: () => void }) {
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
          action={onAtribuir ? <GuardButton icon="plus" onClick={onAtribuir}>Atribuir plano</GuardButton> : undefined}
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
