import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// A inbox de leads é conduzida por 2 hooks gerados (Kubb, sem escritas à mão):
//   - useGetLeads (lista, filtrada por `?status=` — novo/lido/arquivado)
//   - usePatchLeadsId (marcar como lido / arquivar)
// + o write-guard partilhado do platform billing (useGetBillingSubscription,
// via useWriteGuard/GuardButton) — mesmo padrão do writeGuard.test.tsx.

const useGetLeadsMock = vi.fn();
const patchMutateMock = vi.fn();
const useBillingMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetLeads", () => ({
  useGetLeads: (params?: unknown) => useGetLeadsMock(params),
  getLeadsQueryKey: (params?: unknown) => [{ url: "/leads" }, ...(params ? [params] : [])],
}));
vi.mock("../../src/gen/backoffice/hooks/usePatchLeadsId", () => ({
  usePatchLeadsId: () => ({ mutate: patchMutateMock, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => useBillingMock(),
}));

import { LeadsInbox } from "../../src/pages/clientes/LeadsInbox";

type LeadFixture = {
  leadId: string;
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  source?: string | null;
  status: "new" | "read" | "archived";
  createdAt: string;
  updatedAt: string;
};

const LONG_MESSAGE = "a".repeat(200);

const ALL_LEADS: LeadFixture[] = [
  {
    leadId: "lead-new",
    userId: "u1",
    name: "Maria Novo",
    email: "maria@example.com",
    phone: "912345678",
    message: LONG_MESSAGE,
    source: "Formulário de contacto",
    status: "new",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
  },
  {
    leadId: "lead-read",
    userId: "u1",
    name: "Bruno Lido",
    email: "bruno@example.com",
    phone: null,
    message: "Já vi o site, queria saber preços.",
    source: null,
    status: "read",
    createdAt: "2026-06-28T09:00:00.000Z",
    updatedAt: "2026-06-29T09:00:00.000Z",
  },
  {
    leadId: "lead-archived",
    userId: "u1",
    name: "Rui Arquivado",
    email: "rui@example.com",
    phone: "913000000",
    message: "Pedido antigo já tratado.",
    source: "Landing page",
    status: "archived",
    createdAt: "2026-06-01T08:00:00.000Z",
    updatedAt: "2026-06-02T08:00:00.000Z",
  },
];

// Simula o comportamento real da API: `status` no query param filtra; sem
// `status` (filtro "Todos") devolve tudo.
function makeLeadsMock(leads: LeadFixture[]) {
  return (params?: { status?: string }) => {
    const rows = params?.status ? leads.filter((l) => l.status === params.status) : leads;
    return { data: { count: rows.length, rows }, isLoading: false, isError: false };
  };
}

function mockBilling(readOnly: boolean) {
  useBillingMock.mockReturnValue({
    data: { readOnly, reason: readOnly ? "past_due_locked" : "active" },
  });
}

function renderInbox(initialEntries: string[] = ["/clientes"]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <LeadsInbox />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBilling(false);
});

describe("LeadsInbox — lista e badges de estado", () => {
  it("mostra nome, email, telefone, origem, data e badge de estado; trunca mensagem longa com 'Ver mais'", () => {
    useGetLeadsMock.mockImplementation(makeLeadsMock(ALL_LEADS));
    renderInbox();

    // Filtro por omissão = "Novos" → só o lead novo aparece
    expect(screen.getByText("Maria Novo")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
    expect(screen.getByText("912345678")).toBeInTheDocument();
    expect(screen.getByText("via Formulário de contacto")).toBeInTheDocument();
    expect(screen.getByText("Novo")).toBeInTheDocument();
    expect(screen.queryByText("Rui Arquivado")).not.toBeInTheDocument();

    // Mensagem truncada (200 chars) + afordância "Ver mais"
    const msg = screen.getByTestId("lead-message-lead-new");
    expect(msg.textContent).toContain("a".repeat(160));
    expect(msg.textContent).not.toContain("a".repeat(161));
    expect(msg).toHaveTextContent("Ver mais");

    // Expandir mostra a mensagem completa
    fireEvent.click(screen.getByText("Maria Novo").closest("button") as HTMLElement);
    expect(msg.textContent).toContain(LONG_MESSAGE);
    expect(msg).toHaveTextContent("Ver menos");
  });

  it("separadores Novos/Todos/Arquivados mudam o filtro e refazem o pedido (useGetLeads)", () => {
    useGetLeadsMock.mockImplementation(makeLeadsMock(ALL_LEADS));
    renderInbox();

    expect(screen.getByText("Maria Novo")).toBeInTheDocument();
    expect(screen.queryByText("Rui Arquivado")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Arquivados/ }));
    expect(useGetLeadsMock).toHaveBeenCalledWith({ status: "archived" });
    expect(screen.getByText("Rui Arquivado")).toBeInTheDocument();
    expect(screen.getByText("Arquivado")).toBeInTheDocument();
    expect(screen.queryByText("Maria Novo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Todos" }));
    expect(useGetLeadsMock).toHaveBeenCalledWith(undefined);
    expect(screen.getByText("Maria Novo")).toBeInTheDocument();
    expect(screen.getByText("Bruno Lido")).toBeInTheDocument();
    expect(screen.getByText("Lido")).toBeInTheDocument();
    expect(screen.getByText("Rui Arquivado")).toBeInTheDocument();
  });

  it("mostra um empty state quando o filtro não tem leads", () => {
    useGetLeadsMock.mockImplementation(() => ({
      data: { count: 0, rows: [] },
      isLoading: false,
      isError: false,
    }));
    renderInbox();
    expect(screen.getByText("Sem leads novos")).toBeInTheDocument();
  });
});

