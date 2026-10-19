import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { staffFilterOptions, staffParam, staffPickOptions } from "../../src/lib/staffFilter";
import { staffWarningMessages } from "../../src/lib/staffWarnings";

vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true }) }));

const agendaFetch = vi.fn();
const negocioFetch = vi.fn();
const lojaFetch = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetFinanceiroAgenda.js", () => ({ getFinanceiroAgenda: (p: unknown) => agendaFetch(p) }));
vi.mock("../../src/gen/backoffice/hooks/useGetFinanceiroNegocio.js", () => ({ getFinanceiroNegocio: (p: unknown) => negocioFetch(p) }));
vi.mock("../../src/gen/backoffice/hooks/useGetFinanceiroLoja.js", () => ({ getFinanceiroLoja: (p: unknown) => lojaFetch(p) }));

import { useAgendaFinance, useLojaFinance, useNegocioFinance } from "../../src/hooks/useFinanceiro";

const STAFF = [
  { staffId: "a1", name: "Tiago", active: true },
  { staffId: "b2", name: "Aprendiz", active: false },
];

describe("staffFilter — selector Global · Sem profissional · cada um", () => {
  it("staffParam: Global não manda parâmetro; none e id seguem tal e qual", () => {
    expect(staffParam("all")).toBeUndefined();
    expect(staffParam(undefined)).toBeUndefined();
    expect(staffParam("")).toBeUndefined();
    expect(staffParam("none")).toBe("none");
    expect(staffParam("a1")).toBe("a1");
  });

  it("staffFilterOptions: Global, Sem profissional e cada profissional (inactivo assinalado)", () => {
    expect(staffFilterOptions(STAFF)).toEqual([
      { value: "all", label: "Global" },
      { value: "none", label: "Sem profissional" },
      { value: "a1", label: "Tiago" },
      { value: "b2", label: "Aprendiz (inactivo)" },
    ]);
  });

  it("staffPickOptions: só activos, mais o já escolhido mesmo inactivo", () => {
    expect(staffPickOptions(STAFF).map((o) => o.value)).toEqual(["", "a1"]);
    expect(staffPickOptions(STAFF, "b2").map((o) => o.value)).toEqual(["", "a1", "b2"]);
    expect(staffPickOptions(STAFF, null, "—")[0]).toEqual({ value: "", label: "—" });
  });

  it("staffWarningMessages: textos PT dos avisos conhecidos; ignora os desconhecidos", () => {
    expect(staffWarningMessages(["STAFF_BUSY", "STAFF_TIME_OFF", "X"])).toEqual([
      "Já tem marcação a essa hora.",
      "Está de férias ou de folga nesse horário.",
    ]);
    expect(staffWarningMessages(undefined)).toEqual([]);
  });
});

describe("hooks do Financeiro — ?staff=", () => {
  const wrap = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children);

  beforeEach(() => {
    vi.clearAllMocks();
    agendaFetch.mockResolvedValue({});
    negocioFetch.mockResolvedValue({});
    lojaFetch.mockResolvedValue({});
  });

  it("Global (sem staff): o pedido NÃO leva o parâmetro", async () => {
    renderHook(() => useAgendaFinance("month", "com", undefined, undefined, undefined), { wrapper: wrap });
    await waitFor(() => expect(agendaFetch).toHaveBeenCalled());
    expect(agendaFetch.mock.calls[0][0]).toEqual({ period: "month", iva: "com" });
  });

  it("Sem profissional e um profissional: leva staff=none / staff=<id> nas três verticais", async () => {
    renderHook(() => useAgendaFinance("month", "com", undefined, undefined, "none"), { wrapper: wrap });
    renderHook(() => useLojaFinance("week", "sem", undefined, undefined, "a1"), { wrapper: wrap });
    renderHook(() => useNegocioFinance("month", "com", undefined, undefined, "a1"), { wrapper: wrap });
    await waitFor(() => {
      expect(agendaFetch).toHaveBeenCalled();
      expect(lojaFetch).toHaveBeenCalled();
      expect(negocioFetch).toHaveBeenCalled();
    });
    expect(agendaFetch.mock.calls[0][0]).toMatchObject({ staff: "none" });
    expect(lojaFetch.mock.calls[0][0]).toMatchObject({ period: "week", iva: "sem", staff: "a1" });
    expect(negocioFetch.mock.calls[0][0]).toMatchObject({ staff: "a1" });
  });
});
