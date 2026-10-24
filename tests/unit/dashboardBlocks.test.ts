import { describe, expect, it } from "vitest";
import {
  NO_BLOCKS,
  dashboardBlocks,
  dashboardSpine,
  hasAnyBlock,
  hasRevenue,
  revenueSourcesLabel,
} from "../../src/lib/dashboardBlocks";

const perms = { schedule: true, products: true, gym: false };

describe("dashboardBlocks — o que o Dashboard mostra", () => {
  it("o dono vê os módulos do tenant (Clientes é core), como sempre", () => {
    const b = dashboardBlocks({ isMember: false, included: undefined, perms });
    expect(b).toMatchObject({ schedule: true, scheduleValues: true, orders: true, stock: true, customers: true, gymRevenue: false, gymMembers: false });
    expect(dashboardSpine(b)).toBe("agenda");
    expect(revenueSourcesLabel(b)).toBe("agenda + loja");
  });

  it("o dono sem a permissão de clientes não tem o bloco «Clientes» (o pedido daria 403)", () => {
    const b = dashboardBlocks({ isMember: false, included: undefined, perms: { ...perms, customers: false } });
    expect(b.customers).toBe(false);
    expect(b.schedule).toBe(true);
  });

  it("um membro lê só o `included`; enquanto o /dashboard não responde não tem nada", () => {
    expect(dashboardBlocks({ isMember: true, included: undefined, perms })).toEqual(NO_BLOCKS);
    expect(hasAnyBlock(NO_BLOCKS)).toBe(false);
  });

  it("os tectos do tenant não contam para o membro — só o que a API incluiu", () => {
    const b = dashboardBlocks({ isMember: true, included: ["ecommerce.orders", "expenses"], perms });
    expect(b.orders).toBe(true);
    expect(b.expenses).toBe(true);
    expect(b.schedule).toBe(false);
    expect(b.customers).toBe(false);
    expect(b.stock).toBe(false);
  });

  it("sem `schedule.valores` a agenda mostra marcações mas não conta para a receita", () => {
    const b = dashboardBlocks({ isMember: true, included: ["schedule"], perms });
    expect(b.schedule).toBe(true);
    expect(b.scheduleValues).toBe(false);
    expect(hasRevenue(b)).toBe(false); // nada de "Receita de hoje: €0"
    expect(revenueSourcesLabel(b)).toBe("");
  });

  it("a receita junta só as fontes visíveis", () => {
    const b = dashboardBlocks({ isMember: true, included: ["schedule", "schedule.valores", "gym.revenue"], perms });
    expect(hasRevenue(b)).toBe(true);
    expect(revenueSourcesLabel(b)).toBe("agenda + ginásio");
  });

  it("a peça central segue a prioridade operacional e cai para `none` sem nenhuma", () => {
    const pick = (included: string[]) => dashboardSpine(dashboardBlocks({ isMember: true, included, perms }));
    expect(pick(["schedule", "gym.revenue"])).toBe("agenda");
    expect(pick(["gym.revenue", "ecommerce.orders"])).toBe("gym");
    expect(pick(["ecommerce.orders", "ecommerce.customers"])).toBe("loja");
    expect(pick(["ecommerce.customers"])).toBe("core");
    // Só stock / sócios / despesas: não há espinha — o resto vai para o carril, sem buracos.
    expect(pick(["ecommerce.stock"])).toBe("none");
    expect(pick(["gym.members", "expenses"])).toBe("none");
    expect(pick([])).toBe("none");
  });
});
