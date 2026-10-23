import { type ReactNode, type HTMLAttributes } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "../../ui/icons.jsx";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import { SetRowDraft, SetStepDraft, emptySetRow } from "./drafts";

// Wrapper genérico de item arrastável (render-prop para posicionar a pega)
export function Sortable({
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

/**
 * <button> cru de ESCRITA (B41 2b): respeita o billing read-only e o "só ver" da equipa, como o `GuardButton`, mas
 * sem mudar o aspecto do botão cru. Desactivado: `disabled`, sem clique e com o motivo no `title`.
 */
export function WButton({ disabled, title, onClick, className = '', children, ...rest }: any) {
  const { readOnly, message } = useWriteGuard()
  return (
    <button
      {...rest}
      type={rest.type ?? 'button'}
      disabled={disabled || readOnly}
      aria-disabled={disabled || readOnly || undefined}
      title={readOnly ? message : title}
      onClick={readOnly ? undefined : onClick}
      className={`${className} ${readOnly ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
    >
      {children}
    </button>
  )
}

export const DragHandle = (props: HTMLAttributes<HTMLElement>) => {
  const { readOnly, message } = useWriteGuard()
  // Só ver: a pega continua visível mas sem os listeners do arrasto.
  return (
    <button
      {...(readOnly ? {} : props)}
      type="button"
      disabled={readOnly}
      className={`flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 touch-none transition-colors ${readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'}`}
      title={readOnly ? message : 'Arrastar para reordenar'}
    >
      <Icon name="grip" className="w-4 h-4" />
    </button>
  )
}

// Campo numérico opcional (vazio = não se aplica, ex: alongamentos)
export function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
              <WButton type="button" onClick={() => toggleDrop(i)} title={r.drop ? 'Tornar série normal' : 'Tornar série composta (dropset)'} className={`w-6 h-6 flex items-center justify-center rounded ${r.drop ? 'text-amber-500' : 'text-zinc-400 hover:text-accent'}`}><Icon name="layers" className="w-3.5 h-3.5" /></WButton>
              {rows.length > 1 && <WButton type="button" onClick={() => delRow(i)} title="Remover série" className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500"><Icon name="trash" className="w-3.5 h-3.5" /></WButton>}
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
                  <div className="flex justify-center">{r.steps.length > 1 && <WButton type="button" onClick={() => delStep(i, j)} title="Remover passo" className="w-5 h-6 flex items-center justify-center text-zinc-400 hover:text-red-500"><Icon name="x" className="w-3 h-3" /></WButton>}</div>
                </div>
              ))}
              <div className="flex justify-end items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-zinc-400">Após série (s)</span>
                <input type="number" min={0} value={r.rest} onChange={(e) => setRow(i, { rest: e.target.value })} className={SET_NUM_CLS + ' w-16'} />
              </div>
              <WButton type="button" onClick={() => addStep(i)} className="w-full py-1.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 text-[12px] text-zinc-500 hover:border-accent hover:text-accent transition flex items-center justify-center gap-1.5"><Icon name="plus" className="w-3 h-3" />Adicionar passo</WButton>
            </div>
          )}
        </div>
      ))}
      <WButton type="button" onClick={addRow} className="w-full mt-1 py-1.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 text-[13px] text-zinc-500 hover:border-accent hover:text-accent transition flex items-center justify-center gap-1.5"><Icon name="plus" className="w-3.5 h-3.5" />Adicionar série</WButton>
    </div>
  )
}

// Bloco partilhado de campos de prescrição de força/tempo (com toggle série-a-série),
// usado tanto no editor de preset do catálogo como no "Ajustar p/ este treino".
export function StrengthFields({
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
          <WButton type="button" onClick={() => onMode('uniform')} className={`px-2.5 py-1 rounded-md font-medium transition ${mode === 'uniform' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}>Iguais</WButton>
          <WButton type="button" onClick={goPerSet} className={`px-2.5 py-1 rounded-md font-medium transition ${mode === 'perSet' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}>Série a série</WButton>
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
