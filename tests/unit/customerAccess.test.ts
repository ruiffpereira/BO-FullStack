import { describe, it, expect } from "vitest";
import { customerAccess, paidAmountToShow, profileTabsFor } from "../../src/components/customers/customerAccess";

const owner = { can: () => true, hasPermission: () => true };
/** Membro: só as folhas dadas (nível `view` ou `edit`; `edit` implica `view`). */
const member = (grants: Record<string, "view" | "edit">, perms: string[] = []) => ({
  can: (key: string, level: "view" | "edit" = "view") => {
    const g = grants[key];
    return !!g && (level === "view" || g === "edit");
  },
  hasPermission: (name: string) => perms.includes(name),
});

describe("customerAccess (EQ-06) — permissões da ficha de cliente", () => {
  it("o dono pode tudo e vê o dinheiro", () => {
    const a = customerAccess(owner);
    expect(a).toMatchObject({
      canBlock: true,
      onlyInvoicePrefs: false,
      showMoney: true,
      canSchedule: true,
      canGym: true,
      canMail: true,
      canExport: true,
      canErase: true,
    });
  });

  it("sem `valores` (ver) não há dinheiro", () => {
    const a = customerAccess(member({ "clientes.lista": "edit", agenda: "view" }, ["VIEW_SCHEDULE"]));
    expect(a.showMoney).toBe(false);
    expect(a.canBlock).toBe(true);
    expect(a.canSchedule).toBe(true);
  });

  it("quem só edita a Agenda (e não `clientes.lista`) mexe apenas na preferência de fatura", () => {
    const a = customerAccess(member({ "agenda.marcacoes": "edit", agenda: "view" }, ["VIEW_SCHEDULE"]));
    expect(a.canBlock).toBe(false);
    expect(a.onlyInvoicePrefs).toBe(true);
  });

  it("quem edita `clientes.lista` não cai no modo «só fatura»", () => {
    const a = customerAccess(member({ "clientes.lista": "edit", "agenda.marcacoes": "edit" }));
    expect(a.canBlock).toBe(true);
    expect(a.onlyInvoicePrefs).toBe(false);
  });

  it("exportar e apagar são acções próprias", () => {
    expect(customerAccess(member({ "clientes.lista": "edit" })).canExport).toBe(false);
    expect(customerAccess(member({ "clientes.lista.exportar": "edit" })).canExport).toBe(true);
    expect(customerAccess(member({ "clientes.lista.apagar": "edit" })).canErase).toBe(true);
  });

  it("os separadores só existem com o módulo E a folha", () => {
    expect(profileTabsFor({ canSchedule: false, canGym: false, canMail: false })).toEqual([]);
    expect(profileTabsFor({ canSchedule: true, canGym: false, canMail: true }).map((t) => t.id)).toEqual(["agenda", "emails"]);
    const a = customerAccess(member({ "financeiro.mensalidades": "view" }, []));
    expect(a.canGym).toBe(false); // folha sem o módulo VIEW_GYM
  });
});

describe("paidAmountToShow", () => {
  const paid = { paidAt: "2026-01-01", paymentCash: 10, paymentMbway: 5, paymentCard: 0 };
  it("soma os métodos quando há pagamento e valores", () => {
    expect(paidAmountToShow(paid, true)).toBe(15);
  });
  it("nunca mostra dinheiro sem `valores`", () => {
    expect(paidAmountToShow(paid, false)).toBeNull();
  });
  it("sem pagamento ou a zero → nada (nunca «0 €»)", () => {
    expect(paidAmountToShow({ ...paid, paidAt: null }, true)).toBeNull();
    expect(paidAmountToShow({ paidAt: "2026-01-01" }, true)).toBeNull();
  });
});
