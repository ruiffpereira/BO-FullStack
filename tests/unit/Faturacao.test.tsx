import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// A página Faturação mostra o estado da subscrição da plataforma do tenant,
// conduzido pelo hook gerado useGetBillingSubscription. Mockamos o módulo do hook
// para controlar cada estado de forma isolada (sem servidor nem React Query),
// como o Estatisticas.test.tsx faz com useSiteAnalytics.

const useBillingMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => useBillingMock(),
}));

import { Faturacao } from "../../src/pages/Faturacao";

// Objeto BillingSubscription completo (o shape do backend T3). Os testes só
// alteram os campos relevantes por estado.
type Sub = {
  status: string;
  modules: string[];
  trialEnd?: string | null;
  currentPeriodEnd?: string | null;
  cancelAt?: string | null;
  monthlyTotalEur: number;
  readOnly: boolean;
  reason: string;
  graceEndsAt?: string | null;
};

const base: Sub = {
  status: "active",
  modules: ["agenda"],
  trialEnd: null,
  currentPeriodEnd: null,
  cancelAt: null,
  monthlyTotalEur: 15,
  readOnly: false,
  reason: "active",
  graceEndsAt: null,
};
const sub = (p: Partial<Sub>): Sub => ({ ...base, ...p });

function mockBilling(
  data: Sub | undefined,
  opts: { isLoading?: boolean; isError?: boolean } = {},
) {
  useBillingMock.mockReturnValue({
    data,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Faturação — sem subscrição (none)", () => {
  it("mostra um empty state neutro, sem plano nem avisos", () => {
    mockBilling(sub({ status: "none", reason: "none", modules: [], monthlyTotalEur: 0 }));
    render(<Faturacao />);

    expect(screen.getByText("Sem subscrição ativa")).toBeInTheDocument();
    // Nada de plano nem callouts de urgência
    expect(screen.queryByText("O teu plano")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Faturação — período de teste (trialing)", () => {
  it("mostra o fim do trial e o total mensal", () => {
    mockBilling(
      sub({
        status: "trialing",
        reason: "trialing",
        modules: ["agenda"],
        monthlyTotalEur: 15,
        trialEnd: "2026-07-16T12:00:00.000Z",
      }),
    );
    render(<Faturacao />);

    // Badge do estado (cabeçalho)
    expect(screen.getByText("Período de teste")).toBeInTheDocument();
    // Callout com a data de fim do trial (role=status, não alerta)
    expect(screen.getByText(/termina a/)).toBeInTheDocument();
    expect(screen.getByText(/julho de 2026/)).toBeInTheDocument();
    // Total/mês
    expect(screen.getByText(/15,00/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Faturação — ativa (active)", () => {
  it("mostra a próxima renovação, os módulos e o total", () => {
    mockBilling(
      sub({
        status: "active",
        reason: "active",
        modules: ["agenda", "gym"],
        monthlyTotalEur: 45,
        currentPeriodEnd: "2026-08-16T12:00:00.000Z",
      }),
    );
    render(<Faturacao />);

    expect(screen.getByText("Ativa")).toBeInTheDocument();
    expect(screen.getByText(/Próxima renovação/)).toBeInTheDocument();
    expect(screen.getByText(/agosto de 2026/)).toBeInTheDocument();
    // Módulos com labels PT
    expect(screen.getByText("Agenda")).toBeInTheDocument();
    expect(screen.getByText("Ginásio")).toBeInTheDocument();
    expect(screen.getByText(/45,00/)).toBeInTheDocument();
    // CTA do portal (stub T6) presente
    expect(screen.getByRole("button", { name: /gerir pagamento/i })).toBeInTheDocument();
    // Sem avisos de urgência
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Faturação — pagamento em atraso dentro do grace (past_due/grace)", () => {
  it("mostra um aviso âmbar (role=status) com a data limite do grace", () => {
    mockBilling(
      sub({
        status: "past_due",
        reason: "grace",
        modules: ["agenda"],
        monthlyTotalEur: 15,
        graceEndsAt: "2026-07-20T12:00:00.000Z",
      }),
    );
    render(<Faturacao />);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(/Pagamento em atraso/);
    expect(notice).toHaveTextContent(/regulariza até/);
    expect(notice).toHaveTextContent(/julho de 2026/);
    // Aviso âmbar (não vermelho) — cor pela classe de borda do design system
    expect(notice.className).toContain("border-amber");
    expect(notice.className).not.toContain("border-red");
    // Ação de regularizar presente; não é um alerta duro (ainda há grace)
    expect(screen.getByRole("button", { name: /regularizar pagamento/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Faturação — acesso limitado (past_due_locked)", () => {
  it("mostra um alerta vermelho (role=alert) de read-only com ação de regularizar", () => {
    mockBilling(
      sub({
        status: "past_due",
        reason: "past_due_locked",
        modules: ["agenda"],
        monthlyTotalEur: 15,
        readOnly: true,
      }),
    );
    render(<Faturacao />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Acesso limitado a leitura/);
    expect(alert.className).toContain("border-red");
    expect(screen.getByRole("button", { name: /regularizar pagamento/i })).toBeInTheDocument();
    // Badge coerente
    expect(screen.getByText("Acesso limitado")).toBeInTheDocument();
  });
});

describe("Faturação — cancelada (canceled)", () => {
  it("mostra um alerta vermelho de subscrição cancelada / read-only", () => {
    mockBilling(
      sub({
        status: "canceled",
        reason: "canceled",
        modules: ["agenda"],
        monthlyTotalEur: 15,
        readOnly: true,
      }),
    );
    render(<Faturacao />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/cancelada/i);
    expect(alert.className).toContain("border-red");
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
  });
});

describe("Faturação — estados de carregamento e erro", () => {
  it("mostra um skeleton enquanto carrega", () => {
    mockBilling(undefined, { isLoading: true });
    const { container } = render(<Faturacao />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    expect(screen.queryByText("O teu plano")).not.toBeInTheDocument();
  });

  it("mostra uma mensagem amigável em caso de erro", () => {
    mockBilling(undefined, { isError: true });
    render(<Faturacao />);
    expect(
      screen.getByText("Não foi possível carregar a subscrição"),
    ).toBeInTheDocument();
  });
});
