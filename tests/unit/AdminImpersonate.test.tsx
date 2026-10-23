import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Admin → Utilizadores → "Entrar como" (sessão de suporte). Mesma técnica do
// Admin.test.tsx: hooks gerados mockados, QueryClientProvider real.

const useGetUsersMock = vi.fn();
const authMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetUsers.js", () => ({
  useGetUsers: () => useGetUsersMock(),
  getUsersQueryKey: () => [{ url: "/users" }],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetPermissions.js", () => ({
  useGetPermissions: () => ({ data: [] }),
  getPermissionsQueryKey: () => [{ url: "/permissions" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePostUsersRegister.js", () => ({
  usePostUsersRegister: (opts: any) => {
    registerOptions = opts;
    return { mutate: vi.fn(), isPending: false };
  },
}));
vi.mock("../../src/gen/backoffice/hooks/usePutUsers.js", () => ({
  usePutUsers: () => ({ mutate: vi.fn(), isPending: false }),
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
vi.mock("../../src/components/GuardButton", () => ({
  // Sem props de estilo/estado no DOM (isLoading, leaf, variant…): o write-guard não é o assunto destes testes.
  GuardButton: ({ children, isLoading: _l, leaf: _f, variant: _v, size: _s, icon: _i, wrapperClassName: _w, ...rest }: any) => <button {...rest}>{children}</button>,
  GuardIconButton: ({ icon: _i, label, leaf: _f, ...rest }: any) => <button aria-label={label} {...rest} />,
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));

let registerOptions: any = null;

import { Admin } from "../../src/pages/Admin";

const FUTURE = new Date(Date.now() + 3 * 864e5).toISOString();
const PAST = new Date(Date.now() - 864e5).toISOString();

const ALLOWED = { userId: "u1", name: "Barbearia Central", email: "central@example.com", permissions: [], canImpersonate: true, supportAccessUntil: FUTURE };
const DENIED = { userId: "u2", name: "Ginásio Norte", email: "norte@example.com", permissions: [], canImpersonate: false, supportAccessUntil: PAST };
const ADMIN_OTHER = { userId: "u3", name: "Outro Admin", email: "admin2@example.com", permissions: [{ permissionId: "p1", name: "Admin" }], isPlatformAdmin: true, canImpersonate: false };
const ADMIN_SELF = { userId: "admin-1", name: "Conta do admin", email: "admin@example.com", permissions: [{ permissionId: "p1", name: "Admin" }], isPlatformAdmin: true, canImpersonate: false };

function renderAdmin(users: unknown[]) {
  useGetUsersMock.mockReturnValue({ data: users, isLoading: false });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Admin view="utilizadores" />
    </QueryClientProvider>,
  );
}

const row = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReturnValue({ authHeader: () => ({}), userId: "admin-1" });
});

describe("Admin — 'Entrar como' (sessão de suporte)", () => {
  it("activo quando canImpersonate: abre /suporte/entrar/<userId> num separador novo (noopener)", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderAdmin([ALLOWED]);

    const btn = within(row("Barbearia Central")).getByRole("button", { name: "Entrar como Barbearia Central" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);

    expect(open).toHaveBeenCalledWith("/suporte/entrar/u1", "_blank", "noopener");
    open.mockRestore();
  });

  it("desactivado sem consentimento, com o motivo visível (title + aria-label)", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderAdmin([DENIED]);

    const r = row("Ginásio Norte");
    const btn = within(r).getByRole("button", { name: /Entrar como Ginásio Norte \(indisponível\)/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleName(/O cliente não autorizou o acesso — pede-lhe para o dar no Perfil/);
    expect(r.querySelector('[title*="O cliente não autorizou o acesso"]')).not.toBeNull();
    fireEvent.click(btn);
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("para outro utilizador admin o motivo é 'Conta de admin'", () => {
    renderAdmin([ADMIN_OTHER]);
    const btn = within(row("Outro Admin")).getByRole("button", { name: /Entrar como Outro Admin \(indisponível\)/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleName(/Conta de admin/);
  });

  it("na própria linha do admin não aparece", () => {
    renderAdmin([ADMIN_SELF, ALLOWED]);
    expect(within(row("Conta do admin")).queryByRole("button", { name: /Entrar como/ })).not.toBeInTheDocument();
    expect(within(row("Barbearia Central")).getByRole("button", { name: /Entrar como/ })).toBeInTheDocument();
  });

  it("mostra 'Acesso de suporte até DD/MM/AAAA' só quando a data está no futuro", () => {
    renderAdmin([ALLOWED, DENIED]);
    const d = new Date(FUTURE);
    const dd = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    expect(row("Barbearia Central")).toHaveTextContent(`Acesso de suporte até ${dd}`);
    expect(row("Ginásio Norte")).not.toHaveTextContent("Acesso de suporte até");
  });

  it("criar utilizador: a mensagem diz que foi enviado um email para definir a password", () => {
    renderAdmin([ALLOWED]);
    registerOptions.mutation.onSuccess();
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("email ao cliente para ele definir a password"));
  });
});
