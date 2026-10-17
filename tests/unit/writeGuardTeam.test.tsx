import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── B41 — o write-guard também fala "Só tens permissão para ver" ──────────────
//
// `useWriteGuard` junta o billing (402) e as permissões da equipa. O módulo da página resolve-se pelo pathname
// (`moduleForPath`) e o nível vem de `can()` (AuthContext, dado pela API). Mockamos as duas fontes.
const useBillingMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: (opts: unknown) => useBillingMock(opts),
}));

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

import { GuardButton } from "../../src/components/GuardButton";
import { WRITE_GUARD_MESSAGE } from "../../src/hooks/useWriteGuard";
import { VIEW_ONLY_MESSAGE } from "../../src/lib/teamAccess";

type Modules = Record<string, "view" | "edit">;

/** Auth de um membro com estes módulos (mesma regra do `can` real: edit implica view). */
function memberAuth(modules: Modules) {
  return {
    isMember: true,
    member: { memberId: "m1", name: "Ana", email: "ana@x.pt", tenantName: "Tifas Barber" },
    can: (key: string, level: "view" | "edit" = "view") => {
      const l = modules[key];
      if (!l) return false;
      return level === "view" || l === "edit";
    },
  };
}

function renderAt(path: string, onClick = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <GuardButton onClick={onClick}>Guardar</GuardButton>
    </MemoryRouter>,
  );
  return onClick;
}

beforeEach(() => {
  vi.clearAllMocks();
  useBillingMock.mockReturnValue({ data: { readOnly: false, reason: "active" } });
  authMock.mockReturnValue({ isMember: false, member: null, can: () => true });
});

describe("useWriteGuard — membro da equipa com 'ver'", () => {
  it("só ver na Agenda: o botão fica desactivado com 'Só tens permissão para ver' e não dispara", () => {
    authMock.mockReturnValue(memberAuth({ agenda: "view", clientes: "edit" }));
    const onClick = renderAt("/agenda/marcacoes");
    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", VIEW_ONLY_MESSAGE);
    expect(VIEW_ONLY_MESSAGE).toBe("Só tens permissão para ver");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("editar nos Clientes: o mesmo membro pode escrever (o nível é por módulo)", () => {
    authMock.mockReturnValue(memberAuth({ agenda: "view", clientes: "edit" }));
    const onClick = renderAt("/clientes/leads");
    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("resolve o módulo pelo pathname: /financeiro/despesas é 'despesas'; /ginasio/clientes é 'ginasio'", () => {
    authMock.mockReturnValue(memberAuth({ despesas: "view", ginasio: "view" }));
    const { unmount } = render(
      <MemoryRouter initialEntries={["/financeiro/despesas"]}>
        <GuardButton>A</GuardButton>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "A" })).toBeDisabled();
    unmount();
    render(
      <MemoryRouter initialEntries={["/ginasio/clientes"]}>
        <GuardButton>B</GuardButton>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "B" })).toBeDisabled();
  });

  it("páginas sem módulo (ex.: Perfil) não ficam bloqueadas", () => {
    authMock.mockReturnValue(memberAuth({ agenda: "view" }));
    renderAt("/perfil");
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });

  it("o billing tem prioridade sobre 'só ver'", () => {
    authMock.mockReturnValue(memberAuth({ agenda: "view" }));
    useBillingMock.mockReturnValue({ data: { readOnly: true, reason: "past_due_locked" } });
    renderAt("/agenda");
    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", WRITE_GUARD_MESSAGE);
  });

  it("o dono nunca é afectado pelo 'só ver'", () => {
    renderAt("/agenda");
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });

  it("um membro não pede a subscrição de billing (a API devolveria 403)", () => {
    authMock.mockReturnValue(memberAuth({ agenda: "edit" }));
    renderAt("/agenda");
    expect(useBillingMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) }),
    );
  });
});
