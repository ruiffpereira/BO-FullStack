import type { GymExercise } from "../../gen/backoffice/types/GymExercise.js";
import type { GymExercisePreset } from "../../gen/backoffice/types/GymExercisePreset.js";
import type { GymSetRow } from "../../gen/backoffice/types/GymSetRow.js";
import type { GymWorkoutExercise } from "../../gen/backoffice/types/GymWorkoutExercise.js";
import { type MediaItem } from "../../components/MediaGallery";
import { format } from "date-fns";

// Série-a-série: cada série tem reps/peso/descanso próprios (campos string p/ vazio).
// Série composta (dropset): drop=true + passos; `rest` é o descanso após a série toda.
export type SetStepDraft = { reps: string; weight: string; rest: string }
export type SetRowDraft = { reps: string; weight: string; rest: string; drop: boolean; steps: SetStepDraft[] }

// Preset em edição no formulário (campos como string para permitir vazio = "—").
// type 'strength' = séries/reps/peso · 'time' = duração (ex: prancha, mobilidade).
// mode 'uniform' = séries iguais · 'perSet' = série-a-série (usa `setRows`, com dropsets).
export type PresetDraft = { id: string; name: string; contentKey: string | null; type: 'strength' | 'time'; mode: 'uniform' | 'perSet'; sets: string; reps: string; weight: string; rest: string; duration: string; notes: string; setRows: SetRowDraft[] }
export const emptyPreset = (): PresetDraft => ({ id: newUid(), name: '', contentKey: null, type: 'strength', mode: 'uniform', sets: '', reps: '', weight: '', rest: '', duration: '', notes: '', setRows: [] })

