import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// O Combobox real abre um menu ancorado (useAnchoredMenu) — para tornar a
// escolha de serviço determinística nos testes, substituímo-lo por um <select>
// nativo que invoca o mesmo onChange(value).
vi.mock("../../src/components/Combobox", () => ({
  Combobox: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select
      aria-label="Serviço"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

import { ApptModal } from "../../src/components/ApptModal";
import type { Appointment } from "../../src/gen/backoffice/types/Appointment";
import type { Service } from "../../src/gen/backoffice/types/Service";

const services: Service[] = [
  {
    serviceId: "svc-1",
    contentKey: "service.corte",
    name: "Corte",
    duration: 30,
    price: 10,
    active: true,
  },
  {
    serviceId: "svc-2",
    contentKey: "service.barba",
    name: "Barba",
    duration: 20,
    price: 8,
    active: true,
  },
];

const baseAppt: Appointment = {
  appointmentId: "appt-1",
  date: "2026-07-01",
  time: "10:00",
  serviceId: "svc-1",
  serviceName: "Corte",
  servicePrice: 10,
  clientName: "João Silva",
  clientEmail: "joao@example.com",
  clientPhone: "912345678",
  status: "confirmed",
  duration: 30,
};

function renderModal(
  appt: Partial<Appointment> = {},
  overrides: Partial<Parameters<typeof ApptModal>[0]> = {},
) {
  const onSave = vi.fn();
  const onSetStatus = vi.fn();
  const onClose = vi.fn();
  render(
    <ApptModal
      appt={{ ...baseAppt, ...appt }}
      services={services}
      onClose={onClose}
      onSave={onSave}
      onSetStatus={onSetStatus}
      isSaving={false}
      {...overrides}
    />,
  );
  return { onSave, onSetStatus, onClose };
}

describe("ApptModal — sem toggle de notificação", () => {
  it("não mostra qualquer botão/texto com 'notificar'", () => {
    renderModal({ status: "confirmed" });
    expect(screen.queryByText(/notificar/i)).not.toBeInTheDocument();
    // O botão de guardar existe e é simplesmente "Guardar"
    expect(
      screen.getByRole("button", { name: "Guardar" }),
    ).toBeInTheDocument();
  });

  it("ao alterar a hora (TimeField) e clicar Guardar chama onSave com o id e os dados alterados", async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ status: "confirmed", time: "10:00" });

    // A hora é editada por um TimeField (popover de opções), não por <input type=time>.
    // O botão âncora mostra a hora atual; clicá-lo abre a grelha de opções.
    const timeBtn = screen.getByRole("button", { name: /10:00/ });
    await user.click(timeBtn);
    // Escolhe uma nova hora na grelha (11:30 existe na base de 15 em 15 min).
    await user.click(screen.getByRole("button", { name: "11:30" }));

    const saveBtn = screen.getByRole("button", { name: "Guardar" });
    expect(saveBtn).toBeEnabled();
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("appt-1", { time: "11:30" });
  });

  it("ao trocar de serviço e Guardar, envia o novo serviceId (e não há texto de notificação)", async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ status: "confirmed" });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Serviço" }),
      "svc-2",
    );

    expect(screen.queryByText(/notificar/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("appt-1", { serviceId: "svc-2" });
  });

  it("numa marcação cancelada mostra 'Reativar' (sem 'e notificar')", () => {
    renderModal({ status: "cancelled" });
    expect(screen.getByRole("button", { name: "Reativar" })).toBeInTheDocument();
    expect(screen.queryByText(/notificar/i)).not.toBeInTheDocument();
    // Não existe botão de guardar quando está cancelada (só Reativar).
    expect(
      screen.queryByRole("button", { name: "Guardar" }),
    ).not.toBeInTheDocument();
  });

  it("o fluxo de cancelamento mostra 'Confirmar cancelamento' (sem 'e notificar')", async () => {
    const user = userEvent.setup();
    const { onSetStatus } = renderModal({ status: "confirmed" });

    await user.click(screen.getByRole("button", { name: "Cancelar marcação" }));
    const confirmBtn = screen.getByRole("button", {
      name: "Confirmar cancelamento",
    });
    expect(confirmBtn).toBeInTheDocument();
    expect(screen.queryByText(/notificar/i)).not.toBeInTheDocument();

    await user.click(confirmBtn);
    expect(onSetStatus).toHaveBeenCalledWith("appt-1", "cancelled");
  });
});

