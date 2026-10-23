import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

// Ficha do cliente → separador «Emails» (B42 · fase 6): as conversas da caixa do negócio com este cliente.
const byCustomerMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetMailByCustomerCustomerid.js", () => ({
  useGetMailByCustomerCustomerid: (id: string, params: unknown, o: unknown) => byCustomerMock(id, params, o),
}));

import { CustomerEmailsTab } from "../../src/components/correio/CustomerEmailsTab";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
function renderTab(onOpen?: () => void) {
  return render(
    <MemoryRouter initialEntries={["/clientes"]}>
      <CustomerEmailsTab customerId="c1" onOpen={onOpen} />
      <Where />
    </MemoryRouter>,
  );
}

const ITEM = {
  threadId: "t1",
  emailId: "e1",
  subject: "Dúvida sobre a marcação",
  preview: "Posso mudar a hora?",
  from: [{ name: "Maria", email: "maria@x.pt" }],
  to: [],
  receivedAt: "2026-10-19T09:00:00.000Z",
  unread: false,
  hasAttachment: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  byCustomerMock.mockReturnValue({ data: { mailboxId: "b1", configured: true, items: [ITEM], total: 1 }, isLoading: false, isError: false });
});

describe("CustomerEmailsTab", () => {
  it("pede as conversas do cliente certo", () => {
    renderTab();
    expect(byCustomerMock).toHaveBeenCalledWith("c1", { page: 1, limit: 10 }, expect.anything());
    expect(screen.getByText("Dúvida sobre a marcação")).toBeInTheDocument();
  });

  it("abrir uma conversa leva à Caixa nessa conversa (e fecha a ficha)", async () => {
    const onOpen = vi.fn();
    renderTab(onOpen);
    await userEvent.click(screen.getByTestId("mail-thread-row"));
    expect(onOpen).toHaveBeenCalled();
    expect(screen.getByTestId("where")).toHaveTextContent("/correio?caixa=b1&conversa=t1");
  });

  it("sem conversas: estado vazio", () => {
    byCustomerMock.mockReturnValue({ data: { mailboxId: "b1", configured: true, items: [], total: 0 }, isLoading: false, isError: false });
    renderTab();
    expect(screen.getByTestId("customer-emails-empty")).toBeInTheDocument();
  });

  it("sem caixa activa no negócio", () => {
    byCustomerMock.mockReturnValue({ data: { mailboxId: null, configured: true, items: [], total: 0 }, isLoading: false, isError: false });
    renderTab();
    expect(screen.getByTestId("customer-emails-no-mailbox")).toBeInTheDocument();
  });

  it("por configurar (configured:false ou 503)", () => {
    byCustomerMock.mockReturnValue({ data: { mailboxId: null, configured: false, items: [], total: 0 }, isLoading: false, isError: false });
    const { unmount } = renderTab();
    expect(screen.getByTestId("customer-emails-not-configured")).toBeInTheDocument();
    unmount();
    byCustomerMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 503, data: { error: "x", code: "MAIL_NOT_CONFIGURED" } } },
    });
    renderTab();
    expect(screen.getByTestId("customer-emails-not-configured")).toBeInTheDocument();
  });
});
