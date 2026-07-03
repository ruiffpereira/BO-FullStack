import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// O WRITE-GUARD proativo (roadmap 0.4 / dívida T5) desativa os CTAs de escrita
// quando a subscrição da plataforma do tenant está read-only. A fonte é a query
// da subscrição (useGetBillingSubscription) — mockamo-la para exercitar os dois
// estados (pago vs. read-only) sem servidor nem QueryClientProvider, como o
// BillingBanner.test.tsx / AdminBilling.test.tsx.
const useBillingMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => useBillingMock(),
}));

// A ApptModal (teste de página) usa o Combobox ancorado — substituímo-lo por um
// <select> nativo, igual ao ApptModal.test.tsx.
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
    <select aria-label="Serviço" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

import { GuardButton } from "../../src/components/GuardButton";
import { WRITE_GUARD_MESSAGE } from "../../src/hooks/useWriteGuard";
import { ApptModal } from "../../src/components/ApptModal";
import type { Appointment } from "../../src/gen/backoffice/types/Appointment";
import type { Service } from "../../src/gen/backoffice/types/Service";

function mockBilling(
  readOnly: boolean,
  reason: string = readOnly ? "past_due_locked" : "active",
) {
  useBillingMock.mockReturnValue({ data: { readOnly, reason } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GuardButton — write-guard partilhado", () => {
  it("read-only: fica desativado e expõe o motivo (title + aria), sem disparar onClick", () => {
    mockBilling(true);
    const onClick = vi.fn();
    render(<GuardButton onClick={onClick}>Guardar</GuardButton>);

    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", WRITE_GUARD_MESSAGE);
    expect(btn).toHaveAttribute("aria-disabled", "true");

    // Um botão desativado não dispara o handler (defesa proativa).
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("pago/ativo: fica ativado, clicável e sem o motivo do guard", () => {
    mockBilling(false);
    const onClick = vi.fn();
    render(<GuardButton onClick={onClick}>Guardar</GuardButton>);

    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).toBeEnabled();
    expect(btn).not.toHaveAttribute("title", WRITE_GUARD_MESSAGE);

    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("sem subscrição (data undefined): tratado como NÃO read-only (não bloqueia)", () => {
    useBillingMock.mockReturnValue({ data: undefined });
    render(<GuardButton>Guardar</GuardButton>);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });

  it("quando pago, respeita o disabled próprio do CTA", () => {
    mockBilling(false);
    render(<GuardButton disabled>Guardar</GuardButton>);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("read-only: fica inerte dentro de um ancestral clicável (não propaga o clique)", () => {
    // O botão desativado tem `disabled:pointer-events-none` (ui.jsx), por isso o
    // hit-testing nativo do browser resolve o clique para o wrapper <span> — é
    // nele que o clique "chega" de facto (o jsdom não simula pointer-events, daí
    // disparamos o evento no wrapper para replicar o que acontece no browser real).
    // Caso concreto: GymMensalidade.tsx — "Marcar pago" numa linha com onClick que
    // abre a ficha do cliente; sem stopPropagation no wrapper, o clique "atravessa"
    // o botão desativado e abre a ficha.
    mockBilling(true);
    const parentOnClick = vi.fn();
    render(
      <div onClick={parentOnClick}>
        <GuardButton>Marcar pago</GuardButton>
      </div>,
    );

    const btn = screen.getByRole("button", { name: "Marcar pago" });
    const wrapper = btn.parentElement as HTMLElement;
    expect(wrapper?.tagName).toBe("SPAN");

    fireEvent.click(wrapper);
    expect(parentOnClick).not.toHaveBeenCalled();
  });
});

// ── Teste de página: o CTA primário de uma página real fica bloqueado ──────────
//
// A ApptModal é a modal de edição de marcações usada na Agenda/Clientes. O seu CTA
// "Guardar" está protegido pelo GuardButton — em read-only fica desativado com o
// motivo; pago, não carrega o motivo do guard.
describe("write-guard numa página (ApptModal → Guardar)", () => {
  const services: Service[] = [
    { serviceId: "svc-1", contentKey: "service.corte", name: "Corte", duration: 30, price: 10, active: true },
  ];
  const appt: Appointment = {
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

  function renderModal() {
    render(
      <ApptModal
        appt={appt}
        services={services}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSetStatus={vi.fn()}
        isSaving={false}
      />,
    );
  }

  it("read-only: o CTA 'Guardar' fica desativado e mostra o motivo", () => {
    mockBilling(true);
    renderModal();
    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", WRITE_GUARD_MESSAGE);
  });

  it("pago: o CTA 'Guardar' não carrega o motivo do guard", () => {
    mockBilling(false);
    renderModal();
    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).not.toHaveAttribute("title", WRITE_GUARD_MESSAGE);
  });
});