// Marcação concluída e PAGA (€10 em dinheiro). Cobre a aba Pagamento: ver o
// recibo, entrar em modo de edição e *reverter o pagamento* baixando o valor
// recebido — o caminho que o frontend disponibiliza para "anular" um pagamento
// (o botão dedicado "Anular pagamento" existe no código mas não está ligado à UI;
// ver o relatório). Ao baixar o valor recebido, o backend volta a pôr a marcação
// em dívida / por concluir.
const paidAppt: Partial<Appointment> = {
  status: "completed",
  paymentCash: 10,
  paymentMbway: 0,
  paymentCard: 0,
  paidAt: "2026-07-01T10:30:00.000Z",
  servicePrice: 10,
};

describe("ApptModal — pagamento de uma marcação concluída", () => {
  it("mostra o estado 'Pago' e o botão 'Editar marcação' (sem editar à força)", () => {
    renderModal(paidAppt);
    // Badge de estado + indicação de pago.
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getAllByText(/Pago/).length).toBeGreaterThan(0);
    // Concluída → não há "Guardar" direto; há "Editar marcação".
    expect(
      screen.getByRole("button", { name: "Editar marcação" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Guardar" }),
    ).not.toBeInTheDocument();
  });

  it("na aba Pagamento, 'Editar pagamento' revela os campos de valores", async () => {
    const user = userEvent.setup();
    renderModal(paidAppt);

    await user.click(screen.getByRole("button", { name: "Pagamento" }));
    // Recibo: total recebido visível.
    expect(screen.getByText("Total recebido")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Editar pagamento" }));
    // Em modo edição aparece o banner e os 3 campos editáveis de valores.
    expect(screen.getByText(/A editar o pagamento/i)).toBeInTheDocument();
    // "Dinheiro" surge no recibo (read-only) e como label do campo → há ≥1.
    expect(screen.getAllByText("Dinheiro").length).toBeGreaterThan(0);
    // 3 inputs numéricos (Dinheiro/MBway/Cartão) + a gorjeta = 4 campos editáveis.
    expect(
      document.querySelectorAll('input[type="number"]').length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("reverter o pagamento: baixar o dinheiro recebido a 0 e Guardar envia os novos valores", async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal(paidAppt);

    await user.click(screen.getByRole("button", { name: "Pagamento" }));
    await user.click(screen.getByRole("button", { name: "Editar pagamento" }));

    // O campo Dinheiro arranca com o valor pago (10). Limpa → 0 (reverte o pago).
    const cashInput = document.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    expect(cashInput).toBeTruthy();
    expect(cashInput.value).toBe("10");
    await user.clear(cashInput);

    // Agora há alteração de pagamento → Guardar fica ativo.
    const saveBtn = screen.getByRole("button", { name: "Guardar" });
    expect(saveBtn).toBeEnabled();
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("appt-1", {
      paymentCash: 0,
      paymentMbway: 0,
      paymentCard: 0,
    });
  });

  it("entrar em edição e Cancelar descarta — não chama onSave", async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal(paidAppt);

    await user.click(screen.getByRole("button", { name: "Pagamento" }));
    await user.click(screen.getByRole("button", { name: "Editar pagamento" }));

    const cashInput = document.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    await user.clear(cashInput);
    await user.type(cashInput, "3");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    // Voltou ao modo de ver (recibo) sem guardar nada.
    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Editar pagamento" }),
    ).toBeInTheDocument();
  });
});

// Preferência de contribuinte na fatura (wantsInvoice) — o toggle vive na aba
// Pagamento de uma marcação ainda não paga, quando há um `customer` associado.
describe("ApptModal — contribuinte na fatura (wantsInvoice)", () => {
  it("ligar o toggle + NIF e Pagar persiste a preferência no cliente", async () => {
    const user = userEvent.setup();
    const onSaveCustomer = vi.fn();
    const { onSave } = renderModal(
      { status: "confirmed" },
      {
        customer: { customerId: "cus-1", nif: null, wantsInvoice: false },
        onSaveCustomer,
      },
    );

    await user.click(screen.getByRole("button", { name: "Pagamento" }));
    // Liga o toggle "Contribuinte na fatura".
    const invoiceToggle = screen.getByRole("switch");
    await user.click(invoiceToggle);
    // Preenche o NIF (9 dígitos).
    const nif = screen.getByPlaceholderText(/NIF/i) as HTMLInputElement;
    await user.type(nif, "123456789");

    // Paga (preenche dinheiro com o preço do serviço, 10€, e conclui).
    const cashInput = document.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    await user.type(cashInput, "10");
    await user.click(screen.getByRole("button", { name: /^Pagar/ }));

    expect(onSaveCustomer).toHaveBeenCalledWith("cus-1", {
      wantsInvoice: true,
      nif: "123456789",
    });
    expect(onSave).toHaveBeenCalled();
  });
});
