import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// Smoke das 4 vistas do Ginásio (Exercícios · Dia de Treino · Planos · Progresso
// de clientes): lista, estado vazio, pesquisa e a validação do formulário
// "Novo exercício". Mockamos só os hooks de LEITURA tocados pelas vistas; as
// mutações nunca chegam a correr (o botão de criar fica desativado).

const exercisesMock = vi.fn();
const templatesMock = vi.fn();
const planosMock = vi.fn();
const customersMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetGymExercises.js", () => ({
  useGetGymExercises: () => exercisesMock(),
  getGymExercisesQueryKey: () => ["gym-exercises"],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetGymWorkoutTemplates.js", () => ({
  useGetGymWorkoutTemplates: () => templatesMock(),
  getGymWorkoutTemplatesQueryKey: () => ["gym-templates"],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetGymPlanos.js", () => ({
  useGetGymPlanos: () => planosMock(),
  getGymPlanosQueryKey: () => ["gym-planos"],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetGymPrograms.js", () => ({
  useGetGymPrograms: () => ({ data: [], isLoading: false }),
  getGymProgramsQueryKey: () => ["gym-programs"],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetGymMuscleGroups.js", () => ({
  useGetGymMuscleGroups: () => ({
    data: [{ muscleGroupId: "g1", name: "Peito", color: "#2A6FDB", parentId: null }],
  }),
  getGymMuscleGroupsQueryKey: () => ["gym-groups"],
}));
vi.mock("../../src/gen/backoffice/hooks/useGetGymClientsCustomeridStats.js", () => ({
  useGetGymClientsCustomeridStats: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetCustomers.js", () => ({
  useGetCustomers: () => customersMock(),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetUsersMe.js", () => ({
  useGetUsersMe: () => ({ data: undefined }),
}));
vi.mock("../../src/hooks/useSettingsLanguages", () => ({
  useGetSettingsLanguages: () => ({ data: { default: "pt", languages: ["pt"] } }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));
// O nome do exercício é um CmsCombo (pesquisa no CMS) — aqui basta um input.
vi.mock("../../src/components/CmsCombo", () => ({
  CmsCombo: ({ label, name, onChange }: { label: string; name: string; onChange: (k: string | null, n: string) => void }) => (
    <input aria-label={label} value={name} onChange={(e) => onChange(null, e.target.value)} />
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { Ginasio, type GinasioView } from "../../src/pages/Ginasio";

function renderView(view: GinasioView) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Ginasio view={view} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  exercisesMock.mockReturnValue({ data: [], isLoading: false });
  templatesMock.mockReturnValue({ data: [], isLoading: false });
  planosMock.mockReturnValue({ data: [], isLoading: false });
  customersMock.mockReturnValue({ data: { rows: [], count: 0 } });
});

describe("Ginásio — Exercícios", () => {
  it("sem exercícios mostra o estado vazio com a acção de criar", () => {
    renderView("catalogo");
    expect(screen.getByText("Sem exercícios")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Novo exercício/ }).length).toBeGreaterThan(0);
  });

  it("lista os exercícios com o grupo e o número de presets; a pesquisa filtra", async () => {
    const user = userEvent.setup();
    exercisesMock.mockReturnValue({
      data: [
        { exerciseId: "e1", name: "Supino", muscleGroup: "Peito", presets: [{ id: "p1", name: "Iniciante", type: "strength", sets: 3, reps: 10 }] },
        { exerciseId: "e2", name: "Prancha", muscleGroup: "Peito", presets: [] },
      ],
      isLoading: false,
    });
    renderView("catalogo");
    expect(screen.getByText("Supino")).toBeInTheDocument();
    expect(screen.getByText("Prancha")).toBeInTheDocument();
    expect(screen.getByText("1 preset")).toBeInTheDocument();
    expect(screen.getByText("0 presets")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Procurar exercício…"), "pran");
    expect(screen.queryByText("Supino")).not.toBeInTheDocument();
    expect(screen.getByText("Prancha")).toBeInTheDocument();
  });

  it("'Novo exercício': 'Criar exercício' fica desativado até haver nome, grupo e preset completo", async () => {
    const user = userEvent.setup();
    renderView("catalogo");
    await user.click(screen.getAllByRole("button", { name: /Novo exercício/ })[0]);

    const criar = await screen.findByRole("button", { name: "Criar exercício" });
    expect(criar).toBeDisabled();

    // Só o nome — ainda faltam o grupo e o preset.
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Remo" } });
    expect(screen.getByRole("button", { name: "Criar exercício" })).toBeDisabled();
  });
});

describe("Ginásio — Dia de Treino", () => {
  it("sem dias de treino mostra o estado vazio", () => {
    renderView("treinos");
    expect(screen.getByText("Sem dias de treino")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Novo dia de treino/ }).length).toBeGreaterThan(0);
  });

  it("lista os dias e a pesquisa sem correspondência mostra 'Sem resultados'", async () => {
    const user = userEvent.setup();
    templatesMock.mockReturnValue({
      data: [{ id: "t1", name: "Peito e tríceps", exercises: [{}, {}], muscleGroups: ["Peito"] }],
      isLoading: false,
    });
    renderView("treinos");
    expect(screen.getByText("Peito e tríceps")).toBeInTheDocument();
    expect(screen.getByText("2 exercícios")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Procurar dia de treino"), "zzz");
    expect(screen.getByText("Sem resultados")).toBeInTheDocument();
  });
});

describe("Ginásio — Planos", () => {
  it("sem planos mostra o estado vazio com 'Novo plano'", () => {
    renderView("planos");
    expect(screen.getByText("Sem planos")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Novo plano/ }).length).toBeGreaterThan(0);
  });
});

describe("Ginásio — Progresso de clientes", () => {
  it("sem clientes mostra o estado vazio", () => {
    renderView("clientes");
    expect(screen.getByText("Sem clientes")).toBeInTheDocument();
    expect(screen.getByText("0 clientes")).toBeInTheDocument();
  });

  it("lista os clientes e a pesquisa filtra por nome", async () => {
    const user = userEvent.setup();
    customersMock.mockReturnValue({
      data: { rows: [{ customerId: "c1", name: "Ana Sócia" }, { customerId: "c2", name: "Bruno Sócio" }], count: 2 },
    });
    renderView("clientes");
    expect(screen.getByText("Ana Sócia")).toBeInTheDocument();
    expect(screen.getByText("Bruno Sócio")).toBeInTheDocument();
    expect(screen.getByText("2 clientes")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Procurar cliente"), "bruno");
    expect(screen.queryByText("Ana Sócia")).not.toBeInTheDocument();
    expect(screen.getByText("1 cliente")).toBeInTheDocument();
  });
});
