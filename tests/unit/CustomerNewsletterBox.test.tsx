import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Ficha do cliente → «Aceita novidades por email» (B42 · fase 8) ────────────────────────────────────────────────

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => authMock() }));
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));

const getMock = vi.fn();
const putMutate = vi.fn();
const toastError = vi.fn();
const opts: Record<string, any> = {};

vi.mock("../../src/gen/backoffice/hooks/useGetCustomersCustomeridNewsletter.js", () => ({
  useGetCustomersCustomeridNewsletter: (id: string, o: unknown) => getMock(id, o),
  getCustomersCustomeridNewsletterQueryKey: (id: string) => [{ url: "/customers/:customerId/newsletter", params: { customerId: id } }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePutCustomersCustomeridNewsletter.js", () => ({
  usePutCustomersCustomeridNewsletter: (o: any) => ((opts.put = o), { mutate: putMutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

import { CustomerNewsletterBox } from "../../src/components/correio/CustomerNewsletterBox";

const N = (over: object) => ({ subscribed: false, status: "none", blocked: false, source: null, subscribedAt: null, hasEmail: true, ...over });

function setAuth(canEdit: boolean) {
  authMock.mockReturnValue({
    supportSession: null,
    isMember: !canEdit,
    member: null,
    can: (_k: string, level: string = "view") => (level === "edit" ? canEdit : true),
  });
}

function renderBox() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CustomerNewsletterBox customerId="cu1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(opts)) delete opts[k];
  setAuth(true);
  getMock.mockReturnValue({ data: N({}), isLoading: false, isError: false });
});

describe("CustomerNewsletterBox", () => {
  it("não subscrito: interruptor desligado; marcar faz PUT subscribed true", async () => {
    renderBox();
    const sw = screen.getByRole("switch", { name: "Aceita novidades por email" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(putMutate).toHaveBeenCalledWith({ customerId: "cu1", data: { subscribed: true } });
  });

  it("subscrito: mostra a origem e a data; desmarcar faz PUT false", async () => {
    getMock.mockReturnValue({
      data: N({ subscribed: true, status: "subscribed", source: "balcao", subscribedAt: "2026-10-12T10:00:00.000Z" }),
      isLoading: false,
      isError: false,
    });
    renderBox();
    expect(screen.getByTestId("customer-newsletter-detail")).toHaveTextContent("Origem: Balcão");
    expect(screen.getByTestId("customer-newsletter-detail")).toHaveTextContent("desde");
    const sw = screen.getByRole("switch", { name: "Aceita novidades por email" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.click(sw);
    expect(putMutate).toHaveBeenCalledWith({ customerId: "cu1", data: { subscribed: false } });
  });

  it("só-ver: o interruptor fica desactivado", () => {
    setAuth(false);
    renderBox();
    expect(screen.getByRole("switch", { name: "Aceita novidades por email" })).toBeDisabled();
  });

  it("sem email na ficha ou bloqueado: desactivado com a explicação", () => {
    getMock.mockReturnValue({ data: N({ hasEmail: false }), isLoading: false, isError: false });
    const { unmount } = renderBox();
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByTestId("customer-newsletter-detail")).toHaveTextContent("não tem email");
    unmount();
    getMock.mockReturnValue({ data: N({ blocked: true, status: "bounced" }), isLoading: false, isError: false });
    renderBox();
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByTestId("customer-newsletter-detail")).toHaveTextContent("bloqueado");
  });

  it("409 contact_blocked / customer_no_email → mensagem PT", () => {
    renderBox();
    opts.put.mutation.onError({ response: { status: 409, data: { error: "x", code: "CONTACT_BLOCKED" } } });
    expect(toastError).toHaveBeenLastCalledWith(expect.stringContaining("bloqueado"));
    opts.put.mutation.onError({ response: { status: 409, data: { error: "x", code: "CUSTOMER_NO_EMAIL" } } });
    expect(toastError).toHaveBeenLastCalledWith("Este cliente não tem email na ficha.");
  });
});
