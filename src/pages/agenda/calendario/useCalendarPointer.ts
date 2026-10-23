import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { format } from "date-fns";
import type { Appointment } from "../../../gen/backoffice/types/Appointment.js";
import { AG_H_END, AG_H_START, AG_ROW_H, minuteToTime } from "../geometry";
import type {
  ApptDragMeta,
  ApptDragState,
  DragAction,
  DragRef,
  DragSel,
  PendingReschedule,
  RescheduledFrom,
} from "./types";

type Ref<T> = MutableRefObject<T>;

/** Tudo o que os handlers globais de ponteiro tocam: refs (estado do arrasto) e os setters da vista. */
export type CalendarPointerCtx = {
  dragRef: Ref<DragRef | null>;
  apptDragMeta: Ref<ApptDragMeta | null>;
  apptDragTargetRef: Ref<{ day: Date; min: number } | null>;
  longPressRef: Ref<number | null>;
  autoScrollRef: Ref<{ dx: number; dy: number }>;
  autoScrollRafRef: Ref<number | null>;
  calScrollEl: Ref<HTMLDivElement | null>;
  dayColRefs: Ref<Map<string, HTMLElement>>;
  slotMinRef: Ref<number>;
  setNovaDateRef: Ref<Dispatch<SetStateAction<Date | null>>>;
  setNovaTimeRef: Ref<Dispatch<SetStateAction<string | null>>>;
  setDragSelRef: Ref<Dispatch<SetStateAction<DragSel | null>>>;
  setDragActionRef: Ref<Dispatch<SetStateAction<DragAction | null>>>;
  setApptDragStateRef: Ref<Dispatch<SetStateAction<ApptDragState | null>>>;
  setSelApptRef: Ref<Dispatch<SetStateAction<Appointment | null>>>;
  setPendingReschedule: Dispatch<SetStateAction<PendingReschedule | null>>;
  setRescheduledFrom: Dispatch<SetStateAction<RescheduledFrom | null>>;
};

/**
 * Handlers globais de ponteiro do calendário (criar por arrasto, reagendar por arrasto, long-press no touch,
 * auto-scroll). Montam-se uma vez: leem as refs/setters do `ctx` por uma ref, para não haver closures velhas.
 */
