import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Equipa x Correio (B42 · fase 6): ☐ «Dar-lhe um endereço de email» no convite e na ficha do membro ───────────────
const { useGetTeamMock, useGetCatalogMock, authMock, toastSuccess, toastError, toastWarning, mutations, mut } = vi.hoisted(() => {
  const mutations = { create: vi.fn(), update: vi.fn(), noop: vi.fn() };
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
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidResendInvite", () => ({ usePostTeamMemberidResendInvite: mut(mutations.noop) }));
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidSendReset", () => ({ usePostTeamMemberidSendReset: mut(mutations.noop) }));
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidDisable", () => ({ usePostTeamMemberidDisable: mut(mutations.noop) }));
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidEnable", () => ({ usePostTeamMemberidEnable: mut(mutations.noop) }));
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidRevokeSessions", () => ({ usePostTeamMemberidRevokeSessions: mut(mutations.noop) }));
vi.mock("../../src/gen/backoffice/hooks/usePostTeamMemberidGrantsPreview", () => ({ usePostTeamMemberidGrantsPreview: mut(mutations.noop) }));
vi.mock("../../src/gen/backoffice/hooks/useDeleteTeamMemberid", () => ({ useDeleteTeamMemberid: mut(mutations.noop) }));
vi.mock("../../src/gen/backoffice/hooks/useGetTeamMemberidActivity", () => ({
  useGetTeamMemberidActivity: () => ({ data: { items: [], page: 1, limit: 15, total: 0 }, isLoading: false, isError: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetMailMailboxes.js", () => ({
  useGetMailMailboxes: () => ({ data: { configured: true, mailboxes: [{ mailboxId: "b1", kind: "business", address: "geral@tifas.rufvision.com" }] } }),
}));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => authMock() }));
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: (...a: unknown[]) => toastWarning(...a),
  },
}));

import { Equipa, canGiveMailbox } from "../../src/pages/Equipa";

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

const catalog = (correio: Record<string, unknown> | null) => ({
  maxMembers: 10,
  tree: [
    group("agenda", "Agenda", [node("agenda.servicos", "Serviços")]),
    ...(correio
      ? [group("correio", "Correio", [node("correio.caixa", "Caixa", { levelLabels: { edit: "Responder" }, ...correio })])]
      : []),
  ],
});

const MEMBERS = [
  { memberId: "m1", name: "Ana Sá", email: "ana@x.pt", status: "active", lastLoginAt: null, grants: [{ key: "agenda.servicos", level: "view" }], mailbox: null },
  {
    memberId: "m2",
    name: "Rui",
    email: "rui@x.pt",
    status: "active",
    lastLoginAt: null,
    grants: [{ key: "agenda.servicos", level: "view" }],
    mailbox: { address: "rui@tifas.rufvision.com", status: "active" },
  },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Equipa />
    </QueryClientProvider>,
  );
}
function openInvite() {
  renderPage();
  fireEvent.click(screen.getByRole("button", { name: /Convidar utilizador/ }));
  return screen.getByRole("dialog", { name: "Convidar utilizador" });
}
function fill(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Marta Sá" } });
  fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "marta@x.pt" } });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Agenda" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  useGetTeamMock.mockReturnValue({ data: MEMBERS, isLoading: false, isError: false });
  useGetCatalogMock.mockReturnValue({ data: catalog({}) });
  authMock.mockReturnValue({ supportSession: null });
});

describe("canGiveMailbox", () => {
  it("só com o nó correio.caixa disponível e dentro do tecto de quem convida", () => {
    expect(canGiveMailbox(catalog({}).tree as never)).toBe(true);
    expect(canGiveMailbox(catalog({ available: false }).tree as never)).toBe(false);
    expect(canGiveMailbox(catalog({ maxLevel: "view" }).tree as never)).toBe(false);
    expect(canGiveMailbox(catalog({ maxLevel: null }).tree as never)).toBe(false);
    expect(canGiveMailbox(catalog(null).tree as never)).toBe(false);
  });
});