// Mínimo para um preset poder ser guardado: nome + trabalho real prescrito —
// duração>0 (tempo) ou séries+reps (força, uniform ou série-a-série). Evita
// criar/guardar um exercício com presets "vazios" (só o nome, sem prescrição).
export function presetIsComplete(p: PresetDraft): boolean {
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
export const emptySetRow = (seed?: { reps?: string; weight?: string; rest?: string }): SetRowDraft => ({
  reps: seed?.reps || '10', weight: seed?.weight || '0', rest: seed?.rest || '60', drop: false, steps: [],
})
export function setRowsToApi(rows: SetRowDraft[]): GymSetRow[] {
  return rows.map((r) =>
    r.drop
      ? { drop: true, reps: numOr0(r.steps[0]?.reps ?? ''), weight: numOr0(r.steps[0]?.weight ?? ''), rest: numOr0(r.rest), steps: r.steps.map((s) => ({ reps: numOr0(s.reps), weight: numOr0(s.weight), rest: numOr0(s.rest) })) }
      : { drop: false, reps: numOr0(r.reps), weight: numOr0(r.weight), rest: numOr0(r.rest), steps: [] },
  )
}
export function apiToSetRowDrafts(rows?: GymSetRow[] | null): SetRowDraft[] {
  return (rows ?? []).map((r) => ({
    reps: r.reps != null ? String(r.reps) : '',
    weight: r.weight != null ? String(r.weight) : '',
    rest: r.rest != null ? String(r.rest) : '',
    drop: !!r.drop,
    steps: (r.steps ?? []).map((s) => ({ reps: s.reps != null ? String(s.reps) : '', weight: s.weight != null ? String(s.weight) : '', rest: s.rest != null ? String(s.rest) : '' })),
  }))
}
// Resumo legível de uma prescrição série-a-série.
export function setRowsResumo(rows: GymSetRow[]): string {
  if (!rows.length) return '–'
  const parts = rows.map((r) => (r.drop ? (r.steps ?? []).map((s) => s.reps ?? 0).join('-') + '↓' : `${r.reps ?? 0}`))
  const weights = rows.flatMap((r) => (r.drop ? (r.steps ?? []).map((s) => s.weight) : [r.weight])).filter((w): w is number => w != null && w > 0)
  let wTxt = ''
  if (weights.length) { const mn = Math.min(...weights), mx = Math.max(...weights); wTxt = mn === mx ? ` · ${mn}kg` : ` · ${mn}-${mx}kg` }
  return `${rows.length} séries (${parts.join(' · ')})${wTxt}`
}

export type DraftExercise = {
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
export const newUid = () => `d${Date.now()}_${draftSeq++}`

// ── Dias da semana (0=Dom … 6=Sáb, ordem de apresentação a começar na Segunda) ──
export const WEEK_DAYS: { value: number; short: string; label: string }[] = [
  { value: 1, short: 'Seg', label: 'Segunda' },
  { value: 2, short: 'Ter', label: 'Terça' },
  { value: 3, short: 'Qua', label: 'Quarta' },
  { value: 4, short: 'Qui', label: 'Quinta' },
  { value: 5, short: 'Sex', label: 'Sexta' },
  { value: 6, short: 'Sáb', label: 'Sábado' },
  { value: 0, short: 'Dom', label: 'Domingo' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Valores prescritos a partir de um preset (com fallbacks). Mantém-se editável.
export const presetValues = (p?: GymExercisePreset): Partial<DraftExercise> => {
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
export const dtoToRow = (e: GymWorkoutExercise): DraftExercise => ({
  uid: newUid(), exerciseId: e.exerciseId ?? null, name: e.name, group: e.group, subGroup: e.subGroup ?? null,
  type: e.type === 'time' ? 'time' : 'strength',
  mode: e.mode === 'perSet' ? 'perSet' : 'uniform',
  sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest ?? 60,
  duration: e.duration ?? 0, notes: e.notes ?? null,
  setRows: e.setRows ?? null,
  media: (e.media ?? []) as MediaItem[],
})
// Serializa uma linha editável para o payload de exercício da API (com setRows).
export const rowToPayload = (r: DraftExercise) => ({
  exerciseId: r.exerciseId, name: r.name, group: r.group, subGroup: r.subGroup ?? null,
  type: r.type, mode: r.mode, sets: r.sets, reps: r.reps, weight: r.weight, rest: r.rest,
  duration: r.duration, notes: r.notes, setRows: r.setRows ?? null, media: r.media,
})

// ─────────────────────────────────────────────────────────────────────────────
// "Personalizado" = a prescrição da linha não corresponde a nenhum preset do
// exercício (foi ajustada à mão para este treino). Comparamos com os valores que
// aplicar o preset produziria (presetValues), para um preset aplicado coincidir.
export function presetMatchesRow(p: GymExercisePreset, r: DraftExercise): boolean {
  const pv = presetValues(p)
  if (pv.type !== r.type) return false
  if (r.type === 'time') return pv.duration === r.duration && pv.rest === r.rest
  if ((pv.mode === 'perSet') !== (r.mode === 'perSet')) return false
  if (pv.mode === 'perSet') return JSON.stringify(pv.setRows ?? []) === JSON.stringify(r.setRows ?? [])
  return pv.sets === r.sets && pv.reps === r.reps && pv.weight === r.weight && pv.rest === r.rest
}
export function isPersonalizado(catalog: GymExercise[], r: DraftExercise): boolean {
  const ex = catalog.find((c) => c.exerciseId === r.exerciseId)
  const presets = ex?.presets ?? []
  return presets.length > 0 && !presets.some((p) => presetMatchesRow(p, r))
}

// ─────────────────────────────────────────────────────────────────────────────
// Planos — modelo dia-cêntrico: cada dia (semana fixa: Seg…Dom; livre: Dia N)
// atribui um Treino existente (snapshot reutilizado) ou fica descanso. Os
// exercícios não se editam aqui — cria-se/escolhe-se um Treino da biblioteca.
export type DiaDraft = {
  uid: string
  label: string
  dayIndex: number | null         // semana: 0..6 (0=Dom); livre: null
  treinoId: string | null         // template de origem (para "treinos distintos")
  workoutId?: string | null       // id do treino já existente no programa (preserva o id ao guardar)
  treinoName: string | null
  treinoContentKey: string | null
  rows: DraftExercise[]           // snapshot do treino; [] = descanso
}

export const snapshotRows = (exs: GymWorkoutExercise[]): DraftExercise[] => (exs ?? []).map(dtoToRow)

// Datas (período do plano do cliente) — dois inputs nativos (início/fim), estilo da app.
export const todayISO = () => format(new Date(), 'yyyy-MM-dd')
export const addDaysISO = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); return format(new Date(y, (m ?? 1) - 1, (d ?? 1) + n), 'yyyy-MM-dd') }
export const weeksBetweenISO = (a: string, b: string) => (a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 6048e5)) : 0)
export const fmtBR = (iso: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

// ─────────────────────────────────────────────────────────────────────────────
// Clientes — lista de cards → detalhe (ClienteProgresso) + atribuir/editar plano.
// O "plano ativo do cliente" = o Programa ativo (snapshot). "Editar plano" abre
// o editor do programa em ecrã cheio; "Atribuir/Mudar plano" copia um Plano.
export type Cliente = { customerId: string; name: string }

// Helper para formatar datas em dd/MM/yy
export const formatDate = (iso?: string | null) => iso ? format(new Date(iso + 'T00:00:00'), 'dd/MM/yy') : '—'
