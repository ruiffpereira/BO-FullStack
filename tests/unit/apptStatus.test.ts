import { describe, it, expect } from "vitest";
import { apptStatusView, apptDebt } from "../../src/lib/apptStatus";
import { fmtEur } from "../../src/lib/money";

describe("apptStatusView", () => {
  it("confirmada → azul", () => {
    const view = apptStatusView({ status: "confirmed" });
    expect(view.tone).toBe("blue");
    expect(view.label).toBe("Confirmada");
    expect(view.debt).toBe(0);
  });

  it("concluída sem dívida (paga por completo) → verde", () => {
    const view = apptStatusView({ status: "completed", debt: 0 });
    expect(view.tone).toBe("green");
    expect(view.label).toBe("Concluída");
    expect(view.debt).toBe(0);
  });

  it("concluída com dívida (pagamento parcial) → amarelo, label inclui o valor", () => {
    const view = apptStatusView({ status: "completed", debt: 15 });
    expect(view.tone).toBe("amber");
    expect(view.label).toBe(`Dívida ${fmtEur(15)}`);
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

  it("a dívida é a que a API envia (`debt`): o ecrã não faz contas (AG-18)", () => {
    expect(apptDebt({ status: "completed", debt: 15 })).toBe(15);
    // mesmo com preço/pagamentos à vista, o que manda é o campo da API
    expect(apptDebt({ status: "completed", debt: 0 })).toBe(0);
  });

  it("sem os campos de dinheiro (membro sem 'valores') não inventa dívida a partir do preço do catálogo", () => {
    const appt = { status: "completed", service: { price: 40 } };
    expect(apptDebt(appt)).toBe(0);
    expect(apptStatusView(appt).label).toBe("Concluída");
  });

  it("sem `debt` (membro sem 'valores' ou resposta sem o campo) → 0, nunca negativa", () => {
    expect(apptDebt({ status: "completed" })).toBe(0);
    expect(apptDebt({ status: "completed", debt: -3 })).toBe(0);
  });

  it("AG-07: confirmada com dívida mostra o valor sem mudar o rótulo de estado", () => {
    const view = apptStatusView({ status: "confirmed", debt: 20 });
    expect(view.debt).toBe(20);
    expect(view.label).toBe("Confirmada");
  });

  it("statusLabel de faltou (no_show) é 'Faltou'", () => {
    expect(apptStatusView({ status: "no_show" }).statusLabel).toBe("Faltou");
  });

  it("statusLabel de concluída com dívida é 'Concluída' (não duplica o valor em dívida)", () => {
    const view = apptStatusView({ status: "completed", debt: 15 });
    expect(view.statusLabel).toBe("Concluída");
    expect(view.label).toBe(`Dívida ${fmtEur(15)}`);
  });
});
