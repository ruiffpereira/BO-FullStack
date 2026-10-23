import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { pt } from "date-fns/locale";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { Icon } from "../../../ui/icons.jsx";
import { Button, IconButton } from "../../../ui/ui.jsx";

/** Barra de navegação da semana: anterior / Hoje / seguinte e o título do mês (abre o mini-calendário). */
export function CalendarNav({
  weekStart,
  setWeekStart,
  showMiniCal,
  onToggleMini,
  miniCalBtnRef,
}: {
  weekStart: Date;
  setWeekStart: Dispatch<SetStateAction<Date>>;
  showMiniCal: boolean;
  onToggleMini: () => void;
  miniCalBtnRef: RefObject<HTMLButtonElement>;
}) {
  return (
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0 relative">
          <div className="flex items-center gap-1">
            <IconButton
              icon="chevronLeft"
              label="Semana anterior"
              onClick={() => setWeekStart((d) => subWeeks(d, 1))}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
                setWeekStart(new Date().getDay() === 0 ? addWeeks(ws, 1) : ws);
              }}
            >
              Hoje
            </Button>
            <IconButton
              icon="chevronRight"
              label="Próxima semana"
              onClick={() => setWeekStart((d) => addWeeks(d, 1))}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              ref={miniCalBtnRef}
              onClick={onToggleMini}
              className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100 capitalize hover:text-accent transition px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {format(weekStart, "MMMM yyyy", { locale: pt })}
              <Icon
                name="chevronDown"
                className={`w-3.5 h-3.5 transition-transform ${showMiniCal ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>
  );
}
