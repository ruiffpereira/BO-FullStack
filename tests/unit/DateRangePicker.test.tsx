import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateRangePicker } from "../../src/components/DateRangePicker";

const dayButtons = () =>
  screen.getAllByRole("button").filter((b) => /^\d+$/.test(b.textContent ?? ""));

describe("DateRangePicker", () => {
  it("renderiza o calendário", () => {
    const { container } = render(<DateRangePicker value={undefined} onChange={() => {}} />);
    expect(dayButtons().length).toBeGreaterThan(0);
    expect(container.firstChild).toHaveClass("inline-block");
  });

  it("chama onChange ao escolher o início do intervalo", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker value={undefined} onChange={onChange} />);
    await user.click(dayButtons()[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const range = onChange.mock.calls[0][0];
    expect(range?.from).toBeInstanceOf(Date);
  });

  it("aplica className adicional", () => {
    const { container } = render(
      <DateRangePicker value={undefined} onChange={() => {}} className="my-range" />,
    );
    expect(container.firstChild).toHaveClass("my-range");
  });
});
