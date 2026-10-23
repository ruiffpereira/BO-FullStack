import { startOfWeek, addWeeks } from "date-fns";
import type { Appointment } from "../../gen/backoffice/types/Appointment.js";
import type { Service } from "../../gen/backoffice/types/Service.js";
import type { Customer } from "../../gen/backoffice/types/Customer.js";

// ─── Constants ────────────────────────────────────────────────────────────────
export const AG_H_START = 0; // grelha cobre o dia todo (00:00–24:00)
export const AG_H_END = 24;
export const AG_ROW_H = 80;

// As cores por serviço vivem com a modal de marcação (uma só definição).
export { SERVICE_COLORS, stableColorForId } from "../../components/appt/constants";
export const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function weekStartForDate(date: string | null) {
  if (!date) {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    return new Date().getDay() === 0 ? addWeeks(ws, 1) : ws;
  }
  const day = new Date(date + "T00:00:00");
  return startOfWeek(day, { weekStartsOn: 1 });
}

export function customerIdForAppointment(appt: Appointment, customers: Customer[]) {
  if (appt.customerId) return appt.customerId;
  const email = appt.clientEmail?.toLowerCase();
  const phone = appt.clientPhone;
  return (
    customers.find(
      (c) =>
        (email && c.email?.toLowerCase() === email) ||
        (phone && c.contact === phone),
    )?.customerId ?? null
  );
}

export function minuteToTime(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// ─── Overlap layout ───────────────────────────────────────────────────────────
const MIN_VISUAL_MINS = Math.ceil((24 / AG_ROW_H) * 60);

export function apptMinutes(appt: Appointment) {
  const [h, m] = appt.time.split(":").map(Number);
  return h * 60 + m;
}
/** Minutos do dia → "HH:MM". */
export function minToHHMM(total: number) {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
/** Cor de texto legível (escuro/branco) para um fundo hex sólido. */
export function readableOn(hex: string) {
  const c = (hex || "").replace("#", "");
  if (c.length < 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1f2937" : "#ffffff";
}
function apptVisualEnd(appt: Appointment, services: Service[]) {
  const svc = services.find((s) => s.serviceId === appt.serviceId);
  return (
    apptMinutes(appt) +
    Math.max(appt.duration ?? svc?.duration ?? 30, MIN_VISUAL_MINS)
  );
}
function overlaps(a: Appointment, b: Appointment, services: Service[]) {
  return (
    apptMinutes(a) < apptVisualEnd(b, services) &&
    apptMinutes(b) < apptVisualEnd(a, services)
  );
}

export function computeColumns(appts: Appointment[], services: Service[]) {
  const sorted = [...appts].sort((a, b) => apptMinutes(a) - apptMinutes(b));
  const result: { appt: Appointment; col: number; totalCols: number }[] = [];

  const groups: Appointment[][] = [];
  for (const appt of sorted) {
    const grp = groups.find((g) => g.some((x) => overlaps(x, appt, services)));
    if (grp) grp.push(appt);
    else groups.push([appt]);
  }

  for (const group of groups) {
    const cols: Appointment[][] = [];
    for (const appt of group) {
      let ci = cols.findIndex(
        (col) => !col.some((x) => overlaps(x, appt, services)),
      );
      if (ci === -1) {
        ci = cols.length;
        cols.push([]);
      }
      cols[ci].push(appt);
      result.push({ appt, col: ci, totalCols: 0 });
    }
    const n = cols.length;
    for (const r of result) {
      if (group.includes(r.appt)) r.totalCols = n;
    }
  }
  return result;
}
