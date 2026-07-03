import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// O painel admin de subscrições (Admin → tab "Faturação", T6) é conduzido por
// useGetAdminBillingSubscriptions (lista) + usePostAdminBillingSubscriptions
// (criar). Mockamos ambos os hooks gerados para testar a lista + o fluxo de criar
// sem servidor. A invalidação usa useQueryClient → envolvemos num
// QueryClientProvider real (a query em si está mockada, por isso não faz rede).

const useAdminListMock = vi.fn();
const postMutateMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetAdminBillingSubscriptions", () => ({
  useGetAdminBillingSubscriptions: () => useAdminListMock(),
  getAdminBillingSubscriptionsQueryKey: () => [{ url: "/admin/billing/subscriptions" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminBillingSubscriptions", () => ({
  usePostAdminBillingSubscriptions: () => ({ mutate: postMutateMock, isPending: false }),
}));

import { AdminBillingTab } from "../../src/components/AdminBilling";

type Tenant = {
  userId: string;
  name: string;
  email: string;
  subscription:
    | { status: string; modules: string[]; monthlyTotalEur: number }
    | null;
};

function mockList(tenants: Tenant[], isLoading = false) {
  useAdminListMock.mockReturnValue({ data: tenants, isLoading });
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminBillingTab />
    </QueryClientProvider>,
  );
}

const TENANTS: Tenant[] = [
  { userId: "u1", name: "Barbearia Um", email: "um@example.com", subscription: null },
  {
    userId: "u2",
    name: "Ginásio Dois",
    email: "dois@example.com",
    subscription: { status: "active", modules: ["agenda", "gym"], monthlyTotalEur: 45 },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminBillingTab — lista de tenants", () => {
  it("mostra os tenants com estado, módulos e total", () => {
    mockList(TENANTS);
    renderTab();

    // Tenant sem subscrição → badge "Sem subscrição"
    expect(screen.getByText("Barbearia Um")).toBeInTheDocument();
    expect(screen.getByText("Sem subscrição")).toBeInTheDocument();

    // Tenant com subscrição ativa → badge "Ativa" + módulos + total
    expect(screen.getByText("Ginásio Dois")).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
    expect(screen.getByText(/45,00\s*€/)).toBeInTheDocument();
  });

  it("mostra um empty state quando não há tenants", () => {
    mockList([]);
    renderTab();
    expect(screen.getByText("Sem tenants")).toBeInTheDocument();
  });
});

describe("AdminBillingTab — criar subscrição", () => {
  it("escolhe tenant + módulo e dispara a mutação com o payload certo", () => {
    mockList(TENANTS);
    renderTab();

    // Abre o modal (antes de abrir só existe o botão de topo)
    fireEvent.click(screen.getByRole("button", { name: /criar subscrição/i }));

    const dialog = screen.getByRole("dialog");

    // Escolhe o tenant no Combobox (opções em portal, fora do dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: /escolher tenant/i }));
    fireEvent.click(screen.getByText(/Barbearia Um — um@example\.com/i));

    // Marca o módulo Agenda
    fireEvent.click(within(dialog).getByLabelText("Agenda"));

    // Submete (botão do rodapé do modal)
    fireEvent.click(within(dialog).getByRole("button", { name: /criar subscrição/i }));

    expect(postMutateMock).toHaveBeenCalledTimes(1);
    expect(postMutateMock).toHaveBeenCalledWith({
      data: { userId: "u1", modules: ["agenda"] },
    });
  });

  it("não dispara a mutação sem tenant/módulo (validação)", () => {
    mockList(TENANTS);
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /criar subscrição/i }));
    const dialog = screen.getByRole("dialog");
    // Submeter sem escolher nada
    fireEvent.click(within(dialog).getByRole("button", { name: /criar subscrição/i }));

    expect(postMutateMock).not.toHaveBeenCalled();
  });
});
