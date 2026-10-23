import { format, isSameDay } from "date-fns";
import { AG_H_START, AG_ROW_H, minuteToTime } from "../geometry";
import { colorForService } from "../../../components/ApptModal.js";
import type { Service } from "../../../gen/backoffice/types/Service.js";
import type { ApptDragState, DragSel, HoverSlot } from "./types";

/** Camadas por cima da grelha de um dia: hover do slot, bloqueios, almoço, selecção por arrasto e destino do reagendamento. */
export function DayOverlays({
  day,
  hoverSlot,
  dragSel,
  slotMin,
  blockedSlots,
  workingHours,
  apptDragState,
  services,
}: {
  day: Date;
  hoverSlot: HoverSlot | null;
  dragSel: DragSel | null;
  slotMin: number;
  blockedSlots: any[];
  workingHours: any[];
  apptDragState: ApptDragState | null;
  services: Service[];
}) {
  const dayBlocked = blockedSlots.filter((bs) =>
    isSameDay(new Date(bs.date + "T00:00:00"), day),
  );
  const hasDragSel = dragSel && isSameDay(dragSel.day, day);
  return (
    <>
                    {/* Hover: realce da célula do intervalo + tooltip dia/hora (só em slots livres) */}
                    {hoverSlot &&
                      isSameDay(hoverSlot.day, day) &&
                      !hasDragSel && (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-[6]"
                          style={{
                            top:
                              ((hoverSlot.min - AG_H_START * 60) / 60) *
                              AG_ROW_H,
                            height: (AG_ROW_H * slotMin) / 60,
                          }}
                        >
                          <div className="mx-0.5 h-full rounded-md bg-accent/10 ring-1 ring-inset ring-accent/40 dark:bg-accent/20" />
                          <span className="absolute left-1.5 top-0 inline-flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow-md ring-1 ring-black/5">
                            {format(hoverSlot.day, "dd/MM")} ·{" "}
                            {minuteToTime(hoverSlot.min)}
                          </span>
                        </div>
                      )}

                    {/* Blocked slots overlay */}
                    {dayBlocked.map((bs: any) => {
                      if (!bs.startTime || !bs.endTime) {
                        return (
                          <div
                            key={bs.blockedSlotId}
                            className="absolute inset-0 bg-zinc-400/8 dark:bg-zinc-600/15 border-l-2 border-zinc-300 dark:border-zinc-600 pointer-events-none z-[5]"
                          />
                        );
                      }
                      const [sh, sm] = bs.startTime.split(":").map(Number);
                      const [eh, em] = bs.endTime.split(":").map(Number);
                      const startMinBs = sh * 60 + sm;
                      const endMinBs = eh * 60 + em;
                      const top =
                        ((startMinBs - AG_H_START * 60) / 60) * AG_ROW_H;
                      const height = ((endMinBs - startMinBs) / 60) * AG_ROW_H;
                      return (
                        <div
                          key={bs.blockedSlotId}
                          className="absolute inset-x-0 bg-zinc-400/12 dark:bg-zinc-600/20 border-l-2 border-zinc-300 dark:border-zinc-600 pointer-events-none z-[5]"
                          style={{
                            top: Math.max(top, 0),
                            height: Math.max(height, 4),
                          }}
                        />
                      );
                    })}

                    {/* Lunch break overlay */}
                    {(() => {
                      const wh = workingHours.find(
                        (h) => h.dayOfWeek === day.getDay(),
                      );
                      if (!wh?.lunchStart || !wh?.lunchEnd) return null;
                      const [sh, sm] = wh.lunchStart.split(":").map(Number);
                      const [eh, em] = wh.lunchEnd.split(":").map(Number);
                      const startMin = sh * 60 + sm;
                      const endMin = eh * 60 + em;
                      const top =
                        ((startMin - AG_H_START * 60) / 60) * AG_ROW_H;
                      const height = ((endMin - startMin) / 60) * AG_ROW_H;
                      return (
                        <div
                          className="absolute inset-x-0 bg-amber-400/10 dark:bg-amber-500/15 border-l-2 border-amber-300 dark:border-amber-500/40 pointer-events-none z-[5] flex items-center"
                          style={{
                            top: Math.max(top, 0),
                            height: Math.max(height, 8),
                          }}
                        >
                          <span className="text-[9px] font-medium text-amber-500/60 dark:text-amber-400/50 pl-1.5 leading-none select-none">
                            Almoço
                          </span>
                        </div>
                      );
                    })()}

                    {/* Drag selection highlight */}
                    {hasDragSel &&
                      (() => {
                        const top =
                          ((dragSel!.startMin - AG_H_START * 60) / 60) *
                          AG_ROW_H;
                        const height =
                          ((dragSel!.endMin - dragSel!.startMin) / 60) *
                          AG_ROW_H;
                        return (
                          <div
                            className="absolute inset-x-0 bg-blue-500/20 border border-blue-400 dark:border-blue-500 rounded pointer-events-none z-[6]"
                            style={{ top, height: Math.max(height, 2) }}
                          />
                        );
                      })()}

                    {/* Reschedule drop indicator */}
                    {apptDragState?.targetDay &&
                      isSameDay(apptDragState.targetDay, day) &&
                      apptDragState.targetMin !== null &&
                      (() => {
                        const da = apptDragState.appt;
                        const svc = services.find(
                          (s) => s.serviceId === da.serviceId,
                        );
                        const dur = da.duration ?? svc?.duration ?? 30;
                        const top =
                          ((apptDragState.targetMin! - AG_H_START * 60) / 60) *
                          AG_ROW_H;
                        const height = (dur / 60) * AG_ROW_H - 4;
                        const color = colorForService(da.serviceId, services);
                        return (
                          <div
                            className="absolute inset-x-1 rounded-lg pointer-events-none z-[8]"
                            style={{
                              top,
                              height: Math.max(height, 20),
                              background: `${color}20`,
                              borderLeft: `3px solid ${color}`,
                              border: `1px solid ${color}60`,
                            }}
                          />
                        );
                      })()}
    </>
  );
}
