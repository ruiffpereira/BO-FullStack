import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── B41 — página /equipa ──────────────────────────────────────────────────────
//
// Mockamos os hooks gerados (lista, catálogo, mutações) e a sessão; o QueryClient é real (as invalidações usam
// `useQueryClient`). O write-guard passa pelo GuardButton → billing mockado.
const { useGetTeamMock, useGetCatalogMock, authMock, toastSuccess, toastError, toastWarning, mutations, mut } = vi.hoisted(() => {
  const mutations = {
    create: vi.fn(),
    update: vi.fn(),
    resend: vi.fn(),
    reset: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    revoke: vi.fn(),
    remove: vi.fn(),
  };
  return {
    useGetTeamMock: vi.fn(),
    useGetCatalogMock: vi.fn(),
    authMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    mutations,
    mut: (fn: ReturnType<typeof vi.fn>) => () => ({ mutate: fn, isPending: false }),
  };
});

vi.mock("../../src/gen/backoffice/hooks/useGetTeam", () => ({
  useGetTeam: () => useGetTeamMock(),
  getTeamQueryKey: () => [{ url: "/team" }],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetTeamCatalog", () => ({ useGetTeamCatalog: () => useGetCatalogMock() }));
vi.mock("../../src/gen/backoffice/hooks/usePostTeam", () => ({ usePostTeam: mut(mutations.create) }));
vi.mock("../../src/gen/backoffice/hooks/usePutTeamMemberid", () => ({ usePutTeamMemberid: mut(mutations.update) }));
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidResendInvite", () => ({
  usePostTeamMemberidResendInvite: mut(mutations.resend),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidSendReset", () => ({
  usePostTeamMemberidSendReset: mut(mutations.reset),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidDisable", () => ({
  usePostTeamMemberidDisable: mut(mutations.disable),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidEnable", () => ({
  usePostTeamMemberidEnable: mut(mutations.enable),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidRevokeSessions", () => ({
  usePostTeamMemberidRevokeSessions: mut(mutations.revoke),
}));
vi.mock("../../src/gen/backoffice/hooks/useDeleteTeamMemberid", () => ({ useDeleteTeamMemberid: mut(mutations.remove) }));

vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => authMock() }));
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: (...a: unknown[]) => toastWarning(...a),
  },
}));

import { Equipa } from "../../src/pages/Equipa";

const node = (key: string, label: string, over: Record<string, unknown> = {}) => ({
  key,
  label,
  levels: ["view", "edit"],
  action: false,
  storable: true,
  requiresComponents: [],
  available: true,
  children: [],
  ...over,
});
const group = (key: string, label: string, children: unknown[], over: Record<string, unknown> = {}) =>
  node(key, label, { levels: [], storable: false, children, ...over });

const CATALOG = {
  maxMembers: 10,
  tree: [
    group("agenda", "Agenda", [
      node("agenda.marcacoes", "Calendário e marcações", {
        children: [node("agenda.marcacoes.valores", "Valores e pagamentos")],
      }),
      node("agenda.servicos", "Serviços"),
    ]),
    group("clientes", "Clientes", [
      node("clientes.lista", "Lista e ficha", {
        children: [node("clientes.lista.exportar", "Exportar dados (RGPD)", { levels: ["edit"], action: true })],
      }),
    ]),
    group("loja", "Loja", [node("loja.produtos", "Produtos", { available: false })], { available: false }),
    node("estatisticas", "Estatísticas do site", { levels: ["view"] }),
  ],
};

const MEMBERS = [
  {
    memberId: "m-active",
    name: "Ana Silva",
    email: "ana@x.pt",
    status: "active",
    lastLoginAt: "2026-10-10T09:30:00.000Z",
    grants: [
      { key: "agenda.marcacoes", level: "view" },
      { key: "clientes.lista", level: "edit" },
    ],
  },
  { memberId: "m-inv", name: "Rui Convidado", email: "rui@x.pt", status: "invited", lastLoginAt: null, grants: [{ key: "agenda.marcacoes", level: "edit" }] },
  { memberId: "m-off", name: "Zé Desactivado", email: "ze@x.pt", status: "disabled", lastLoginAt: null, grants: [] },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Equipa />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useGetTeamMock.mockReturnValue({ data: MEMBERS, isLoading: false, isError: false });
  useGetCatalogMock.mockReturnValue({ data: CATALOG });
  authMock.mockReturnValue({ supportSession: null });
});

