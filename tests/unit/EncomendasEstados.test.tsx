import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

// LJ-33 — o Backoffice mostra o estado e só os botões que a API manda em `allowedTransitions`;
// cancelar e reembolsar pedem confirmação (LJ-34); a tabela de passos não vive no frontend.

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

const ordersMock = vi.hoisted(() => vi.fn());
const mutate = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/gen/backoffice/hooks/useGetOrders.js", () => ({
  useGetOrders: (...a: unknown[]) => ordersMock(...a),
  getOrdersQueryKey: () => [{ url: "/orders" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePutOrdersId.js", () => ({
  usePutOrdersId: () => ({ mutate, isPending: false }),
}));
vi.mock("../../src/components/confirm", () => ({ confirmDialog: (...a: unknown[]) => confirmMock(...a) }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EncomendasTab } from "../../src/pages/loja/EncomendasTab";

const row = (orderId: string, status: string, allowedTransitions: string[]) => ({
  orderId, price: 20, status, allowedTransitions, createdAt: "2026-10-01T10:00:00Z",
});

function renderTab() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <EncomendasTab />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  confirmMock.mockResolvedValue(true);
  ordersMock.mockReturnValue({
    data: {
      count: 4, page: 1, limit: 20, stats: { billed: 40, open: 2 },
      rows: [
        row("aaaaaaaa-1", "pending", ["cancelled"]),
        row("bbbbbbbb-2", "processing", ["shipped", "cancelled", "refunded"]),
        row("cccccccc-3", "shipped", ["delivered", "refunded"]),
        row("dddddddd-4", "cancelled", []),
      ],
    },
    isLoading: false,
  });
});

describe("Loja → Encomendas — estado e passos", () => {
  it("mostra o estado de cada encomenda", () => {
    renderTab();
    for (const label of ["Por pagar", "A processar", "Enviada", "Cancelada"]) expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("só aparecem os botões que a API permite; estado final não tem botões", () => {
    renderTab();
    expect(screen.queryByRole("button", { name: /Marcar entregue \(encomenda aaaaaaaa/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar \(encomenda aaaaaaaa/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar enviada \(encomenda aaaaaaaa/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marcar enviada \(encomenda bbbbbbbb/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marcar entregue \(encomenda cccccccc/ })).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /encomenda dddddddd/ })).toHaveLength(0);
  });

  it("«Marcar enviada» grava logo, sem confirmação", async () => {
    renderTab();
    await userEvent.setup().click(screen.getByRole("button", { name: /Marcar enviada \(encomenda bbbbbbbb/ }));
    expect(confirmMock).not.toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledWith({ id: "bbbbbbbb-2", data: { status: "shipped" } });
  });

  it("cancelar e reembolsar pedem confirmação; se recusar, não grava", async () => {
    const user = userEvent.setup();
    renderTab();
    confirmMock.mockResolvedValueOnce(false);
    await user.click(screen.getByRole("button", { name: /Reembolsar \(encomenda bbbbbbbb/ }));
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock.mock.calls[0][0]).toMatchObject({ danger: true, leaf: "loja.encomendas" });
    expect(mutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Cancelar \(encomenda bbbbbbbb/ }));
    expect(mutate).toHaveBeenCalledWith({ id: "bbbbbbbb-2", data: { status: "cancelled" } });
  });
});
