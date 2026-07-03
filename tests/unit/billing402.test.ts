import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// notifyBillingReadOnly mostra o toast via sonner. Mockamos o módulo para o
// `toast.error` ser um spy — assim testamos a lógica (match + dedup + ação) sem
// montar o Toaster nem o AuthContext.
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

import { isBillingReadOnlyError } from "../../src/lib/billingStatus";
import {
  notifyBillingReadOnly,
  resetBillingReadOnlyThrottle,
} from "../../src/lib/billing402";

beforeEach(() => {
  vi.clearAllMocks();
  resetBillingReadOnlyThrottle();
});

// ── Discriminador puro ─────────────────────────────────────────────────────────
describe("isBillingReadOnlyError", () => {
  it("402 com `reason` (billing gate) → true", () => {
    expect(
      isBillingReadOnlyError(402, { error: "x", reason: "past_due_locked", graceEndsAt: null }),
    ).toBe(true);
    expect(isBillingReadOnlyError(402, { reason: "grace", graceEndsAt: "2026-07-20" })).toBe(true);
    expect(isBillingReadOnlyError(402, { reason: "canceled" })).toBe(true);
  });

  it("402 SEM `reason` → false (não é o 402 do billing)", () => {
    expect(isBillingReadOnlyError(402, { error: "algo" })).toBe(false);
    expect(isBillingReadOnlyError(402, {})).toBe(false);
    expect(isBillingReadOnlyError(402, { reason: "" })).toBe(false);
    expect(isBillingReadOnlyError(402, { reason: 123 })).toBe(false);
    expect(isBillingReadOnlyError(402, null)).toBe(false);
    expect(isBillingReadOnlyError(402, undefined)).toBe(false);
  });

  it("outros status (403/500/401/undefined) → false mesmo com `reason`", () => {
    expect(isBillingReadOnlyError(403, { reason: "past_due_locked" })).toBe(false);
    expect(isBillingReadOnlyError(500, { reason: "canceled" })).toBe(false);
    expect(isBillingReadOnlyError(401, { reason: "grace" })).toBe(false);
    expect(isBillingReadOnlyError(undefined, { reason: "grace" })).toBe(false);
  });
});

// ── Toast reativo ──────────────────────────────────────────────────────────────
describe("notifyBillingReadOnly", () => {
  it("mostra um toast coalescido com ação que navega para /faturacao", () => {
    const navigate = vi.fn();
    const matched = notifyBillingReadOnly(402, { reason: "past_due_locked" }, navigate);

    expect(matched).toBe(true);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    const [msg, opts] = toastErrorMock.mock.calls[0] as [string, any];
    expect(msg).toMatch(/regulariza o pagamento/i);
    expect(opts.id).toBe("billing-402"); // id fixo → sonner mantém um só toast
    expect(opts.action.label).toBe("Faturação");
    // A ação leva à página de regularização.
    opts.action.onClick();
    expect(navigate).toHaveBeenCalledWith("/faturacao");
  });

  it("não mostra toast nem faz match para erros não-billing", () => {
    const navigate = vi.fn();
    expect(notifyBillingReadOnly(500, { error: "boom" }, navigate)).toBe(false);
    expect(notifyBillingReadOnly(403, { reason: "past_due_locked" }, navigate)).toBe(false);
    expect(notifyBillingReadOnly(402, { error: "sem reason" }, navigate)).toBe(false);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("dedup: uma rajada de 402 só dispara um toast (throttle temporal)", () => {
    const navigate = vi.fn();
    notifyBillingReadOnly(402, { reason: "past_due_locked" }, navigate);
    notifyBillingReadOnly(402, { reason: "past_due_locked" }, navigate);
    notifyBillingReadOnly(402, { reason: "canceled" }, navigate);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it("volta a avisar depois de o throttle expirar", () => {
    const navigate = vi.fn();
    notifyBillingReadOnly(402, { reason: "past_due_locked" }, navigate);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    // Simula o passar do tempo (reset do throttle) → novo aviso permitido.
    resetBillingReadOnlyThrottle();
    notifyBillingReadOnly(402, { reason: "past_due_locked" }, navigate);
    expect(toastErrorMock).toHaveBeenCalledTimes(2);
  });
});
