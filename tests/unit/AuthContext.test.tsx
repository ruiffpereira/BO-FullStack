import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// B12 — este ficheiro testa o `AuthContext` A SÉRIO (não mockado, ao
// contrário de tests/unit/App.test.tsx): os três estados do arranque
// (autenticado / 401 duro / "ainda sem veredito") vivem inteiramente dentro
// de `doRefresh`. Mockamos só a fronteira de rede que o bootstrap encadeia —
// `axiosInstance` partilhado (POST /users/refresh) e os dois hooks gerados
// (GET /csrf-token, GET /userpermissions) — para controlar os três desfechos
// sem servidor. `usePostUsersLogin` fica por mockar de propósito: nenhum
// destes testes chama `login()`.
const axiosPostMock = vi.fn();
vi.mock("@kubb/plugin-client/clients/axios", () => ({
  axiosInstance: {
    defaults: {} as Record<string, unknown>,
    post: (...args: unknown[]) => axiosPostMock(...args),
    interceptors: {
      request: { use: vi.fn(() => 1), eject: vi.fn() },
      response: { use: vi.fn(() => 2), eject: vi.fn() },
    },
  },
  default: vi.fn(),
}));

const getCsrfTokenMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetCsrfToken", () => ({
  getCsrfToken: (...args: unknown[]) => getCsrfTokenMock(...args),
}));

const getUserpermissionsMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetUserpermissions", () => ({
  getUserpermissions: (...args: unknown[]) => getUserpermissionsMock(...args),
}));

import { AuthProvider, useAuth } from "../../src/context/AuthContext";

// Sonda mínima: expõe os três booleanos do arranque como texto, para os
// poder ler via `screen` sem depender de `renderHook` (o AuthProvider precisa
// de um <Router> por causa do `useNavigate()` interno).
function Probe() {
  const { initializing, reconnecting, isAuthenticated } = useAuth();
  return (
    <div>
      <span data-testid="initializing">{String(initializing)}</span>
      <span data-testid="reconnecting">{String(reconnecting)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
    </div>
  );
}

function renderAuth() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function state() {
  return {
    initializing: screen.getByTestId("initializing").textContent,
    reconnecting: screen.getByTestId("reconnecting").textContent,
    authenticated: screen.getByTestId("authenticated").textContent,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCsrfTokenMock.mockResolvedValue({ csrfToken: "csrf-token-abc" });
  getUserpermissionsMock.mockResolvedValue([]);
});

describe("AuthContext — B12, os três estados do arranque (doRefresh)", () => {
  it("sessão válida: autentica de imediato e NUNCA passa por 'reconnecting'", async () => {
    axiosPostMock.mockResolvedValue({ status: 200, data: { accessToken: "access.token.value" } });

    renderAuth();

    await waitFor(() => expect(state().initializing).toBe("false"));
    expect(state()).toEqual({ initializing: "false", reconnecting: "false", authenticated: "true" });
  });

  it("401 duro: resolve como 'sem sessão' de imediato — veredito definitivo, sem 'reconnecting'", async () => {
    // `refreshSession` aceita 401 como resposta válida (validateStatus) — não
    // é uma exceção, é o ramo "refresh token morto".
    axiosPostMock.mockResolvedValue({ status: 401, data: {} });

    renderAuth();

    await waitFor(() => expect(state().initializing).toBe("false"));
    expect(state()).toEqual({ initializing: "false", reconnecting: "false", authenticated: "false" });
  });

  it("erro transitório: NÃO mostra 'sem sessão' — mostra 'reconnecting' e recupera sozinho quando a rede volta", async () => {
    // 1ª tentativa (arranque) falha por soluço de rede; a 2ª (o retry que o
    // próprio doRefresh agenda) já tem a rede de volta.
    axiosPostMock
      .mockRejectedValueOnce(new Error("network hiccup"))
      .mockResolvedValueOnce({ status: 200, data: { accessToken: "access.token.value" } });

    renderAuth();

    // O 1º doRefresh já resolveu (initializing=false), mas SEM veredito: é
    // exactamente aqui que o bug do B12 mostrava <Login/> — isAuthenticated
    // continua false, mas reconnecting tem de ser true (não Login).
    await waitFor(() => expect(state().initializing).toBe("false"));
    expect(state()).toEqual({ initializing: "false", reconnecting: "true", authenticated: "false" });

    // O retry agendado (RECONNECT_RETRY_MS) resolve sozinho, sem qualquer
    // ação do utilizador — autentica e limpa o 'reconnecting'.
    await waitFor(() => expect(state().authenticated).toBe("true"), { timeout: 6_000 });
    expect(state().reconnecting).toBe("false");
  }, 10_000);

  it("erro transitório persistente: desiste ao fim do orçamento e mostra Login — não fica preso para sempre", async () => {
    axiosPostMock.mockRejectedValue(new Error("still down"));

    renderAuth();

    await waitFor(() => expect(state().initializing).toBe("false"));
    expect(state().reconnecting).toBe("true");
    expect(state().authenticated).toBe("false");

    // MAX_RECONNECT_ATTEMPTS=3: a 1ª falha já aconteceu (acima); a 2ª e a 3ª
    // chegam pelos retries agendados a RECONNECT_RETRY_MS. Ao fim delas,
    // desiste — reconnecting cai a false SEM nunca ter autenticado.
    await waitFor(() => expect(state().reconnecting).toBe("false"), { timeout: 8_000 });
    expect(state().authenticated).toBe("false");
  }, 12_000);

  it("401 duro depois de já ter passado por 'reconnecting' também assenta o veredito (mostra Login)", async () => {
    // 1ª tentativa: soluço de rede → reconnecting=true. 2ª tentativa (retry):
    // 401 duro → sessão confirmada morta, mesmo sem ter esgotado o orçamento
    // de reconexão.
    axiosPostMock
      .mockRejectedValueOnce(new Error("network hiccup"))
      .mockResolvedValueOnce({ status: 401, data: {} });

    renderAuth();

    await waitFor(() => expect(state().reconnecting).toBe("true"));

    await waitFor(() => expect(state().reconnecting).toBe("false"), { timeout: 6_000 });
    expect(state().authenticated).toBe("false");
  }, 10_000);
});
