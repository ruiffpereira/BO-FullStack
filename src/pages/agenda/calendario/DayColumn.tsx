import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { format, isSameDay } from "date-fns";
import { AG_H_END, AG_H_START, AG_ROW_H, computeColumns, minuteToTime } from "../geometry";
import type { Appointment } from "../../../gen/backoffice/types/Appointment.js";
import type { Service } from "../../../gen/backoffice/types/Service.js";
import { AppointmentBlock } from "./AppointmentBlock";
import { DayOverlays } from "./DayOverlays";
import type {
  ApptDragMeta,
  ApptDragState,
  DragRef,
  DragSel,
  HoverSlot,
  PendingReschedule,
  TouchTap,
} from "./types";

/**
 * Coluna de um dia da grelha: ponteiros (arrastar para criar / tap no touch / hover do slot), a grelha de horas,
 * as camadas por cima e as marcações. O estado dos arrastos vive no `CalendarioView` (refs partilhadas com os
 * handlers globais de `useCalendarPointer`).
 */
export function DayColumn({
  day,
  appointments,
  services,
  blockedSlots,
  workingHours,
  pendingReschedule,
  dragSel,
  apptDragState,
  hoverSlot,
  isLoading,
  writeLocked,
  slotMin,
  slotTicks,
  hours,
  dayColRefs,
  dragRef,
  touchTapRef,
  apptDragMeta,
  longPressRef,
  setHoverSlot,
  setDragSel,
  setNovaDate,
  setNovaTime,
  setApptDragState,
  setSelAppt,
}: {
  day: Date;
  appointments: Appointment[];
  services: Service[];
  blockedSlots: any[];
  workingHours: any[];
  pendingReschedule: PendingReschedule | null;
  dragSel: DragSel | null;
  apptDragState: ApptDragState | null;
  hoverSlot: HoverSlot | null;
  isLoading: boolean;
  writeLocked: boolean;
  slotMin: number;
  slotTicks: number[];
  hours: number[];
  dayColRefs: MutableRefObject<Map<string, HTMLElement>>;
  dragRef: MutableRefObject<DragRef | null>;
  touchTapRef: MutableRefObject<TouchTap | null>;
  apptDragMeta: MutableRefObject<ApptDragMeta | null>;
  longPressRef: MutableRefObject<number | null>;
  setHoverSlot: Dispatch<SetStateAction<HoverSlot | null>>;
  setDragSel: Dispatch<SetStateAction<DragSel | null>>;
  setNovaDate: (d: Date | null) => void;
  setNovaTime: (t: string | null) => void;
  setApptDragState: Dispatch<SetStateAction<ApptDragState | null>>;
  setSelAppt: (a: Appointment) => void;
}) {
                const isToday = isSameDay(day, new Date());
                const dayDateStr = format(day, "yyyy-MM-dd");
                const dayAppts = (appointments as Appointment[]).filter((a) => {
                  const effectiveDate =
                    pendingReschedule?.appointmentId === a.appointmentId
                      ? pendingReschedule.newDate
                      : a.date;
                  return (
                    effectiveDate === dayDateStr && a.status !== "cancelled"
                  );
                });
                const effectiveAppts = dayAppts.map((a) =>
                  pendingReschedule?.appointmentId === a.appointmentId
                    ? {
                        ...a,
                        date: pendingReschedule.newDate,
                        time: pendingReschedule.newTime,
                      }
                    : a,
                );
                const layout = computeColumns(effectiveAppts, services);
                // Há marcação a cobrir este minuto? → não sugerir "criar aqui" (hover).
                const slotHasAppt = (min: number) =>
                  effectiveAppts.some((a) => {
                    const [h, m] = a.time.split(":").map(Number);
                    const startMin = h * 60 + m;
                    const dur =
                      a.duration ??
                      services.find((s) => s.serviceId === a.serviceId)?.duration ??
                      30;
                    return min >= startMin && min < startMin + dur;
                  });

                return (
                  <div
                    key={day.toISOString()}
                    ref={(el) => {
                      if (el)
                        dayColRefs.current.set(format(day, "yyyy-MM-dd"), el);
                      else dayColRefs.current.delete(format(day, "yyyy-MM-dd"));
                    }}
                    className={`relative border-l border-zinc-50 dark:border-zinc-800/50 ${dragSel ? "cursor-crosshair" : "cursor-pointer"} select-none ${isToday ? "bg-accent/[0.04] dark:bg-accent/[0.07]" : ""}`}
                    style={{ touchAction: "pan-x pan-y" }}
                    onPointerDown={(e) => {
                      if (writeLocked) return;
                      const isTouch = e.pointerType === "touch";
                      if (e.button !== 0 && !isTouch) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = Math.max(0, e.clientY - rect.top);
                      const totalMin = (y / AG_ROW_H) * 60 + AG_H_START * 60;
                      const snapped = Math.round(totalMin / slotMin) * slotMin;
                      if (isTouch) {
                        // Touch: sem drag-to-select. Guarda o ponto para detetar um TAP
                        // (preview → agendar). O swipe faz scroll (touchAction pan) e
                        // dispara pointercancel, cancelando o tap.
                        const min = Math.min(
                          Math.max(snapped, AG_H_START * 60),
                          AG_H_END * 60 - slotMin,
                        );
                        touchTapRef.current = {
                          day,
                          min,
                          x: e.clientX,
                          y: e.clientY,
                          id: e.pointerId,
                        };
                        return;
                      }
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      dragRef.current = {
                        day,
                        colEl: e.currentTarget,
                        startMin: snapped,
                        endMin: snapped,
                        active: true,
                        armed: true,
                        pointerId: e.pointerId,
                        pointerType: e.pointerType,
                        startX: e.clientX,
                        startY: e.clientY,
                      };
                      document.body.style.touchAction = "none";
                      setDragSel({ day, startMin: snapped, endMin: snapped });
                    }}
                    onMouseMove={(e) => {
                      if (dragRef.current?.active) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = Math.max(0, e.clientY - rect.top);
                      const totalMin = (y / AG_ROW_H) * 60 + AG_H_START * 60;
                      const min = Math.min(
                        Math.max(
                          Math.floor(totalMin / slotMin) * slotMin,
                          AG_H_START * 60,
                        ),
                        AG_H_END * 60 - slotMin,
                      );
                      // Slot já ocupado por uma marcação → não mostrar o hover de "criar aqui".
                      if (slotHasAppt(min)) {
                        setHoverSlot((prev) => (prev ? null : prev));
                        return;
                      }
                      setHoverSlot((prev) =>
                        prev && prev.min === min && isSameDay(prev.day, day)
                          ? prev
                          : { day, min },
                      );
                    }}
                    onMouseLeave={() => setHoverSlot(null)}
                    onPointerUp={(e) => {
                      if (e.pointerType !== "touch") return;
                      const t = touchTapRef.current;
                      touchTapRef.current = null;
                      if (!t || t.id !== e.pointerId) return;
                      if (
                        Math.abs(e.clientX - t.x) > 12 ||
                        Math.abs(e.clientY - t.y) > 12
                      )
                        return; // foi swipe, não tap
                      if (slotHasAppt(t.min)) return; // slot já ocupado
                      const same =
                        hoverSlot &&
                        hoverSlot.min === t.min &&
                        isSameDay(hoverSlot.day, t.day);
                      if (same) {
                        // 2.º toque na mesma célula → agenda.
                        setNovaDate(t.day);
                        setNovaTime(minuteToTime(t.min));
                        setHoverSlot(null);
                      } else {
                        // 1.º toque → mostra o preview (o mesmo realce do hover desktop).
                        setHoverSlot({ day: t.day, min: t.min });
                      }
                    }}
                    onPointerCancel={() => {
                      touchTapRef.current = null;
                    }}
                  >
                    {/* Grelha: linha de hora (forte) + um tick por intervalo (a meia hora mais marcada) */}
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="relative border-b border-zinc-100 dark:border-zinc-800/50"
                        style={{ height: AG_ROW_H }}
                      >
                        {slotTicks.map((m) => (
                          <div
                            key={m}
                            className={`pointer-events-none absolute inset-x-0 border-t ${m === 30 ? "border-zinc-100/80 dark:border-zinc-800/35" : "border-dashed border-zinc-100/60 dark:border-zinc-800/25"}`}
                            style={{ top: (m / 60) * AG_ROW_H }}
                          />
                        ))}
                      </div>
                    ))}

                    <DayOverlays day={day} hoverSlot={hoverSlot} dragSel={dragSel} slotMin={slotMin} blockedSlots={blockedSlots} workingHours={workingHours} apptDragState={apptDragState} services={services} />


                    {/* Appointments */}
                    {isLoading ? (
                      <div className="absolute inset-2 top-2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 h-10" />
                    ) : (
                      layout.map(({ appt, col, totalCols }) => (
                        <AppointmentBlock
                          key={appt.appointmentId}
                          appt={appt}
                          col={col}
                          totalCols={totalCols}
                          day={day}
                          services={services}
                          writeLocked={writeLocked}
                          isBeingDragged={apptDragState?.appt.appointmentId === appt.appointmentId}
                          apptDragMeta={apptDragMeta}
                          longPressRef={longPressRef}
                          setApptDragState={setApptDragState}
                          setSelAppt={setSelAppt}
                          onNewAtSameTime={(d, t) => { setNovaDate(d); setNovaTime(t); }}
                        />
                      ))
                    )}
                  </div>
                );
}
