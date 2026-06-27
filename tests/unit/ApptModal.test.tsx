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

  it("ao alterar a hora e clicar Guardar chama onSave com o id e os dados alterados", async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ status: "confirmed" });

    const timeInput = document.querySelector(
      'input[type="time"]',
    ) as HTMLInputElement;
    expect(timeInput).toBeTruthy();
    // Limpa e escreve uma nova hora.
    await user.clear(timeInput);
    await user.type(timeInput, "11:30");

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
