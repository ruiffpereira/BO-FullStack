import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// A página /perfil (T3.3) é conduzida por GET/PUT /users/me + PUT
// /users/me/password (hooks gerados pelo Kubb) + useSettingsLanguages (língua
// padrão) + useGetBillingSubscription (write-guard do "Guardar" da Conta,
// mesmo padrão do writeGuard.test.tsx). Mockamos todos para testar a UI sem
// servidor nem React Query real — exceto o próprio QueryClient (as
// invalidações usam useQueryClient(), por isso envolvemos num
// QueryClientProvider real, mesmo padrão do AdminBilling.test.tsx.

const useGetUsersMeMock = vi.fn();
const putUsersMeMutate = vi.fn();
const putUsersMePasswordMutate = vi.fn();
const useLangMock = vi.fn();
const putLangsMutate = vi.fn();
const authMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetUsersMe", () => ({
  useGetUsersMe: () => useGetUsersMeMock(),
  getUsersMeQueryKey: () => [{ url: "/users/me" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePutUsersMe", () => ({
  usePutUsersMe: () => ({ mutate: putUsersMeMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutUsersMePassword", () => ({
  usePutUsersMePassword: () => ({ mutate: putUsersMePasswordMutate, isPending: false }),
}));

const { uploadImage } = vi.hoisted(() => ({ uploadImage: vi.fn() }));
vi.mock("../../src/gen/backoffice/hooks/useUploadImage.js", () => ({ uploadImage }));

vi.mock("../../src/hooks/useSettingsLanguages", () => ({
  useGetSettingsLanguages: () => useLangMock(),
  usePutSettingsLanguages: () => ({ mutate: putLangsMutate, isPending: false }),
}));

// Write-guard da Conta (GuardButton → useWriteGuard → useBillingReadOnly →
// useGetBillingSubscription) — mesma técnica do writeGuard.test.tsx: mockamos
// a query da subscrição diretamente para controlar readOnly sem servidor.
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { Perfil } from "../../src/pages/Perfil";

const USER_ME_FIXTURE = {
  name: "Barbearia Central",
  email: "dono@example.com",
  phone: "912345678",
  logoUrl: null,
  uiTheme: "system" as const,
  defaultLanguage: "pt",
};

const LANG_FIXTURE = {
  available: [
    { code: "pt", name: "Português", flag: "🇵🇹" },
    { code: "en", name: "Inglês", flag: "🇬🇧" },
  ],
  selected: ["pt", "en"],
  default: "pt",
};

function mockUserMe(data: typeof USER_ME_FIXTURE | undefined, isLoading = false, isError = false) {
  useGetUsersMeMock.mockReturnValue({ data, isLoading, isError });
}
function mockLangs(data: typeof LANG_FIXTURE | undefined) {
  useLangMock.mockReturnValue({ data });
}

function renderPerfil() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Perfil />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUserMe(USER_ME_FIXTURE);
  mockLangs(LANG_FIXTURE);
  authMock.mockReturnValue({
    username: "Barbearia Central",
    updateIdentity: vi.fn(),
    setAccessToken: vi.fn(),
  });
});