describe("Equipa — lista", () => {
  it("mostra nome, email, estado (Badge) e último acesso de cada membro", () => {
    renderPage();
    const row = screen.getByRole("row", { name: /Abrir Ana Silva/ });
    expect(within(row).getByText("ana@x.pt")).toBeInTheDocument();
    expect(within(row).getByText("Activo")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Abrir Rui Convidado/ })).getByText("Convidado")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Abrir Zé Desactivado/ })).getByText("Desactivado")).toBeInTheDocument();
    expect(within(row).getByText(/10\/10\/2026/)).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Abrir Rui Convidado/ })).getByText("Nunca")).toBeInTheDocument();
  });

  it("sem membros: estado vazio com o CTA de convidar", () => {
    useGetTeamMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText("Ainda não tens equipa")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Convidar utilizador/ }).length).toBeGreaterThan(0);
  });

  it("erro da API (ex.: 403 TEAM_ADMIN_FORBIDDEN) é mostrado em PT", () => {
    useGetTeamMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { data: { code: "TEAM_ADMIN_FORBIDDEN" } } },
    });
    renderPage();
    expect(screen.getByText("Não foi possível carregar a equipa")).toBeInTheDocument();
    expect(screen.getByText(/conta de administrador/)).toBeInTheDocument();
  });

  it("no limite de membros o convite fica desactivado com o motivo", () => {
    useGetCatalogMock.mockReturnValue({ data: { ...CATALOG, maxMembers: 3 } });
    renderPage();
    const btn = screen.getByRole("button", { name: /Convidar utilizador/ });
    expect(btn).toBeDisabled();
    expect(btn.closest("span")).toHaveAttribute("title", expect.stringContaining("máximo de 3 membros"));
  });
});

