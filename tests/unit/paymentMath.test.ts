import { describe, it, expect } from "vitest";
import {
  activeMethodFor,
  buildApptSaveData,
  paymentChangedFrom,
  paymentPayload,
  paymentTotals,
  priceMismatchFor,
  toNum,
} from "../../src/components/appt/paymentMath";

const pay = (cash = "", mbway = "", card = "", tip = "") => ({ cash, mbway, card, tip });

describe("paymentMath — contas da modal de marcação", () => {
  it("toNum: vazio ou lixo = 0", () => {
    expect(toNum("")).toBe(0);
    expect(toNum("abc")).toBe(0);
    expect(toNum("12.5")).toBe(12.5);
  });

  it("paymentTotals separa a gorjeta do total sem gorjeta", () => {
    expect(paymentTotals(pay("10", "5", "", "2"))).toEqual({ tipVal: 2, payNoTip: 15, payTotal: 17 });
  });

  it("activeMethodFor: só marca um método quando ele sozinho cobre o preço", () => {
    expect(activeMethodFor(pay("10"), 10)).toBe("cash");
    expect(activeMethodFor(pay("", "10"), 10)).toBe("mbway");
    expect(activeMethodFor(pay("", "", "10"), 10)).toBe("card");
    expect(activeMethodFor(pay("5", "5"), 10)).toBeNull(); // dividido por dois métodos
    expect(activeMethodFor(pay("10"), 12)).toBeNull();
    expect(activeMethodFor(pay("10"), 0)).toBeNull();
  });

  it("paymentChangedFrom: a gorjeta soma ao dinheiro guardado", () => {
    const saved = { paymentCash: 12, paymentMbway: null, paymentCard: 0 };
    expect(paymentChangedFrom(saved, pay("10", "", "", "2"))).toBe(false);
    expect(paymentChangedFrom(saved, pay("10"))).toBe(true);
    expect(paymentChangedFrom(saved, pay("12", "1"))).toBe(true);
  });

  it("paymentPayload: dinheiro = dinheiro + gorjeta", () => {
    expect(paymentPayload(pay("10", "5", "1", "2"))).toEqual({ paymentCash: 12, paymentMbway: 5, paymentCard: 1 });
  });

  it("priceMismatchFor: só ao editar os detalhes de uma vaga paga com outro serviço", () => {
    const base = { isPaid: true, editingDetails: true, serviceChanged: true, editedServicePrice: 18, totalPaid: 10 };
    expect(priceMismatchFor(base)).toBe(8); // falta cobrar
    expect(priceMismatchFor({ ...base, editedServicePrice: 6 })).toBe(-4); // a mais
    expect(priceMismatchFor({ ...base, isPaid: false })).toBe(0);
    expect(priceMismatchFor({ ...base, editingDetails: false })).toBe(0);
    expect(priceMismatchFor({ ...base, serviceChanged: false })).toBe(0);
  });

  describe("buildApptSaveData — só o que mudou", () => {
    const appt = { time: "10:00", date: "2026-07-01", serviceId: "s1", staffId: null };
    const edits = { time: "10:00", date: "2026-07-01", serviceId: "s1", staffId: "", duration: 30 };
    const args = { appt, originalDuration: 30, edits, pay: pay(), paymentChanged: false };

    it("sem alterações → objecto vazio", () => {
      expect(buildApptSaveData(args)).toEqual({});
    });
    it("hora, data, serviço, profissional e duração", () => {
      const d = buildApptSaveData({
        ...args,
        edits: { time: "11:00", date: "2026-07-02", serviceId: "s2", staffId: "p1", duration: 45 },
      });
      expect(d).toEqual({ time: "11:00", date: "2026-07-02", serviceId: "s2", staffId: "p1", duration: 45 });
    });
    it("tirar o profissional envia null", () => {
      const d = buildApptSaveData({ ...args, appt: { ...appt, staffId: "p1" }, edits: { ...edits, staffId: "" } });
      expect(d).toEqual({ staffId: null });
    });
    it("pagamento alterado inclui os três valores (gorjeta no dinheiro)", () => {
      const d = buildApptSaveData({ ...args, pay: pay("10", "", "", "2"), paymentChanged: true });
      expect(d).toEqual({ paymentCash: 12, paymentMbway: 0, paymentCard: 0 });
    });
  });
});
