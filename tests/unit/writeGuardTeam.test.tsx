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
import { canFromGrants } from "../../src/lib/teamTree";

type Modules = Record<string, "view" | "edit">;

/** Auth de um membro com estas FOLHAS (mesma regra do `can` real: edit implica view; agrupador = alguma folha). */
function memberAuth(leaves: Modules) {
  const grants = Object.entries(leaves).map(([key, level]) => ({ key, level }));
  return {
    isMember: true,
    member: { memberId: "m1", name: "Ana", email: "ana@x.pt", tenantName: "Tifas Barber" },
    can: (key: string, level: "view" | "edit" = "view") => canFromGrants(grants, key, level),
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
    authMock.mockReturnValue(memberAuth({ "agenda.marcacoes": "view", "clientes.leads": "edit" }));
    const onClick = renderAt("/agenda/marcacoes");
    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", VIEW_ONLY_MESSAGE);
    expect(VIEW_ONLY_MESSAGE).toBe("Só tens permissão para ver");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("editar nos Leads: o mesmo membro pode escrever (o nível é por folha)", () => {
    authMock.mockReturnValue(memberAuth({ "agenda.marcacoes": "view", "clientes.leads": "edit" }));
    const onClick = renderAt("/clientes/leads");
    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("resolve o módulo pelo pathname: /financeiro/despesas é 'despesas'; /ginasio/clientes é 'ginasio'", () => {
    authMock.mockReturnValue(memberAuth({ "financeiro.despesas": "view", "ginasio.clientes": "view" }));
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

  it("por folha: com 'agenda.marcacoes' em edit mas só ver nos Serviços, a página de Serviços fica só-ver", () => {
    authMock.mockReturnValue(memberAuth({ "agenda.marcacoes": "edit", "agenda.servicos": "view" }));
    const { unmount } = render(
      <MemoryRouter initialEntries={["/agenda/servicos"]}>
        <GuardButton>S</GuardButton>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "S" })).toBeDisabled();
    unmount();
    renderAt("/agenda/marcacoes");
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });

  it("`leaf` no botão manda mais do que a página (ex.: bloquear horário no calendário = agenda.bloqueios)", () => {
    authMock.mockReturnValue(memberAuth({ "agenda.marcacoes": "edit", "agenda.bloqueios": "view" }));
    render(
      <MemoryRouter initialEntries={["/agenda"]}>
        <GuardButton leaf="agenda.bloqueios">Bloquear</GuardButton>
        <GuardButton>Marcar</GuardButton>
        <GuardButton leaf={["agenda.config", "agenda.marcacoes"]}>Qualquer</GuardButton>
      </MemoryRouter>,
    );
    const b = screen.getByRole("button", { name: "Bloquear" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("title", VIEW_ONLY_MESSAGE);
    expect(screen.getByRole("button", { name: "Marcar" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Qualquer" })).not.toBeDisabled();
  });

  it("páginas sem módulo (ex.: Perfil) não ficam bloqueadas", () => {
    authMock.mockReturnValue(memberAuth({ "agenda.marcacoes": "view" }));
    renderAt("/perfil");
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });

  it("o billing tem prioridade sobre 'só ver'", () => {
    authMock.mockReturnValue(memberAuth({ "agenda.marcacoes": "view" }));
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
    authMock.mockReturnValue(memberAuth({ "agenda.marcacoes": "edit" }));
    renderAt("/agenda");
    expect(useBillingMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) }),
    );
  });
});

describe("useWriteGuard — fail-closed (EQ-03/EQ-04: uma rota nova nasce fechada)", () => {
  it("membro numa rota SEM folha e não isenta → só-ver (mesmo com Acesso total)", () => {
    authMock.mockReturnValue(memberAuth({ "agenda.marcacoes": "edit", "loja.produtos": "edit" }));
    renderAt("/rota-nova-sem-folha");
    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", VIEW_ONLY_MESSAGE);
  });

  it("`leaf` explícito numa rota sem folha manda (o botão da Equipa passa leaf='equipa')", () => {
    authMock.mockReturnValue(memberAuth({ equipa: "edit" }));
    render(
      <MemoryRouter initialEntries={["/equipa"]}>
        <GuardButton leaf="equipa">Convidar</GuardButton>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Convidar" })).not.toBeDisabled();
  });

  it("rotas isentas (Perfil, Dashboard) não fecham; dono e sem Router como antes", () => {
    authMock.mockReturnValue(memberAuth({ "agenda.marcacoes": "view" }));
    renderAt("/dashboard");
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });

  it("o dono numa rota sem folha continua com tudo activo", () => {
    renderAt("/rota-nova-sem-folha");
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });

  it("ConfirmDialog: a membro só-ver o botão de confirmar fica desactivado e não dispara", async () => {
    const { ConfirmDialog } = await import("../../src/components/ConfirmDialog");
    authMock.mockReturnValue(memberAuth({ "clientes.lista": "view" }));
    const onConfirm = vi.fn();
    render(
      <MemoryRouter initialEntries={["/clientes"]}>
        <ConfirmDialog open onClose={() => {}} onConfirm={onConfirm} title="Apagar?" description="x" />
      </MemoryRouter>,
    );
    const btn = screen.getByRole("button", { name: "Eliminar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", VIEW_ONLY_MESSAGE);
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("ConfirmDialog: `leaf` manda sobre a rota; com edit, confirma", async () => {
    const { ConfirmDialog } = await import("../../src/components/ConfirmDialog");
    authMock.mockReturnValue(memberAuth({ "clientes.lista": "view", "equipa": "edit" }));
    const onConfirm = vi.fn();
    render(
      <MemoryRouter initialEntries={["/clientes"]}>
        <ConfirmDialog open onClose={() => {}} onConfirm={onConfirm} title="Remover?" description="x" leaf="equipa" confirmLabel="Remover" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
