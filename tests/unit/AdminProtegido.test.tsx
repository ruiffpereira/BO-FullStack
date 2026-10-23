import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// B40 — "a conta admin é intocável". O servidor manda `isPlatformAdmin` (utilizadores)
// e `protected` (roles e componentes); a UI só os respeita, nunca os recalcula.

const useGetUsersMock = vi.fn();
const useGetPermissionsMock = vi.fn();
const useGetComponentsMock = vi.fn();
const putUsersMutate = vi.fn();
let putUsersOptions: any = null;
const authMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetUsers.js", () => ({
  useGetUsers: () => useGetUsersMock(),
  getUsersQueryKey: () => [{ url: "/users" }],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetPermissions.js", () => ({
  useGetPermissions: () => useGetPermissionsMock(),
  getPermissionsQueryKey: () => [{ url: "/permissions" }],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetComponents.js", () => ({
  useGetComponents: () => useGetComponentsMock(),
  getComponentsQueryKey: () => [{ url: "/components" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePostUsersRegister.js", () => ({
  usePostUsersRegister: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutUsers.js", () => ({
  usePutUsers: (opts: any) => {
    putUsersOptions = opts;
    return { mutate: putUsersMutate, isPending: false };
  },
}));
vi.mock("../../src/gen/backoffice/hooks/usePostUsersUseridSendReset.js", () => ({
  usePostUsersUseridSendReset: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutAdminUsersUseridSiteDomain.js", () => ({
  usePutAdminUsersUseridSiteDomain: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useDeleteUsersUserid.js", () => ({
  useDeleteUsersUserid: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostPermissions.js", () => ({
  usePostPermissions: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutPermissionsId.js", () => ({
  usePutPermissionsId: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useDeletePermissionsId.js", () => ({
  useDeletePermissionsId: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostComponents.js", () => ({
  usePostComponents: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutComponentsId.js", () => ({
  usePutComponentsId: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useDeleteComponentsId.js", () => ({
  useDeleteComponentsId: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/components/GuardButton", () => ({
  // Sem props de estilo/estado no DOM (isLoading, leaf, variant…): o write-guard não é o assunto destes testes.
  GuardButton: ({ children, isLoading: _l, leaf: _f, variant: _v, size: _s, icon: _i, wrapperClassName: _w, ...rest }: any) => <button {...rest}>{children}</button>,
  GuardIconButton: ({ icon: _i, label, leaf: _f, ...rest }: any) => <button aria-label={label} {...rest} />,
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) },
}));

import { Admin } from "../../src/pages/Admin";

const ROLE_ADMIN = { permissionId: "r-admin", name: "Admin", description: "Acesso total", protected: true };
const ROLE_STAFF = { permissionId: "r-staff", name: "Staff", description: "Equipa", protected: false };

const ADMIN_USER = {
  userId: "admin-1",
  name: "Conta do admin",
  email: "admin@example.com",
  permissions: [ROLE_ADMIN],
  isPlatformAdmin: true,
  canImpersonate: false,
};
const TENANT = {
  userId: "u1",
  name: "Barbearia Central",
  email: "central@example.com",
  permissions: [ROLE_STAFF],
  isPlatformAdmin: false,
  canImpersonate: true,
};

function renderView(view: "utilizadores" | "permissoes" | "componentes") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Admin view={view} />
    </QueryClientProvider>,
  );
}
const row = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  putUsersOptions = null;
  authMock.mockReturnValue({ authHeader: () => ({}), userId: "someone-else" });
  useGetPermissionsMock.mockReturnValue({ data: [ROLE_ADMIN, ROLE_STAFF], isLoading: false });
  useGetUsersMock.mockReturnValue({ data: [ADMIN_USER, TENANT], isLoading: false });
  useGetComponentsMock.mockReturnValue({ data: [], isLoading: false });
});

