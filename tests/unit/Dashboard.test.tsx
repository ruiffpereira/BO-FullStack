import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// O Dashboard decide os cartões por permissão (dono: VIEW_* do tenant) e a
// linha do tempo do dia (DayRail) pelo estado de cada marcação e pela hora
// actual. Mockamos auth, hooks Kubb e o relógio para controlar cada cenário.

let perms = new Set<string>();
const authMock = () => ({
  authHeader: () => ({}),
  hasPermission: (p: string) => perms.has(p),
  username: "dono",
  isMember: false,
  can: () => true,
  member: null,
});
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => authMock() }));

const NOW = new Date(2026, 9, 19, 10, 0, 0); // 2026-10-19 10:00 (hora local)
vi.mock("../../src/hooks/useNow", () => ({ useNow: () => NOW }));

const dashMock = vi.fn();
vi.mock("../../src/hooks/useDashboard", () => ({ useDashboard: () => dashMock() }));

// Profissionais (R2): sem QueryClientProvider, o tenant "não tem profissionais" (nenhum selector aparece).
vi.mock("../../src/hooks/useStaff", () => ({
  useStaffOptions: () => ({ staff: [], active: [], hasStaff: false, isLoading: false }),
}));

vi.mock("../../src/components/FirstValueChecklist", () => ({ FirstValueChecklist: () => null }));

