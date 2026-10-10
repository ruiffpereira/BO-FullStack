import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Sessão de suporte no AuthContext (testado A SÉRIO, como AuthContext.test) ──
//
// As quatro invariantes (ver o bloco "Sessão de suporte" em AuthContext.tsx):
//   1. em modo suporte nunca há `/users/refresh` (timer, doRefresh, interceptor
//      de 401) — um 401 termina a sessão e NÃO repete o pedido;
//   2. `logout()` nunca chama `/users/logout` nem `/push/unsubscribe`;
//   3. nada se escreve no localStorage (identidade);
//   4. o estado vive no sessionStorage (`backoffice.supportSession`).
// Mockamos só a fronteira de rede (axiosInstance partilhado + 2 hooks gerados).

const axiosPostMock = vi.fn();
const axiosCallMock = vi.fn();
const responseInterceptorRef: { current: ((err: any) => Promise<any>) | null } = { current: null };

vi.mock("@kubb/plugin-client/clients/axios", () => {
  const axiosInstanceMock: any = (...args: unknown[]) => axiosCallMock(...args);
  axiosInstanceMock.defaults = {} as Record<string, unknown>;
  axiosInstanceMock.post = (...args: unknown[]) => axiosPostMock(...args);
  axiosInstanceMock.interceptors = {
    request: { use: vi.fn(() => 1), eject: vi.fn() },
    response: {
      use: vi.fn((_ok: unknown, onRejected: (err: any) => Promise<any>) => {
        responseInterceptorRef.current = onRejected;
        return 2;
      }),
      eject: vi.fn(),
    },
  };
  return { axiosInstance: axiosInstanceMock, default: vi.fn() };
});

const getCsrfTokenMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetCsrfToken", () => ({
  getCsrfToken: (...args: unknown[]) => getCsrfTokenMock(...args),
}));
const getUserpermissionsMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetUserpermissions", () => ({
  getUserpermissions: (...args: unknown[]) => getUserpermissionsMock(...args),
}));

import { AuthProvider, useAuth } from "../../src/context/AuthContext";
import { SupportEnded } from "../../src/pages/SupportEnded";

const IDENTITY_KEY = "backoffice.auth.identity";
const SUPPORT_KEY = "backoffice.supportSession";

function supportResponse(expiresInMs = 60 * 60 * 1000) {
  return {
    accessToken: "support.token.value",
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    tenant: { userId: "tenant-1", name: "Barbearia Central", email: "dono@example.com" },
  };
}

function Probe() {
  const a = useAuth();
  return (
    <div>
      <span data-testid="initializing">{String(a.initializing)}</span>
      <span data-testid="authenticated">{String(a.isAuthenticated)}</span>
      <span data-testid="tenant">{a.supportSession?.tenantName ?? "none"}</span>
      <span data-testid="ended">{a.supportEnded ?? "none"}</span>
      <span data-testid="username">{a.username ?? "none"}</span>
      <button onClick={() => void a.startImpersonation(supportResponse())}>start</button>
      <button onClick={() => void a.logout()}>logout</button>
      <button onClick={() => a.updateIdentity({ username: "Outro Nome" })}>identity</button>
      <button onClick={() => a.endImpersonation("exit")}>end</button>
    </div>
  );
}

function renderAuth(extra?: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Probe />
        {extra}
      </AuthProvider>
    </MemoryRouter>,
  );
}

const txt = (id: string) => screen.getByTestId(id).textContent;
const refreshCalls = () => axiosPostMock.mock.calls.filter((c) => c[0] === "/users/refresh");

/** Autentica como ADMIN (bootstrap pelo cookie) e entra em sessão de suporte. */
async function bootstrapAdminThenSupport() {
  axiosPostMock.mockResolvedValue({ status: 200, data: { accessToken: "admin.token.value" } });
  renderAuth();
  await waitFor(() => expect(txt("authenticated")).toBe("true"));
  axiosPostMock.mockClear();
  getCsrfTokenMock.mockClear();
  // A identidade do ADMIN (escrita legitimamente pelo arranque normal) tem de
  // ficar exactamente como está durante toda a sessão de suporte.
  const adminIdentity = localStorage.getItem(IDENTITY_KEY);
  fireEvent.click(screen.getByText("start"));
  await waitFor(() => expect(txt("tenant")).toBe("Barbearia Central"));
  return adminIdentity;
}

function mockPushSubscription() {
  const sub = { endpoint: "https://push.example/abc", unsubscribe: vi.fn(() => Promise.resolve(true)) };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(sub) } }) },
  });
  return sub;
}

