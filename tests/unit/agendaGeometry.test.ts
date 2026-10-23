import { describe, it, expect } from "vitest";
import {
  AG_ROW_H,
  apptMinutes,
  computeColumns,
  customerIdForAppointment,
  minToHHMM,
  minuteToTime,
  readableOn,
  stableColorForId,
  SERVICE_COLORS,
  weekStartForDate,
} from "../../src/pages/agenda/geometry";
import type { Appointment } from "../../src/gen/backoffice/types/Appointment";
import type { Service } from "../../src/gen/backoffice/types/Service";
import type { Customer } from "../../src/gen/backoffice/types/Customer";

const appt = (id: string, time: string, extra: Partial<Appointment> = {}) =>
  ({ appointmentId: id, date: "2026-07-01", time, serviceId: "s1", clientName: id, ...extra }) as Appointment;
const services = [{ serviceId: "s1", name: "Corte", duration: 30, price: 10 }] as Service[];

describe("geometria do calendário da Agenda", () => {
  it("weekStartForDate: a semana começa à segunda-feira", () => {
    // 2026-07-01 é uma quarta-feira → segunda 2026-06-29
    const ws = weekStartForDate("2026-07-01");
    expect(ws.getFullYear()).toBe(2026);
    expect(ws.getMonth()).toBe(5);
    expect(ws.getDate()).toBe(29);
    expect(ws.getDay()).toBe(1);
  });

  it("minuteToTime / minToHHMM", () => {
    expect(minuteToTime(0)).toBe("00:00");
    expect(minuteToTime(9 * 60 + 5)).toBe("09:05");
    expect(minToHHMM(25 * 60)).toBe("01:00"); // dá a volta às 24 h
  });

  it("apptMinutes lê HH:MM", () => {
    expect(apptMinutes(appt("a", "10:30"))).toBe(630);
  });

  it("computeColumns: marcações que não se sobrepõem ficam numa coluna só", () => {
    const r = computeColumns([appt("a", "09:00"), appt("b", "10:00")], services);
    expect(r.map((x) => [x.appt.appointmentId, x.col, x.totalCols])).toEqual([
      ["a", 0, 1],
      ["b", 0, 1],
    ]);
  });

  it("computeColumns: sobrepostas dividem a largura em colunas", () => {
    const r = computeColumns([appt("a", "09:00"), appt("b", "09:15"), appt("c", "09:20")], services);
    const cols = Object.fromEntries(r.map((x) => [x.appt.appointmentId, x.col]));
    expect(new Set(Object.values(cols)).size).toBe(3);
    expect(r.every((x) => x.totalCols === 3)).toBe(true);
  });

  it("computeColumns: a duração própria da marcação manda sobre a do serviço", () => {
    const r = computeColumns([appt("a", "09:00", { duration: 90 }), appt("b", "10:00")], services);
    expect(r.every((x) => x.totalCols === 2)).toBe(true);
  });

  it("uma marcação curtíssima ocupa pelo menos a altura mínima visual", () => {
    // 24px de altura mínima a 80px/h ⇒ ceil(24/80*60) = 18 min
    const r = computeColumns([appt("a", "09:00", { duration: 5 }), appt("b", "09:10")], services);
    expect(r.every((x) => x.totalCols === 2)).toBe(true);
    expect(AG_ROW_H).toBe(80);
  });

  it("customerIdForAppointment: id directo, senão email (sem maiúsculas), senão telefone", () => {
    const customers = [
      { customerId: "c1", name: "A", email: "ana@x.pt", contact: "911" },
      { customerId: "c2", name: "B", email: "bruno@x.pt", contact: "922" },
    ] as Customer[];
    expect(customerIdForAppointment(appt("a", "09:00", { customerId: "cX" }), customers)).toBe("cX");
    expect(customerIdForAppointment(appt("a", "09:00", { clientEmail: "ANA@x.pt" }), customers)).toBe("c1");
    expect(customerIdForAppointment(appt("a", "09:00", { clientPhone: "922" }), customers)).toBe("c2");
    expect(customerIdForAppointment(appt("a", "09:00"), customers)).toBeNull();
  });

  it("readableOn: texto escuro em fundos claros, branco nos escuros", () => {
    expect(readableOn("#ffffff")).toBe("#1f2937");
    expect(readableOn("#000000")).toBe("#ffffff");
    expect(readableOn("")).toBe("#ffffff");
  });

  it("stableColorForId: determinística e da paleta", () => {
    expect(stableColorForId("abc")).toBe(stableColorForId("abc"));
    expect(SERVICE_COLORS).toContain(stableColorForId("qualquer"));
  });
});