describe("Equipa — convidar", () => {
  function openInvite() {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Convidar utilizador/ }));
    return screen.getByRole("dialog", { name: "Convidar utilizador" });
  }
  const fill = (dialog: HTMLElement) => {
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "  Marta  " } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "marta@x.pt" } });
  };

  it("oferece só 'Acesso total' ou 'Escolher na árvore' — com a ajuda sob o acesso total", () => {
    const dialog = openInvite();
    expect(within(dialog).getAllByRole("radio")).toHaveLength(2);
    expect(within(dialog).getByRole("radio", { name: /Acesso total/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /Escolher na árvore/ })).toBeChecked();
    expect(
      within(dialog).getByText("Dá tudo o que existe hoje. Partes novas que apareçam no futuro ficam fechadas até as dares."),
    ).toBeInTheDocument();
  });

  it("a árvore abre vazia e colapsada; os topos mostram o estado; o módulo que o plano não inclui nem aparece", () => {
    const dialog = openInvite();
    expect(within(dialog).getByRole("checkbox", { name: "Agenda" })).not.toBeChecked();
    expect(within(dialog).queryByRole("checkbox", { name: "Serviços" })).toBeNull(); // colapsado
    expect(within(dialog).queryByRole("checkbox", { name: "Loja" })).toBeNull();
    expect(within(dialog).queryByText(/O teu plano não inclui/)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Agenda" }));
    expect(within(dialog).getByRole("checkbox", { name: "Serviços" })).toBeInTheDocument();
  });

  it("marcar o pai marca os filhos; desmarcar um filho deixa o pai parcial; só Ver/Editar onde há níveis", () => {
    const dialog = openInvite();
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Agenda" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Agenda" }));
    expect(within(dialog).getByRole("checkbox", { name: "Serviços" })).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Calendário e marcações" }));
    expect(within(dialog).getByRole("checkbox", { name: "Valores e pagamentos" })).toBeChecked();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Valores e pagamentos" }));
    expect((within(dialog).getByRole("checkbox", { name: "Calendário e marcações" }) as HTMLInputElement).indeterminate).toBe(true);
    expect((within(dialog).getByRole("checkbox", { name: "Agenda" }) as HTMLInputElement).indeterminate).toBe(true);
    // baixar o pai para Ver: um filho nunca fica acima do pai
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Valores e pagamentos" }));
    fireEvent.click(within(dialog).getByRole("tab", { name: "Calendário e marcações: só ver" }));
    expect(within(dialog).getByRole("tab", { name: "Calendário e marcações: só ver", selected: true })).toBeInTheDocument();
    expect(within(dialog).queryByRole("tab", { name: "Valores e pagamentos: editar" })).toBeNull();
    // só-ver e acção
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Estatísticas do site" }));
    expect(within(dialog).getAllByText("Só ver").length).toBeGreaterThan(0);
  });

  it("'Escolher na árvore' envia só as folhas marcadas (nunca o agrupador)", () => {
    const dialog = openInvite();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Agenda" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Serviços" }));
    fireEvent.click(within(dialog).getByRole("tab", { name: "Serviços: só ver" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));

    expect(mutations.create).toHaveBeenCalledTimes(1);
    expect(mutations.create.mock.calls[0][0]).toEqual({
      data: { name: "Marta", email: "marta@x.pt", grants: [{ key: "agenda.servicos", level: "view" }] },
    });
  });

  it("'Acesso total' envia todos os nós disponíveis ao nível máximo (sem os indisponíveis)", () => {
    const dialog = openInvite();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole("radio", { name: /Acesso total/ }));
    expect(within(dialog).queryByRole("checkbox", { name: "Agenda" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(mutations.create.mock.calls[0][0].data.grants).toEqual([
      { key: "agenda.marcacoes", level: "edit" },
      { key: "agenda.marcacoes.valores", level: "edit" },
      { key: "agenda.servicos", level: "edit" },
      { key: "clientes.lista", level: "edit" },
      { key: "clientes.lista.exportar", level: "edit" },
      { key: "estatisticas", level: "view" },
    ]);
  });

  it("valida antes de enviar: nome, email e pelo menos uma permissão", () => {
    const dialog = openInvite();
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(toastError).toHaveBeenLastCalledWith("Indica o nome.");
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Marta" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "isto-nao-e-email" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(toastError).toHaveBeenLastCalledWith("Indica um email válido.");
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "marta@x.pt" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(toastError).toHaveBeenLastCalledWith("Escolhe pelo menos uma permissão.");
    expect(mutations.create).not.toHaveBeenCalled();
  });

  it("erro 409 EMAIL_IN_USE aparece em PT", () => {
    const dialog = openInvite();
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Marta" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "marta@x.pt" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Agenda" }));
    mutations.create.mockImplementation((_vars, opts) =>
      opts.onError({ response: { status: 409, data: { code: "EMAIL_IN_USE" } } }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/já está a ser usado/));
  });
});

