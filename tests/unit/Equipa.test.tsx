import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── B41 — página /equipa ──────────────────────────────────────────────────────
//
// Mockamos os hooks gerados (lista, catálogo, mutações) e a sessão; o QueryClient é real (as invalidações usam
// `useQueryClient`). O write-guard passa pelo GuardButton → billing mockado.
const { useGetTeamMock, useGetCatalogMock, useActivityMock, authMock, toastSuccess, toastError, toastWarning, mutations, mut } = vi.hoisted(() => {
  const mutations = {
    create: vi.fn(),
    update: vi.fn(),
    resend: vi.fn(),
    reset: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    revoke: vi.fn(),
    remove: vi.fn(),
    preview: vi.fn(),
  };
  return {
    useGetTeamMock: vi.fn(),
    useGetCatalogMock: vi.fn(),
    useActivityMock: vi.fn(),
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
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidGrantsPreview", () => ({
  usePostTeamMemberidGrantsPreview: mut(mutations.preview),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetTeamMemberidActivity", () => ({
  useGetTeamMemberidActivity: (...a: unknown[]) => useActivityMock(...a),
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
  useActivityMock.mockReturnValue({ data: { items: [], page: 1, limit: 15, total: 0 }, isLoading: false, isError: false });
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
      within(dialog).getByText("Dá tudo o que existe hoje, menos gerir a equipa. Partes novas que apareçam no futuro ficam fechadas até as dares."),
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

// ── Fase 3 — delegação ────────────────────────────────────────────────────────

const EQUIPA_CATALOG = {
  maxMembers: 10,
  tree: [
    ...CATALOG.tree,
    node("equipa", "Equipa", { excludeFromFullAccess: true, levelLabels: { edit: "Gerir" }, maxLevel: "edit" }),
  ],
};

const asMember = (level: "view" | "edit") => ({
  supportSession: null,
  isMember: true,
  member: { memberId: "me", name: "Barbeiro", tenantName: "Barbearia Navalha" },
  can: (key: string, l: "view" | "edit" = "view") => key === "equipa" && (l === "view" || level === "edit"),
});

const WITH_CHILD = [
  { ...MEMBERS[0], createdBy: null, canManage: true },
  { ...MEMBERS[1], createdBy: { memberId: "m-active", name: "Ana Silva" }, canManage: true },
];

describe("Equipa — fase 3 · dono", () => {
  it("mostra 'Criado por': Tu para o dono, o nome do membro para os convidados dele", () => {
    useGetTeamMock.mockReturnValue({ data: WITH_CHILD, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByRole("columnheader", { name: "Criado por" })).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Abrir Ana Silva/ })).getByText("Tu")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Abrir Rui Convidado/ })).getByText("Ana Silva")).toBeInTheDocument();
  });

  it("'Acesso total' não dá o nó Equipa", () => {
    useGetCatalogMock.mockReturnValue({ data: EQUIPA_CATALOG });
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Convidar utilizador/ })[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Novo" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "novo@x.pt" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Acesso total/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    const sent = mutations.create.mock.calls[0][0].data.grants.map((g: { key: string }) => g.key);
    expect(sent).toContain("agenda.servicos");
    expect(sent).not.toContain("equipa");
  });

  it("cascata: se o membro criou outros e há afectados, pede confirmação antes do PUT", () => {
    useGetTeamMock.mockReturnValue({ data: WITH_CHILD, isLoading: false, isError: false });
    mutations.preview.mockImplementation((_v, opts) => opts.onSuccess({ affected: 2 }));
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Ana Silva/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Agenda" }));
    fireEvent.click(within(dialog).getByRole("tab", { name: "Calendário e marcações: editar" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar permissões" }));
    expect(mutations.preview).toHaveBeenCalled();
    expect(mutations.update).not.toHaveBeenCalled();
    expect(screen.getByText("Também sai a 2 utilizadores criados por este membro.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar e retirar" }));
    expect(mutations.update).toHaveBeenCalledTimes(1);
  });

  it("cascata: sem afectados guarda logo, sem aviso", () => {
    useGetTeamMock.mockReturnValue({ data: WITH_CHILD, isLoading: false, isError: false });
    mutations.preview.mockImplementation((_v, opts) => opts.onSuccess({ affected: 0 }));
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Ana Silva/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Agenda" }));
    fireEvent.click(within(dialog).getByRole("tab", { name: "Calendário e marcações: editar" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar permissões" }));
    expect(mutations.update).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Também sai/)).toBeNull();
  });

  it("membro que não criou ninguém: não chama o preview", () => {
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Ana Silva/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir Agenda" }));
    fireEvent.click(within(dialog).getByRole("tab", { name: "Calendário e marcações: editar" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar permissões" }));
    expect(mutations.preview).not.toHaveBeenCalled();
    expect(mutations.update).toHaveBeenCalledTimes(1);
  });

  it("ficha: separador Actividade lista as acções", () => {
    useActivityMock.mockReturnValue({
      data: {
        items: [{ id: "1", at: "2026-10-10T09:30:00.000Z", action: "update", actionLabel: "Alterou", area: "Agenda", ok: false, statusCode: 403 }],
        page: 1,
        limit: 15,
        total: 1,
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Ana Silva/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: "Actividade" }));
    expect(within(dialog).getByText("Alterou")).toBeInTheDocument();
    expect(within(dialog).getByText("Agenda")).toBeInTheDocument();
    expect(within(dialog).getByText("Falhou")).toBeInTheDocument();
    expect(useActivityMock).toHaveBeenCalledWith("m-active", { page: 1, limit: 15 });
  });

  it("Actividade vazia: 'Ainda sem actividade'", () => {
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Ana Silva/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: "Actividade" }));
    expect(within(dialog).getByText("Ainda sem actividade")).toBeInTheDocument();
  });
});

describe("Equipa — fase 3 · membro", () => {
  const BASIC = [
    { memberId: "me", name: "Barbeiro", status: "active", lastLoginAt: null, createdBy: null, isSelf: true, canManage: false },
    { memberId: "x", name: "Colega", status: "active", lastLoginAt: null, createdBy: { memberId: "me", name: "Barbeiro" }, isSelf: false, canManage: false },
  ];

  it("só Ver: lista de leitura, sem email, sem Convidar, sem abrir ficha; criado por mostra o negócio", () => {
    authMock.mockReturnValue(asMember("view"));
    useGetTeamMock.mockReturnValue({ data: BASIC, isLoading: false, isError: false });
    useGetCatalogMock.mockReturnValue({ data: EQUIPA_CATALOG });
    renderPage();
    expect(screen.queryByRole("button", { name: /Convidar utilizador/ })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Email" })).toBeNull();
    expect(screen.queryByRole("row", { name: /Abrir/ })).toBeNull();
    expect(screen.getByText("Barbearia Navalha")).toBeInTheDocument();
    expect(screen.getByText("(tu)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Colega"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Gerir: convida (sem 'Acesso total'); abre só as linhas com canManage, nunca a própria", () => {
    authMock.mockReturnValue(asMember("edit"));
    useGetTeamMock.mockReturnValue({
      data: [
        BASIC[0],
        { ...MEMBERS[0], memberId: "x", name: "Colega", createdBy: { memberId: "me", name: "Barbeiro" }, canManage: true, isSelf: false },
        { memberId: "y", name: "Outro", status: "active", lastLoginAt: null, createdBy: null, isSelf: false, canManage: false },
      ],
      isLoading: false,
      isError: false,
    });
    useGetCatalogMock.mockReturnValue({ data: EQUIPA_CATALOG });
    renderPage();
    expect(screen.getAllByRole("row", { name: /Abrir/ })).toHaveLength(1);
    expect(screen.getByRole("row", { name: "Abrir Colega" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Convidar utilizador/ })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("radio", { name: /Acesso total/ })).toBeNull();
    expect(within(dialog).getByRole("list", { name: "Permissões" })).toBeInTheDocument();
  });

  it("nós acima do maxLevel ficam desactivados com 'Só podes dar o que tens'", () => {
    authMock.mockReturnValue(asMember("edit"));
    useGetTeamMock.mockReturnValue({ data: [BASIC[0]], isLoading: false, isError: false });
    useGetCatalogMock.mockReturnValue({
      data: {
        maxMembers: 10,
        tree: [
          node("equipa", "Equipa", { levelLabels: { edit: "Gerir" }, maxLevel: "view" }),
          node("agenda.servicos", "Serviços", { maxLevel: null }),
        ],
      },
    });
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Convidar utilizador/ })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("checkbox", { name: "Serviços" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Equipa" }));
    const gerir = within(dialog).getByRole("tab", { name: "Equipa: Gerir" });
    expect(gerir).toBeDisabled();
    expect(gerir).toHaveAttribute("title", "Só podes dar o que tens");
  });
});

describe("Equipa — fase 3 · fecho (remover com convidados, desactivado pelo dono, motivo visível)", () => {
  const BOSS = { ...MEMBERS[0], memberId: "boss", name: "Chefe", createdBy: null, canManage: true, isSelf: false };
  const kid = (id: string) => ({ ...MEMBERS[0], memberId: id, name: `Conv ${id}`, createdBy: { memberId: "boss", name: "Chefe" }, canManage: true, isSelf: false });

  it("dono: remover um membro com 2 convidados avisa que passam para ti", () => {
    useGetTeamMock.mockReturnValue({ data: [BOSS, kid("k1"), kid("k2")], isLoading: false, isError: false });
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Chefe/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remover" }));
    expect(screen.getByTestId("remove-guests-note")).toHaveTextContent(
      "Os 2 utilizadores que este membro convidou passam para ti, com as permissões que têm.",
    );
  });

  it("singular com 1 convidado; sem convidados não há aviso", () => {
    useGetTeamMock.mockReturnValue({ data: [BOSS, kid("k1")], isLoading: false, isError: false });
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Chefe/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remover" }));
    expect(screen.getByTestId("remove-guests-note")).toHaveTextContent(
      "O utilizador que este membro convidou passa para ti, com as permissões que tem.",
    );
  });

  it("o diálogo de confirmação tem nome acessível (o título)", () => {
    useGetTeamMock.mockReturnValue({ data: [BOSS], isLoading: false, isError: false });
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Chefe/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remover" }));
    expect(screen.getByRole("dialog", { name: "Remover Chefe?" })).toBeInTheDocument();
    expect(screen.queryByTestId("remove-guests-note")).toBeNull();
  });

  it("delegado: Reactivar fica desactivado, com o motivo visível, num membro desactivado pelo dono", () => {
    authMock.mockReturnValue(asMember("edit"));
    useGetTeamMock.mockReturnValue({
      data: [
        { memberId: "me", name: "Barbeiro", status: "active", lastLoginAt: null, createdBy: null, isSelf: true, canManage: false },
        { ...MEMBERS[2], memberId: "off", name: "Desligado", createdBy: { memberId: "me", name: "Barbeiro" }, canManage: true, isSelf: false, disabledByOwner: true },
      ],
      isLoading: false,
      isError: false,
    });
    useGetCatalogMock.mockReturnValue({ data: EQUIPA_CATALOG });
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: "Abrir Desligado" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Reactivar" })).toBeDisabled();
    expect(within(dialog).getByTestId("owner-disabled-note")).toHaveTextContent("Foi o dono que desactivou este utilizador.");
  });

  it("dono: Reactivar continua activo num membro desactivado por ele", () => {
    useGetTeamMock.mockReturnValue({ data: [{ ...MEMBERS[2], disabledByOwner: true }], isLoading: false, isError: false });
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Zé Desactivado/ }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Reactivar" })).toBeEnabled();
  });

  it("a árvore mostra o motivo 'Só podes dar o que tens' como texto quando há nós bloqueados", () => {
    authMock.mockReturnValue(asMember("edit"));
    useGetTeamMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useGetCatalogMock.mockReturnValue({
      data: { maxMembers: 10, tree: [node("agenda.servicos", "Serviços", { maxLevel: null }), node("equipa", "Equipa", { maxLevel: "view" })] },
    });
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Convidar utilizador/ })[0]);
    expect(within(screen.getByRole("dialog")).getByTestId("tree-limit-note")).toHaveTextContent("Só podes dar o que tens");
  });

  it("sem nós bloqueados não há nota", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Convidar utilizador/ })[0]);
    expect(screen.queryByTestId("tree-limit-note")).toBeNull();
  });
});
