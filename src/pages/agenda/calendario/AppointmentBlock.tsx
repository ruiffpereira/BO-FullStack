import type { MutableRefObject } from "react";
import { AG_H_START, AG_ROW_H, apptMinutes, minToHHMM, readableOn } from "../geometry";
import { colorForService } from "../../../components/ApptModal.js";
import type { Appointment } from "../../../gen/backoffice/types/Appointment.js";
import type { Service } from "../../../gen/backoffice/types/Service.js";
import type { ApptDragMeta, ApptDragState } from "./types";

/**
 * Uma marcação na grelha do dia. Rato: arrasta-se (reagendar) ou clica-se (abrir). Touch: long-press (~380 ms)
 * «pega» na marcação; soltar antes = abrir. Só ver (`writeLocked`): sem arrastar, abre num clique normal.
 */
export function AppointmentBlock({
  appt,
  col,
  totalCols,
  day,
  services,
  writeLocked,
  isBeingDragged,
  apptDragMeta,
  longPressRef,
  setApptDragState,
  setSelAppt,
  onNewAtSameTime,
}: {
  appt: Appointment;
  col: number;
  totalCols: number;
  day: Date;
  services: Service[];
  writeLocked: boolean;
  isBeingDragged: boolean;
  apptDragMeta: MutableRefObject<ApptDragMeta | null>;
  longPressRef: MutableRefObject<number | null>;
  setApptDragState: (s: ApptDragState | null) => void;
  setSelAppt: (a: Appointment) => void;
  onNewAtSameTime: (day: Date, time: string) => void;
}) {
                        const svcItem = services.find(
                          (s) => s.serviceId === appt.serviceId,
                        );
                        const color = colorForService(appt.serviceId, services);
                        const [hh, mm] = appt.time.split(":").map(Number);
                        const top = (hh + mm / 60 - AG_H_START) * AG_ROW_H;
                        const height =
                          ((appt.duration ?? svcItem?.duration ?? 30) / 60) *
                            AG_ROW_H -
                          4;
                        const leftPct = (col / totalCols) * 100;
                        const widthPct = (1 / totalCols) * 100;
                        return (
                          <button
                            key={appt.appointmentId}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              if (writeLocked) return;
                              const isTouch = e.pointerType === "touch";
                              if (e.button !== 0 && !isTouch) return;
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const yInAppt = Math.max(0, e.clientY - rect.top);
                              apptDragMeta.current = {
                                appt,
                                offsetMin: Math.round(
                                  (yInAppt / AG_ROW_H) * 60,
                                ),
                                grabYInGhost: yInAppt,
                                ghostW: rect.width,
                                ghostH: rect.height,
                                active: true,
                                armed: !isTouch,
                                moved: false,
                                startX: e.clientX,
                                startY: e.clientY,
                                pointerId: e.pointerId,
                                pointerType: e.pointerType,
                                el: e.currentTarget,
                              };
                              if (!isTouch) {
                                e.preventDefault();
                                e.currentTarget.setPointerCapture(e.pointerId);
                                document.body.style.touchAction = "none";
                              } else {
                                // Touch: long-press (~380ms) para "pegar" na marcação
                                // (o swipe normal continua a fazer scroll). Soltar antes
                                // = abre a marcação (tap).
                                longPressRef.current = window.setTimeout(() => {
                                  const m = apptDragMeta.current;
                                  if (!m || m.armed) return;
                                  m.armed = true;
                                  m.moved = true;
                                  try {
                                    m.el.setPointerCapture(m.pointerId);
                                  } catch {
                                    /* noop */
                                  }
                                  document.body.style.touchAction = "none";
                                  document.body.style.cursor = "grabbing";
                                  setApptDragState({
                                    appt: m.appt,
                                    mouseX: m.startX,
                                    mouseY: m.startY,
                                    grabYInGhost: m.grabYInGhost,
                                    ghostW: m.ghostW,
                                    ghostH: m.ghostH,
                                    targetDay: null,
                                    targetMin: null,
                                  });
                                  (navigator as any).vibrate?.(35);
                                }, 380);
                              }
                            }}
                            // Só ver: sem arrastar, a marcação abre num clique normal.
                            onClick={() => { if (writeLocked) setSelAppt(appt); }}
                            className={`absolute group rounded-lg px-2 py-1 text-left z-10 hover:shadow-md hover:z-20 transition-all ${writeLocked ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${isBeingDragged ? "opacity-25" : ""}`}
                            style={{
                              top: top + 2,
                              height: Math.max(height, 24),
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                              background: color,
                              // Profissional: faixa à esquerda na cor dele.
                              boxShadow: appt.staff?.color ? `inset 4px 0 0 ${appt.staff.color}` : undefined,
                              touchAction: "pan-x pan-y",
                            }}
                          >
                            <p className="text-[10px] font-semibold leading-tight truncate pr-4" style={{ color: readableOn(color) }}>
                              {appt.time}–{minToHHMM(apptMinutes(appt) + (appt.duration ?? svcItem?.duration ?? 30))} {appt.clientName}
                              {(() => {
                                const calTotalPaid = Number(appt.paymentCash ?? 0) + Number(appt.paymentMbway ?? 0) + Number(appt.paymentCard ?? 0);
                                const calDebt = Math.max(0, Number(appt.servicePrice ?? 0) - calTotalPaid);
                                const calHasDebt = appt.status === "completed" && calDebt > 0;
                                return calHasDebt ? (
                                  <span className="ml-1 px-1 rounded bg-white/90 text-red-600 font-bold">€!</span>
                                ) : appt.paidAt ? (
                                  <span className="ml-1 px-1 rounded bg-white/90 text-emerald-600 font-bold">€</span>
                                ) : null;
                              })()}
                            </p>
                            {(appt.serviceName || svcItem) && (
                              <p className="text-[9px] truncate" style={{ color: readableOn(color), opacity: 0.85 }}>
                                {svcItem?.name || appt.serviceName}
                                {appt.staff?.name ? ` · ${appt.staff.name}` : ""}
                              </p>
                            )}
                            {!writeLocked && <span
                              title="Nova marcação à mesma hora"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onNewAtSameTime(day, appt.time);
                              }}
                              className="absolute top-0.5 right-0.5 w-5 h-5 sm:w-4 sm:h-4 flex items-center justify-center rounded text-[12px] sm:text-[11px] font-bold opacity-80 [@media(hover:hover)]:sm:opacity-0 [@media(hover:hover)]:sm:group-hover:opacity-80 hover:!opacity-100 transition-opacity bg-white/80 dark:bg-zinc-900/80 text-zinc-500 hover:text-accent cursor-pointer"
                            >
                              +
                            </span>}
                          </button>
                        );
}
