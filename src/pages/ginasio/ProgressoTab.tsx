import { useState } from "react";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, Badge, Modal, BADGE_TONES } from "../../ui/ui.jsx";
import { LineChart, DonutChart } from "../../ui/charts.jsx";
import { useGetGymClientsCustomeridStats } from "../../gen/backoffice/hooks/useGetGymClientsCustomeridStats.js";
import { Combobox } from "../../components/Combobox";
import { useGymGroups } from "./groups";

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

export function ProgressoTab({ customerId }: { customerId: string }) {
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
                  options={loadSeries.map((s) => ({ value: s.exerciseName ?? '', label: s.exerciseName ?? '' }))}
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
