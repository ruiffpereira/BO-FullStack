import { useMemo } from "react";
import { format } from "date-fns";
import { Icon } from "../../ui/icons.jsx";
import { Badge, EmptyState } from "../../ui/ui.jsx";
import { DONE, STATUS_PT, STATUS_TONE, toMin } from "./shared";

// ── Agenda spine: the day as a spine ─────────────────────────────────────────
export type Appt = { appointmentId: string; date: string; time: string; serviceId?: string | null; serviceName: string; clientName: string; status?: string }

export function DayRail({ appts, colorOf, now }: {
  appts: Appt[]; colorOf: (id?: string | null) => string; now: Date
}) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const sorted = useMemo(() => [...appts].sort((a, b) => a.time.localeCompare(b.time)), [appts])

  // The next thing the operator actually has to do.
  const next = useMemo(
    () => sorted.find((a) => toMin(a.time) >= nowMin && !DONE.has(a.status ?? '')),
    [sorted, nowMin],
  )
  const nextInMin = next ? toMin(next.time) - nowMin : null

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Dia livre"
        desc="Sem marcações para hoje. Quando entrarem reservas, aparecem aqui em linha do tempo."
      />
    )
  }

  // Index at which the "agora" marker should sit among the appointments.
  const nowIndex = sorted.findIndex((a) => toMin(a.time) > nowMin)
  const markerAt = nowIndex === -1 ? sorted.length : nowIndex

  return (
    <div>
      {/* Próximo — the one decision that matters right now */}
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-accent/5 dark:bg-accent/10 border border-accent/15 px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
          <Icon name="clock" className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0">
          {next ? (
            <>
              <p className="text-[13px] text-zinc-500">
                Próximo {nextInMin !== null && nextInMin >= 0
                  ? <span className="text-accent font-medium">· {nextInMin === 0 ? 'agora' : `em ${nextInMin} min`}</span>
                  : null}
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                {next.time.slice(0, 5)} · {next.clientName}
                <span className="font-normal text-zinc-500"> — {next.serviceName}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-zinc-500">Dia concluído</p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Sem mais marcações por hoje</p>
            </>
          )}
        </div>
      </div>

      {/* Timeline rail */}
      <ol className="relative">
        {sorted.map((a, i) => {
          const isNext = next?.appointmentId === a.appointmentId
          const past = DONE.has(a.status ?? '') || toMin(a.time) < nowMin
          const col = colorOf(a.serviceId)
          return (
            <li key={a.appointmentId}>
              {i === markerAt && <NowMarker time={now} />}
              <div className="relative flex gap-3 pb-3 last:pb-0">
                <time className={`w-11 shrink-0 pt-0.5 text-right text-[13px] font-mono tabular-nums ${past ? 'text-zinc-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                  {a.time.slice(0, 5)}
                </time>
                <div className="relative flex flex-col items-center">
                  <span
                    className="mt-1 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-zinc-900 shrink-0"
                    style={{ background: col }}
                  />
                  {i < sorted.length - 1 && <span className="flex-1 w-px bg-zinc-200 dark:bg-zinc-800" />}
                </div>
                <div className={`flex-1 min-w-0 rounded-lg px-3 py-2 -my-0.5 transition-colors ${
                  isNext
                    ? 'bg-accent/5 dark:bg-accent/10 ring-1 ring-accent/20'
                    : past ? 'opacity-60' : ''
                }`}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate flex-1">{a.clientName}</p>
                    <Badge tone={(STATUS_TONE[a.status ?? ''] as any) ?? 'neutral'}>
                      {STATUS_PT[a.status ?? ''] ?? a.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{a.serviceName}</p>
                </div>
              </div>
            </li>
          )
        })}
        {markerAt === sorted.length && <NowMarker time={now} trailing />}
      </ol>
    </div>
  )
}

function NowMarker({ time, trailing = false }: { time: Date; trailing?: boolean }) {
  return (
    <div className={`relative flex items-center gap-3 ${trailing ? 'pt-1' : 'py-1'}`}>
      <span className="w-11 shrink-0 text-right text-[11px] font-mono font-semibold text-accent tabular-nums">
        {format(time, 'HH:mm')}
      </span>
      <span className="relative flex items-center justify-center w-2.5">
        <span className="absolute w-2.5 h-2.5 rounded-full bg-accent/30 animate-ping motion-reduce:animate-none" />
        <span className="relative w-2 h-2 rounded-full bg-accent ring-4 ring-white dark:ring-zinc-900" />
      </span>
      <span className="flex items-center gap-2 flex-1">
        <span className="h-px flex-1 bg-gradient-to-r from-accent/40 to-transparent" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">agora</span>
      </span>
    </div>
  )
}
