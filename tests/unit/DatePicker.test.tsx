import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "../../src/components/DatePicker";

// Botões do calendário (react-day-picker): os dias têm o número como texto;
// a navegação prev/next tem só ícones. Filtrar por texto numérico isola os dias.
const dayButtons = () =>
  screen.getAllByRole("button").filter((b) => /^\d+$/.test(b.textContent ?? ""));

describe("DatePicker", () => {
  it("mostra o placeholder quando não há data", () => {
    render(<DatePicker value="" onChange={() => {}} placeholder="Escolher dia" />);
    expect(screen.getByText("Escolher dia")).toBeInTheDocument();
  });

  it("formata a data selecionada como dd/MM/yyyy", () => {
    render(<DatePicker value="2026-06-15" onChange={() => {}} />);
    expect(screen.getByText("15/06/2026")).toBeInTheDocument();
  });

  it("abre o calendário ao clicar no campo", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-06-15" onChange={() => {}} />);
    expect(dayButtons()).toHaveLength(0);
    await user.click(screen.getByRole("button"));
    expect(dayButtons().length).toBeGreaterThan(0);
  });

  it("chama onChange (yyyy-MM-dd) ao escolher um dia", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2026-06-15" onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    await user.click(dayButtons()[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
