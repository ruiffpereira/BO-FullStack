import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// O CalendarSubscribeCard (Agenda) é conduzido pelo hook manual
// useScheduleCalendarFeed (sem Kubb). Mockamos o módulo do hook para exercitar
// cada estado (loading/erro/ok) de forma isolada — como o BillingBanner.test.tsx
// faz com useGetBillingSubscription.

const feedMock = vi.fn();
const rotateMutateMock = vi.fn();

vi.mock("../../src/hooks/useScheduleCalendar", () => ({
  useScheduleCalendarFeed: () => feedMock(),
  useRotateScheduleCalendarToken: () => ({
    mutate: rotateMutateMock,
    isPending: false,
  }),
}));

import { CalendarSubscribeCard } from "../../src/components/CalendarSubscribeCard";

const FEED = {
  token: "tok123",
  url: "https://api.example.com/schedule/calendar/tok123.ics",
  webcalUrl: "webcal://api.example.com/schedule/calendar/tok123.ics",
};

function mockFeed(overrides: Partial<{
  data: typeof FEED | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}> = {}) {
  feedMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  });
}

async function openCard() {
  fireEvent.click(screen.getByRole("button", { name: /subscrever calendário/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("CalendarSubscribeCard — carregado com sucesso", () => {
  it("mostra o link https:// (com label) e o botão copiar", async () => {
    mockFeed({ data: FEED });
    render(<CalendarSubscribeCard />);
    await openCard();

    const input = screen.getByLabelText("Link do calendário") as HTMLInputElement;
    expect(input).toHaveValue(FEED.url);
    expect(input).toHaveAttribute("readonly");

    expect(
      screen.getByRole("button", { name: /copiar link do calendário/i }),
    ).toBeInTheDocument();

    // Ação secundária: abrir na app (webcal://), nunca o CTA primário
    const openInApp = screen.getByRole("link", { name: /abrir na app de calendário/i });
    expect(openInApp).toHaveAttribute("href", FEED.webcalUrl);

    // O antigo deep-link `calendar/r?cid=` do Google foi removido
    expect(screen.queryByText(/google calendar$/i)).not.toBeInTheDocument();
  });

  it("clicar em copiar chama navigator.clipboard.writeText com o url https://", async () => {
    mockFeed({ data: FEED });
    render(<CalendarSubscribeCard />);
    await openCard();

    fireEvent.click(screen.getByRole("button", { name: /copiar link do calendário/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(FEED.url);
    expect(await screen.findByText(/copiado/i)).toBeInTheDocument();
  });
});

describe("CalendarSubscribeCard — loading", () => {
  it("mostra 'A carregar…' e não renderiza links", async () => {
    mockFeed({ isLoading: true });
    render(<CalendarSubscribeCard />);
    await openCard();

    expect(screen.getByText(/a carregar/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("CalendarSubscribeCard — erro", () => {
  it("isError=true mostra a mensagem de erro e não renderiza links mortos", async () => {
    mockFeed({ isError: true });
    render(<CalendarSubscribeCard />);
    await openCard();

    expect(
      screen.getByText(/não foi possível carregar o link do calendário/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Link do calendário")).not.toBeInTheDocument();
  });

  it("sem dados e sem loading (falha silenciosa) também mostra o erro", async () => {
    mockFeed({ data: undefined, isLoading: false, isError: false });
    render(<CalendarSubscribeCard />);
    await openCard();

    expect(
      screen.getByText(/não foi possível carregar o link do calendário/i),
    ).toBeInTheDocument();
  });

  it("'Tentar novamente' chama o refetch", async () => {
    const refetch = vi.fn();
    mockFeed({ isError: true, refetch });
    render(<CalendarSubscribeCard />);
    await openCard();

    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
