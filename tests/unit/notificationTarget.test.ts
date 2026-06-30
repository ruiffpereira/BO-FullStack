import { describe, it, expect } from "vitest";
import { notificationHref } from "../../src/lib/notificationTarget";
import type { Notification } from "../../src/hooks/useNotifications";

// Helper: constrói o mínimo que `notificationHref` lê (type + data).
function notif(
  type: Notification["type"],
  data: Record<string, unknown> | null = null,
): Pick<Notification, "type" | "data"> {
  return { type, data };
}

describe("notificationHref", () => {
  it("booking → agenda focando a marcação (data.appointmentId tem prioridade)", () => {
    expect(
      notificationHref(notif("booking", { appointmentId: "appt-1", date: "2026-07-02" })),
    ).toBe("/agenda?marcacao=appt-1");
  });

  it("booking sem id → agenda na data; sem nada → /agenda", () => {
    expect(notificationHref(notif("booking", { date: "2026-07-02" }))).toBe(
      "/agenda?data=2026-07-02",
    );
    expect(notificationHref(notif("booking"))).toBe("/agenda");
  });

  it("order → separador Encomendas da Loja", () => {
    expect(notificationHref(notif("order", { orderId: "o-9" }))).toBe(
      "/loja?tab=encomendas",
    );
  });

  it("customer → ficha do cliente; sem id → lista", () => {
    expect(notificationHref(notif("customer", { customerId: "c-7" }))).toBe(
      "/clientes?cliente=c-7",
    );
    expect(notificationHref(notif("customer"))).toBe("/clientes");
  });

  it("gym com cliente → ficha do cliente; sem cliente → /ginasio", () => {
    expect(
      notificationHref(notif("gym", { programId: "p-1", customerId: "c-3" })),
    ).toBe("/clientes?cliente=c-3");
    expect(notificationHref(notif("gym", { programId: "p-1" }))).toBe("/ginasio");
  });

  it("payment → Financeiro/Ginásio", () => {
    expect(notificationHref(notif("payment", { period: "2026-06" }))).toBe(
      "/financeiro?vista=ginasio",
    );
  });

  it("stock → produto na Loja; sem id → /loja", () => {
    expect(notificationHref(notif("stock", { productId: "prod-2" }))).toBe(
      "/loja?openProduct=prod-2",
    );
    expect(notificationHref(notif("stock"))).toBe("/loja");
  });

  it("reminder de marcações (data.date) → agenda; de mensalidades (data.period) → financeiro", () => {
    expect(notificationHref(notif("reminder", { date: "2026-07-02", count: 3 }))).toBe(
      "/agenda?data=2026-07-02",
    );
    expect(notificationHref(notif("reminder", { period: "2026-06", count: 2 }))).toBe(
      "/financeiro?vista=ginasio",
    );
    expect(notificationHref(notif("reminder"))).toBe("/agenda");
  });

  it("system (ou tipo desconhecido) → sem destino (null)", () => {
    expect(notificationHref(notif("system"))).toBeNull();
    expect(
      notificationHref(notif("desconhecido" as Notification["type"])),
    ).toBeNull();
  });

  it("tolera datetime ISO no campo date (corta para YYYY-MM-DD)", () => {
    expect(
      notificationHref(notif("booking", { date: "2026-07-02T10:30:00.000Z" })),
    ).toBe("/agenda?data=2026-07-02");
  });

  it("codifica valores no query string", () => {
    expect(notificationHref(notif("customer", { customerId: "a b/c" }))).toBe(
      "/clientes?cliente=a%20b%2Fc",
    );
  });
});
