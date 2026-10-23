import { DAY_NAMES_SHORT } from "./constants";
import { format, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { pt } from "date-fns/locale";
import { Icon } from "../../ui/icons.jsx";
import type { ApptEditor } from "./useApptEditor";

/** Popup do calendário de data (ancorado ao botão da data). */
export function ApptDatePicker({ ctx }: { ctx: ApptEditor }) {
  const { showDatePicker, setEditDate, setShowDatePicker, pickerMonth, setPickerMonth, pickerGridDays, parsedEditDate, btnRect } = ctx;
  if (!showDatePicker) return null;
  return (
        <>
          <div
            className="fixed inset-0 z-[199]"
            onClick={() => setShowDatePicker(false)}
          />
          <div
            className="fixed z-[200] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-3 w-64"
            style={{
              top: btnRect ? btnRect.bottom + 6 : 100,
              left: btnRect
                ? Math.min(btnRect.left, window.innerWidth - 268)
                : 100,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setPickerMonth((m) => subMonths(m, 1))}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <Icon name="chevronLeft" className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium capitalize">
                {format(pickerMonth, "MMMM yyyy", { locale: pt })}
              </span>
              <button
                type="button"
                onClick={() => setPickerMonth((m) => addMonths(m, 1))}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <Icon name="chevronRight" className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES_SHORT.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-medium text-zinc-400 py-0.5"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {pickerGridDays.map((day) => {
                const isSelected = isSameDay(day, parsedEditDate);
                const inMonth = isSameMonth(day, pickerMonth);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setEditDate(format(day, "yyyy-MM-dd"));
                      setShowDatePicker(false);
                    }}
                    className={`h-7 w-full rounded text-xs font-medium transition
                      ${
                        isSelected
                          ? "bg-accent text-white"
                          : inMonth
                            ? "text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            : "text-zinc-300 dark:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        </>
  );
}
