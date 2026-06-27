import { Card, Badge, BADGE_TONES } from '../../ui/ui.jsx'
import { Icon } from '../../ui/icons.jsx'
import type { Money } from '../../hooks/useFinanceiro'

export const fmtEur = (n: number) =>
  '€' + (n || 0).toLocaleString('pt-PT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })

type Tone = keyof typeof BADGE_TONES

/** Variação % vs período anterior. */
export function DeltaPill({ delta, good = 'up' }: { delta?: number | null; good?: 'up' | 'down' }) {
  if (delta === undefined || delta === null || delta === 0) return null
  const isGood = (delta > 0 && good === 'up') || (delta < 0 && good === 'down')
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
      <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} className="w-3 h-3" />
      {Math.abs(delta)}%
    </span>
  )
}

/** Cartão de KPI único e canónico do Financeiro (substitui as variantes antigas). */
export function KpiCard({ label, value, icon, tone = 'blue', delta, deltaGood = 'up', sub, loading }: {
  label: string; value: string; icon?: string; tone?: Tone
  delta?: number | null; deltaGood?: 'up' | 'down'; sub?: string; loading?: boolean
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        {icon ? (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${BADGE_TONES[tone]}`}>
            <Icon name={icon} className="w-[18px] h-[18px]" />
          </div>
        ) : <span />}
        <DeltaPill delta={delta} good={deltaGood} />
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <p className="text-2xl font-semibold text-zinc-900 dark:text-white mt-3 tabular-nums tracking-tight">{value}</p>
      )}
      <p className="text-[13px] text-zinc-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </Card>
  )
}

/** Bloco "Faturado · Recebido · Em dívida" reutilizável por vertical. */
export function MoneyTriad({ money, loading }: { money?: Money; loading?: boolean }) {
  const items: { label: string; key: keyof Money; tone: string; hint: string }[] = [
    { label: 'Faturado', key: 'faturado', tone: 'text-zinc-900 dark:text-white', hint: 'Vendido no período' },
    { label: 'Recebido', key: 'recebido', tone: 'text-emerald-600 dark:text-emerald-400', hint: 'Entrou em caixa' },
    { label: 'Em dívida', key: 'emDivida', tone: 'text-amber-600 dark:text-amber-400', hint: 'Falta cobrar' },
  ]
  return (
    <Card className="p-5">
      <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800">
        {items.map((it) => (
          <div key={it.key} className="px-2 first:pl-0 last:pr-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{it.label}</p>
              {it.key === 'recebido' && <DeltaPill delta={money?.recebidoGrowth} good="up" />}
            </div>
            {loading ? (
              <div className="mt-2 h-6 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            ) : (
              <p className={`text-xl sm:text-2xl font-semibold tabular-nums tracking-tight mt-1.5 ${it.tone}`}>{fmtEur(money?.[it.key] as number ?? 0)}</p>
            )}
            <p className="text-[11px] text-zinc-400 mt-0.5">{it.hint}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Anel de saúde do negócio (0–100) + fatores que o compõem. */
export function HealthScore({ score, factors }: {
  score: number
  factors: { key: string; label: string; score: number; weight: number; detail: string }[]
}) {
  const tone = score >= 70 ? '#1F8A5B' : score >= 40 ? '#E6B450' : '#DC2626'
  const r = 52, c = 2 * Math.PI * r
  const off = c - (c * Math.max(0, Math.min(100, score))) / 100
  return (
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
          <svg viewBox="0 0 132 132" className="-rotate-90 w-full h-full">
            <circle cx="66" cy="66" r={r} fill="none" strokeWidth="12" className="stroke-zinc-100 dark:stroke-zinc-800" />
            <circle cx="66" cy="66" r={r} fill="none" strokeWidth="12" stroke={tone} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">{Math.round(score)}</span>
            <span className="text-[11px] text-zinc-400">de 100</span>
          </div>
        </div>
        <div className="flex-1 w-full space-y-3">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Saúde do negócio</p>
          {factors.map((f) => (
            <div key={f.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-600 dark:text-zinc-300">{f.label} <span className="text-zinc-400">· {Math.round(f.weight * 100)}%</span></span>
                <span className="text-zinc-500 tabular-nums">{Math.round(f.score)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, f.score)}%`, background: f.score >= 70 ? '#1F8A5B' : f.score >= 40 ? '#E6B450' : '#DC2626' }} />
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">{f.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/** Alternador c/IVA · s/IVA. */
export function VatToggle({ value, onChange }: { value: 'com' | 'sem'; onChange: (v: 'com' | 'sem') => void }) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-white dark:bg-zinc-900">
      {(['com', 'sem'] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2.5 py-1 text-[12px] font-medium rounded-md transition-colors ${value === v ? 'bg-accent text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
          title={v === 'com' ? 'Valores com IVA (preço final)' : 'Valores sem IVA (base)'}
        >
          {v === 'com' ? 'c/ IVA' : 's/ IVA'}
        </button>
      ))}
    </div>
  )
}

/** Pequeno cabeçalho de secção reutilizável. */
export function SubBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  return <Badge tone={tone}>{children}</Badge>
}
