import { describe, it, expect } from "vitest";
import {
  parseOwnPrice,
  rowsFromRules,
  rulesFromRows,
  validateServiceRows,
  validateTimeOff,
  validateWeek,
  weekFromHours,
  WEEK_ORDER,
} from "../../src/lib/staffForm";

const SERVICES = [
  { serviceId: "s1", name: "Corte", price: 15 },
  { serviceId: "s2", name: "Barba", price: 10, active: false },
];

describe("staffForm — serviços e preço próprio", () => {
  it("rowsFromRules: ausência de regra = faz ao preço normal", () => {
    const rows = rowsFromRules(SERVICES, []);
    expect(rows.map((r) => [r.does, r.ownPrice])).toEqual([[true, ""], [true, ""]]);
    expect(rows[1].active).toBe(false);
  });

  it("rowsFromRules: aplica excluído e preço próprio", () => {
    const rows = rowsFromRules(SERVICES, [
      { serviceId: "s1", excluded: false, price: 12 },
      { serviceId: "s2", excluded: true, price: null },
    ]);
    expect(rows[0]).toMatchObject({ does: true, ownPrice: "12" });
    expect(rows[1]).toMatchObject({ does: false, ownPrice: "" });
  });

  it("parseOwnPrice: vazio = null (normal), vírgula decimal, lixo/negativo = inválido", () => {
    expect(parseOwnPrice("")).toBeNull();
    expect(parseOwnPrice("  ")).toBeNull();
    expect(parseOwnPrice("12,5")).toBe(12.5);
    expect(parseOwnPrice("0")).toBe(0);
    expect(parseOwnPrice("abc")).toBeUndefined();
    expect(parseOwnPrice("-3")).toBeUndefined();
  });

  it("rulesFromRows: só excepções (excluído ou com preço); preço de um excluído nunca vai", () => {
    const rows = rowsFromRules(SERVICES, []);
    rows[0].ownPrice = "9";
    rows[1].does = false;
    rows[1].ownPrice = "7";
    expect(rulesFromRows(rows)).toEqual([
      { serviceId: "s1", excluded: false, price: 9 },
      { serviceId: "s2", excluded: true, price: null },
    ]);
  });

  it("validateServiceRows: ignora o preço de quem não faz o serviço", () => {
    const rows = rowsFromRules(SERVICES, []);
    rows[0].ownPrice = "x";
    expect(validateServiceRows(rows)).toMatch(/Corte/);
    rows[0].does = false;
    expect(validateServiceRows(rows)).toBeNull();
  });
});

describe("staffForm — horário", () => {
  it("weekFromHours: 7 dias de segunda a domingo; o que falta fica fechado", () => {
    const week = weekFromHours([{ dayOfWeek: 1, startTime: "10:00", endTime: "19:00", isActive: true }]);
    expect(week.map((d) => d.dayOfWeek)).toEqual([...WEEK_ORDER]);
    expect(week[0]).toMatchObject({ dayOfWeek: 1, startTime: "10:00", isActive: true });
    expect(week[6]).toMatchObject({ dayOfWeek: 0, isActive: false });
  });

  it("validateWeek: fecho tem de ser depois da abertura num dia aberto", () => {
    const week = weekFromHours([{ dayOfWeek: 1, startTime: "18:00", endTime: "09:00", isActive: true }]);
    expect(validateWeek(week)).toMatch(/Segunda/);
    week[0].isActive = false;
    expect(validateWeek(week)).toBeNull();
  });
});

describe("staffForm — férias e folgas", () => {
  const ok = { startDate: "2026-10-20", endDate: "2026-10-22", startTime: "", endTime: "" };
  it("válido: dias inteiros", () => expect(validateTimeOff(ok)).toBeNull());
  it("fim antes do início", () => expect(validateTimeOff({ ...ok, endDate: "2026-10-19" })).toMatch(/antes/));
  it("sem datas", () => expect(validateTimeOff({ ...ok, startDate: "" })).toMatch(/datas/));
  it("janela de horas só num dia", () => {
    expect(validateTimeOff({ ...ok, startTime: "09:00", endTime: "12:00" })).toMatch(/num dia/);
    expect(validateTimeOff({ ...ok, endDate: "2026-10-20", startTime: "09:00", endTime: "12:00" })).toBeNull();
    expect(validateTimeOff({ ...ok, endDate: "2026-10-20", startTime: "12:00", endTime: "09:00" })).toMatch(/depois/);
  });
});
