import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// Admin → tab Utilizadores → apagar tenant (B8, hard delete). Mockamos os hooks
// gerados pelo Kubb usados por essa aba, mesma técnica do AdminBilling.test.tsx
// e do Perfil.test.tsx (mock por caminho de import, QueryClientProvider real só
// porque a invalidação usa `useQueryClient()`).
//
// O `useDeleteUsersUserid` precisa de um mock "vivo": para testar o que a
// página faz com o resultado (fechar o modal no sucesso, mensagem certa por
// código de erro), capturamos as `options.mutation` que o componente passa ao
// hook e invocamo-las manualmente a partir do teste — o `mutate` em si é só um
// spy (não faz pedidos reais).

const useGetUsersMock = vi.fn();
const useGetPermissionsMock = vi.fn();
const postUsersRegisterMutate = vi.fn();
const putUsersMutate = vi.fn();
const sendResetMutate = vi.fn();
const deleteMutate = vi.fn();
let deleteMutationOptions: any = null;
let deleteIsPending = false;
const domainMutate = vi.fn();
let domainMutationOptions: any = null;
const authMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetUsers.js", () => ({
  useGetUsers: () => useGetUsersMock(),
  getUsersQueryKey: () => [{ url: "/users" }],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetPermissions.js", () => ({
  useGetPermissions: () => useGetPermissionsMock(),
  getPermissionsQueryKey: () => [{ url: "/permissions" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePostUsersRegister.js", () => ({
  usePostUsersRegister: () => ({ mutate: postUsersRegisterMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutUsers.js", () => ({
  usePutUsers: () => ({ mutate: putUsersMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostUsersUseridSendReset.js", () => ({
  usePostUsersUseridSendReset: () => ({ mutate: sendResetMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutAdminUsersUseridSiteDomain.js", () => ({
  usePutAdminUsersUseridSiteDomain: (opts: any) => {
    domainMutationOptions = opts;
    return { mutate: domainMutate, isPending: false };
  },
}));
vi.mock("../../src/components/GuardButton", () => ({
  GuardButton: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
}));
vi.mock("../../src/gen/backoffice/hooks/useDeleteUsersUserid.js", () => ({
  useDeleteUsersUserid: (opts: any) => {
    deleteMutationOptions = opts;
    return { mutate: deleteMutate, isPending: deleteIsPending };
  },
}));

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { Admin } from "../../src/pages/Admin";

const TENANT = { userId: "u1", name: "Barbearia Central", email: "central@example.com", permissions: [] };
const OTHER_TENANT = { userId: "u2", name: "Ginásio Norte", email: "norte@example.com", permissions: [] };
const ADMIN_SELF = { userId: "admin-1", name: "Conta do admin", email: "admin@example.com", permissions: [] };

function mockUsers(users: unknown[], isLoading = false) {
  useGetUsersMock.mockReturnValue({ data: users, isLoading });
}

function renderAdmin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Admin view="utilizadores" />
    </QueryClientProvider>,
  );
}

/** Abre o modal de eliminar na linha de `name`. */
function openDeleteModal(name: string) {
  const row = screen.getByText(name).closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: "Eliminar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteMutationOptions = null;
  deleteIsPending = false;
  useGetPermissionsMock.mockReturnValue({ data: [] });
  authMock.mockReturnValue({ authHeader: () => ({}), userId: "admin-1" });
});

describe("Admin — apagar tenant — confirmação forte", () => {
  it("botão 'Apagar definitivamente' fica desactivado até o email do tenant bater", () => {
    mockUsers([TENANT]);
    renderAdmin();

    openDeleteModal("Barbearia Central");

    const confirmBtn = screen.getByRole("button", { name: "Apagar definitivamente" });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByLabelText("Escreve o email do tenant para confirmar");
    fireEvent.change(input, { target: { value: "email-errado@example.com" } });
    expect(confirmBtn).toBeDisabled();

    // Case-insensitive + trim de espaços (comentário no Admin.tsx explica o porquê).
    fireEvent.change(input, { target: { value: "  CENTRAL@EXAMPLE.COM  " } });
    expect(confirmBtn).toBeEnabled();

    fireEvent.click(confirmBtn);
    expect(deleteMutate).toHaveBeenCalledWith({ userId: "u1" });
  });

  it("502 (falha no Stripe) mostra a mensagem certa e mantém o modal aberto", () => {
    mockUsers([TENANT]);
    renderAdmin();

    openDeleteModal("Barbearia Central");
    fireEvent.change(screen.getByLabelText("Escreve o email do tenant para confirmar"), {
      target: { value: "central@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apagar definitivamente" }));

    expect(deleteMutationOptions?.mutation?.onError).toBeTypeOf("function");
    act(() => {
      deleteMutationOptions.mutation.onError({ response: { status: 502 } });
    });

    expect(toastError).toHaveBeenCalledWith("Falha no Stripe — nada foi apagado. Tenta novamente.");
    // O modal continua montado — o título ainda mostra o tenant a apagar.
    expect(screen.getByText('Eliminar "Barbearia Central" definitivamente?')).toBeInTheDocument();
  });

  it("400 (apagar-se a si próprio) mostra a mensagem certa", () => {
    mockUsers([TENANT]);
    renderAdmin();

    openDeleteModal("Barbearia Central");
    fireEvent.change(screen.getByLabelText("Escreve o email do tenant para confirmar"), {
      target: { value: "central@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apagar definitivamente" }));

    act(() => {
      deleteMutationOptions.mutation.onError({ response: { status: 400 } });
    });
    expect(toastError).toHaveBeenCalledWith("Não podes apagar a tua própria conta.");
  });

  it("sucesso fecha o modal", () => {
    mockUsers([TENANT]);
    renderAdmin();

    openDeleteModal("Barbearia Central");
    fireEvent.change(screen.getByLabelText("Escreve o email do tenant para confirmar"), {
      target: { value: "central@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apagar definitivamente" }));

    act(() => {
      deleteMutationOptions.mutation.onSuccess();
    });

    expect(toastSuccess).toHaveBeenCalledWith("Tenant eliminado definitivamente");
    expect(screen.queryByText('Eliminar "Barbearia Central" definitivamente?')).not.toBeInTheDocument();
  });

  it("a linha do próprio admin autenticado não permite abrir o modal de eliminar", () => {
    mockUsers([ADMIN_SELF, OTHER_TENANT]);
    renderAdmin();

    const selfRow = screen.getByText("Conta do admin").closest("tr")!;
    const selfDeleteBtn = within(selfRow).getByRole("button", { name: "Eliminar" });
    expect(selfDeleteBtn).toBeDisabled();

    fireEvent.click(selfDeleteBtn);
    expect(screen.queryByText('Eliminar "Conta do admin" definitivamente?')).not.toBeInTheDocument();

    // A linha de outro tenant continua eliminável normalmente.
    const otherRow = screen.getByText("Ginásio Norte").closest("tr")!;
    fireEvent.click(within(otherRow).getByRole("button", { name: "Eliminar" }));
    expect(screen.getByText('Eliminar "Ginásio Norte" definitivamente?')).toBeInTheDocument();
  });
});

describe("Admin — domínio do site do tenant", () => {
  it("mostra o domínio na coluna Site e '—' quando não há", () => {
    mockUsers([{ ...TENANT, websiteDomain: "www.barbearia.pt" }, OTHER_TENANT]);
    renderAdmin();

    expect(screen.getByText("Site")).toBeInTheDocument();
    expect(screen.getByText("www.barbearia.pt")).toBeInTheDocument();
  });

  it("abre o modal pré-preenchido e grava o domínio do tenant da linha", () => {
    mockUsers([{ ...TENANT, websiteDomain: "www.barbearia.pt" }]);
    renderAdmin();

    const row = screen.getByText("Barbearia Central").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Domínio do site" }));

    const input = screen.getByPlaceholderText("www.exemplo.pt") as HTMLInputElement;
    expect(input.value).toBe("www.barbearia.pt");

    fireEvent.change(input, { target: { value: "novo.exemplo.pt" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(domainMutate).toHaveBeenCalledWith({ userId: "u1", data: { domain: "novo.exemplo.pt" } });

    act(() => {
      domainMutationOptions.mutation.onSuccess();
    });
    expect(toastSuccess).toHaveBeenCalledWith("Domínio guardado");
  });

  it("409 e 400 mostram a mensagem certa", () => {
    mockUsers([TENANT]);
    renderAdmin();

    act(() => {
      domainMutationOptions.mutation.onError({ response: { status: 409 } });
    });
    expect(toastError).toHaveBeenCalledWith("Esse domínio já pertence a outro cliente.");

    act(() => {
      domainMutationOptions.mutation.onError({ response: { status: 400 } });
    });
    expect(toastError).toHaveBeenCalledWith("Domínio inválido.");
  });
});
