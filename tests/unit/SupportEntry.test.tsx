import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

const impersonateMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridImpersonate.js", () => ({
  postAdminUsersUseridImpersonate: (...a: unknown[]) => impersonateMock(...a),
}));

import { SupportEntry } from "../../src/pages/SupportEntry";

const RES = {
  accessToken: "support.token",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  tenant: { userId: "u1", name: "Barbearia Central", email: "dono@example.com" },
};

function renderEntry() {
  return render(
    <MemoryRouter>
      <SupportEntry userId="u1" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SupportEntry (/suporte/entrar/:userId)", () => {
  it("pede o impersonate UMA vez e passa a resposta ao startImpersonation", async () => {
    const startImpersonation = vi.fn(() => Promise.resolve());
    authMock.mockReturnValue({ supportSession: null, startImpersonation });
    impersonateMock.mockResolvedValue(RES);

    renderEntry();

    await waitFor(() => expect(startImpersonation).toHaveBeenCalledWith(RES));
    expect(impersonateMock).toHaveBeenCalledTimes(1);
    expect(impersonateMock.mock.calls[0][0]).toBe("u1");
  });

  it("em erro mostra a mensagem por code e um botão para fechar o separador", async () => {
    const startImpersonation = vi.fn();
    authMock.mockReturnValue({ supportSession: null, startImpersonation });
    impersonateMock.mockRejectedValue({
      response: { status: 403, data: { code: "SUPPORT_ACCESS_DENIED" } },
    });
    const close = vi.spyOn(window, "close").mockImplementation(() => {});

    renderEntry();

    expect(await screen.findByRole("alert")).toHaveTextContent("O cliente não autorizou o acesso");
    expect(startImpersonation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fechar separador" }));
    expect(close).toHaveBeenCalled();
    close.mockRestore();
  });

  it("já em sessão de suporte não volta a pedir o impersonate", async () => {
    authMock.mockReturnValue({
      supportSession: { tenantName: "X", expiresAt: RES.expiresAt },
      startImpersonation: vi.fn(),
    });
    renderEntry();
    await new Promise((r) => setTimeout(r, 20));
    expect(impersonateMock).not.toHaveBeenCalled();
  });
});
