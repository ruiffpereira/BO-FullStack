import { useState, useMemo } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, IconButton, Badge, Input, Modal, EmptyState } from "../../ui/ui.jsx";
import { usePagination, Pagination } from "../../components/Pagination";
import { useGetGymExercises, getGymExercisesQueryKey } from "../../gen/backoffice/hooks/useGetGymExercises.js";
import { postGymExercises } from "../../gen/backoffice/hooks/usePostGymExercises.js";
import { putGymExercisesId } from "../../gen/backoffice/hooks/usePutGymExercisesId.js";
import { deleteGymExercisesId } from "../../gen/backoffice/hooks/useDeleteGymExercisesId.js";
import { CmsCombo } from "../../components/CmsCombo";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { ensureCmsName } from "../../lib/gymCms";
import { useGetSettingsLanguages } from "../../hooks/useSettingsLanguages";
import { getGymMuscleGroupsQueryKey } from "../../gen/backoffice/hooks/useGetGymMuscleGroups.js";
import { postGymMuscleGroups } from "../../gen/backoffice/hooks/usePostGymMuscleGroups.js";
import { putGymMuscleGroupsId } from "../../gen/backoffice/hooks/usePutGymMuscleGroupsId.js";
import { deleteGymMuscleGroupsId } from "../../gen/backoffice/hooks/useDeleteGymMuscleGroupsId.js";
import type { GymExercise } from "../../gen/backoffice/types/GymExercise.js";
import type { GymExercisePreset } from "../../gen/backoffice/types/GymExercisePreset.js";
import { type MediaItem, MediaGallery, uploadPendingMedia } from "../../components/MediaGallery";
import { Combobox } from "../../components/Combobox";
import { Group, randomColor, useGymGroups } from "./groups";
import { PresetDraft, apiToSetRowDrafts, emptyPreset, newUid, presetIsComplete, setRowsResumo, setRowsToApi } from "./drafts";
import { NumField, StrengthFields, WButton } from "./SetEditors";

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
  const [editingSub, setEditingSub] = useState<string | null>(null)

  // Chave gerada pelo Kubb — garante que continua a bater com a query de leitura
  // (useGetGymMuscleGroups) mesmo que o path mude no spec.
  const invalidate = () => qc.invalidateQueries({ queryKey: getGymMuscleGroupsQueryKey() })
  const addSub = () => { if (!novoSubName.trim()) return; setSubs((s) => [...s, { uid: newUid(), name: novoSubName.trim(), contentKey: novoSubKey }]); setNovoSubName(''); setNovoSubKey(null) }
  const delSub = (sd: SubDraft) => {
    if (sd.muscleGroupId) setRemovedIds((r) => [...r, sd.muscleGroupId!])
    setSubs((s) => s.filter((x) => x.uid !== sd.uid))
  }
  const renameSub = (uid: string, newName: string) => {
    setSubs((s) => s.map((x) => x.uid === uid ? { ...x, name: newName.trim() || x.name } : x))
    setEditingSub(null)
  }

  const save = useMutation({
    mutationFn: async () => {
      const key = await ensureCmsName(contentKey, 'gym', name, defaultLang)
      setContentKey(key) // Gravar key de imediato para evitar duplicados em retry

      let groupId = grupo?.muscleGroupId
      if (grupo) {
        await putGymMuscleGroupsId(grupo.muscleGroupId, { name: name.trim(), color, contentKey: key })
      } else {
        const created = await postGymMuscleGroups({ name: name.trim(), color, contentKey: key })
        groupId = created.muscleGroupId
      }
      // Atualiza subgrupos existentes + cria novos.
      for (const sd of subs) {
        if (sd.muscleGroupId) {
          // Subgrupo existente: permitir renomear
          const sk = await ensureCmsName(sd.contentKey ?? null, 'gym', sd.name, defaultLang)
          setSubs((s) => s.map((x) => x.uid === sd.uid ? { ...x, contentKey: sk } : x)) // Gravar key
          await putGymMuscleGroupsId(sd.muscleGroupId, { name: sd.name.trim(), color, contentKey: sk })
        } else {
          // Novo subgrupo: criar
          const sk = await ensureCmsName(sd.contentKey ?? null, 'gym', sd.name, defaultLang)
          setSubs((s) => s.map((x) => x.uid === sd.uid ? { ...x, contentKey: sk } : x)) // Gravar key
          await postGymMuscleGroups({ name: sd.name.trim(), color, parentId: groupId, contentKey: sk })
        }
      }
      // Apaga os subgrupos removidos.
      for (const id of removedIds) await deleteGymMuscleGroupsId(id)
    },
    onSuccess: () => { invalidate(); onClose(); toast.success(grupo ? 'Grupo atualizado' : 'Grupo criado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!grupo?.muscleGroupId) return
      await deleteGymMuscleGroupsId(grupo.muscleGroupId)
    },
    onSuccess: () => { invalidate(); onClose(); toast.success('Grupo eliminado') },
    onError: (e) => toast.error(getApiError(e)),
  })

  const [confirmDelGrupo, setConfirmDelGrupo] = useState(false)

  return (
    <>
      <Modal open onClose={onClose} width="max-w-md" title={grupo ? 'Editar grupo muscular' : 'Novo grupo muscular'} subtitle="Define o grupo, a cor e os subgrupos."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            {grupo && <GuardButton variant="danger" icon="trash" onClick={() => setConfirmDelGrupo(true)}>Eliminar grupo</GuardButton>}
            <GuardButton icon="check" isLoading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate()}>{grupo ? 'Guardar' : 'Criar'}</GuardButton>
          </>
        }>
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
                <div key={s.uid} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  {editingSub === s.uid ? (
                    <input
                      autoFocus
                      value={s.name}
                      onChange={(e) => setSubs((ss) => ss.map((x) => x.uid === s.uid ? { ...x, name: e.target.value } : x))}
                      onBlur={() => renameSub(s.uid, s.name)}
                      onKeyDown={(e) => { if (e.key === 'Enter') renameSub(s.uid, s.name); if (e.key === 'Escape') setEditingSub(null) }}
                      className="text-sm bg-transparent text-zinc-700 dark:text-zinc-200 focus:outline-none border-b border-zinc-300 dark:border-zinc-600"
                    />
                  ) : (
                    <WButton type="button" onClick={() => setEditingSub(s.uid)} className="text-sm text-zinc-700 dark:text-zinc-200 hover:opacity-70">
                      {s.name}
                    </WButton>
                  )}
                  <WButton type="button" onClick={() => delSub(s)} className="text-zinc-400 hover:text-red-500 text-base leading-none">×</WButton>
                </div>
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

      <ConfirmDialog
        open={confirmDelGrupo}
        onClose={() => setConfirmDelGrupo(false)}
        title="Eliminar grupo muscular?"
        description={`Tens a certeza que queres eliminar "${grupo?.name}"? Os subgrupos também serão eliminados, mas os exercícios mantêm o nome em snapshot.`}
        onConfirm={() => { deleteMutation.mutate(); setConfirmDelGrupo(false) }}
        isPending={deleteMutation.isPending}
      />
    </>
  )
}

