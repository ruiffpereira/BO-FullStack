import { format, addDays, startOfWeek, isSameDay, eachDayOfInterval, isSameMonth, addMonths, subMonths } from "date-fns";
import { pt } from "date-fns/locale";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { Icon } from "../../../ui/icons.jsx";

/** Mini-calendário (popup do título do mês): salta para a semana do dia escolhido. */
export function MiniCalendarPopup({
  showMiniCal,
  setShowMiniCal,
  miniCalBtnRef,
  miniCalMonth,
  setMiniCalMonth,
  days,
  setWeekStart,
}: {
  showMiniCal: boolean;
  setShowMiniCal: (v: boolean) => void;
  miniCalBtnRef: RefObject<HTMLButtonElement>;
  miniCalMonth: Date;
  setMiniCalMonth: Dispatch<SetStateAction<Date>>;
  days: Date[];
  setWeekStart: (d: Date) => void;
}) {
  return (
    <>
        {showMiniCal && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMiniCal(false)}
            />
            <div
              className="fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-3 w-64"
              style={(() => {
                const btn = miniCalBtnRef.current;
                if (!btn) return { top: 100, right: 24 };
                const r = btn.getBoundingClientRect();
                return { top: r.bottom + 6, left: r.right - 256 };
              })()}
            >
              {/* Month nav */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setMiniCalMonth((m) => subMonths(m, 1))}
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                >
                  <Icon name="chevronLeft" className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 capitalize">
                  {format(miniCalMonth, "MMMM yyyy", { locale: pt })}
                </span>
                <button
                  onClick={() => setMiniCalMonth((m) => addMonths(m, 1))}
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                >
                  <Icon name="chevronRight" className="w-4 h-4" />
                </button>
              </div>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-medium text-zinc-400 py-0.5"
                  >
                    {d}
                  </div>
                ))}
              </div>
              {/* Day grid */}
              {(() => {
                const monthStart = miniCalMonth;
                const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                const gridEnd = addDays(gridStart, 41);
                const gridDays = eachDayOfInterval({
                  start: gridStart,
                  end: gridEnd,
                });
                const today = new Date();
                return (
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {gridDays.map((day) => {
                      const isToday = isSameDay(day, today);
                      const isCurrentWeek = days.some((d) => isSameDay(d, day));
                      const inMonth = isSameMonth(day, miniCalMonth);
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => {
                            setWeekStart(startOfWeek(day, { weekStartsOn: 1 }));
                            setShowMiniCal(false);
                          }}
                          className={`text-xs rounded py-1 font-medium transition
                            ${isCurrentWeek ? "bg-accent text-white" : ""}
                            ${isToday && !isCurrentWeek ? "text-accent font-bold" : ""}
                            ${!inMonth ? "text-zinc-300 dark:text-zinc-600" : !isCurrentWeek ? "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800" : ""}
                          `}
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </>
        )}
    </>
  );
}
