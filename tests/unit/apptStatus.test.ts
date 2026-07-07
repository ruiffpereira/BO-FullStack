import { describe, it, expect } from "vitest";
import { apptStatusView, apptDebt } from "../../src/lib/apptStatus";

describe("apptStatusView", () => {
  it("confirmada → azul", () => {
    const view = apptStatusView({ status: "confirmed" });
    expect(view.tone).toBe("blue");
    expect(view.label).toBe("Confirmada");
    expect(view.debt).toBe(0);
  });

  it("concluída sem dívida (paga por completo) → verde", () => {
    const view = apptStatusView({
      status: "completed",
      servicePrice: 30,
      paymentCash: 30,
    });
    expect(view.tone).toBe("green");
    expect(view.label).toBe("Concluída");
    expect(view.debt).toBe(0);
  });

  it("concluída com dívida (pagamento parcial) → amarelo, label inclui o valor", () => {
    const view = apptStatusView({
      status: "completed",
      servicePrice: 30,
      paymentCash: 15,
    });
    expect(view.tone).toBe("amber");
    expect(view.label).toBe("Dívida 15.00 €");
    expect(view.debt).toBe(15);
  });

  it("cancelada → vermelho", () => {
    const view = apptStatusView({ status: "cancelled" });
    expect(view.tone).toBe("red");
    expect(view.label).toBe("Cancelada");
  });

  it("pendente → âmbar", () => {
    const view = apptStatusView({ status: "pending" });
    expect(view.tone).toBe("amber");
    expect(view.label).toBe("Pendente");
  });

  it("faltou (no_show) → neutro", () => {
    const view = apptStatusView({ status: "no_show" });
    expect(view.tone).toBe("neutral");
    expect(view.label).toBe("Faltou");
  });

  it("estado desconhecido → neutro, label = o próprio estado", () => {
    const view = apptStatusView({ status: "algo_novo" });
    expect(view.tone).toBe("neutral");
    expect(view.label).toBe("algo_novo");
  });

  it("sem status → assume pendente", () => {
    const view = apptStatusView({});
    expect(view.key).toBe("pending");
    expect(view.tone).toBe("amber");
  });

  it("dívida com pagamento repartido (dinheiro + cartão parcial)", () => {
    const debt = apptDebt({
      status: "completed",
      servicePrice: 50,
      paymentCash: 10,
      paymentMbway: 5,
      paymentCard: 20,
    });
    expect(debt).toBe(15);
  });

  it("dívida usa service.price como fallback quando não há servicePrice", () => {
    const debt = apptDebt({
      status: "completed",
      service: { price: 40 },
      paymentCard: 25,
    });
    expect(debt).toBe(15);
  });

  it("nunca há dívida fora de 'completed', mesmo sem pagamento", () => {
    expect(apptDebt({ status: "confirmed", servicePrice: 30 })).toBe(0);
    expect(apptDebt({ status: "pending", servicePrice: 30 })).toBe(0);
    expect(apptDebt({ status: "cancelled", servicePrice: 30 })).toBe(0);
  });

  it("dívida nunca é negativa (pagamento acima do preço)", () => {
    expect(
      apptDebt({ status: "completed", servicePrice: 20, paymentCash: 25 }),
    ).toBe(0);
  });

  it("resíduo de vírgula flutuante em pagamento repartido não gera dívida falsa", () => {
    const view = apptStatusView({
      status: "completed",
      servicePrice: 0.87,
      paymentCash: 0.29,
      paymentMbway: 0.29,
      paymentCard: 0.29,
    });
    expect(view.debt).toBe(0);
    expect(view.tone).toBe("green");
    expect(view.label).toBe("Concluída");
  });

  it("statusLabel de faltou (no_show) é 'Faltou'", () => {
    expect(apptStatusView({ status: "no_show" }).statusLabel).toBe("Faltou");
  });

  it("statusLabel de concluída com dívida é 'Concluída' (não duplica o valor em dívida)", () => {
    const view = apptStatusView({
      status: "completed",
      servicePrice: 30,
      paymentCash: 15,
    });
    expect(view.statusLabel).toBe("Concluída");
    expect(view.label).toBe("Dívida 15.00 €");
  });
});
