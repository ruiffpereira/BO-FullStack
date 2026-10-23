import { useNavigate } from "react-router-dom";
import { Icon } from "../../ui/icons.jsx";
import { Card, Badge, SectionTitle } from "../../ui/ui.jsx";
import { fmtEur } from "../../lib/money";
import { RowLink } from "./shared";
import type { GymFinance } from "../../gen/backoffice/types/GymFinance.js";

// Derivado do gerado (nunca à mão).
export type { GymFinance };

// ── Gym: mensalidades (recebido vs previsto + quem está em atraso) ────────────

export function gymDerive(fin?: GymFinance) {
  const k = fin?.kpis
  const previsto = k?.mrr ?? 0
  const recebido = k?.recebido ?? 0
  const pct = previsto > 0 ? Math.min(100, Math.round((recebido / previsto) * 100)) : 0
  const porCobrar = Math.max(0, previsto - recebido)
  const overdue = (fin?.rows ?? []).filter((r) => r.overdue)
  return { previsto, recebido, pct, porCobrar, emAtraso: k?.emAtraso ?? 0, mrr: previsto, overdue }
}

function GymProgress({ recebido, previsto, pct }: { recebido: number; previsto: number; pct: number }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[26px] leading-none font-semibold text-zinc-900 dark:text-white tabular-nums tracking-tight">
          {fmtEur(recebido)}
          <span className="text-base font-normal text-zinc-400"> / {fmtEur(previsto)}</span>
        </p>
        <span className="text-sm font-semibold text-zinc-500 tabular-nums">{pct}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function GymCobrancasSpine({ fin, monthLabel, loading }: { fin?: GymFinance; monthLabel: string; loading?: boolean }) {
  const { recebido, previsto, pct, porCobrar, emAtraso, mrr, overdue } = gymDerive(fin)
  if (loading) return <div className="space-y-3 py-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />)}</div>
  return (
    <div>
      <SectionTitle right={<span className="text-xs text-zinc-400">Mensalidades</span>}>Cobranças · {monthLabel}</SectionTitle>
      <GymProgress recebido={recebido} previsto={previsto} pct={pct} />

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 py-2.5">
          <p className="text-xs text-zinc-400">Por cobrar</p>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 tabular-nums">{fmtEur(porCobrar)}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 py-2.5">
          <p className="text-xs text-zinc-400">Em atraso</p>
          <p className={`text-sm font-semibold tabular-nums ${emAtraso ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-100'}`}>{emAtraso}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 py-2.5">
          <p className="text-xs text-zinc-400">MRR</p>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 tabular-nums">{fmtEur(mrr)}</p>
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle right={overdue.length > 6 ? <span className="text-xs text-zinc-400">+{overdue.length - 6}</span> : undefined}>
          Em atraso
        </SectionTitle>
        {overdue.length === 0 ? (
          <p className="text-sm text-zinc-400 py-2">Tudo em dia — ninguém em atraso este mês. ✓</p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {overdue.slice(0, 6).map((r) => (
              <RowLink key={r.customerId} to={`/clientes?cliente=${encodeURIComponent(r.customerId)}`} ariaLabel={`Abrir ficha de ${r.name}`}>
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-medium text-zinc-900 dark:text-white truncate group-hover/row:text-accent">{r.name}</span>
                <Badge tone="red">Em atraso</Badge>
              </RowLink>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function GymMiniCard({ fin, monthLabel }: { fin?: GymFinance; monthLabel: string }) {
  const navigate = useNavigate()
  const { recebido, previsto, pct, emAtraso } = gymDerive(fin)
  return (
    <Card className="p-5">
      <SectionTitle right={
        <button type="button" onClick={() => navigate('/financeiro/ginasio')} className="text-xs text-accent hover:underline px-2 py-1 -mr-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">Ver cobranças</button>
      }>
        Ginásio · {monthLabel}
      </SectionTitle>
      <GymProgress recebido={recebido} previsto={previsto} pct={pct} />
      {emAtraso > 0 && (
        <button
          type="button"
          onClick={() => navigate('/financeiro/ginasio')}
          className="mt-3 w-full flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-left"
        >
          <Icon name="alertTriangle" className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300 font-medium">{emAtraso} cliente{emAtraso === 1 ? '' : 's'} em atraso</span>
        </button>
      )}
    </Card>
  )
}
