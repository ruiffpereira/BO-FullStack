import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateMoney, isMoneyKey } from "../../src/lib/invalidateMoney";

// FI-05: toda a mutation que mexe em dinheiro invalida o Dashboard, o Financeiro, a Loja, as marcações e os clientes.
describe("invalidateMoney", () => {
  it("reconhece as chaves de dinheiro (Kubb e à mão) e ignora as outras", () => {
    expect(isMoneyKey(["dashboard", "30d"])).toBe(true);
    expect(isMoneyKey(["financeiro", "agenda"])).toBe(true);
    expect(isMoneyKey([{ url: "/orders" }, { page: 1 }])).toBe(true);
    expect(isMoneyKey([{ url: "/products" }])).toBe(true);
    expect(isMoneyKey([{ url: "/schedule/appointments/page" }])).toBe(true);
    expect(isMoneyKey([{ url: "/customers/:id/history", params: { id: "x" } }])).toBe(true);
    expect(isMoneyKey([{ url: "/expenses" }])).toBe(true);
    expect(isMoneyKey([{ url: "/gym/mensalidade/finance" }])).toBe(true);
    expect(isMoneyKey([{ url: "/settings/languages" }])).toBe(false);
    expect(isMoneyKey(["outra-coisa"])).toBe(false);
  });

  it("invalida só as queries de dinheiro", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["dashboard", "30d"], 1);
    qc.setQueryData(["financeiro", "loja"], 1);
    qc.setQueryData([{ url: "/orders" }], 1);
    qc.setQueryData([{ url: "/settings/languages" }], 1);
    const spy = vi.spyOn(qc, "invalidateQueries");
    await invalidateMoney(qc);
    expect(spy).toHaveBeenCalledTimes(1);
    const state = (k: unknown[]) => qc.getQueryState(k as never)!.isInvalidated;
    expect(state(["dashboard", "30d"])).toBe(true);
    expect(state(["financeiro", "loja"])).toBe(true);
    expect(state([{ url: "/orders" }])).toBe(true);
    expect(state([{ url: "/settings/languages" }])).toBe(false);
  });
});