export function useCalendarPointer(ctx: CalendarPointerCtx) {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  useEffect(() => {
    const {
      dragRef, apptDragMeta, apptDragTargetRef, longPressRef, autoScrollRef, autoScrollRafRef, calScrollEl,
      dayColRefs, slotMinRef, setNovaDateRef, setNovaTimeRef, setDragSelRef, setDragActionRef,
      setApptDragStateRef, setSelApptRef, setPendingReschedule, setRescheduledFrom,
    } = ctxRef.current;
    const startAutoScroll = () => {
      if (autoScrollRafRef.current != null) return;
      const step = () => {
        const c = calScrollEl.current;
        const { dx, dy } = autoScrollRef.current;
        if (c && (dx || dy)) {
          c.scrollLeft += dx;
          c.scrollTop += dy;
          autoScrollRafRef.current = requestAnimationFrame(step);
        } else {
          autoScrollRafRef.current = null;
        }
      };
      autoScrollRafRef.current = requestAnimationFrame(step);
    };
    const stopAutoScroll = () => {
      if (autoScrollRafRef.current != null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      autoScrollRef.current = { dx: 0, dy: 0 };
    };
    const onMove = (e: PointerEvent) => {
      // ── Drag-to-create ──
      const d = dragRef.current;
      if (d && d.pointerId === e.pointerId) {
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (!d.armed) {
          if (Math.sqrt(dx * dx + dy * dy) < 8) return;
          d.armed = true;
          d.active = true;
          document.body.style.touchAction = "none";
          setDragSelRef.current({
            day: d.day,
            startMin: d.startMin,
            endMin: d.endMin,
          });
        }
      }
      if (d && d.active && d.pointerId === e.pointerId) {
        e.preventDefault();
        const rect = d.colEl.getBoundingClientRect();
        const y = Math.max(0, e.clientY - rect.top);
        const totalMin = (y / AG_ROW_H) * 60 + AG_H_START * 60;
        const step = slotMinRef.current;
        const snapped = Math.min(
          Math.max(Math.round(totalMin / step) * step, AG_H_START * 60),
          AG_H_END * 60,
        );
        d.endMin = snapped;
        const startMin = Math.min(d.startMin, d.endMin);
        const endMin = Math.max(d.startMin, d.endMin);
        setDragSelRef.current({ day: d.day, startMin, endMin });
        return;
      }
      // ── Appointment reschedule drag ──
      const ad = apptDragMeta.current;
      if (!ad || !ad.active || ad.pointerId !== e.pointerId) return;
      const dx = e.clientX - ad.startX;
      const dy = e.clientY - ad.startY;
      if (!ad.armed) {
        if (ad.pointerType === "touch") {
          // Touch: arma-se por long-press (timer), não por movimento. Mover antes do
          // timer disparar = o utilizador quer fazer scroll → cancela o "pegar".
          if (Math.sqrt(dx * dx + dy * dy) > 10) {
            if (longPressRef.current) {
              clearTimeout(longPressRef.current);
              longPressRef.current = null;
            }
            apptDragMeta.current = null;
          }
          return;
        }
        if (Math.sqrt(dx * dx + dy * dy) < 8) return;
        ad.armed = true;
        document.body.style.touchAction = "none";
      }
      e.preventDefault();
      if (!ad.moved && Math.sqrt(dx * dx + dy * dy) > 5) {
        ad.moved = true;
        document.body.style.cursor = "grabbing";
        setApptDragStateRef.current({
          appt: ad.appt,
          mouseX: e.clientX,
          mouseY: e.clientY,
          grabYInGhost: ad.grabYInGhost,
          ghostW: ad.ghostW,
          ghostH: ad.ghostH,
          targetDay: null,
          targetMin: null,
        });
        return;
      }
      if (!ad.moved) return;
      // Auto-scroll (touch): ao arrastar até às bordas do container, faz scroll nessa
      // direção — para alcançar dias/horas fora do ecrã.
      if (ad.pointerType === "touch") {
        const c = calScrollEl.current;
        if (c) {
          const r = c.getBoundingClientRect();
          const EDGE = 52;
          const SPEED = 14;
          const nx =
            e.clientX < r.left + EDGE ? -SPEED : e.clientX > r.right - EDGE ? SPEED : 0;
          const ny =
            e.clientY < r.top + EDGE ? -SPEED : e.clientY > r.bottom - EDGE ? SPEED : 0;
          autoScrollRef.current = { dx: nx, dy: ny };
          if (nx || ny) startAutoScroll();
          else stopAutoScroll();
        }
      }
      let targetDay: Date | null = null;
      let targetMin: number | null = null;
      for (const [dayStr, el] of dayColRefs.current) {
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right) {
          targetDay = new Date(dayStr + "T00:00:00");
          const rawMin =
            ((e.clientY - r.top - ad.grabYInGhost) / AG_ROW_H) * 60 +
            AG_H_START * 60;
          const step = slotMinRef.current;
          targetMin = Math.min(
            Math.max(Math.round(rawMin / step) * step, AG_H_START * 60),
            (AG_H_END - 1) * 60,
          );
          break;
        }
      }
      apptDragTargetRef.current =
        targetDay && targetMin !== null
          ? { day: targetDay, min: targetMin }
          : null;
      setApptDragStateRef.current((prev) =>
        prev
          ? {
              ...prev,
              mouseX: e.clientX,
              mouseY: e.clientY,
              targetDay,
              targetMin,
            }
          : null,
      );
    };

    const onUp = (e: PointerEvent) => {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
      stopAutoScroll();
      // ── Drag-to-create ──
      const d = dragRef.current;
      if (d && d.pointerId === e.pointerId) {
        if (d.colEl.hasPointerCapture(e.pointerId)) {
          d.colEl.releasePointerCapture(e.pointerId);
        }
        if (!d.armed) {
          dragRef.current = null;
          document.body.style.touchAction = "";
          setNovaDateRef.current(d.day);
          setNovaTimeRef.current(minuteToTime(d.startMin));
          return;
        }
        d.active = false;
        const startMin = Math.min(d.startMin, d.endMin);
        const endMin = Math.max(d.startMin, d.endMin);
        const day = d.day;
        dragRef.current = null;
        setDragSelRef.current(null);
        document.body.style.touchAction = "";
        if (endMin - startMin >= slotMinRef.current) {
          setDragActionRef.current({
            x: e.clientX,
            y: e.clientY,
            pointerType: d.pointerType,
            day,
            startMin,
            endMin,
          });
        } else {
          setNovaDateRef.current(day);
          setNovaTimeRef.current(minuteToTime(startMin));
        }
        return;
      }
      // ── Appointment reschedule drag ──
      const ad = apptDragMeta.current;
      if (!ad || !ad.active || ad.pointerId !== e.pointerId) return;
      if (ad.el.hasPointerCapture(e.pointerId)) {
        ad.el.releasePointerCapture(e.pointerId);
      }
      ad.active = false;
      apptDragMeta.current = null;
      document.body.style.cursor = "";
      document.body.style.touchAction = "";
      setApptDragStateRef.current(null);
      const target = apptDragTargetRef.current;
      apptDragTargetRef.current = null;
      if (ad.moved && target) {
        const newDate = format(target.day, "yyyy-MM-dd");
        const newTime = minuteToTime(target.min);
        if (newDate !== ad.appt.date || newTime !== ad.appt.time) {
          // Don't save yet — open modal for confirmation
          setPendingReschedule({
            appointmentId: ad.appt.appointmentId,
            newDate,
            newTime,
          });
          setRescheduledFrom({ date: ad.appt.date, time: ad.appt.time });
          setSelApptRef.current(ad.appt);
        }
      } else if (!ad.moved && e.type !== "pointercancel") {
        // Tap (não moveu, e não foi cancelado por scroll) → abre a marcação.
        setSelApptRef.current(ad.appt);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (longPressRef.current) clearTimeout(longPressRef.current);
      stopAutoScroll();
      document.body.style.cursor = "";
      document.body.style.touchAction = "";
    };
  }, []);
}
