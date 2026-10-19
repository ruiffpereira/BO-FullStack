import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "../../src/ui/ui.jsx";

describe("Input — nome acessível sem a dica", () => {
  it("o nome é só o label; a dica liga-se por aria-describedby", () => {
    render(<Input label="Domínio de email" hint="Sugerimos o subdomínio do negócio." />);
    const field = screen.getByRole("textbox", { name: "Domínio de email" });
    expect(field).toHaveAccessibleDescription("Sugerimos o subdomínio do negócio.");
  });

  it("sem dica não há aria-describedby; um aria-describedby dado mantém-se", () => {
    const { rerender } = render(<Input label="Nome" />);
    expect(screen.getByRole("textbox", { name: "Nome" })).not.toHaveAttribute("aria-describedby");
    rerender(<><span id="extra">Obrigatório</span><Input label="Nome" hint="Como aparece" aria-describedby="extra" /></>);
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveAccessibleDescription("Obrigatório Como aparece");
  });
});
