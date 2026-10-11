import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// O GrelhaCard (Agenda → Configurações) lê/grava o intervalo da grelha do
// calendário (`/schedule/settings`). Mockamos os hooks Kubb e o write-guard.

const settingsMock = vi.fn();
const mutateMock = vi.fn();
const writeGuardMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetScheduleSettings.js", () => ({
  useGetScheduleSettings: () => settingsMock(),
  getScheduleSettingsQueryKey: () => [{ url: "/schedule/settings" }],
}));
vi.mock("../../src/gen/backoffice/hooks/useUpdateScheduleSettings.js", () => ({
  useUpdateScheduleSettings: () => ({ mutate: mutateMock, isPending: false }),
}));
vi.mock("../../src/hooks/useWriteGuard", () => ({
  useWriteGuard: () => writeGuardMock(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { GrelhaCard } from "../../src/pages/AgendaConfig";

function renderCard() {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <GrelhaCard />
    </QueryClientProvider>,
  );
  return qc;
}

beforeEach(() => {
  vi.clearAllMocks();
  writeGuardMock.mockReturnValue({ readOnly: false, message: "" });
});

describe("GrelhaCard — intervalo do calendário", () => {
  it("mostra as 5 opções e 15 min selecionado por defeito", () => {
    settingsMock.mockReturnValue({ data: undefined, isLoading: false });
    renderCard();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "15 min" })).toHaveAttribute("aria-selected", "true");
  });

  it("mostra o valor guardado do tenant", () => {
    settingsMock.mockReturnValue({ data: { slotMinutes: 30 }, isLoading: false });
    renderCard();
    expect(screen.getByRole("tab", { name: "30 min" })).toHaveAttribute("aria-selected", "true");
  });

  it("grava o intervalo escolhido (número, não string)", () => {
    settingsMock.mockReturnValue({ data: { slotMinutes: 15 }, isLoading: false });
    renderCard();
    fireEvent.click(screen.getByRole("tab", { name: "20 min" }));
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0]).toEqual({ data: { slotMinutes: 20 } });
  });

  it("não grava ao clicar no valor atual", () => {
    settingsMock.mockReturnValue({ data: { slotMinutes: 15 }, isLoading: false });
    renderCard();
    fireEvent.click(screen.getByRole("tab", { name: "15 min" }));
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("em read-only (billing) não grava e mostra o motivo", () => {
    writeGuardMock.mockReturnValue({ readOnly: true, message: "Conta em modo só de leitura" });
    settingsMock.mockReturnValue({ data: { slotMinutes: 15 }, isLoading: false });
    renderCard();
    fireEvent.click(screen.getByRole("tab", { name: "30 min" }));
    expect(mutateMock).not.toHaveBeenCalled();
    expect(screen.getByText("Conta em modo só de leitura")).toBeInTheDocument();
  });
});