// Miniatura da linha de exercício: 1.ª media (imagem/frame de vídeo) quando
// existir, com contador se houver mais; sem media, mantém o quadrado de cor
// do grupo (comportamento de sempre).
function ExerciseThumb({ media, fallbackColor }: { media?: GymExercise['media']; fallbackColor: string }) {
  const first = media?.[0]
  if (!first) return <span className="w-9 h-9 rounded-lg shrink-0" style={{ background: fallbackColor }} />
  return (
    <span className="relative w-9 h-9 rounded-lg shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
      {first.type === 'image' ? (
        <img src={first.url} alt="" className="w-full h-full object-cover" />
      ) : (
        <>
          <video src={first.url} className="w-full h-full object-cover" muted preload="metadata" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/10">
            <Icon name="play" className="w-3.5 h-3.5 text-white drop-shadow" />
          </span>
        </>
      )}
      {media!.length > 1 && (
        <span className="absolute bottom-0 right-0 text-[8px] leading-tight px-1 rounded-tl bg-black/60 text-white">
          +{media!.length - 1}
        </span>
      )}
    </span>
  )
}

export function CatalogoTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useGetGymExercises()
  const exercises = useMemo(() => (data ?? []) as GymExercise[], [data])
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
  const [media, setMedia] = useState<MediaItem[]>([])
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

  // Chave gerada pelo Kubb — garante que continua a bater com a query de leitura
  // (useGetGymExercises) mesmo que o path mude no spec.
  const invalidate = () => qc.invalidateQueries({ queryKey: getGymExercisesQueryKey() })

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
    setPresets([]); setMedia([]); setPresetEdit({ form: emptyPreset(), isNew: true }); setOpen(true)
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
    // Carregar media do exercício (não é editável em linha, só visual).
    setMedia((e.media as MediaItem[]) ?? [])
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
          setPresets((ps) => ps.map((x) => x.id === p.id ? { ...x, contentKey: pk } : x)) // Gravar key no estado
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
      setContentKey(key) // Gravar key de imediato para evitar duplicados em retry

      // Upload de media pendente (upload diferido).
      const finalMedia = await uploadPendingMedia(media, 'gym')
      setMedia(finalMedia) // Gravar media finais no estado

      const body = {
        // O exercício fica sempre visível na app do cliente (sem toggle de ativo/inativo).
        name: name.trim(), contentKey: key, muscleGroupId: groupId, subGroupId: subGroupId || null, active: true, media: finalMedia,
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
            <GuardIconButton icon="plus" label="Novo grupo" onClick={() => setGrupoModal({ group: null })} className="w-7 h-7" />
          </div>
          <div className="space-y-0.5">
            <button onClick={() => setGrupoSel('todos')} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${grupoSel === 'todos' ? 'bg-accent/10 text-accent' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <Icon name="grid" className="w-4 h-4" />Todos
              <span className="ml-auto text-xs text-zinc-400 tabular-nums">{exercises.length}</span>
            </button>
            {topGroups.map((g) => (
              <div key={g.muscleGroupId} className={`flex items-center gap-1 rounded-lg transition ${grupoSel === g.muscleGroupId ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                <button onClick={() => setGrupoSel(g.muscleGroupId)} className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium flex-1 min-w-0 text-left ${grupoSel === g.muscleGroupId ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(g.name) }} />
                  <span className="truncate">{g.name}</span>
                </button>
                <div onClick={(e) => e.stopPropagation()} className="opacity-60 hover:opacity-100 transition">
                  <IconButton icon="edit" label="Editar grupo" onClick={() => setGrupoModal({ group: g })} className="w-6 h-6" />
                </div>
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
            <GuardButton icon="plus" onClick={startCreate}>Novo exercício</GuardButton>
          </div>

          {isLoading ? (
            <Card className="p-8 text-center text-zinc-400">A carregar…</Card>
          ) : filtered.length === 0 ? (
            <EmptyState icon="box" title="Sem exercícios" desc="Cria exercícios para os usar nos treinos dos clientes." action={<GuardButton icon="plus" onClick={startCreate}>Novo exercício</GuardButton>} />
          ) : (
            <>
            <div className="space-y-2">
              {pg.pageItems.map((e) => (
                <Card key={e.exerciseId} className="overflow-hidden">
                  <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30" onClick={() => startEdit(e)}>
                    <ExerciseThumb media={e.media} fallbackColor={colorOf(e.muscleGroup)} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-white truncate">{e.name}</p>
                      <p className="text-xs text-zinc-400">{e.muscleGroup}{e.subGroup ? ` · ${e.subGroup}` : ''}</p>
                    </div>
                    <Badge tone="neutral">{e.presets?.length ?? 0} preset{(e.presets?.length ?? 0) === 1 ? '' : 's'}</Badge>
                    <span onClick={(ev) => ev.stopPropagation()} className="flex items-center gap-1">
                      <IconButton icon="edit" label="Editar" onClick={() => startEdit(e)} />
                      <GuardIconButton icon="trash" label="Eliminar" className="hover:text-red-500" onClick={() => setConfirmDel(e)} />
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
            <GuardButton
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
            </GuardButton>
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
                <GuardButton
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
                </GuardButton>
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
                    <GuardIconButton icon="trash" label="Remover preset" onClick={() => setPresets((ps) => ps.filter((x) => x.id !== p.id))} />
                  </div>
                ))}
              </div>
            )}

            {presetEdit && (
              <div className="border border-accent/30 bg-accent/[0.02] rounded-xl p-3 space-y-3">
                <p className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">{presetEdit.isNew ? 'Novo preset' : 'Editar preset'}</p>
                <div className="grid grid-cols-2 gap-2">
                  <WButton type="button" onClick={() => setEditField({ type: 'strength' })} className={togCls(presetEdit.form.type === 'strength')}>Força (séries/reps)</WButton>
                  <WButton type="button" onClick={() => setEditField({ type: 'time' })} className={togCls(presetEdit.form.type === 'time')}>Tempo (duração)</WButton>
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

          {/* Media (imagens/vídeos) com upload diferido */}
          <MediaGallery value={media} onChange={setMedia} />
        </div>
      </Modal>

      {grupoModal && <GrupoModal grupo={grupoModal.group} onClose={() => setGrupoModal(null)} />}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar exercício?"
        description={<>Tens a certeza que queres eliminar <strong>{confirmDel?.name}</strong>? Esta ação não pode ser revertida.</>}
        confirmLabel="Eliminar"
        isPending={remove.isPending}
        onConfirm={() => {
          if (confirmDel) remove.mutate(confirmDel.exerciseId);
        }}
      />
    </>
  )
}