describe("Equipa — ficha do membro", () => {
  function openMember(name: RegExp) {
    renderPage();
    fireEvent.click(screen.getByRole("row", { name }));
    return screen.getByRole("dialog");
  }

  it("activo: árvore com o estado actual, 'Enviar reset de password', Desactivar, Terminar sessões — e sem 'Reenviar convite'", () => {
    const dialog = openMember(/Abrir Ana Silva/);
    // topos colapsados: o estado vê-se logo (Agenda parcial, Clientes parcial — a acção exportar está por dar)
    expect((within(dialog).getByRole("checkbox", { name: "Agenda" }) as HTMLInputElement).indeterminate).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Agenda" }));
    // tem a folha própria, mas falta o filho (Valores): parcial
    expect((within(dialog).getByRole("checkbox", { name: "Calendário e marcações" }) as HTMLInputElement).indeterminate).toBe(true);
    expect(within(dialog).getByRole("tab", { name: "Calendário e marcações: só ver", selected: true })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Clientes" }));
    expect(within(dialog).getByRole("tab", { name: "Lista e ficha: editar", selected: true })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Enviar reset de password/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Desactivar/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Terminar sessões/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Reenviar convite/ })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /Reactivar/ })).toBeNull();
  });

  it("convidado: 'Reenviar convite' e sem reset de password", () => {
    const dialog = openMember(/Abrir Rui Convidado/);
    fireEvent.click(within(dialog).getByRole("button", { name: /Reenviar convite/ }));
    expect(mutations.resend).toHaveBeenCalledWith({ memberId: "m-inv" }, expect.anything());
    expect(within(dialog).queryByRole("button", { name: /Enviar reset de password/ })).toBeNull();
  });

  it("desactivado: 'Reactivar' em vez de 'Desactivar'", () => {
    const dialog = openMember(/Abrir Zé Desactivado/);
    fireEvent.click(within(dialog).getByRole("button", { name: /Reactivar/ }));
    expect(mutations.enable).toHaveBeenCalledWith({ memberId: "m-off" }, expect.anything());
    expect(within(dialog).queryByRole("button", { name: /Desactivar/ })).toBeNull();
  });

  it("Guardar permissões só activa com alterações e envia as folhas novas (substitui)", () => {
    const dialog = openMember(/Abrir Ana Silva/);
    const save = within(dialog).getByRole("button", { name: "Guardar permissões" });
    expect(save).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Agenda" }));
    fireEvent.click(within(dialog).getByRole("tab", { name: "Calendário e marcações: editar" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Clientes" }));
    const lista = within(dialog).getByRole("checkbox", { name: "Lista e ficha" });
    fireEvent.click(lista); // parcial → completa o ramo
    fireEvent.click(lista); // tudo marcado → tira a folha e arrasta a acção
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    expect(mutations.update.mock.calls[0][0]).toEqual({
      memberId: "m-active",
      data: { name: "Ana Silva", grants: [{ key: "agenda.marcacoes", level: "edit" }] },
    });
  });

  it("desactivar, reset e terminar sessões chamam a API certa", () => {
    const dialog = openMember(/Abrir Ana Silva/);
    fireEvent.click(within(dialog).getByRole("button", { name: /Enviar reset de password/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Terminar sessões/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Desactivar/ }));
    expect(mutations.reset).toHaveBeenCalledWith({ memberId: "m-active" }, expect.anything());
    expect(mutations.revoke).toHaveBeenCalledWith({ memberId: "m-active" }, expect.anything());
    expect(mutations.disable).toHaveBeenCalledWith({ memberId: "m-active" }, expect.anything());
  });

  it("Remover pede confirmação e só depois apaga", () => {
    const dialog = openMember(/Abrir Ana Silva/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }));
    expect(mutations.remove).not.toHaveBeenCalled();
    expect(screen.getByText("Remover Ana Silva?")).toBeInTheDocument();
    // o botão de confirmar é o último "Remover" (o do diálogo de confirmação, aberto por cima da ficha)
    fireEvent.click(screen.getAllByRole("button", { name: "Remover" }).at(-1)!);
    expect(mutations.remove).toHaveBeenCalledWith({ memberId: "m-active" }, expect.anything());
  });
});

describe("Equipa — sessão de suporte", () => {
  it("lê a lista, mas todas as escritas ficam desactivadas com o motivo", () => {
    authMock.mockReturnValue({ supportSession: { tenantName: "Tifas", expiresAt: "2099-01-01" } });
    renderPage();
    expect(screen.getByRole("button", { name: /Convidar utilizador/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Ana Silva/ }));
    const dialog = screen.getByRole("dialog");
    for (const name of ["Guardar permissões", "Remover", /Desactivar/, /Enviar reset de password/, /Terminar sessões/]) {
      const b = within(dialog).getByRole("button", { name });
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute("title", "Indisponível numa sessão de suporte");
    }
  });
});
