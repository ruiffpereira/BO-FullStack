import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Admin → Utilizadores → Email → «Caixas» (B42 · fases 5 e 6).
const listMock = vi.fn();
const activate = vi.fn();
const disable = vi.fn();
const enable = vi.fn();
const toastError = vi.fn();
const opts: Record<string, any> = {};

vi.mock("../../src/gen/backoffice/hooks/useGetAdminUsersUseridMailboxes.js", () => ({
  useGetAdminUsersUseridMailboxes: () => listMock(),
  getAdminUsersUseridMailboxesQueryKey: (id: string) => [{ url: "/admin/users/:userId/mailboxes", params: { userId: id } }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridMailboxesBusiness.js", () => ({
  usePostAdminUsersUseridMailboxesBusiness: (o: any) => ((opts.activate = o), { mutate: activate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridMailboxesMailboxidDisable.js", () => ({
  usePostAdminUsersUseridMailboxesMailboxidDisable: () => ({ mutate: disable, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridMailboxesMailboxidEnable.js", () => ({
  usePostAdminUsersUseridMailboxesMailboxidEnable: () => ({ mutate: enable, isPending: false }),
}));
vi.mock("../../src/components/GuardButton", () => ({
  // Sem props de estilo/estado no DOM (isLoading, leaf, variant…): o write-guard não é o assunto destes testes.
  GuardButton: ({ children, isLoading: _l, leaf: _f, variant: _v, size: _s, icon: _i, wrapperClassName: _w, ...rest }: any) => <button {...rest}>{children}</button>,
  GuardIconButton: ({ icon: _i, label, leaf: _f, ...rest }: any) => <button aria-label={label} {...rest} />,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

import { AdminMailboxesSection } from "../../src/components/AdminMailboxesSection";

const BUSINESS = { mailboxId: "b1", address: "geral@tifas.rufvision.com", kind: "business", displayName: "Tifas", status: "active", quotaMb: 1024, usedMb: 12, forwardTo: null, pendingSync: false };
const MEMBER = { mailboxId: "b2", address: "ana@tifas.rufvision.com", kind: "member", displayName: "Ana", status: "active", quotaMb: 512, usedMb: null, forwardTo: null, pendingSync: true };
const OFF = { ...MEMBER, mailboxId: "b3", address: "rui@tifas.rufvision.com", status: "disabled", pendingSync: false, forwardTo: "geral@tifas.rufvision.com" };

function renderIt() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AdminMailboxesSection userId="u1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockReturnValue({ data: { configured: true, moduleEnabled: true, mailboxes: [BUSINESS, MEMBER, OFF] }, isLoading: false, isError: false });
});

describe("AdminMailboxesSection", () => {
  it("lista endereço, tipo, quota, usado, reencaminha para e pendente", () => {
    renderIt();
    const rows = screen.getAllByTestId("admin-mailbox-row");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("geral@tifas.rufvision.com")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Suporte")).toBeInTheDocument();
    expect(within(rows[0]).getByText("1024 MB")).toBeInTheDocument();
    expect(within(rows[0]).getByText("12 MB")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Pendente")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Desactivada")).toBeInTheDocument();
    expect(within(rows[2]).getByText("geral@tifas.rufvision.com")).toBeInTheDocument();
  });

  it("desactivar / reactivar só nas caixas de membro", () => {
    renderIt();
    const rows = screen.getAllByTestId("admin-mailbox-row");
    expect(within(rows[0]).queryByRole("button")).toBeNull(); // a do negócio não se desactiva
    fireEvent.click(within(rows[1]).getByRole("button", { name: "Desactivar" }));
    expect(disable).toHaveBeenCalledWith({ userId: "u1", mailboxId: "b2" });
    fireEvent.click(within(rows[2]).getByRole("button", { name: "Reactivar" }));
    expect(enable).toHaveBeenCalledWith({ userId: "u1", mailboxId: "b3" });
  });

  it("com a caixa do negócio activa não há «Activar a caixa do negócio»", () => {
    renderIt();
    expect(screen.queryByRole("button", { name: "Activar a caixa do negócio" })).toBeNull();
  });

  it("sem caixa do negócio: activa (com quota opcional validada 50-51200)", () => {
    listMock.mockReturnValue({ data: { configured: true, moduleEnabled: true, mailboxes: [] }, isLoading: false, isError: false });
    renderIt();
    expect(screen.getByTestId("admin-mailboxes-empty")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Activar a caixa do negócio" });
    fireEvent.click(btn);
    expect(activate).toHaveBeenLastCalledWith({ userId: "u1", data: {} });
    fireEvent.change(screen.getByLabelText("Quota (MB, opcional)"), { target: { value: "2048" } });
    fireEvent.click(btn);
    expect(activate).toHaveBeenLastCalledWith({ userId: "u1", data: { quotaMb: 2048 } });
    fireEvent.change(screen.getByLabelText("Quota (MB, opcional)"), { target: { value: "10" } });
    expect(btn).toBeDisabled();
  });

  it("módulo Correio desligado: avisa e não deixa activar", () => {
    listMock.mockReturnValue({ data: { configured: true, moduleEnabled: false, mailboxes: [] }, isLoading: false, isError: false });
    renderIt();
    expect(screen.getByText("Módulo Correio desligado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activar a caixa do negócio" })).toBeDisabled();
  });

  it("servidor por configurar: etiqueta «Por configurar»", () => {
    listMock.mockReturnValue({ data: { configured: false, moduleEnabled: true, mailboxes: [] }, isLoading: false, isError: false });
    renderIt();
    expect(screen.getByText("Por configurar")).toBeInTheDocument();
  });

  it("erro ao activar aparece em PT", () => {
    renderIt();
    opts.activate.mutation.onError({ response: { status: 409, data: { error: "x", code: "EMAIL_DOMAIN_NOT_FOUND" } } });
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/domínio de email/));
  });
});
