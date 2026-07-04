import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// Convite de sócio por email: "Convidar sócio" (ConvidarSocioModal), plano
// predefinido no catálogo (SubscricoesModal → "Tornar predefinido") e badge
// "Convidado" para memberships pending (ClienteMensalidade). Mockamos os hooks
// gerados (Kubb) tocados por estes 3 componentes + o write-guard partilhado
// (useGetBillingSubscription), mesmo padrão do writeGuard.test.tsx /
// LeadsInbox.test.tsx / AdminBilling.test.tsx.

const useGetGymSubscriptionsMock = vi.fn();
const postGymMembersInviteMock = vi.fn();
const putGymSubscriptionsIdMock = vi.fn();
const useGetGymMensalidadeCustomersCustomeridMock = vi.fn();
const useBillingMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetGymSubscriptions", () => ({
  useGetGymSubscriptions: () => useGetGymSubscriptionsMock(),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostGymMembersInvite", () => ({
  postGymMembersInvite: (data: unknown) => postGymMembersInviteMock(data),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutGymSubscriptionsId", () => ({
  putGymSubscriptionsId: (id: string, data: unknown) => putGymSubscriptionsIdMock(id, data),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetGymMensalidadeCustomersCustomerid", () => ({
  useGetGymMensalidadeCustomersCustomerid: (id: string, opts?: unknown) =>
    useGetGymMensalidadeCustomersCustomeridMock(id, opts),
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ authHeader: () => ({}) }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => useBillingMock(),
}));
// Toast — silenciar (e permitir asserções no texto mostrado), mesmo padrão do NotificationsPanel.test.tsx.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ConvidarSocioModal, SubscricoesModal, ClienteMensalidade, type Sub, type Membership } from "../../src/pages/GymMensalidade";

function mockBilling(readOnly: boolean) {
  useBillingMock.mockReturnValue({ data: { readOnly, reason: readOnly ? "past_due_locked" : "active" } });
}

function renderWithQC(ui: JSX.Element) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const SUBS: Sub[] = [
  { subscriptionId: "sub-basic", name: "Básico", price: 25, dueDay: 8, active: true, isDefault: false, clientCount: 2 },
  { subscriptionId: "sub-default", name: "Mensal", price: 30, dueDay: 8, active: true, isDefault: true, clientCount: 5 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockBilling(false);
  useGetGymSubscriptionsMock.mockReturnValue({ data: SUBS });
});

describe("ConvidarSocioModal — convite de sócio por email", () => {
  it("pré-seleciona o plano predefinido do tenant", () => {
    renderWithQC(<ConvidarSocioModal onClose={vi.fn()} onInvited={vi.fn()} />);
    expect(screen.getByText("Mensal · Predefinido")).toBeInTheDocument();
  });

  it("envia { name, email, subscriptionId } ao convidar (plano predefinido pré-selecionado)", async () => {
    renderWithQC(<ConvidarSocioModal onClose={vi.fn()} onInvited={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana Sócia" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Convidar" }));

    await waitFor(() =>
      expect(postGymMembersInviteMock).toHaveBeenCalledWith({
        name: "Ana Sócia",
        email: "ana@example.com",
        subscriptionId: "sub-default",
      }),
    );
  });

  it("permite trocar o plano antes de convidar", async () => {
    const user = userEvent.setup();
    renderWithQC(<ConvidarSocioModal onClose={vi.fn()} onInvited={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Bruno Sócio" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bruno@example.com" } });
    // Combobox: <button> mostra o plano selecionado; abrir e escolher outro.
    await user.click(screen.getByRole("button", { name: "Mensal · Predefinido" }));
    await user.click(screen.getByRole("button", { name: "Básico" }));
    fireEvent.click(screen.getByRole("button", { name: "Convidar" }));

    await waitFor(() =>
      expect(postGymMembersInviteMock).toHaveBeenCalledWith({
        name: "Bruno Sócio",
        email: "bruno@example.com",
        subscriptionId: "sub-basic",
      }),
    );
  });

  it("write-guard: em read-only, o botão 'Convidar' fica desativado", () => {
    mockBilling(true);
    renderWithQC(<ConvidarSocioModal onClose={vi.fn()} onInvited={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    expect(screen.getByRole("button", { name: "Convidar" })).toBeDisabled();
  });

  it("'Convidar' fica desativado até preencher nome e email", () => {
    renderWithQC(<ConvidarSocioModal onClose={vi.fn()} onInvited={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Convidar" });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana Sócia" } });
    expect(btn).toBeDisabled(); // só o nome — ainda falta o email

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    expect(btn).toBeEnabled();
  });

  it("sucesso: chama onInvited, fecha a modal e mostra o toast 'Convite enviado por email'", async () => {
    postGymMembersInviteMock.mockResolvedValueOnce({ alreadyInvited: false });
    const onInvited = vi.fn();
    const onClose = vi.fn();
    renderWithQC(<ConvidarSocioModal onClose={onClose} onInvited={onInvited} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana Sócia" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Convidar" }));

    await waitFor(() => expect(onInvited).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Convite enviado por email");
  });

  it("sucesso com alreadyInvited: mostra o toast 'Sócio já tinha sido convidado'", async () => {
    postGymMembersInviteMock.mockResolvedValueOnce({ alreadyInvited: true });
    renderWithQC(<ConvidarSocioModal onClose={vi.fn()} onInvited={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana Sócia" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Convidar" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sócio já tinha sido convidado"));
  });
});

describe("SubscricoesModal — marcar plano predefinido", () => {
  it("mostra ★ Predefinido no plano atual e um botão 'Tornar predefinido' nos outros", () => {
    renderWithQC(<SubscricoesModal onClose={vi.fn()} />);
    expect(screen.getByText("★ Predefinido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tornar predefinido" })).toBeInTheDocument();
  });

  it("'Tornar predefinido' chama o update com { isDefault: true }", async () => {
    renderWithQC(<SubscricoesModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Tornar predefinido" }));
    await waitFor(() => expect(putGymSubscriptionsIdMock).toHaveBeenCalledWith("sub-basic", { isDefault: true }));
  });
});

describe("ClienteMensalidade — badge de sócio pendente", () => {
  const BASE_MEMBERSHIP: Membership = {
    customerId: "cust-1",
    name: "Ana Sócia",
    blocked: false,
    payOnly: false,
    subscription: null,
    payments: [],
    currentPeriod: "2026-07",
    today: "2026-07-04",
  };

  it("membership pending: mostra o badge 'Convidado'", () => {
    useGetGymMensalidadeCustomersCustomeridMock.mockReturnValue({
      data: { ...BASE_MEMBERSHIP, status: "pending" },
      isLoading: false,
    });
    renderWithQC(<ClienteMensalidade customerId="cust-1" />);
    expect(screen.getByText("Convidado")).toBeInTheDocument();
  });

  it("membership active: não mostra o badge 'Convidado'", () => {
    useGetGymMensalidadeCustomersCustomeridMock.mockReturnValue({
      data: { ...BASE_MEMBERSHIP, status: "active" },
      isLoading: false,
    });
    renderWithQC(<ClienteMensalidade customerId="cust-1" />);
    expect(screen.queryByText("Convidado")).not.toBeInTheDocument();
  });
});
