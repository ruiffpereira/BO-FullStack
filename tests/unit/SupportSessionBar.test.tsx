import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

import { SupportSessionBar, formatClock } from "../../src/components/SupportSessionBar";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SupportSessionBar", () => {
  it("só aparece em modo suporte", () => {
    authMock.mockReturnValue({ supportSession: null, endImpersonation: vi.fn() });
    const { container } = render(<SupportSessionBar />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("region", { name: "Sessão de suporte" })).not.toBeInTheDocument();
  });

  it("mostra o tenant e a hora de fim, como região com nome acessível", () => {
    const expiresAt = new Date(2026, 9, 10, 14, 35).toISOString();
    authMock.mockReturnValue({
      supportSession: { tenantName: "Barbearia Central", expiresAt },
      endImpersonation: vi.fn(),
    });
    render(<SupportSessionBar />);

    const region = screen.getByRole("region", { name: "Sessão de suporte" });
    expect(region).toHaveTextContent("Sessão de suporte — estás na conta de Barbearia Central");
    expect(region).toHaveTextContent(`termina às ${formatClock(expiresAt)}`);
    expect(formatClock(expiresAt)).toMatch(/14:35/);
  });

  it("'Sair' termina a sessão localmente (exit) e tenta fechar o separador", () => {
    const endImpersonation = vi.fn();
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    authMock.mockReturnValue({
      supportSession: { tenantName: "Barbearia Central", expiresAt: new Date(Date.now() + 60_000).toISOString() },
      endImpersonation,
    });
    render(<SupportSessionBar />);

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(endImpersonation).toHaveBeenCalledWith("exit");
    expect(close).toHaveBeenCalled();
    close.mockRestore();
  });
});
