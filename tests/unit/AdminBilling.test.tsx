import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// O painel admin de faturação (Admin → tab "Faturação", VIEW_ADMIN) é conduzido
// por 4 hooks gerados:
//   - useGetAdminBillingSubscriptions (lista de tenants)
//   - usePostAdminBillingSubscriptions (criar subscrição — agora com override de
//     preço por módulo: items:[{ module, amountCents? }])
//   - useGetAdminBillingCatalog (catálogo de preços dos módulos)
//   - usePutAdminBillingCatalogModule (editar preço/estado de um módulo)
// Mockamos os 4 para testar a UI sem servidor. A invalidação usa useQueryClient →
// envolvemos num QueryClientProvider real (as queries em si estão mockadas).

const useAdminListMock = vi.fn();
const postMutateMock = vi.fn();
const useCatalogMock = vi.fn();
const putMutateMock = vi.fn();
const extendTrialMutateMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetAdminBillingSubscriptions", () => ({
  useGetAdminBillingSubscriptions: () => useAdminListMock(),
  getAdminBillingSubscriptionsQueryKey: () => [{ url: "/admin/billing/subscriptions" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminBillingSubscriptions", () => ({
  usePostAdminBillingSubscriptions: () => ({ mutate: postMutateMock, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetAdminBillingCatalog", () => ({
  useGetAdminBillingCatalog: () => useCatalogMock(),
  getAdminBillingCatalogQueryKey: () => [{ url: "/admin/billing/catalog" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePutAdminBillingCatalogModule", () => ({
  usePutAdminBillingCatalogModule: () => ({ mutate: putMutateMock, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePatchAdminBillingSubscriptionsUseridTrial", () => ({
  usePatchAdminBillingSubscriptionsUseridTrial: () => ({ mutate: extendTrialMutateMock, isPending: false }),
}));

import { AdminBillingTab } from "../../src/components/AdminBilling";
import { parseEurToCents, centsToEurInput } from "../../src/lib/billingStatus";

type Tenant = {
  userId: string;
  name: string;
  email: string;
  subscription:
    | { status: string; modules: string[]; monthlyTotalEur: number }
    | null;
};

type CatalogRow = {
  module: string;
  label: string;
  monthlyAmountCents: number;
  monthlyAmountEur: number;
  currency: string;
  active: boolean;
};

function mockList(tenants: Tenant[], isLoading = false) {
  useAdminListMock.mockReturnValue({ data: tenants, isLoading });
}
function mockCatalog(rows: CatalogRow[], isLoading = false) {
  useCatalogMock.mockReturnValue({ data: rows, isLoading });
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

const CATALOG: CatalogRow[] = [
  { module: "agenda", label: "Agenda", monthlyAmountCents: 1500, monthlyAmountEur: 15, currency: "eur", active: true },
  { module: "gym", label: "Ginásio", monthlyAmountCents: 3000, monthlyAmountEur: 30, currency: "eur", active: true },
  { module: "loja", label: "Loja", monthlyAmountCents: 2000, monthlyAmountEur: 20, currency: "eur", active: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  // Default seguro: o catálogo carregado (os testes que precisam override chamam mockCatalog).
  mockCatalog(CATALOG);
});

describe("AdminBillingTab — lista de tenants", () => {
  it("mostra os tenants com estado, módulos e total", () => {
    mockList(TENANTS);
    renderTab();

    expect(screen.getByText("Barbearia Um")).toBeInTheDocument();
    expect(screen.getByText("Sem subscrição")).toBeInTheDocument();

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

describe("AdminBillingTab — catálogo de preços", () => {
  it("mostra os módulos com preço em € e estado ativo/inativo", () => {
    mockList(TENANTS);
    mockCatalog(CATALOG);
    renderTab();

    // Preços em euros (não cêntimos), com vírgula decimal pt-PT.
    expect((screen.getByLabelText("Preço de Agenda") as HTMLInputElement).value).toBe("15,00");
    expect((screen.getByLabelText("Preço de Ginásio") as HTMLInputElement).value).toBe("30,00");
    expect((screen.getByLabelText("Preço de Loja") as HTMLInputElement).value).toBe("20,00");

    // Estado ativo: agenda/gym ativos, loja inativa (na ordem do catálogo).
    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toHaveAttribute("aria-checked", "true"); // agenda
    expect(switches[2]).toHaveAttribute("aria-checked", "false"); // loja
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });

  it("guardar um preço chama o PUT com o valor em cêntimos (vírgula decimal → cents)", () => {
    mockList(TENANTS);
    mockCatalog(CATALOG);
    renderTab();

    // Edita o preço da Agenda: 12,50 € → 1250 cêntimos.
    fireEvent.change(screen.getByLabelText("Preço de Agenda"), { target: { value: "12,50" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar Agenda" }));

    expect(putMutateMock).toHaveBeenCalledTimes(1);
    expect(putMutateMock).toHaveBeenCalledWith({
      module: "agenda",
      data: { monthlyAmountCents: 1250, active: true },
    });
  });

  it("alternar ativo/inativo e guardar envia o novo estado (preço inalterado)", () => {
    mockList(TENANTS);
    mockCatalog(CATALOG);
    renderTab();

    // Desliga o toggle da Agenda (ativo → inativo), sem mexer no preço.
    fireEvent.click(screen.getAllByRole("switch")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Guardar Agenda" }));

    expect(putMutateMock).toHaveBeenCalledWith({
      module: "agenda",
      data: { monthlyAmountCents: 1500, active: false },
    });
  });

  it("não guarda com um preço inválido (mostra o erro, botão desativado)", () => {
    mockList(TENANTS);
    mockCatalog(CATALOG);
    renderTab();

    fireEvent.change(screen.getByLabelText("Preço de Agenda"), { target: { value: "abc" } });
    expect(screen.getByText("Valor inválido.")).toBeInTheDocument();
    // Botão desativado → clicar não dispara o PUT.
    fireEvent.click(screen.getByRole("button", { name: "Guardar Agenda" }));
    expect(putMutateMock).not.toHaveBeenCalled();
  });
});

describe("AdminBillingTab — criar subscrição (com override de preço)", () => {
  it("sem override envia items com apenas o módulo (usa o preço do catálogo)", () => {
    mockList(TENANTS);
    mockCatalog(CATALOG);
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /criar subscrição/i }));
    const dialog = screen.getByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /escolher tenant/i }));
    fireEvent.click(screen.getByText(/Barbearia Um — um@example\.com/i));

    // Marca a Agenda, deixa o override vazio.
    fireEvent.click(within(dialog).getByLabelText("Agenda"));
    fireEvent.click(within(dialog).getByRole("button", { name: /criar subscrição/i }));

    expect(postMutateMock).toHaveBeenCalledTimes(1);
    expect(postMutateMock).toHaveBeenCalledWith({
      data: { userId: "u1", items: [{ module: "agenda" }] },
    });
  });

  it("com override envia items com amountCents convertido para cêntimos", () => {
    mockList(TENANTS);
    mockCatalog(CATALOG);
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /criar subscrição/i }));
    const dialog = screen.getByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /escolher tenant/i }));
    fireEvent.click(screen.getByText(/Barbearia Um — um@example\.com/i));

    // Marca a Agenda e escreve um preço personalizado: 19,90 € → 1990 cêntimos.
    fireEvent.click(within(dialog).getByLabelText("Agenda"));
    fireEvent.change(within(dialog).getByLabelText("Preço personalizado de Agenda"), {
      target: { value: "19,90" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /criar subscrição/i }));

    expect(postMutateMock).toHaveBeenCalledTimes(1);
    expect(postMutateMock).toHaveBeenCalledWith({
      data: { userId: "u1", items: [{ module: "agenda", amountCents: 1990 }] },
    });
  });

  it("não dispara a mutação sem tenant/módulo (validação)", () => {
    mockList(TENANTS);
    mockCatalog(CATALOG);
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /criar subscrição/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /criar subscrição/i }));

    expect(postMutateMock).not.toHaveBeenCalled();
  });

  it("cancelar limpa o formulário — tenant, módulo e override não persistem ao reabrir", () => {
    mockList(TENANTS);
    mockCatalog(CATALOG);
    renderTab();

    // Abre, escolhe tenant, marca um módulo e escreve um override de preço.
    fireEvent.click(screen.getByRole("button", { name: /criar subscrição/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /escolher tenant/i }));
    fireEvent.click(screen.getByText(/Barbearia Um — um@example\.com/i));
    fireEvent.click(within(dialog).getByLabelText("Agenda"));
    fireEvent.change(within(dialog).getByLabelText("Preço personalizado de Agenda"), {
      target: { value: "30,00" },
    });

    // Cancela → fecha sem submeter.
    fireEvent.click(within(dialog).getByRole("button", { name: /cancelar/i }));
    expect(postMutateMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Reabre → o formulário arranca limpo.
    fireEvent.click(screen.getByRole("button", { name: /criar subscrição/i }));
    const reopened = screen.getByRole("dialog");

    // Tenant não pré-selecionado: o botão volta ao placeholder "Escolher tenant…".
    expect(within(reopened).getByRole("button", { name: /escolher tenant/i })).toBeInTheDocument();
    // Módulo não marcado.
    expect(within(reopened).getByLabelText("Agenda")).not.toBeChecked();
    // Override some com o módulo desmarcado; ao voltar a marcar, vem vazio (não
    // arrasta o "30,00" do tenant anterior → sem cobrança errada).
    expect(within(reopened).queryByLabelText("Preço personalizado de Agenda")).not.toBeInTheDocument();
    fireEvent.click(within(reopened).getByLabelText("Agenda"));
    expect(
      (within(reopened).getByLabelText("Preço personalizado de Agenda") as HTMLInputElement).value,
    ).toBe("");
  });
});

