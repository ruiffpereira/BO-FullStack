import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// O guard de escrita (billing/equipa) não é o assunto aqui: GuardButton passa a ser um Button simples.
vi.mock("../../src/components/GuardButton", async () => {
  const { Button } = await import("../../src/ui/ui.jsx");
  return { GuardButton: (p: Record<string, unknown>) => <Button {...p} /> };
});

import { StaffServicesEditor } from "../../src/components/StaffServicesEditor";

const SERVICES = [
  { serviceId: "s1", name: "Corte", price: 15, active: true },
  { serviceId: "s2", name: "Barba", price: 10, active: true },
];

function setup(over: { canEditPrices?: boolean; rules?: any[] } = {}) {
  const onSave = vi.fn();
  render(
    <StaffServicesEditor
      services={SERVICES}
      rules={over.rules ?? []}
      canEditPrices={over.canEditPrices ?? true}
      onSave={onSave}
    />,
  );
  return onSave;
}

describe("StaffServicesEditor — formulário do profissional", () => {
  it("todos os serviços vêm marcados por omissão e o preço próprio vazio (= o normal)", () => {
    setup();
    expect(screen.getByRole("checkbox", { name: "Faz Corte" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Faz Barba" })).toBeChecked();
    expect(screen.getByLabelText("Preço próprio em Corte")).toHaveValue("");
  });

  it("sem agenda.profissionais.precos o preço próprio é SÓ-LEITURA (e há a nota a explicar)", () => {
    setup({ canEditPrices: false, rules: [{ serviceId: "s1", excluded: false, price: 12 }] });
    const price = screen.getByLabelText("Preço próprio em Corte");
    expect(price).toHaveAttribute("readonly");
    expect(price).toHaveValue("12");
    expect(screen.getByTestId("prices-readonly-note")).toBeInTheDocument();
    // Mesmo forçando o evento, o valor não muda.
    fireEvent.change(price, { target: { value: "5" } });
    expect(screen.getByLabelText("Preço próprio em Corte")).toHaveValue("12");
    expect(screen.getByLabelText("Preço próprio em Barba")).toHaveAttribute("readonly");
  });

  it("com a permissão o preço é editável e não há nota de só-leitura", () => {
    setup({ canEditPrices: true });
    expect(screen.getByLabelText("Preço próprio em Corte")).not.toHaveAttribute("readonly");
    expect(screen.queryByTestId("prices-readonly-note")).toBeNull();
  });

  it("desmarcar = excluído; preço próprio = excepção; só vão as excepções", () => {
    const onSave = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Faz Barba" }));
    fireEvent.change(screen.getByLabelText("Preço próprio em Corte"), { target: { value: "12,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar serviços" }));
    expect(onSave).toHaveBeenCalledWith([
      { serviceId: "s1", excluded: false, price: 12.5 },
      { serviceId: "s2", excluded: true, price: null },
    ]);
  });

  it("sem excepções envia lista vazia (todos fazem ao preço normal)", () => {
    const onSave = setup();
    fireEvent.click(screen.getByRole("button", { name: "Guardar serviços" }));
    expect(onSave).toHaveBeenCalledWith([]);
  });

  it("preço inválido → erro e nada é enviado", () => {
    const onSave = setup();
    fireEvent.change(screen.getByLabelText("Preço próprio em Corte"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar serviços" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Preço inválido em «Corte».");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("um serviço excluído mostra-se desmarcado e com o preço desactivado", () => {
    setup({ rules: [{ serviceId: "s2", excluded: true, price: null }] });
    expect(screen.getByRole("checkbox", { name: "Faz Barba" })).not.toBeChecked();
    expect(screen.getByLabelText("Preço próprio em Barba")).toBeDisabled();
  });
});