beforeEach(() => {
  vi.clearAllMocks();
  responseInterceptorRef.current = null;
  localStorage.clear();
  sessionStorage.clear();
  getCsrfTokenMock.mockResolvedValue({ csrfToken: "csrf-token-abc" });
  getUserpermissionsMock.mockResolvedValue([]);
  axiosPostMock.mockResolvedValue({ status: 200, data: {} });
});

afterEach(() => {
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: undefined });
  vi.useRealTimers();
});

describe("AuthContext — sessão de suporte", () => {
  it("startImpersonation: age como o tenant, guarda no sessionStorage e não toca no localStorage", async () => {
    const adminIdentity = await bootstrapAdminThenSupport();

    expect(txt("authenticated")).toBe("true");
    expect(txt("username")).toBe("Barbearia Central");
    const stored = JSON.parse(sessionStorage.getItem(SUPPORT_KEY)!);
    expect(stored.accessToken).toBe("support.token.value");
    expect(stored.tenant.userId).toBe("tenant-1");
    // Invariante 3: nem identidade nem nada no localStorage.
    expect(localStorage.getItem(IDENTITY_KEY)).toBe(adminIdentity);
    expect(localStorage.length).toBe(1);
  });

  it("invariante 3: updateIdentity em modo suporte não escreve no localStorage", async () => {
    const adminIdentity = await bootstrapAdminThenSupport();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    fireEvent.click(screen.getByText("identity"));

    await waitFor(() => expect(txt("username")).toBe("Outro Nome"));
    expect(localStorage.getItem(IDENTITY_KEY)).toBe(adminIdentity);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("invariante 1: um 401 NÃO chama /users/refresh, NÃO repete o pedido e termina a sessão", async () => {
    await bootstrapAdminThenSupport();
    axiosCallMock.mockClear();

    const err: any = {
      config: { url: "/customers", headers: {} },
      response: { status: 401, data: { code: "SUPPORT_SESSION_ENDED" } },
    };
    await expect(responseInterceptorRef.current!(err)).rejects.toBe(err);

    expect(refreshCalls()).toHaveLength(0);
    expect(getCsrfTokenMock).not.toHaveBeenCalled();
    expect(axiosCallMock).not.toHaveBeenCalled(); // nunca repetido
    await waitFor(() => expect(txt("ended")).toBe("ended"));
    expect(txt("authenticated")).toBe("false");
    expect(sessionStorage.getItem(SUPPORT_KEY)).toBeNull();
  });

  it("invariante 1: nem o timer agenda refresh em modo suporte", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosPostMock.mockResolvedValue({ status: 200, data: { accessToken: "admin.token.value" } });
    renderAuth();
    await waitFor(() => expect(txt("authenticated")).toBe("true"));
    axiosPostMock.mockClear();
    fireEvent.click(screen.getByText("start"));
    await waitFor(() => expect(txt("tenant")).toBe("Barbearia Central"));

    // 30 min: muito para lá de qualquer cadência de refresh (10 min), mas antes dos 60 min do token.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    });

    expect(refreshCalls()).toHaveLength(0);
    expect(txt("tenant")).toBe("Barbearia Central");
  });

  it("o timer do expiresAt termina a sessão com 'expired'", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosPostMock.mockResolvedValue({ status: 200, data: { accessToken: "admin.token.value" } });
    renderAuth();
    await waitFor(() => expect(txt("authenticated")).toBe("true"));
    fireEvent.click(screen.getByText("start"));
    await waitFor(() => expect(txt("tenant")).toBe("Barbearia Central"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
    });

    expect(txt("ended")).toBe("expired");
    expect(txt("authenticated")).toBe("false");
  });

  it("invariante 2: logout() em modo suporte NÃO chama /users/logout nem /push/unsubscribe", async () => {
    const sub = mockPushSubscription();
    await bootstrapAdminThenSupport();

    fireEvent.click(screen.getByText("logout"));

    await waitFor(() => expect(txt("ended")).toBe("exit"));
    expect(axiosPostMock).not.toHaveBeenCalled(); // nem /users/logout nem /push/unsubscribe
    expect(getCsrfTokenMock).not.toHaveBeenCalled();
    expect(sub.unsubscribe).not.toHaveBeenCalled(); // a subscrição push do admin fica intacta
    expect(sessionStorage.getItem(SUPPORT_KEY)).toBeNull();
  });

  it("controlo: o logout NORMAL continua a chamar /push/unsubscribe e /users/logout", async () => {
    const sub = mockPushSubscription();
    axiosPostMock.mockResolvedValue({ status: 200, data: { accessToken: "admin.token.value" } });
    renderAuth();
    await waitFor(() => expect(txt("authenticated")).toBe("true"));
    axiosPostMock.mockClear();

    fireEvent.click(screen.getByText("logout"));

    await waitFor(() => expect(txt("authenticated")).toBe("false"));
    const urls = axiosPostMock.mock.calls.map((c) => c[0]);
    expect(urls).toContain("/push/unsubscribe");
    expect(urls).toContain("/users/logout");
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it("arranque com sessão de suporte válida no sessionStorage: retoma SEM chamar /users/refresh", async () => {
    sessionStorage.setItem(SUPPORT_KEY, JSON.stringify(supportResponse()));

    renderAuth();

    await waitFor(() => expect(txt("tenant")).toBe("Barbearia Central"));
    expect(txt("authenticated")).toBe("true");
    expect(txt("initializing")).toBe("false");
    expect(axiosPostMock).not.toHaveBeenCalled();
    expect(getCsrfTokenMock).not.toHaveBeenCalled();
    // As permissões foram pedidas com o token de SUPORTE, nunca o do admin.
    expect(getUserpermissionsMock.mock.calls[0][0].headers.Authorization).toBe("Bearer support.token.value");
    expect(localStorage.length).toBe(0);
  });

  it("arranque com sessão válida mas 401 nas permissões: termina a sessão, sem refresh", async () => {
    sessionStorage.setItem(SUPPORT_KEY, JSON.stringify(supportResponse()));
    getUserpermissionsMock.mockImplementation(async () => {
      const err: any = { config: { url: "/userpermissions", headers: {} }, response: { status: 401, data: {} } };
      await responseInterceptorRef.current!(err).catch(() => {});
      throw err;
    });

    renderAuth();

    await waitFor(() => expect(txt("ended")).toBe("ended"));
    expect(axiosPostMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(SUPPORT_KEY)).toBeNull();
  });

  it("arranque com sessão expirada: mostra o ecrã de sessão terminada e remove-a, sem refresh", async () => {
    sessionStorage.setItem(SUPPORT_KEY, JSON.stringify(supportResponse(-1000)));

    renderAuth(<SupportEnded />);

    await waitFor(() => expect(screen.getByTestId("support-ended-screen")).toBeInTheDocument());
    expect(screen.getByText("A sessão de suporte terminou")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar separador" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para o meu backoffice" })).toBeInTheDocument();
    expect(txt("ended")).toBe("expired");
    expect(txt("authenticated")).toBe("false");
    expect(sessionStorage.getItem(SUPPORT_KEY)).toBeNull();
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it("'Ir para o meu backoffice' limpa o ecrã final e refaz o arranque normal pelo cookie", async () => {
    sessionStorage.setItem(SUPPORT_KEY, JSON.stringify(supportResponse(-1000)));
    renderAuth(<SupportEnded />);
    await waitFor(() => expect(screen.getByTestId("support-ended-screen")).toBeInTheDocument());
    expect(axiosPostMock).not.toHaveBeenCalled();

    axiosPostMock.mockResolvedValue({ status: 200, data: { accessToken: "admin.token.value" } });
    fireEvent.click(screen.getByRole("button", { name: "Ir para o meu backoffice" }));

    await waitFor(() => expect(txt("authenticated")).toBe("true"));
    expect(txt("ended")).toBe("none");
    expect(refreshCalls()).toHaveLength(1);
  });

  it("a sessão normal continua a renovar como antes (401 → refresh → repete o pedido)", async () => {
    axiosPostMock.mockResolvedValue({ status: 200, data: { accessToken: "initial.token.value" } });
    renderAuth();
    await waitFor(() => expect(txt("authenticated")).toBe("true"));
    axiosPostMock.mockClear();
    axiosPostMock.mockResolvedValueOnce({ status: 200, data: { accessToken: "refreshed.token.value" } });
    axiosCallMock.mockResolvedValue({ data: "ok" });

    const err: any = { config: { url: "/customers", headers: {} }, response: { status: 401 } };
    await responseInterceptorRef.current!(err);

    expect(refreshCalls()).toHaveLength(1);
    expect(axiosCallMock).toHaveBeenCalledTimes(1);
    expect((axiosCallMock.mock.calls[0][0] as any).headers.Authorization).toBe("Bearer refreshed.token.value");
  });
});