describe("AdminBillingTab — estender trial (self-serve, T10)", () => {
  const TENANTS_TRIAL: Tenant[] = [
    { userId: "u1", name: "Barbearia Um", email: "um@example.com", subscription: null },
    {
      userId: "u2",
      name: "Ginásio Dois",
      email: "dois@example.com",
      subscription: { status: "trialing", modules: ["gym"], monthlyTotalEur: 30 },
    },
    {
      userId: "u3",
      name: "Loja Três",
      email: "tres@example.com",
      subscription: { status: "active", modules: ["loja"], monthlyTotalEur: 20 },
    },
  ];

  it('só aparece nas linhas com subscrição "trialing" (sem subscrição / ativa não têm a ação)', () => {
    mockList(TENANTS_TRIAL);
    renderTab();

    const rows = screen.getAllByRole("row");
    const trialRow = rows.find((r) => within(r).queryByText("Ginásio Dois"));
    const noneRow = rows.find((r) => within(r).queryByText("Barbearia Um"));
    const activeRow = rows.find((r) => within(r).queryByText("Loja Três"));

    expect(within(trialRow!).getByRole("button", { name: /estender trial/i })).toBeInTheDocument();
    expect(within(noneRow!).queryByRole("button", { name: /estender trial/i })).not.toBeInTheDocument();
    expect(within(activeRow!).queryByRole("button", { name: /estender trial/i })).not.toBeInTheDocument();
  });

  it("envia { days } corretamente ao confirmar", () => {
    mockList(TENANTS_TRIAL);
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /estender trial/i }));
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Dias a acrescentar"), { target: { value: "30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^estender$/i }));

    expect(extendTrialMutateMock).toHaveBeenCalledTimes(1);
    expect(extendTrialMutateMock).toHaveBeenCalledWith({ userId: "u2", data: { days: 30 } });
  });

  it("o valor por defeito é 14 dias", () => {
    mockList(TENANTS_TRIAL);
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /estender trial/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^estender$/i }));

    expect(extendTrialMutateMock).toHaveBeenCalledWith({ userId: "u2", data: { days: 14 } });
  });

  it("não envia com um valor fora de 1..90 (botão desativado + aviso)", () => {
    mockList(TENANTS_TRIAL);
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /estender trial/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Dias a acrescentar"), { target: { value: "0" } });

    expect(within(dialog).getByText(/introduz um número entre 1 e 90/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /^estender$/i }));
    expect(extendTrialMutateMock).not.toHaveBeenCalled();
  });
});

