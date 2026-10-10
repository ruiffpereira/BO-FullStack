import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Em sessão de suporte, SSE e push NÃO arrancam (a API devolve 403 em
// /events/stream e /push/*) — nem se pede permissão de notificações.

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

const vapidMock = vi.fn();
const subscribeMock = vi.fn();
const unsubscribeMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetPushVapidPublicKey.js", () => ({
  getPushVapidPublicKey: (...a: unknown[]) => vapidMock(...a),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostPushSubscribe.js", () => ({
  postPushSubscribe: (...a: unknown[]) => subscribeMock(...a),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostPushUnsubscribe.js", () => ({
  postPushUnsubscribe: (...a: unknown[]) => unsubscribeMock(...a),
}));

import { useSSE } from "../../src/hooks/useSSE";
import { usePushSubscription } from "../../src/hooks/usePushSubscription";

const SUPPORT = { tenantName: "Barbearia Central", expiresAt: "2030-01-01T00:00:00.000Z" };

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

let fetchSpy: ReturnType<typeof vi.fn>;
let requestPermission: ReturnType<typeof vi.fn>;
const originalNotification = (globalThis as any).Notification;

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetchSpy);
  requestPermission = vi.fn(() => Promise.resolve("granted"));
  (globalThis as any).Notification = Object.assign(function () {}, {
    permission: "default",
    requestPermission,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  (globalThis as any).Notification = originalNotification;
});

describe("sessão de suporte — o que não arranca", () => {
  it("useSSE não abre /events/stream", () => {
    authMock.mockReturnValue({ isAuthenticated: true, accessToken: "support.token", supportSession: SUPPORT });
    renderHook(() => useSSE(), { wrapper });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("controlo: useSSE fora de suporte abre /events/stream", () => {
    authMock.mockReturnValue({ isAuthenticated: true, accessToken: "tok", supportSession: null });
    renderHook(() => useSSE(), { wrapper });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/events/stream");
  });

  it("usePushSubscription não pede permissão, não subscreve nem desinscreve", async () => {
    authMock.mockReturnValue({ isAuthenticated: true, supportSession: SUPPORT });
    const { result } = renderHook(() => usePushSubscription(), { wrapper });

    let ok = true;
    await act(async () => {
      ok = await result.current.requestAndSubscribe();
      await result.current.unsubscribe();
    });

    expect(ok).toBe(false);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(vapidMock).not.toHaveBeenCalled();
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(unsubscribeMock).not.toHaveBeenCalled();
  });
});
