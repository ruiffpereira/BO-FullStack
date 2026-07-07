import { describe, it, expect } from "vitest";
import { paymentTone } from "../../src/lib/paymentTone";

describe("paymentTone — tom do botão único de pagamento vs a linha Total", () => {
  it("falta dinheiro → amber, com o valor em falta no hint", () => {
    const info = paymentTone(6, 10);
    expect(info.tone).toBe("amber");
    expect(info.hint).toContain("faltam 4.00 €");
  });

  it("valor certo → blue", () => {
    const info = paymentTone(10, 10);
    expect(info.tone).toBe("blue");
    expect(info.hint).toBe("Valor certo");
  });

  it("valor a mais → green, com o excedente no hint", () => {
    const info = paymentTone(13, 10);
    expect(info.tone).toBe("green");
    expect(info.hint).toContain("+3.00 €");
  });

  it("tolerância de 1 cêntimo: 9.995 vs 10 continua 'certo'", () => {
    expect(paymentTone(9.995, 10).tone).toBe("blue");
  });

  it("sem nada introduzido e serviço grátis (preço 0) → certo (0 == 0)", () => {
    expect(paymentTone(0, 0).tone).toBe("blue");
  });

  it("nada introduzido com preço > 0 → amber (fica em dívida total)", () => {
    const info = paymentTone(0, 10);
    expect(info.tone).toBe("amber");
    expect(info.hint).toContain("faltam 10.00 €");
  });
});
