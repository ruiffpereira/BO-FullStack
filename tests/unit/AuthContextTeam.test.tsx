import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── B41 — AuthContext: membro da equipa, `member`, `isMember`, `can()` ─────────
//
// Depois do refresh o contexto vai buscar `GET /userpermissions/access` e expõe quem está ligado e o nível por
// módulo. Nada se calcula no frontend: os níveis vêm da API. Mesma fronteira mockada do AuthContext.test.tsx.
const axiosPostMock = vi.fn();
vi.mock("@kubb/plugin-client/clients/axios", () => {
  const axiosInstanceMock: any = vi.fn();
  axiosInstanceMock.defaults = {};
  axiosInstanceMock.post = (...args: unknown[]) => axiosPostMock(...args);
  axiosInstanceMock.interceptors = {
    request: { use: vi.fn(() => 1), eject: vi.fn() },
    response: { use: vi.fn(() => 2), eject: vi.fn() },
  };
  return { axiosInstance: axiosInstanceMock, default: vi.fn() };
});

const getCsrfTokenMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetCsrfToken", () => ({
  getCsrfToken: (...args: unknown[]) => getCsrfTokenMock(...args),
}));
const getUserpermissionsMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetUserpermissions", () => ({
  getUserpermissions: (...args: unknown[]) => getUserpermissionsMock(...args),
}));
const getUserpermissionsAccessMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetUserpermissionsAccess", () => ({
  getUserpermissionsAccess: (...args: unknown[]) => getUserpermissionsAccessMock(...args),
}));

import { AuthProvider, useAuth } from "../../src/context/AuthContext";

function Probe() {
  const { initializing, isAuthenticated, isMember, member, can } = useAuth();
  if (initializing || !isAuthenticated) return <span data-testid="pending">a carregar</span>;
  return (
    <div>
      <span data-testid="isMember">{String(isMember)}</span>
      <span data-testid="who">{member ? `${member.name} · ${member.tenantName}` : "dono"}</span>
      <span data-testid="agenda-view">{String(can("agenda", "view"))}</span>
      <span data-testid="agenda-edit">{String(can("agenda", "edit"))}</span>
      <span data-testid="clientes-edit">{String(can("clientes", "edit"))}</span>
      <span data-testid="loja-view">{String(can("loja"))}</span>
    </div>
  );
}

function renderAuth() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  vi.clearAllMocks();
  getCsrfTokenMock.mockResolvedValue({ csrfToken: "csrf" });
  getUserpermissionsMock.mockResolvedValue([]);
  axiosPostMock.mockResolvedValue({ status: 200, data: { accessToken: "access.token.value" } });
});

describe("AuthContext — acesso da equipa (B41)", () => {
  it("membro: expõe quem é e `can` respeita o nível por módulo (edit implica view; sem módulo = não)", async () => {
    getUserpermissionsAccessMock.mockResolvedValue({
      member: { memberId: "m1", name: "Ana", email: "ana@x.pt", tenantName: "Tifas Barber" },
      modules: [
        { key: "agenda", label: "Agenda", level: "view" },
        { key: "clientes", label: "Clientes", level: "edit" },
      ],
    });
    renderAuth();
    await waitFor(() => expect(screen.queryByTestId("pending")).toBeNull());

    expect(text("isMember")).toBe("true");
    expect(text("who")).toBe("Ana · Tifas Barber");
    expect(text("agenda-view")).toBe("true");
    expect(text("agenda-edit")).toBe("false");
    expect(text("clientes-edit")).toBe("true");
    expect(text("loja-view")).toBe("false");
  });

  it("dono (`member: null`): pode tudo, `isMember` falso", async () => {
    getUserpermissionsAccessMock.mockResolvedValue({ member: null, modules: [] });
    renderAuth();
    await waitFor(() => expect(screen.queryByTestId("pending")).toBeNull());

    expect(text("isMember")).toBe("false");
    expect(text("who")).toBe("dono");
    expect(text("agenda-edit")).toBe("true");
    expect(text("loja-view")).toBe("true");
  });

  it("o acesso é pedido com o token novo, antes de a sessão ficar autenticada", async () => {
    getUserpermissionsAccessMock.mockResolvedValue({ member: null, modules: [] });
    renderAuth();
    await waitFor(() => expect(screen.queryByTestId("pending")).toBeNull());

    expect(getUserpermissionsAccessMock).toHaveBeenCalledTimes(1);
    expect(getUserpermissionsAccessMock.mock.calls[0][0].headers.Authorization).toBe("Bearer access.token.value");
  });
});
