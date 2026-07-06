import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavBadge } from "../../src/components/NavBadge";

// NavBadge é o badge de não-lidas do item "Mensagens" na sidebar (T0.2). Testado
// isolado (em vez de montar o Shell inteiro, que precisa de router + AuthContext +
// QueryClient) — ver NavItem/SidebarContent em src/components/Shell.tsx.
describe("NavBadge", () => {
  it("não renderiza nada quando a contagem é 0", () => {
    const { container } = render(<NavBadge count={0} collapsed={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada com contagem negativa (defensivo)", () => {
    const { container } = render(<NavBadge count={-1} collapsed={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("expandido: mostra o número exato", () => {
    render(<NavBadge count={3} collapsed={false} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("expandido: acima de 99 mostra o cap '99+' (coerente com o ChatLauncher)", () => {
    render(<NavBadge count={150} collapsed={false} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("expandido: no limite (99) mostra o número, não o cap", () => {
    render(<NavBadge count={99} collapsed={false} />);
    expect(screen.getByText("99")).toBeInTheDocument();
  });

  it("colapsado: não mostra o número (é só um dot), mas o dot existe no DOM", () => {
    const { container } = render(<NavBadge count={5} collapsed />);
    expect(screen.queryByText("5")).not.toBeInTheDocument();
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("o badge é decorativo (aria-hidden) — a contagem acessível vive no aria-label do NavItem", () => {
    render(<NavBadge count={4} collapsed={false} />);
    expect(screen.getByText("4")).toHaveAttribute("aria-hidden", "true");
  });
});
