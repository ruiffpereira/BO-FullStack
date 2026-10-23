import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

// LJ-05 / LJ-11 — a Loja NÃO calcula totais nem o limite de stock baixo: lê-os da API (`stats`).
// 25 encomendas no tenant, só 20 chegam por página; o «Total faturado» é o da API (sem canceladas/reembolsadas).

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ authHeader: () => ({}), hasPermission: () => true, isMember: false, can: () => true, member: null }),
}));
vi.mock("../../src/hooks/useTeamAccess", () => ({
  useTeamAccess: () => ({ can: () => true, canAny: () => true, isMember: false, scopeOf: () => "todos", staffId: null }),
}));
vi.mock("../../src/hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({ readOnly: false, billingReadOnly: false, viewOnly: false, reason: "active", message: "" }),
}));
vi.mock("../../src/hooks/useStaff", () => ({
  useStaffOptions: () => ({ staff: [], active: [], hasStaff: false, isLoading: false }),
}));
vi.mock("../../src/hooks/useSettingsLanguages", () => ({ useGetSettingsLanguages: () => ({ data: { default: "pt" } }) }));
vi.mock("../../src/context/PageMetaContext", () => ({ usePageSubtitle: () => {} }));

const productsMock = vi.hoisted(() => vi.fn());
const ordersMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/gen/backoffice/hooks/useGetProducts.js", () => ({
  useGetProducts: () => productsMock(),
  getProductsQueryKey: () => [{ url: "/products" }],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetOrders.js", () => ({
  useGetOrders: (...a: unknown[]) => ordersMock(...a),
  getOrdersQueryKey: () => [{ url: "/orders" }],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetCategories.js", () => ({
  useGetCategories: () => ({ data: { rows: [] } }),
  getCategoriesQueryKey: () => [{ url: "/categories" }],
}));
const idle = vi.hoisted(() => () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false }));
vi.mock("../../src/gen/backoffice/hooks/usePutOrdersId.js", () => ({ usePutOrdersId: idle }));
vi.mock("../../src/gen/backoffice/hooks/usePostProducts.js", () => ({ usePostProducts: idle }));
vi.mock("../../src/gen/backoffice/hooks/usePutProductsId.js", () => ({ usePutProductsId: idle }));
vi.mock("../../src/gen/backoffice/hooks/useDeleteProductsId.js", () => ({ useDeleteProductsId: idle }));
vi.mock("../../src/gen/backoffice/hooks/usePutCategoriesId.js", () => ({ usePutCategoriesId: idle }));
vi.mock("../../src/gen/backoffice/hooks/useDeleteCategoriesId.js", () => ({ useDeleteCategoriesId: idle }));
vi.mock("../../src/gen/backoffice/hooks/usePutSubcategoriesId.js", () => ({ usePutSubcategoriesId: idle }));
vi.mock("../../src/gen/backoffice/hooks/useDeleteSubcategoriesId.js", () => ({ useDeleteSubcategoriesId: idle }));
vi.mock("../../src/gen/backoffice/hooks/useUploadImage.js", () => ({ uploadImage: vi.fn() }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loja } from "../../src/pages/Loja";
import { fmtEur } from "../../src/lib/money";

const orders = Array.from({ length: 20 }, (_, i) => ({ orderId: `order-${i}-xxxxxxxx`, price: 10, status: "delivered", createdAt: "2026-10-01T10:00:00Z" }));

function renderLoja(view: "produtos" | "encomendas") {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Loja view={view} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  productsMock.mockReturnValue({
    data: {
      count: 3,
      rows: [
        { productId: "p1", name: "A", price: 5, stock: 7 },
        { productId: "p2", name: "B", price: 5, stock: 2 },
        { productId: "p3", name: "C", price: 5, stock: 0 },
      ],
      // a API manda: 2 «baixo» (uma só constante lá), 1 esgotado, limite 5
      stats: { total: 3, stock: 9, low: 1, out: 1, lowStockMax: 5 },
    },
    isLoading: false,
  });
  ordersMock.mockReturnValue({
    data: { count: 25, page: 1, limit: 20, rows: orders, stats: { billed: 230, open: 2 } },
    isLoading: false,
  });
});

describe("Loja — totais e contadores vêm da API", () => {
  it("«Total faturado» é o da API (230), não a soma das 20 linhas visíveis (200)", () => {
    renderLoja("encomendas");
    expect(screen.getByText(fmtEur(230).replace(/\s/g, " "), { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(fmtEur(200).replace(/\s/g, " "), { exact: false })).not.toBeInTheDocument();
  });

  it("pede a página 1 com limite 20 e mostra «1–20 de 25»; avançar pede a página 2", async () => {
    const user = userEvent.setup();
    renderLoja("encomendas");
    expect(ordersMock.mock.calls[0][0]).toMatchObject({ page: 1, limit: 20 });
    expect(screen.getByText(/25/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Página seguinte" }));
    expect(ordersMock.mock.calls.at(-1)![0]).toMatchObject({ page: 2, limit: 20 });
  });

  it("contadores de stock são os da API (baixo 1, esgotados 1), não recalculados", () => {
    renderLoja("produtos");
    const low = screen.getAllByText("Stock baixo").find((e) => e.tagName === "P")!.previousElementSibling!;
    const out = screen.getAllByText("Esgotados").find((e) => e.tagName === "P")!.previousElementSibling!;
    expect(low.textContent).toBe("1");
    expect(out.textContent).toBe("1");
  });
});
