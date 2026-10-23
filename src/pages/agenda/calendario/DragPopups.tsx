import { format } from "date-fns";
import { Icon } from "../../../ui/icons.jsx";
import { colorForService } from "../../../components/ApptModal.js";
import type { Service } from "../../../gen/backoffice/types/Service.js";
import { minuteToTime } from "../geometry";
import type { ApptDragState, DragAction } from "./types";

/** Popup que aparece ao largar o arrasto numa coluna: nova marcação / bloquear horário / cancelar. */
export function DragActionPopup({
  dragAction,
  canBlockSlots,
  onClose,
  onNova,
  onBlock,
}: {
  dragAction: DragAction;
  canBlockSlots: boolean;
  onClose: () => void;
  onNova: (day: Date, startMin: number) => void;
  onBlock: (data: { date: string; startTime: string; endTime: string }) => void;
}) {
  return (
    <>
          <div
            className="fixed inset-0 z-40"
            onPointerDown={onClose}
          />
          <div
            className="fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-2 min-w-[210px]"
            style={
              dragAction.pointerType === "touch"
                ? { left: 16, right: 16, bottom: 16 }
                : {
                    left: Math.min(dragAction.x + 8, window.innerWidth - 230),
                    top: Math.min(dragAction.y - 10, window.innerHeight - 140),
                  }
            }
          >
            <p className="text-xs text-zinc-400 px-2 py-1 mb-1 font-medium">
              {minuteToTime(dragAction.startMin)} —{" "}
              {minuteToTime(dragAction.endMin)}
            </p>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                onNova(dragAction.day, dragAction.startMin);
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-800 dark:text-zinc-100"
            >
              <Icon name="plus" className="w-4 h-4 text-accent" /> Nova marcação
            </button>
            {canBlockSlots && <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                onBlock({
                    date: format(dragAction.day, "yyyy-MM-dd"),
                    startTime: minuteToTime(dragAction.startMin),
                    endTime: minuteToTime(dragAction.endMin),
                  });
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-800 dark:text-zinc-100"
            >
              <Icon name="ban" className="w-4 h-4 text-red-400" /> Bloquear
              horário
            </button>}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              className="w-full text-left px-3 py-2 text-sm text-zinc-400 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          </div>
    </>
  );
}

/** «Fantasma» que acompanha o rato ao reagendar uma marcação por arrasto. */
export function ApptDragGhost({ apptDragState, services }: { apptDragState: ApptDragState; services: Service[] }) {
  return (
    <>
      {
        (() => {
          const {
            appt: da,
            mouseX,
            mouseY,
            grabYInGhost,
            ghostW,
            ghostH,
            targetMin,
          } = apptDragState;
          const color = colorForService(da.serviceId, services);
          const svcItem = services.find((s) => s.serviceId === da.serviceId);
          return (
            <div
              className="fixed pointer-events-none z-[100] rounded-lg px-2 py-1 shadow-xl"
              style={{
                left: mouseX - ghostW / 2,
                top: mouseY - grabYInGhost,
                width: ghostW,
                height: Math.max(ghostH, 24),
                background: `${color}22`,
                borderLeft: `3px solid ${color}`,
                border: `1px solid ${color}60`,
                opacity: 0.9,
              }}
            >
              <p className="text-[10px] font-semibold leading-tight truncate text-zinc-800 dark:text-zinc-100">
                {targetMin !== null ? minuteToTime(targetMin) : da.time}{" "}
                {da.clientName}
              </p>
              {(da.serviceName || svcItem) && (
                <p className="text-[9px] text-zinc-500 truncate">
                  {da.serviceName || svcItem?.name}
                </p>
              )}
            </div>
          );
        })()}
    </>
  );
}
