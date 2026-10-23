import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, IconButton, Input, Modal, EmptyState } from "../../ui/ui.jsx";
import { usePagination, Pagination } from "../../components/Pagination";
import { useGetGymExercises } from "../../gen/backoffice/hooks/useGetGymExercises.js";
import { CmsCombo } from "../../components/CmsCombo";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { ensureCmsName } from "../../lib/gymCms";
import { useGetSettingsLanguages } from "../../hooks/useSettingsLanguages";
import { useGetGymWorkoutTemplates } from "../../gen/backoffice/hooks/useGetGymWorkoutTemplates.js";
import { useGetGymPlanos, getGymPlanosQueryKey } from "../../gen/backoffice/hooks/useGetGymPlanos.js";
import { postGymPlanos } from "../../gen/backoffice/hooks/usePostGymPlanos.js";
import { putGymPlanosId } from "../../gen/backoffice/hooks/usePutGymPlanosId.js";
import { deleteGymPlanosId } from "../../gen/backoffice/hooks/useDeleteGymPlanosId.js";
import type { GymPlano } from "../../gen/backoffice/types/GymPlano.js";
import type { GymExercise } from "../../gen/backoffice/types/GymExercise.js";
import type { GymWorkoutTemplate } from "../../gen/backoffice/types/GymWorkoutTemplate.js";
import { useGymGroups } from "./groups";
import { WButton } from "./SetEditors";
import { DiaDraft, DraftExercise, WEEK_DAYS, newUid, rowToPayload, snapshotRows } from "./drafts";
import { DiaTreinoEditor } from "./ClientePlanoEditor";

// Modal: escolher um treino existente (ou criar novo) para um dia
export function PickTreinoModal({ open, title, templates, onClose, onPick, onEdit, onCriarNovo }: {
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
      <WButton onClick={onCriarNovo} className="w-full flex items-center gap-3 p-3 mb-3 rounded-lg border border-dashed border-accent/40 text-accent hover:bg-accent/[0.04] transition">
        <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center"><Icon name="plus" className="w-4 h-4" /></span>
        <span className="text-sm font-medium">Criar treino novo (só para este plano)</span>
      </WButton>
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
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
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

  // Baseline do dirty: snapshot do MESMO estado seeded (nunca comparar drafts
  // com DTOs da API — os uids/shapes nunca coincidem e dava dirty perpétuo).
  const dirtyBaseline = useRef<string | null>(null)
  useEffect(() => {
    if (!open) return
    const seedName = plano?.name ?? ''
    const seedKey = plano?.contentKey ?? null
    const seedNote = plano?.note ?? ''
    const m: 'weekly' | 'free' = plano?.mode === 'free' ? 'free' : 'weekly'
    let seedDias: DiaDraft[]
    if (!plano) {
      seedDias = buildWeeklyDays([])
    } else if (m === 'free') {
      seedDias = (plano.workouts ?? []).map((w, i) => ({
        uid: newUid(), label: w.dayLabel || `Dia ${i + 1}`, dayIndex: null,
        treinoId: null, treinoName: w.name, treinoContentKey: w.contentKey ?? null,
        rows: snapshotRows(w.exercises ?? []),
      }))
    } else {
      seedDias = buildWeeklyDays(plano.workouts ?? [])
    }
    setName(seedName); setContentKey(seedKey); setNote(seedNote); setMode(m); setDias(seedDias)
    setPickFor(null); setEditTreino(null)
    dirtyBaseline.current = JSON.stringify({ n: seedName, k: seedKey, t: seedNote, m, d: seedDias })
    setDirty(false)
  }, [open, plano?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Marcar dirty quando há mudanças face ao baseline
  useEffect(() => {
    if (!open || dirtyBaseline.current === null) return
    setDirty(JSON.stringify({ n: name, k: contentKey, t: note, m: mode, d: dias }) !== dirtyBaseline.current)
  }, [name, contentKey, note, mode, dias, open])

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
      setContentKey(planoKey) // Gravar key de imediato para evitar duplicados em retry

      const workouts = await Promise.all(diasComTreino.map(async (d) => {
        const wkey = await ensureCmsName(d.treinoContentKey, 'gym', d.treinoName?.trim() || 'Treino', defaultLang)
        setDias((dias) => dias.map((x) => x.uid === d.uid ? { ...x, treinoContentKey: wkey } : x)) // Gravar key no estado
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
    // Chave gerada pelo Kubb — garante que continua a bater com a query de leitura
    // (useGetGymPlanos) mesmo que o path mude no spec.
    onSuccess: () => { qc.invalidateQueries({ queryKey: getGymPlanosQueryKey() }); onSaved(); onClose(); toast.success(plano ? 'Plano atualizado' : 'Plano criado') },
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
    <>
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={handleClose} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar aos planos</button>
        <div className="sm:ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <GuardButton isLoading={save.isPending} disabled={!canSave} onClick={() => { save.mutate(); setDirty(false) }}>{plano ? 'Guardar plano' : 'Criar plano'}</GuardButton>
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

export function PlanosTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useGetGymPlanos()
  const planos = useMemo(() => (data ?? []) as GymPlano[], [data])
  const { data: catalogData } = useGetGymExercises()
  const catalog = (catalogData ?? []) as GymExercise[]
  const { data: templatesData } = useGetGymWorkoutTemplates()
  const templates = (templatesData ?? []) as GymWorkoutTemplate[]

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GymPlano | null>(null)
  const [confirmDel, setConfirmDel] = useState<GymPlano | null>(null)
  const [q, setQ] = useState('')

  // Chave gerada pelo Kubb — garante que continua a bater com a query de leitura
  // (useGetGymPlanos) mesmo que o path mude no spec.
  const invalidate = () => qc.invalidateQueries({ queryKey: getGymPlanosQueryKey() })
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
        <GuardButton icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo plano</GuardButton>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-zinc-400">A carregar…</Card>
      ) : planos.length === 0 ? (
        <EmptyState icon="folder" title="Sem planos" desc="Cria um plano (conjunto de treinos por dias da semana) e atribui-o a clientes." action={<GuardButton icon="plus" onClick={() => { setEditing(null); setOpen(true) }}>Novo plano</GuardButton>} />
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
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(p); setOpen(true) } }}
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
                      <GuardIconButton icon="trash" label="Eliminar" onClick={() => setConfirmDel(p)} className="hover:text-red-500 w-7 h-7" />
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

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar plano?"
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