describe("Convite — ☐ Dar-lhe um endereço de email", () => {
  it("sem o módulo Correio o campo não aparece", () => {
    useGetCatalogMock.mockReturnValue({ data: catalog(null) });
    const dialog = openInvite();
    expect(within(dialog).queryByRole("checkbox", { name: /Dar-lhe um endereço de email/ })).toBeNull();
  });

  it("com o módulo: ☐ desligado por omissão; ligar sugere a parte local do nome e mostra o domínio", () => {
    const dialog = openInvite();
    const box = within(dialog).getByRole("checkbox", { name: /Dar-lhe um endereço de email/ });
    expect(box).not.toBeChecked();
    expect(within(dialog).queryByLabelText("Parte local do endereço")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Marta Sá" } });
    fireEvent.click(box);
    expect(within(dialog).getByLabelText("Parte local do endereço")).toHaveAttribute("placeholder", "marta");
    expect(within(dialog).getByText(/marta@tifas\.rufvision\.com/)).toBeInTheDocument();
  });

  it("sem tocar na parte local envia giveMailbox sem mailboxLocalPart (a API deriva e desambigua)", () => {
    const dialog = openInvite();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Dar-lhe um endereço de email/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(mutations.create.mock.calls[0][0].data).toEqual({
      name: "Marta Sá",
      email: "marta@x.pt",
      grants: [{ key: "agenda.servicos", level: "edit" }],
      giveMailbox: true,
    });
  });

  it("escrevendo a parte local, vai com o pedido; inválida bloqueia", () => {
    const dialog = openInvite();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Dar-lhe um endereço de email/ }));
    fireEvent.change(within(dialog).getByLabelText("Parte local do endereço"), { target: { value: "marta.sa" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(mutations.create.mock.calls[0][0].data).toMatchObject({ giveMailbox: true, mailboxLocalPart: "marta.sa" });

    mutations.create.mockClear();
    fireEvent.change(within(dialog).getByLabelText("Parte local do endereço"), { target: { value: "má!" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(mutations.create).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/caracteres inválidos/));
  });

  it("sem ☐ não envia nada do correio", () => {
    const dialog = openInvite();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(mutations.create.mock.calls[0][0].data).not.toHaveProperty("giveMailbox");
  });

  it("mailboxError: o convite segue e o motivo aparece em PT", () => {
    const dialog = openInvite();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Dar-lhe um endereço de email/ }));
    mutations.create.mockImplementation((_v, opts) =>
      opts.onSuccess({ emailSent: true, member: { memberId: "x" }, mailboxError: "mailbox_address_unavailable" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(toastWarning).toHaveBeenCalledWith(expect.stringMatching(/não está disponível/));
  });

  it("sucesso mostra o endereço criado", () => {
    const dialog = openInvite();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Dar-lhe um endereço de email/ }));
    mutations.create.mockImplementation((_v, opts) =>
      opts.onSuccess({ emailSent: true, member: { memberId: "x", mailbox: { address: "marta@tifas.rufvision.com", status: "active" } } }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(toastSuccess).toHaveBeenCalledWith("Endereço criado: marta@tifas.rufvision.com");
  });
});

describe("Ficha do membro — endereço de email", () => {
  it("membro com caixa: mostra o endereço e o estado", () => {
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Rui/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTestId("member-mailbox-address")).toHaveTextContent("rui@tifas.rufvision.com");
    expect(within(within(dialog).getByTestId("member-mailbox")).getByText("Activo")).toBeInTheDocument();
  });

  it("membro sem caixa: oferece criar o endereço (PUT com giveMailbox)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Ana Sá/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Dar-lhe um endereço de email/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar endereço" }));
    expect(mutations.update.mock.calls[0][0]).toEqual({ memberId: "m1", data: { giveMailbox: true } });
  });

  it("sem o módulo, a secção não existe (a não ser que o membro já tenha caixa)", () => {
    useGetCatalogMock.mockReturnValue({ data: catalog(null) });
    renderPage();
    fireEvent.click(screen.getByRole("row", { name: /Abrir Ana Sá/ }));
    expect(within(screen.getByRole("dialog")).queryByTestId("member-mailbox")).toBeNull();
  });
});
