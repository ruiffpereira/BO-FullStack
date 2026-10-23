import type { Appointment } from "../../../gen/backoffice/types/Appointment.js";

// Estado dos arrastos do calendário: criar por arrasto numa coluna, reagendar uma marcação e o popup de acções.

export type DragRef = {
  day: Date;
  colEl: HTMLElement;
  startMin: number;
  endMin: number;
  active: boolean;
  armed: boolean;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
};

export type DragSel = { day: Date; startMin: number; endMin: number };

export type DragAction = {
  x: number;
  y: number;
  pointerType: string;
  day: Date;
  startMin: number;
  endMin: number;
};

export type ApptDragMeta = {
  appt: Appointment;
  offsetMin: number;
  grabYInGhost: number;
  ghostW: number;
  ghostH: number;
  active: boolean;
  armed: boolean;
  moved: boolean;
  startX: number;
  startY: number;
  pointerId: number;
  pointerType: string;
  el: HTMLElement;
};

export type ApptDragState = {
  appt: Appointment;
  mouseX: number;
  mouseY: number;
  grabYInGhost: number;
  ghostW: number;
  ghostH: number;
  targetDay: Date | null;
  targetMin: number | null;
};

export type HoverSlot = { day: Date; min: number };
export type TouchTap = { day: Date; min: number; x: number; y: number; id: number };
export type PendingReschedule = { appointmentId: string; newDate: string; newTime: string };
export type RescheduledFrom = { date: string; time: string };
