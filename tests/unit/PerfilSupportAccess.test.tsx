import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Perfil → cartão "Acesso do suporte" + o que fica desactivado em sessão de suporte ──
//
// Mesma técnica do Perfil.test.tsx: hooks gerados mockados por caminho de
// import, QueryClientProvider real (as invalidações usam `useQueryClient`).

const useGetUsersMeMock = vi.fn();
const useSupportAccessMock = vi.fn();
const useSupportLogsMock = vi.fn();
const putSupportMutate = vi.fn();
const putUsersMeMutate = vi.fn();
const putPasswordMutate = vi.fn();
const authMock = vi.fn();
const confirmMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetUsersMe", () => ({
  useGetUsersMe: () => useGetUsersMeMock(),
  getUsersMeQueryKey: () => [{ url: "/users/me" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePutUsersMe", () => ({
  usePutUsersMe: () => ({ mutate: putUsersMeMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutUsersMePassword", () => ({
  usePutUsersMePassword: () => ({ mutate: putPasswordMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetUsersMeSupportAccess", () => ({
  useGetUsersMeSupportAccess: () => useSupportAccessMock(),
  getUsersMeSupportAccessQueryKey: () => [{ url: "/users/me/support-access" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePutUsersMeSupportAccess", () => ({
  usePutUsersMeSupportAccess: () => ({ mutate: putSupportMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetUsersMeSupportAccessLogs", () => ({
  useGetUsersMeSupportAccessLogs: (params: unknown) => useSupportLogsMock(params),
  getUsersMeSupportAccessLogsQueryKey: () => [{ url: "/users/me/support-access/logs" }],
}));
vi.mock("../../src/gen/backoffice/hooks/useUploadImage.js", () => ({ uploadImage: vi.fn() }));
vi.mock("../../src/hooks/useSettingsLanguages", () => ({
  useGetSettingsLanguages: () => ({ data: undefined }),
  usePutSettingsLanguages: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));
vi.mock("../../src/components/confirm", () => ({
  confirmDialog: (...a: unknown[]) => confirmMock(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { Perfil } from "../../src/pages/Perfil";

const ME = {
  name: "Barbearia Central",
  email: "dono@example.com",
  phone: "912345678",
  logoUrl: null,
  uiTheme: "system" as const,
  defaultLanguage: "pt",
};

const FUTURE = new Date(2030, 5, 15, 18, 30).toISOString();

const LOG = (over: Record<string, unknown> = {}) => ({
  auditLogId: "l1",
  createdAt: new Date(2026, 9, 10, 9, 5).toISOString(),
  kind: "change",
  actorName: "Ana (suporte)",
  method: "PUT",
  path: "/services/1",
  resourceType: "services",
  resourceId: "1",
  statusCode: 200,
  success: true,
  changes: { name: "Corte" },
  ...over,
});

function setAccess(data: unknown, isLoading = false) {
  useSupportAccessMock.mockReturnValue({ data, isLoading, isError: false });
}
function setLogs(items: unknown[], total = items.length) {
  useSupportLogsMock.mockReturnValue({ data: { items, total, page: 1, limit: 10 }, isLoading: false, isError: false });
}

function renderPerfil() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Perfil />
    </QueryClientProvider>,
  );
}

function card() {
  return screen.getByText("Acesso do suporte").closest("div.p-5") as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  useGetUsersMeMock.mockReturnValue({ data: ME, isLoading: false, isError: false });
  authMock.mockReturnValue({ username: "Barbearia Central", updateIdentity: vi.fn(), setAccessToken: vi.fn() });
  setAccess({ supportAccessUntil: null, active: false, pendingActivation: false });
  setLogs([]);
  confirmMock.mockResolvedValue(true);
});

describe("Perfil — cartão 'Acesso do suporte': os três estados", () => {
  it("activo com data → 'O suporte tem acesso à tua conta até DD/MM/AAAA às HH:mm'", () => {
    setAccess({ supportAccessUntil: FUTURE, active: true, pendingActivation: false });
    renderPerfil();
    expect(screen.getByTestId("support-access-state")).toHaveTextContent(
      "O suporte tem acesso à tua conta até 15/06/2030 às 18:30",
    );
    expect(screen.getByRole("button", { name: "Revogar acesso" })).toBeEnabled();
  });

  it("pendingActivation → texto próprio (conta por activar)", () => {
    setAccess({ supportAccessUntil: null, active: true, pendingActivation: true });
    renderPerfil();
    expect(screen.getByTestId("support-access-state")).toHaveTextContent("ainda não foi activada");
  });

  it("sem acesso → 'O suporte não tem acesso à tua conta' e sem botão de revogar", () => {
    renderPerfil();
    expect(screen.getByTestId("support-access-state")).toHaveTextContent("O suporte não tem acesso à tua conta");
    expect(screen.queryByRole("button", { name: "Revogar acesso" })).not.toBeInTheDocument();
  });
});

describe("Perfil — cartão 'Acesso do suporte': acções", () => {
  it("'Dar acesso ao suporte' envia a duração escolhida (24 horas = 1, 7 dias, 30 dias)", () => {
    renderPerfil();
    const select = within(card()).getByLabelText("Duração");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["24 horas", "7 dias", "30 dias"]);

    fireEvent.click(screen.getByRole("button", { name: "Dar acesso ao suporte" }));
    expect(putSupportMutate.mock.calls[0][0]).toEqual({ data: { days: 1 } });

    fireEvent.change(select, { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Dar acesso ao suporte" }));
    expect(putSupportMutate.mock.calls[1][0]).toEqual({ data: { days: 30 } });
  });

  it("'Revogar acesso' pede confirmação e só depois envia days: 0", async () => {
    setAccess({ supportAccessUntil: FUTURE, active: true, pendingActivation: false });
    renderPerfil();

    fireEvent.click(screen.getByRole("button", { name: "Revogar acesso" }));
    await waitFor(() => expect(putSupportMutate).toHaveBeenCalledTimes(1));
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(putSupportMutate.mock.calls[0][0]).toEqual({ data: { days: 0 } });
  });

  it("'Revogar acesso' cancelado na confirmação não envia nada", async () => {
    confirmMock.mockResolvedValue(false);
    setAccess({ supportAccessUntil: FUTURE, active: true, pendingActivation: false });
    renderPerfil();

    fireEvent.click(screen.getByRole("button", { name: "Revogar acesso" }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(putSupportMutate).not.toHaveBeenCalled();
  });
});

describe("Perfil — Registo do suporte", () => {
  it("vazio → EmptyState", () => {
    renderPerfil();
    expect(screen.getByText("Registo do suporte")).toBeInTheDocument();
    expect(screen.getByText("Sem atividade do suporte")).toBeInTheDocument();
  });

  it("linhas com Data/hora · Quem · Ação · Detalhe, selo 'Bloqueado' e expandir", () => {
    setLogs([
      LOG(),
      LOG({ auditLogId: "l2", kind: "session", method: "POST", resourceType: "admin", changes: null }),
      LOG({ auditLogId: "l3", kind: "grant", actorName: null, changes: { days: 7 } }),
      LOG({ auditLogId: "l4", method: "DELETE", resourceType: "cms", path: "/cms/entries/9", success: false, statusCode: 403, changes: null }),
    ]);
    renderPerfil();

    for (const h of ["Data/hora", "Quem", "Ação", "Detalhe"]) {
      expect(screen.getByRole("columnheader", { name: h })).toBeInTheDocument();
    }
    expect(screen.getByText("Alterou os serviços")).toBeInTheDocument();
    expect(screen.getByText("Entrou na tua conta (sessão de suporte)")).toBeInTheDocument();
    expect(screen.getByText("Deste acesso ao suporte por 7 dias")).toBeInTheDocument();
    expect(screen.getByText("Tu")).toBeInTheDocument();
    const blocked = screen.getByText("Apagou os conteúdos").closest("tr") as HTMLElement;
    expect(within(blocked).getByText("Bloqueado")).toBeInTheDocument();

    // Expandir o detalhe da 1.ª linha (chave: valor).
    const first = screen.getByText("Alterou os serviços").closest("tr") as HTMLElement;
    fireEvent.click(within(first).getByRole("button", { name: "Ver detalhe" }));
    expect(within(first).getByText("name:")).toBeInTheDocument();
    expect(within(first).getByText("Corte")).toBeInTheDocument();
  });

  it("paginação: 25 registos → página 1 de 3, 'seguinte' pede a página 2", () => {
    setLogs([LOG()], 25);
    renderPerfil();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Página seguinte" }));
    expect(useSupportLogsMock).toHaveBeenLastCalledWith({ page: 2, limit: 10 });
  });
});

describe("Perfil — em sessão de suporte", () => {
  beforeEach(() => {
    authMock.mockReturnValue({
      username: "Barbearia Central",
      updateIdentity: vi.fn(),
      setAccessToken: vi.fn(),
      supportSession: { tenantName: "Barbearia Central", expiresAt: FUTURE },
    });
    setAccess({ supportAccessUntil: FUTURE, active: true, pendingActivation: false });
  });

  it("dar/revogar acesso ficam desactivados, com a nota", () => {
    renderPerfil();
    expect(screen.getByRole("button", { name: "Dar acesso ao suporte" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revogar acesso" })).toBeDisabled();
    expect(within(card()).getByText("Indisponível numa sessão de suporte")).toBeInTheDocument();
  });

  it("mudar password e mudar email ficam desactivados; nome e telefone continuam editáveis", () => {
    renderPerfil();
    expect(screen.getByLabelText("Password atual")).toBeDisabled();
    expect(screen.getByLabelText(/^Nova password/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mudar password" })).toBeDisabled();
    expect(screen.getByLabelText(/^Email/)).toBeDisabled();
    expect(screen.getByLabelText("Nome do negócio")).toBeEnabled();
    expect(screen.getByLabelText("Telefone")).toBeEnabled();
    expect(screen.getAllByText("Indisponível numa sessão de suporte").length).toBeGreaterThanOrEqual(2);
  });
});
