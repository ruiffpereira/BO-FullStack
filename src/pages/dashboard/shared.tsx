import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../ui/icons.jsx";
import { Card, BADGE_TONES } from "../../ui/ui.jsx";
import { Sparkline } from "../../ui/charts.jsx";

export const STATUS_PT: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmada', completed: 'Concluída', cancelled: 'Cancelada',
}
export const STATUS_TONE: Record<string, string> = {
  pending: 'amber', confirmed: 'blue', completed: 'green', cancelled: 'red',
}
export const DONE = new Set(['completed', 'cancelled'])

// Encomendas ainda por despachar (não enviadas / não canceladas).
export const OPEN_ORDER = new Set(['pending', 'processing'])

// HH:mm[:ss] → minutes since midnight
export const toMin = (t: string) => {
  const [h, m] = t.split(':')
  return Number(h) * 60 + Number(m)
}

// ── KPI ───────────────────────────────────────────────────────────────────
export type Kpi = {
  label: string; value: string | number; sub?: string
  icon: string; tone: keyof typeof BADGE_TONES; loading?: boolean
  delta?: number; spark?: number[]; href?: string
}

export function KpiCard({ label, value, sub, icon, tone, loading, delta, spark, href }: Kpi) {
  const navigate = useNavigate()
  const body = (
    <Card className={`p-4 flex flex-col h-full ${href ? 'group-hover/kpi:border-accent/40 transition-colors' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${BADGE_TONES[tone]}`}>
          <Icon name={icon} className="w-4 h-4" />
        </div>
        {delta !== undefined && delta !== 0 && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} className="w-3 h-3" />
            {Math.abs(delta)}
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <p className="text-[26px] leading-none font-semibold text-zinc-900 dark:text-white mt-3 tabular-nums tracking-tight">{value}</p>
      )}
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {/* Com mini-gráfico o espaço é curto (390): o texto quebra em vez de ser cortado com «…». */}
          <p className={`text-[13px] text-zinc-500 ${spark ? "break-words" : "truncate"}`}>{label}</p>
          {sub && <p className={`text-xs text-zinc-400 mt-0.5 ${spark ? "break-words" : "truncate"}`}>{sub}</p>}
        </div>
        {spark && spark.some((v) => v > 0) && (
          <Sparkline data={spark} color="#2A6FDB" width={64} height={26} up={delta === undefined || delta >= 0} />
        )}
      </div>
    </Card>
  )
  if (!href) return body
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      aria-label={`${label}: ${value}`}
      className="group/kpi text-left w-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {body}
    </button>
  )
}

// ── Clickable row helper (em atraso / encomendas) ─────────────────────────────
export function RowLink({ to, children, ariaLabel }: { to: string; children: ReactNode; ariaLabel: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      aria-label={ariaLabel}
      className="group/row w-full text-left flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
    >
      {children}
    </button>
  )
}
