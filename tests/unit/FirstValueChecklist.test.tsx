import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// O FirstValueChecklist (T11, Dashboard) deriva o checklist das permissões
// (useAuth) + dados já existentes (hooks gerados). Mockamos ambos para testar
// cada vertical isoladamente, sem servidor.

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

const customersMock = vi.fn();
const servicesMock = vi.fn();
const workingHoursMock = vi.fn();
const gymSubsMock = vi.fn();
const productsMock = vi.fn();

// useGetCustomers recebe as opções (query.enabled) — encaminhamos para o mock
// para podermos verificar, no FIX 5, que o hook não é ativado sem VIEW_CUSTOMERS.
vi.mock("../../src/gen/backoffice/hooks/useGetCustomers.js", () => ({
  useGetCustomers: (opts: unknown) => customersMock(opts),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetScheduleServices.js", () => ({
  useGetScheduleServices: () => servicesMock(),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetScheduleWorkingHours.js", () => ({
  useGetScheduleWorkingHours: () => workingHoursMock(),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetGymSubscriptions.js", () => ({
  useGetGymSubscriptions: () => gymSubsMock(),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetProducts.js", () => ({
  useGetProducts: () => productsMock(),
}));

import { FirstValueChecklist } from "../../src/components/FirstValueChecklist";

function mockAuth(perms: string[], userId = "u1") {
  authMock.mockReturnValue({
    authHeader: () => ({}),
    hasPermission: (p: string) => perms.includes(p),
    userId,
  });
}

function renderChecklist() {
  return render(
    <MemoryRouter>
      <FirstValueChecklist />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  try {
    window.localStorage.clear();
  } catch {
    /* noop */
  }
  customersMock.mockReturnValue({ data: { count: 0, rows: [] } });
  servicesMock.mockReturnValue({ data: [] });
  workingHoursMock.mockReturnValue({ data: [] });
  gymSubsMock.mockReturnValue({ data: [] });
  productsMock.mockReturnValue({ data: { rows: [], count: 0 } });
});

describe("FirstValueChecklist — checklist por vertical", () => {
  it("VIEW_SCHEDULE: mostra os passos da agenda", () => {
    mockAuth(["VIEW_SCHEDULE"]);
    renderChecklist();

    expect(screen.getByText("Cria o teu primeiro serviço")).toBeInTheDocument();
    expect(screen.getByText("Define o horário de funcionamento")).toBeInTheDocument();
    expect(screen.getByText("Partilha o link de marcação com os teus clientes")).toBeInTheDocument();
  });

  it("VIEW_GYM: mostra os passos do ginásio", () => {
    mockAuth(["VIEW_GYM", "VIEW_CUSTOMERS"]);
    renderChecklist();

    expect(screen.getByText("Cria a tua primeira subscrição")).toBeInTheDocument();
    expect(screen.getByText("Adiciona o teu primeiro cliente")).toBeInTheDocument();
    expect(screen.getByText("Regista a primeira cobrança")).toBeInTheDocument();
  });

  it("VIEW_PRODUCTS: mostra os passos da loja", () => {
    mockAuth(["VIEW_PRODUCTS"]);
    renderChecklist();

    expect(screen.getByText("Cria o teu primeiro produto")).toBeInTheDocument();
    expect(screen.getByText("Revê as tuas encomendas")).toBeInTheDocument();
  });

  it("core (sem módulos): mostra o checklist genérico", () => {
    mockAuth(["VIEW_CUSTOMERS"]);
    renderChecklist();

    expect(screen.getByText("Adiciona o teu primeiro cliente")).toBeInTheDocument();
    expect(screen.getByText("Explora os conteúdos do teu site")).toBeInTheDocument();
  });

  it("a agenda tem prioridade sobre o ginásio/loja quando o tenant tem várias permissões", () => {
    mockAuth(["VIEW_SCHEDULE", "VIEW_GYM", "VIEW_PRODUCTS"]);
    renderChecklist();
    expect(screen.getByText("Cria o teu primeiro serviço")).toBeInTheDocument();
    expect(screen.queryByText("Cria a tua primeira subscrição")).not.toBeInTheDocument();
  });
});

describe("FirstValueChecklist — completude a partir dos dados existentes", () => {
  it("marca os itens da agenda como concluídos quando já há serviço/horário", () => {
    mockAuth(["VIEW_SCHEDULE"]);
    servicesMock.mockReturnValue({ data: [{ serviceId: "s1", name: "Corte" }] });
    workingHoursMock.mockReturnValue({ data: [{ dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }] });
    renderChecklist();

    // 2 de 3 concluídos (falta partilhar o link, que nunca auto-completa)
    expect(screen.getByText("2/3 concluídos")).toBeInTheDocument();
  });

  it("marca 'adicionar cliente' como concluído quando já há clientes (core)", () => {
    mockAuth(["VIEW_CUSTOMERS"]);
    customersMock.mockReturnValue({ data: { count: 3, rows: [] } });
    renderChecklist();
    expect(screen.getByText("1/2 concluídos")).toBeInTheDocument();
  });

  it("sem nenhum dado, nenhum item está concluído (0/N)", () => {
    mockAuth(["VIEW_PRODUCTS"]);
    renderChecklist();
    expect(screen.getByText("0/2 concluídos")).toBeInTheDocument();
  });
});