describe("parseEurToCents — fronteira do dinheiro (rejeita formatos não-monetários)", () => {
  it("rejeita formatos exóticos que o Number() engoliria (devolve null)", () => {
    expect(parseEurToCents("19,999")).toBeNull(); // >2 casas decimais
    expect(parseEurToCents("1e3")).toBeNull(); // notação científica
    expect(parseEurToCents("0x10")).toBeNull(); // hexadecimal
    expect(parseEurToCents("1.2.3")).toBeNull(); // dois separadores
    expect(parseEurToCents("abc")).toBeNull();
    expect(parseEurToCents("")).toBeNull();
    expect(parseEurToCents("-1")).toBeNull();
  });

  it("aceita dinheiro simples (1–2 casas, vírgula ou ponto) e arredonda a cêntimos", () => {
    expect(parseEurToCents("12")).toBe(1200);
    expect(parseEurToCents("12,5")).toBe(1250);
    expect(parseEurToCents("12.50")).toBe(1250);
    expect(parseEurToCents("19,99")).toBe(1999);
    expect(parseEurToCents("0")).toBe(0);
  });

  it("round-trip com centsToEurInput mantém o valor exato", () => {
    expect(parseEurToCents(centsToEurInput(1999))).toBe(1999);
    expect(parseEurToCents(centsToEurInput(3000))).toBe(3000);
    expect(parseEurToCents(centsToEurInput(0))).toBe(0);
  });
});
