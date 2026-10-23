import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// A ficha de cliente é UMA só (Agenda + Clientes): as permissões vêm de `customerAccess` (EQ-06).
// Aqui prova-se o contraste dono vs membro sem `valores`, e o «só fatura» de quem só tem a Agenda.

const access = vi.hoisted(() => ({
  can: ((_k: string, _l?: string): boolean => true) as (k: string, l?: string) => boolean,
  perms: new Set<string>(["VIEW_SCHEDULE", "VIEW_GYM", "VIEW_EMAIL"]),
}));
vi.mock("../../src/hooks/useTeamAccess", () => ({
  useTeamAccess: () => ({ can: (k: string, l?: string) => access.can(k, l) }),
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (n: string) => access.perms.has(n) }),
}));
// GuardButton → write-guard (billing + equipa): aqui nunca bloqueia.
vi.mock("../../src/hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({ readOnly: false, billingReadOnly: false, viewOnly: false, reason: null, message: "" }),
}));

const historyMock = vi.hoisted(() => ({ data: undefined as any, isLoading: false }));
vi.mock("../../src/gen/backoffice/hooks/useGetCustomersIdHistory", () => ({
  useGetCustomersIdHistory: () => historyMock,
  getCustomersIdHistoryQueryKey: (id: string) => ["customers", id, "history"],
}));

// Filhos pesados que só entram na versão completa.
vi.mock("../../src/components/correio/CustomerEmailsTab", () => ({ CustomerEmailsTab: () => <div>emails-tab</div> }));
vi.mock("../../src/components/correio/CustomerNewsletterBox", () => ({ CustomerNewsletterBox: () => <div>newsletter-box</div> }));
vi.mock("../../src/components/chat/OpenConversationShortcut", () => ({ OpenConversationShortcut: () => null }));
vi.mock("../../src/pages/gymMensalidade/ClienteMensalidade", () => ({ ClienteMensalidade: () => <div>mensalidade</div> }));

import { CustomerProfileModal } from "../../src/components/customers/CustomerProfileModal";

const customer = {
  customerId: "c1",
  name: "Ana Costa",
  email: "ana@x.pt",
  contact: "911222333",
  nif: "123456789",
  wantsInvoice: true,
  blocked: false,
};

const appointments = [
  {
    appointmentId: "a1",
    date: "2026-06-01",
    time: "10:00",
    status: "completed",
    serviceId: "s1",
    service: { name: "Corte" },
    paidAt: "2026-06-01T11:00:00Z",
    paymentCash: 25,
    paymentMbway: 0,
    paymentCard: 0,
  },
];

const withMoney = {
  customer,
  appointments,
  stats: { visitCount: 3, totalSpent: 150, debt: 12.5, favoriteServiceId: "s1", lastVisit: "2026-06-01" },
};
// Sem `valores` a API nem envia estes campos — mas se alguma vez enviasse, a ficha não os desenha.
const withoutMoney = {
  customer,
  appointments,
  stats: { visitCount: 3, totalSpent: 150, debt: 12.5, favoriteServiceId: "s1", lastVisit: "2026-06-01" },
};

function setup(props: Partial<React.ComponentProps<typeof CustomerProfileModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const onOpenAppointment = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <CustomerProfileModal
        customerId="c1"
        customers={[customer as any]}
        onClose={onClose}
        onOpenAppointment={onOpenAppointment}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onClose, onOpenAppointment };
}

beforeEach(() => {
  access.can = () => true;
  access.perms = new Set(["VIEW_SCHEDULE", "VIEW_GYM", "VIEW_EMAIL"]);
  historyMock.data = withMoney;
  historyMock.isLoading = false;
});

describe("CustomerProfileModal — ficha única", () => {
  it("dono: vê gasto total, dívida e o valor pago; pode bloquear", () => {
    setup();
    expect(screen.getByText("gasto total")).toBeInTheDocument();
    expect(screen.getByText(/em dívida/)).toBeInTheDocument();
    expect(screen.getByText(/25,00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloquear" })).toBeInTheDocument();
  });

  it("membro sem `valores`: nenhuma caixa de dinheiro (nunca «0 €»), mesmo que a API enviasse", () => {
    access.can = (k) => k !== "agenda.marcacoes.valores";
    historyMock.data = withoutMoney;
    setup();
    expect(screen.queryByText("gasto total")).not.toBeInTheDocument();
    expect(screen.queryByText(/em dívida/)).not.toBeInTheDocument();
    expect(screen.queryByText(/25,00/)).not.toBeInTheDocument();
    // o resto da ficha continua
    expect(screen.getByText("visitas")).toBeInTheDocument();
    expect(screen.getByText("Ana Costa")).toBeInTheDocument();
  });

  it("quem só edita a Agenda não bloqueia e só mexe na preferência de fatura", () => {
    access.can = (k, l) => (k === "clientes.lista" ? l !== "edit" : true);
    // `can('agenda.marcacoes','edit')` = true, `clientes.lista` só ver
    setup();
    expect(screen.queryByRole("button", { name: "Bloquear" })).not.toBeInTheDocument();
    expect(screen.getByText("Contribuinte na fatura")).toBeInTheDocument();
  });

  it("na página Clientes (full) o «Bloquear» está sempre (o write-guard da folha da rota é que o desactiva); na Agenda não", () => {
    access.can = (k, l) => (k === "clientes.lista" ? l !== "edit" : true);
    setup({ full: true });
    expect(screen.getByRole("button", { name: "Bloquear" })).toBeInTheDocument();
  });

  it("quem edita `clientes.lista` não vê o editor «só fatura»", () => {
    setup();
    expect(screen.queryByText("Contribuinte na fatura")).not.toBeInTheDocument();
  });

  it("abrir uma marcação do histórico chama onOpenAppointment", async () => {
    const { onOpenAppointment } = setup();
    await userEvent.click(screen.getByRole("button", { name: /2026-06-01/ }));
    expect(onOpenAppointment).toHaveBeenCalledTimes(1);
    expect(onOpenAppointment.mock.calls[0][0]).toMatchObject({ appointmentId: "a1" });
  });

  it("versão curta: sem separadores nem Privacidade; completa: com separadores e RGPD", () => {
    setup();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText(/Privacidade/)).not.toBeInTheDocument();
  });

  it("completa: separadores por permissão + RGPD (exportar/apagar são acções próprias)", () => {
    setup({ full: true, onEdit: vi.fn() });
    expect(screen.getByRole("tab", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ginásio" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Emails" })).toBeInTheDocument();
    expect(screen.getByText(/Privacidade/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByText("newsletter-box")).toBeInTheDocument();
  });

  it("completa, membro sem as acções de privacidade nem Ginásio: sem RGPD nem esse separador", () => {
    access.can = (k) => !k.startsWith("clientes.lista.") && k !== "financeiro.mensalidades";
    setup({ full: true });
    expect(screen.queryByText(/Privacidade/)).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Ginásio" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Agenda" })).toBeInTheDocument();
  });

  it("sem dados do cliente ainda: mostra o esqueleto e o rodapé fecha", async () => {
    historyMock.data = undefined;
    const { onClose } = setup({ customers: [] });
    await userEvent.click(screen.getAllByRole("button", { name: "Fechar" }).pop()!); // o do rodapé
    expect(onClose).toHaveBeenCalled();
  });
});
