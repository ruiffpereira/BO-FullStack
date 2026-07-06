import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// useThemeSync (T3.4, .design/shell-nav-perfil/) é conduzido por
// GET/PUT /users/me (hooks gerados pelo Kubb) + useAuth (isAuthenticated).
// Mockamos os dois lados da API para controlar o "servidor" sem rede real,
// mesmo padrão de tests/unit/Perfil.test.tsx. useQueryClient (invalidação)
// usa-se a sério, por isso envolvemos num QueryClientProvider real.

const useGetUsersMeMock = vi.fn();
const putUsersMeMutate = vi.fn();
const authMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetUsersMe", () => ({
  useGetUsersMe: () => useGetUsersMeMock(),
  getUsersMeQueryKey: () => [{ url: "/users/me" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePutUsersMe", () => ({
  usePutUsersMe: () => ({ mutate: putUsersMeMutate, isPending: false }),
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) },
}));

import { useThemeSync } from "../../src/hooks/useThemeSync";

function mockMatchMedia(prefersDark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: prefersDark,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderThemeSync() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useThemeSync(), {
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useGetUsersMeMock.mockReturnValue({ data: undefined });
  authMock.mockReturnValue({ isAuthenticated: false });
});

describe("useThemeSync — precedência servidor > localStorage > sistema", () => {
  it("servidor 'light' ganha ao localStorage E ao sistema, ambos 'dark', e corrige o localStorage", () => {
    localStorage.setItem("bo.theme", "dark");
    mockMatchMedia(true); // sistema prefere dark
    authMock.mockReturnValue({ isAuthenticated: true });
    useGetUsersMeMock.mockReturnValue({ data: { uiTheme: "light" } });

    const { result } = renderThemeSync();

    expect(result.current.theme).toBe("light");
    // Auto-corrige o localStorage para o PRÓXIMO reload (anti-flash) já
    // bater com o servidor, fechando o ciclo do bug original.
    expect(localStorage.getItem("bo.theme")).toBe("light");
  });

  it("servidor 'system' segue o sistema atual E limpa o override local (nunca grava a string 'system')", () => {
    localStorage.setItem("bo.theme", "dark");
    mockMatchMedia(false); // sistema prefere light
    authMock.mockReturnValue({ isAuthenticated: true });
    useGetUsersMeMock.mockReturnValue({ data: { uiTheme: "system" } });

    const { result } = renderThemeSync();

    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem("bo.theme")).toBeNull();
  });

  it("sem sessão (não autenticado) fica com o palpite local — GET não é chamado a sério (query desativada)", () => {
    localStorage.setItem("bo.theme", "light");
    authMock.mockReturnValue({ isAuthenticated: false });
    useGetUsersMeMock.mockReturnValue({ data: undefined });

    const { result } = renderThemeSync();

    expect(result.current.theme).toBe("light");
  });
});

describe("useThemeSync — toggleTheme", () => {
  it("autenticado: aplica de imediato + grava no servidor (PUT /users/me)", () => {
    localStorage.setItem("bo.theme", "dark");
    authMock.mockReturnValue({ isAuthenticated: true });
    useGetUsersMeMock.mockReturnValue({ data: undefined });

    const { result } = renderThemeSync();
    expect(result.current.theme).toBe("dark");

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem("bo.theme")).toBe("light");
    expect(putUsersMeMutate).toHaveBeenCalledTimes(1);
    const [vars] = putUsersMeMutate.mock.calls[0];
    expect(vars).toEqual({ data: { uiTheme: "light" } });
  });

  it("reversão otimista: PUT falha → volta ao tema anterior + localStorage + toast", () => {
    localStorage.setItem("bo.theme", "dark");
    authMock.mockReturnValue({ isAuthenticated: true });
    useGetUsersMeMock.mockReturnValue({ data: undefined });
    putUsersMeMutate.mockImplementation((_vars, opts) => {
      opts.onError({ response: { status: 500 } });
    });

    const { result } = renderThemeSync();
    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem("bo.theme")).toBe("dark");
    expect(toastError).toHaveBeenCalled();
  });

  it("sem sessão: só aplica localmente, sem PUT", () => {
    localStorage.setItem("bo.theme", "dark");
    authMock.mockReturnValue({ isAuthenticated: false });
    useGetUsersMeMock.mockReturnValue({ data: undefined });

    const { result } = renderThemeSync();
    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem("bo.theme")).toBe("light");
    expect(putUsersMeMutate).not.toHaveBeenCalled();
  });
});