describe("LeadsInbox — ações (marcar lido / arquivar)", () => {
  it("'Marcar como lida' chama a mutação PATCH com o id certo e status:'read'", () => {
    useGetLeadsMock.mockImplementation(makeLeadsMock(ALL_LEADS));
    renderInbox();

    fireEvent.click(screen.getByRole("button", { name: "Marcar como lida" }));
    expect(patchMutateMock).toHaveBeenCalledWith(
      { id: "lead-new", data: { status: "read" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("'Arquivar' chama a mutação PATCH com o id certo e status:'archived'", () => {
    useGetLeadsMock.mockImplementation(makeLeadsMock(ALL_LEADS));
    renderInbox();

    fireEvent.click(screen.getByRole("button", { name: "Arquivar" }));
    expect(patchMutateMock).toHaveBeenCalledWith(
      { id: "lead-new", data: { status: "archived" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("expandir um lead novo marca-o como lido automaticamente, sem toast (chamada silenciosa)", () => {
    useGetLeadsMock.mockImplementation(makeLeadsMock(ALL_LEADS));
    renderInbox();

    fireEvent.click(screen.getByText("Maria Novo").closest("button") as HTMLElement);
    // Chamada "silenciosa": só 1 argumento (sem onSuccess de toast) — distingue
    // do clique explícito em "Marcar como lida" (testado acima, com 2 args).
    expect(patchMutateMock).toHaveBeenCalledWith({ id: "lead-new", data: { status: "read" } });
    expect(patchMutateMock.mock.calls[0]).toHaveLength(1);
  });

  it("write-guard: em read-only, as ações ficam desativadas", () => {
    useGetLeadsMock.mockImplementation(makeLeadsMock(ALL_LEADS));
    mockBilling(true);
    renderInbox();

    expect(screen.getByRole("button", { name: "Marcar como lida" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Arquivar" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Marcar como lida" }));
    expect(patchMutateMock).not.toHaveBeenCalled();
  });
});

describe("LeadsInbox — deep-link de notificação (?lead=)", () => {
  it("com ?lead=<id>, muda para 'Todos', expande e marca como lido o lead indicado", () => {
    useGetLeadsMock.mockImplementation(makeLeadsMock(ALL_LEADS));
    renderInbox(["/clientes?tab=leads&lead=lead-new"]);

    // Força o filtro "Todos" (o lead pode não estar em "Novos")
    expect(useGetLeadsMock).toHaveBeenCalledWith(undefined);
    expect(screen.getByText("Maria Novo")).toBeInTheDocument();

    const btn = screen.getByText("Maria Novo").closest("button") as HTMLElement;
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(patchMutateMock).toHaveBeenCalledWith({ id: "lead-new", data: { status: "read" } });
  });
});
