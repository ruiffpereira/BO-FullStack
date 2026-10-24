// Contagens de marcações do painel (ES-15). Só apresentação sobre a lista da agenda; as canceladas nunca contam.
// Datas em 'yyyy-MM-dd' (dia de Lisboa, como a agenda as entrega).

export type ApptLike = { date: string; status?: string }

/** Marcações de um dia, sem as canceladas («Marcações hoje» e «tudo confirmado»). */
export function apptsOfDay<T extends ApptLike>(appts: T[], day: string): T[] {
  return appts.filter((a) => a.date === day && a.status !== 'cancelled')
}

/** Série diária (sem canceladas) dos `days` dias que terminam em `days[days.length-1]`; o total é o dos 14 e a
 *  variação compara a segunda metade com a primeira. */
export function windowSeries(appts: ApptLike[], days: string[]) {
  const counts: Record<string, number> = {}
  for (const a of appts) if (a.status !== 'cancelled') counts[a.date] = (counts[a.date] ?? 0) + 1
  const series = days.map((d) => counts[d] ?? 0)
  const half = Math.floor(series.length / 2)
  const first = series.slice(0, series.length - half).reduce((s, v) => s + v, 0)
  const last = series.slice(series.length - half).reduce((s, v) => s + v, 0)
  return { series, total: first + last, delta: last - first }
}