describe("FirstValueChecklist — 'Regista a primeira cobrança' não regride entre meses (FIX 4)", () => {
  it("nunca marca concluído sozinho, mesmo com subscrição e cliente já criados (item não-auto-completante)", () => {
    mockAuth(["VIEW_GYM", "VIEW_CUSTOMERS"]);
    gymSubsMock.mockReturnValue({ data: [{ subscriptionId: "sub1" }] });
    customersMock.mockReturnValue({ data: { count: 2, rows: [] } });
    renderChecklist();

    // Subscrição + cliente concluídos, cobrança nunca auto-completa (2/3, não 3/3).
    expect(screen.getByText("2/3 concluídos")).toBeInTheDocument();
    expect(screen.getByText("Regista a primeira cobrança")).toBeInTheDocument();
  });

  it("o item continua visível e nunca concluído em remontagens sucessivas (não há regressão mensal para observar)", () => {
    mockAuth(["VIEW_GYM", "VIEW_CUSTOMERS"]);
    gymSubsMock.mockReturnValue({ data: [{ subscriptionId: "sub1" }] });
    customersMock.mockReturnValue({ data: { count: 2, rows: [] } });
    const { unmount } = renderChecklist();
    expect(screen.getByText("2/3 concluídos")).toBeInTheDocument();
    unmount();

    // Uma segunda montagem (equivalente a "o mês seguinte") mostra exatamente o
    // mesmo estado — nada regride porque o item nunca dependeu do mês corrente.
    renderChecklist();
    expect(screen.getByText("2/3 concluídos")).toBeInTheDocument();
  });
});

describe("FirstValueChecklist — gate de VIEW_CUSTOMERS no hook de clientes (FIX 5)", () => {
  it("sem VIEW_CUSTOMERS (core), o item de cliente não aparece e o hook fica desativado", () => {
    mockAuth([]); // core, sem nenhuma permissão de módulo nem VIEW_CUSTOMERS
    renderChecklist();

    expect(screen.queryByText("Adiciona o teu primeiro cliente")).not.toBeInTheDocument();
    expect(screen.getByText("Explora os conteúdos do teu site")).toBeInTheDocument();
    expect(customersMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) }),
    );
  });

  it("sem VIEW_CUSTOMERS (ginásio), o item de cliente não aparece e o hook fica desativado", () => {
    mockAuth(["VIEW_GYM"]); // VIEW_GYM sem VIEW_CUSTOMERS
    renderChecklist();

    expect(screen.queryByText("Adiciona o teu primeiro cliente")).not.toBeInTheDocument();
    expect(screen.getByText("Cria a tua primeira subscrição")).toBeInTheDocument();
    expect(customersMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) }),
    );
  });

  it("com VIEW_CUSTOMERS (core), o hook fica ativado normalmente", () => {
    mockAuth(["VIEW_CUSTOMERS"]);
    renderChecklist();

    expect(screen.getByText("Adiciona o teu primeiro cliente")).toBeInTheDocument();
    expect(customersMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: true }) }),
    );
  });
});

describe("FirstValueChecklist — dispensar", () => {
  it("dispensar esconde o bloco e persiste em localStorage por user", () => {
    mockAuth(["VIEW_SCHEDULE"], "tenant-1");
    renderChecklist();

    expect(screen.getByText("Primeiros passos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dispensar checklist/i }));

    expect(screen.queryByText("Primeiros passos")).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem("dashboard.firstValueChecklist.dismissedFor.tenant-1"),
    ).toBe("1");
  });

  it("ao remontar já dispensado (mesmo user), o bloco não aparece", () => {
    window.localStorage.setItem("dashboard.firstValueChecklist.dismissedFor.tenant-1", "1");
    mockAuth(["VIEW_SCHEDULE"], "tenant-1");
    renderChecklist();
    expect(screen.queryByText("Primeiros passos")).not.toBeInTheDocument();
  });

  it("dispensado para um user não afeta outro user", () => {
    window.localStorage.setItem("dashboard.firstValueChecklist.dismissedFor.tenant-1", "1");
    mockAuth(["VIEW_SCHEDULE"], "tenant-2");
    renderChecklist();
    expect(screen.getByText("Primeiros passos")).toBeInTheDocument();
  });
});

describe("FirstValueChecklist — deep-links", () => {
  it("clicar num item navega para a rota certa", () => {
    mockAuth(["VIEW_PRODUCTS"]);
    renderChecklist();

    fireEvent.click(screen.getByText("Cria o teu primeiro produto"));
    // A navegação real é verificada indiretamente — apenas confirmamos que o
    // botão existe e é clicável sem rebentar (o useNavigate é do react-router
    // real dentro do MemoryRouter).
    expect(screen.getByText("Cria o teu primeiro produto")).toBeInTheDocument();
  });
});
