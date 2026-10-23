import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PeriodSelector, periodBtnClass } from "../../src/components/PeriodSelector";

const presets = [
  { key: "day" as const, label: "Hoje" },
  { key: "7d" as const, label: "7 dias" },
];

describe("PeriodSelector — o selector de período partilhado (Estatísticas + Financeiro)", () => {
  it("marca o período activo (aria-pressed) e chama onChange com a chave", async () => {
    const onChange = vi.fn();
    render(<PeriodSelector presets={presets} value="7d" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "7 dias" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(onChange).toHaveBeenCalledWith("day");
  });

  it("os filhos entram na mesma barra (ex.: «Personalizado»)", () => {
    render(
      <PeriodSelector presets={presets} value="custom" onChange={() => {}}>
        <button type="button">Personalizado</button>
      </PeriodSelector>,
    );
    expect(screen.getByRole("button", { name: "Personalizado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-pressed", "false");
  });

  it("periodBtnClass: activo = fundo de destaque; inactivo = texto neutro", () => {
    expect(periodBtnClass(true)).toContain("bg-accent text-white");
    expect(periodBtnClass(false)).toContain("text-zinc-500");
    expect(periodBtnClass(false, "inline-flex")).toContain("inline-flex");
  });
});
