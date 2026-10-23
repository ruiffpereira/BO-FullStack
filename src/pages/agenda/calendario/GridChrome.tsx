import { isSameDay } from "date-fns";
import { AG_H_END, AG_H_START, AG_ROW_H, DAY_NAMES } from "../geometry";

/** Cabeçalho dos dias (sticky). */
export function GridHeader({ days }: { days: Date[] }) {
  return (
            <div
              className="grid sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800"
              style={{ gridTemplateColumns: `48px repeat(6, 1fr)` }}
            >
              <div />
              {days.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className={`px-2 py-2 text-center border-l border-zinc-50 dark:border-zinc-800/50 ${isToday ? "bg-accent/[0.06] dark:bg-accent/[0.10]" : ""}`}
                  >
                    <p
                      className={`text-xs uppercase tracking-wide ${isToday ? "text-accent font-semibold" : "text-zinc-400"}`}
                    >
                      {DAY_NAMES[day.getDay()]}
                    </p>
                    <div className="flex justify-center mt-0.5">
                      <span
                        className={`text-lg font-semibold leading-none w-8 h-8 flex items-center justify-center rounded-full ${isToday ? "bg-accent text-white" : "text-zinc-800 dark:text-zinc-100"}`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
  );
}

/** Coluna das horas à esquerda da grelha. */
export function HourLabels({ hours }: { hours: number[] }) {
  return (
              <div>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="text-right pr-2 text-[10px] text-zinc-400 tabular-nums"
                    style={{ height: AG_ROW_H }}
                  >
                    <span className="-translate-y-2 inline-block">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
                {/* End-time cap label */}
                <div
                  className="text-right pr-2 text-[10px] text-zinc-400 tabular-nums"
                  style={{ height: 0 }}
                >
                  <span className="-translate-y-2 inline-block">
                    {String(AG_H_END).padStart(2, "0")}:00
                  </span>
                </div>
              </div>
  );
}

/** Risca do "AGORA" — só quando a semana visível contém hoje. */
export function NowLine({ days, now }: { days: Date[]; now: Date }) {
  return (
    <>
              {days.some((d) => isSameDay(d, now)) && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-30"
                  style={{
                    left: 48,
                    top:
                      (now.getHours() + now.getMinutes() / 60 - AG_H_START) *
                      AG_ROW_H,
                  }}
                >
                  {/* Linha à largura das colunas de dia (não sobre os rótulos de hora) */}
                  <div className="absolute inset-x-0 top-0 h-[2px] -translate-y-1/2 bg-red-500" />
                  {/* Pontinho na extremidade esquerda da coluna de HOJE */}
                  {days.map((day, idx) =>
                    isSameDay(day, now) ? (
                      <div
                        key={day.toISOString()}
                        className="absolute top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500"
                        style={{ left: `${(idx / days.length) * 100}%` }}
                      />
                    ) : null,
                  )}
                </div>
              )}
    </>
  );
}