describe("Perfil — render dos 4 cartões", () => {
  it("mostra Conta, Password, Preferências e Logótipo", () => {
    renderPerfil();
    expect(screen.getByText("Conta")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
    expect(screen.getByText("Preferências")).toBeInTheDocument();
    expect(screen.getByText("Logótipo")).toBeInTheDocument();
    // Campos da Conta pré-preenchidos com o GET /users/me
    expect(screen.getByLabelText("Nome do negócio")).toHaveValue("Barbearia Central");
    expect(screen.getByLabelText("Email")).toHaveValue("dono@example.com");
    expect(screen.getByLabelText("Telefone")).toHaveValue("912345678");
  });

  it("mostra um skeleton enquanto carrega, sem os cartões", () => {
    mockUserMe(undefined, true);
    renderPerfil();
    expect(screen.queryByText("Conta")).not.toBeInTheDocument();
  });
});

describe("Perfil — Conta", () => {
  it("Guardar chama usePutUsersMe com os dados atuais (sem currentPassword quando o email não muda)", () => {
    renderPerfil();

    fireEvent.change(screen.getByLabelText("Nome do negócio"), {
      target: { value: "Barbearia Nova" },
    });

    const saveBtn = screen.getByRole("button", { name: "Guardar" });
    expect(saveBtn).toBeEnabled();
    fireEvent.click(saveBtn);

    expect(putUsersMeMutate).toHaveBeenCalledTimes(1);
    const [vars] = putUsersMeMutate.mock.calls[0];
    expect(vars).toEqual({
      data: {
        name: "Barbearia Nova",
        phone: "912345678",
        email: "dono@example.com",
      },
    });
  });

  it("Guardar fica desativado sem alterações (não fica \"dirty\")", () => {
    renderPerfil();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("mudar o email revela o campo de password atual (e não aparece antes)", () => {
    renderPerfil();
    expect(
      screen.queryByLabelText("Password atual (para mudar o email)"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "novo@example.com" },
    });

    expect(screen.getByLabelText("Password atual (para mudar o email)")).toBeInTheDocument();
  });

  it("bloqueia o Guardar (com toast) se o email mudou e falta a password atual", () => {
    renderPerfil();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "novo@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(putUsersMeMutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Introduz a password atual para mudar o email.",
    );
  });

  it("409 (email já em uso) mostra um toast claro", () => {
    putUsersMeMutate.mockImplementation((_vars, opts) => {
      opts.onError({ response: { status: 409, data: { error: "Email já em uso" } } });
    });
    renderPerfil();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "novo@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password atual (para mudar o email)"), {
      target: { value: "senhaAtual123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(putUsersMeMutate).toHaveBeenCalledTimes(1);
    const [vars] = putUsersMeMutate.mock.calls[0];
    expect(vars.data.currentPassword).toBe("senhaAtual123");
    expect(toastError).toHaveBeenCalledWith("Email já em uso");
  });

  it("ao guardar com sucesso sincroniza o AuthContext (updateIdentity) com o novo nome/email", () => {
    const updateIdentity = vi.fn();
    authMock.mockReturnValue({ username: "Barbearia Central", updateIdentity, setAccessToken: vi.fn() });
    putUsersMeMutate.mockImplementation((_vars, opts) => {
      opts.onSuccess({
        name: "Barbearia Nova",
        email: "dono@example.com",
        phone: "912345678",
        logoUrl: null,
        uiTheme: "system",
        defaultLanguage: "pt",
      });
    });
    renderPerfil();

    fireEvent.change(screen.getByLabelText("Nome do negócio"), {
      target: { value: "Barbearia Nova" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateIdentity).toHaveBeenCalledWith({ username: "Barbearia Nova", email: "dono@example.com" });
    expect(toastSuccess).toHaveBeenCalledWith("Dados da conta guardados.");
  });
});

describe("Perfil — Password", () => {
  it("mudar password chama usePutUsersMePassword, adota o accessToken novo e mostra o aviso", () => {
    const setAccessToken = vi.fn();
    authMock.mockReturnValue({ username: "Barbearia Central", updateIdentity: vi.fn(), setAccessToken });
    putUsersMePasswordMutate.mockImplementation((_vars, opts) => {
      opts.onSuccess({ accessToken: "NOVO_ACCESS_TOKEN" });
    });
    renderPerfil();

    fireEvent.change(screen.getByLabelText("Password atual"), {
      target: { value: "passwordAntiga1" },
    });
    fireEvent.change(screen.getByLabelText(/^Nova password/), {
      target: { value: "passwordNova123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova password"), {
      target: { value: "passwordNova123" },
    });

    const btn = screen.getByRole("button", { name: "Mudar password" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);

    expect(putUsersMePasswordMutate).toHaveBeenCalledTimes(1);
    const [vars] = putUsersMePasswordMutate.mock.calls[0];
    expect(vars).toEqual({
      data: { currentPassword: "passwordAntiga1", newPassword: "passwordNova123" },
    });

    // CRÍTICO: adota o accessToken novo (senão o próximo pedido usava o
    // antigo, já inválido pelo bump de tokenVersion, e levava 401).
    expect(setAccessToken).toHaveBeenCalledWith("NOVO_ACCESS_TOKEN");
    expect(toastSuccess).toHaveBeenCalledWith(
      "Password alterada. Sessão dos outros dispositivos foi terminada.",
    );
  });

  it("fica desativado até a nova password ter 8+ caracteres e coincidir com a confirmação", () => {
    renderPerfil();
    const btn = screen.getByRole("button", { name: "Mudar password" });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Password atual"), { target: { value: "atual123" } });
    fireEvent.change(screen.getByLabelText(/^Nova password/), { target: { value: "curta" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova password"), { target: { value: "curta" } });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^Nova password/), { target: { value: "novapassword1" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova password"), { target: { value: "diferente" } });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Confirmar nova password"), { target: { value: "novapassword1" } });
    expect(btn).toBeEnabled();
  });

  it("password atual incorreta (401) mostra um toast claro", () => {
    putUsersMePasswordMutate.mockImplementation((_vars, opts) => {
      opts.onError({ response: { status: 401, data: { error: "Password atual incorreta" } } });
    });
    renderPerfil();

    fireEvent.change(screen.getByLabelText("Password atual"), { target: { value: "errada123" } });
    fireEvent.change(screen.getByLabelText(/^Nova password/), { target: { value: "novapassword1" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova password"), { target: { value: "novapassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Mudar password" }));

    expect(toastError).toHaveBeenCalledWith("Password atual incorreta");
  });
});

describe("Perfil — Preferências", () => {
  it("mostra as 3 opções de tema e a língua padrão com bandeiras", () => {
    renderPerfil();
    expect(screen.getByRole("tab", { name: "Claro" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Escuro" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sistema" })).toBeInTheDocument();
    expect(screen.getByText("Português")).toBeInTheDocument();
    expect(screen.getByText("Inglês")).toBeInTheDocument();
  });

  it("mudar o tema persiste de imediato via usePutUsersMe", () => {
    renderPerfil();
    fireEvent.click(screen.getByRole("tab", { name: "Escuro" }));
    expect(putUsersMeMutate).toHaveBeenCalledWith(
      { data: { uiTheme: "dark" } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("mudar a língua padrão chama usePutSettingsLanguages preservando as línguas ativas", () => {
    renderPerfil();
    fireEvent.click(screen.getByText("Inglês"));
    expect(putLangsMutate).toHaveBeenCalledWith(
      { languages: ["pt", "en"], default: "en" },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });
});

describe("Perfil — Logótipo", () => {
  it("guarda o logótipo colado por URL via usePutUsersMe", () => {
    renderPerfil();
    fireEvent.click(screen.getByText("ou cola um URL"));
    fireEvent.change(screen.getByPlaceholderText("https://…/logo.png"), {
      target: { value: "https://exemplo.pt/logo.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar logótipo" }));

    expect(putUsersMeMutate).toHaveBeenCalledWith(
      { data: { logoUrl: "https://exemplo.pt/logo.png" } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });
});