describe("Admin — Utilizadores — conta admin intocável", () => {
  it("a linha do admin mostra 'Acesso total' e não tem o botão Eliminar (não está só desactivado)", () => {
    renderView("utilizadores");
    const adminRow = row("Conta do admin");
    expect(within(adminRow).getByText("Acesso total")).toBeInTheDocument();
    expect(within(adminRow).queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
    // As outras acções ficam.
    expect(within(adminRow).getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(within(adminRow).getByRole("button", { name: "Reset password" })).toBeInTheDocument();
    // Um tenant normal mantém o Eliminar e as badges das roles.
    const tenantRow = row("Barbearia Central");
    expect(within(tenantRow).getByRole("button", { name: "Eliminar" })).toBeEnabled();
    expect(within(tenantRow).getByText("Staff")).toBeInTheDocument();
    expect(within(tenantRow).queryByText("Acesso total")).not.toBeInTheDocument();
  });

  it("editar o admin: permissão fixa ('Admin — fixo') e o PUT não envia permissionId", () => {
    renderView("utilizadores");
    fireEvent.click(within(row("Conta do admin")).getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Admin — fixo")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Seleccionar permissão/ })).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Novo nome" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(putUsersMutate).toHaveBeenCalledTimes(1);
    const sent = putUsersMutate.mock.calls[0][0].data;
    expect(sent.userId).toBe("admin-1");
    expect(sent.name).toBe("Novo nome");
    expect(sent).not.toHaveProperty("permissionId");
  });

  it("novo utilizador e editar tenant: o seletor não mostra roles protegidas", () => {
    renderView("utilizadores");
    fireEvent.click(screen.getByRole("button", { name: "Novo utilizador" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Seleccionar permissão/ }));
    expect(screen.getByRole("option", { name: "Staff" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Admin" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    fireEvent.click(within(row("Barbearia Central")).getByRole("button", { name: "Editar" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("Admin — fixo")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Staff/ }));
    expect(screen.queryByRole("option", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("um 403 ADMIN_PROTECTED que escape mostra a mensagem do servidor", () => {
    renderView("utilizadores");
    putUsersOptions.mutation.onError({
      response: { status: 403, data: { error: "A conta de admin não pode ser alterada.", code: "ADMIN_PROTECTED" } },
    });
    expect(toastError).toHaveBeenCalledWith("A conta de admin não pode ser alterada.");
  });
});

describe("Admin — Permissões — role protegida", () => {
  it("role protegida: cadeado + 'Só leitura', sem Editar nem Eliminar; a outra mantém ambos", () => {
    renderView("permissoes");
    const adminRow = row("Admin");
    expect(within(adminRow).getByText("Só leitura")).toBeInTheDocument();
    expect(within(adminRow).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(within(adminRow).queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();

    const staffRow = row("Staff");
    expect(within(staffRow).getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(within(staffRow).getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });
});

describe("Admin — Componentes — componente protegido", () => {
  const VIEW_ADMIN = { componentId: "c1", name: "VIEW_ADMIN", description: "Admin", protected: true, permissions: [ROLE_ADMIN] };
  const VIEW_X = { componentId: "c2", name: "VIEW_X", description: "X", protected: false, permissions: [ROLE_ADMIN, ROLE_STAFF] };

  it("componente protegido: 'Só leitura', sem Editar nem Eliminar", () => {
    useGetComponentsMock.mockReturnValue({ data: [VIEW_ADMIN, VIEW_X], isLoading: false });
    renderView("componentes");
    const card = screen.getByText("VIEW_ADMIN").closest(".group") as HTMLElement;
    expect(within(card).getByText("Só leitura")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();

    const other = screen.getByText("VIEW_X").closest(".group") as HTMLElement;
    expect(within(other).getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(within(other).getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });

  it("no formulário a caixa da role de admin vem marcada, desactivada e com a nota", () => {
    useGetComponentsMock.mockReturnValue({ data: [VIEW_X], isLoading: false });
    renderView("componentes");
    fireEvent.click(screen.getByRole("button", { name: "Novo componente" }));
    const dialog = screen.getByRole("dialog");
    const adminBox = within(dialog).getByRole("checkbox", { name: /Admin/ });
    expect(adminBox).toBeChecked();
    expect(adminBox).toBeDisabled();
    expect(within(dialog).getByText("O Admin tem sempre acesso")).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: /Staff/ })).not.toBeDisabled();
  });
});