const apptsMock = vi.fn();
const ordersMock = vi.fn();
const gymMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetCustomers.js", () => ({
  useGetCustomers: () => ({ data: { rows: [], count: 3 }, isLoading: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetOrders.js", () => ({ useGetOrders: () => ordersMock() }));
vi.mock("../../src/gen/backoffice/hooks/useGetScheduleAppointments.js", () => ({
  useGetScheduleAppointments: () => apptsMock(),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetScheduleServices.js", () => ({
  useGetScheduleServices: () => ({ data: [{ serviceId: "s1", color: "#ff0000" }] }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetGymMensalidadeFinance.js", () => ({
  useGetGymMensalidadeFinance: () => gymMock(),
}));

import { Dashboard } from "../../src/pages/Dashboard";

const appt = (id: string, time: string, status: string, clientName = `Cliente ${id}`) => ({
  appointmentId: id,
  date: "2026-10-19",
  time,
  serviceId: "s1",
  serviceName: "Corte",
  clientName,
  status,
});

function renderDash() {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  perms = new Set();
  dashMock.mockReturnValue({ data: { included: undefined, ecommerce: { period: { revenue: 0 } } }, isLoading: false });
  apptsMock.mockReturnValue({ data: [], isLoading: false });
  ordersMock.mockReturnValue({ data: { rows: [{ orderId: "o1", status: "pending", createdAt: "2026-10-18T10:00:00Z" }], stats: { billed: 10, open: 1 } }, isLoading: false });
  gymMock.mockReturnValue({
    data: { kpis: { recebido: 50, emDivida: 0, emAtraso: 2, mrr: 200, blocked: 0 }, rows: [] },
    isLoading: false,
  });
});

describe("Dashboard — KPIs por permissão (dono)", () => {
  it("sem VIEW_PRODUCTS não há 'Por despachar' nem vendas", () => {
    perms = new Set(["VIEW_SCHEDULE"]);
    renderDash();
    expect(screen.queryByText("Por despachar")).not.toBeInTheDocument();
    expect(screen.queryByText("Vendas de hoje")).not.toBeInTheDocument();
    expect(screen.queryByText("Ticket médio")).not.toBeInTheDocument();
    expect(screen.getByText("Marcações hoje")).toBeInTheDocument();
  });

  it("«Por despachar» é a contagem da API (LJ-11), não as encomendas carregadas", () => {
    perms = new Set(["VIEW_PRODUCTS"]);
    ordersMock.mockReturnValue({
      data: { rows: [{ orderId: "o1", status: "pending", createdAt: "2026-10-18T10:00:00Z" }], stats: { billed: 10, open: 37 } },
      isLoading: false,
    });
    renderDash();
    expect(screen.getByText("Por despachar")).toBeInTheDocument();
    expect(screen.getByText("37")).toBeInTheDocument();
  });

  it("sem VIEW_SCHEDULE não há 'Marcações hoje'", () => {
    perms = new Set(["VIEW_PRODUCTS"]);
    renderDash();
    expect(screen.queryByText("Marcações hoje")).not.toBeInTheDocument();
    expect(screen.queryByText(/Marcações · 14 dias/)).not.toBeInTheDocument();
    expect(screen.getByText("Por despachar")).toBeInTheDocument();
  });

  it("sem VIEW_GYM não há cobranças nem 'Em atraso'/'Por cobrar'", () => {
    perms = new Set(["VIEW_SCHEDULE", "VIEW_PRODUCTS"]);
    renderDash();
    expect(screen.queryByText(/Cobranças/)).not.toBeInTheDocument();
    expect(screen.queryByText("Por cobrar")).not.toBeInTheDocument();
    expect(screen.queryByText("Sócios ativos")).not.toBeInTheDocument();
  });

  it("com VIEW_GYM (e só ele) a espinha é a das cobranças", () => {
    perms = new Set(["VIEW_GYM"]);
    renderDash();
    expect(screen.getByText(/Cobranças ·/)).toBeInTheDocument();
    expect(screen.queryByText("Marcações hoje")).not.toBeInTheDocument();
    expect(screen.queryByText("Por despachar")).not.toBeInTheDocument();
  });

  it("sem nenhum módulo só sobra o core (Clientes) e não há 'Receita de hoje'", () => {
    renderDash();
    expect(screen.queryByText("Receita de hoje")).not.toBeInTheDocument();
    expect(screen.getByText("Clientes")).toBeInTheDocument();
  });
});

describe("Dashboard — DayRail (linha do tempo de hoje)", () => {
  beforeEach(() => {
    perms = new Set(["VIEW_SCHEDULE"]);
  });

  it("sem marcações hoje mostra 'Dia livre'", () => {
    renderDash();
    expect(screen.getByText("Dia livre", { selector: "h3" })).toBeInTheDocument();
  });

  it("mostra o estado de cada marcação e o marcador 'agora' entre passado e futuro", () => {
    apptsMock.mockReturnValue({
      data: [
        appt("a1", "09:00", "completed", "Ana"),
        appt("a2", "09:30", "cancelled", "Bruno"),
        appt("a3", "11:00", "confirmed", "Carla"),
        appt("a4", "12:00", "pending", "Duarte"),
      ],
      isLoading: false,
    });
    renderDash();

    const rail = screen.getByRole("list");
    const items = within(rail).getAllByRole("listitem");
    // O marcador 'agora' (10:00) fica depois das 09:30 e antes das 11:00.
    const textos = items.map((li) => li.textContent ?? "");
    expect(textos[0]).toContain("Ana");
    expect(textos[0]).toContain("Concluída");
    expect(textos[1]).toContain("Cancelada");
    expect(textos[2]).toContain("agora");
    expect(textos[2]).toContain("Carla");
    expect(textos[2]).toContain("Confirmada");
    expect(textos[3]).toContain("Pendente");
    expect(within(rail).getAllByText("agora")).toHaveLength(1);
  });

  it("'Próximo' é a primeira marcação por fazer a partir de agora (ignora concluídas/canceladas)", () => {
    apptsMock.mockReturnValue({
      data: [appt("a1", "10:30", "cancelled", "Bruno"), appt("a2", "11:00", "confirmed", "Carla")],
      isLoading: false,
    });
    renderDash();
    expect(screen.getByText(/em 60 min/)).toBeInTheDocument();
    expect(screen.getByText(/11:00 · Carla/)).toBeInTheDocument();
  });

  it("depois da última marcação mostra 'Dia concluído' e o marcador 'agora' no fim", () => {
    apptsMock.mockReturnValue({ data: [appt("a1", "08:00", "completed", "Ana")], isLoading: false });
    renderDash();
    expect(screen.getByText("Dia concluído")).toBeInTheDocument();
    expect(screen.getByText("Sem mais marcações por hoje")).toBeInTheDocument();
    expect(screen.getByText("agora")).toBeInTheDocument();
  });
});
