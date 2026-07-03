import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// O BillingBanner (faixa no topo do Shell) é conduzido pelo estado da subscrição
// da plataforma (useGetBillingSubscription). Mockamos o hook para exercitar cada
// estado de forma isolada — como o Faturacao.test.tsx / Estatisticas.test.tsx.
// O banner usa useLocation/<Link> → envolvemos em <MemoryRouter>.

const useBillingMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => useBillingMock(),
}));

import { BillingBanner } from "../../src/components/BillingBanner";

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
const iso = (days: number) => new Date(Date.now() + days * 864e5).toISOString();

function mockBilling(data: Sub | undefined, opts: { isLoading?: boolean } = {}) {
  useBillingMock.mockReturnValue({ data, isLoading: opts.isLoading ?? false });
}

function renderBanner(path = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BillingBanner />
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
});

describe("BillingBanner — estados que exigem ação (visível)", () => {
  it("grace: mostra aviso âmbar (role=status) com a data limite + link", () => {
    mockBilling(sub({ status: "past_due", reason: "grace", graceEndsAt: iso(5) }));
    renderBanner();

    const bar = screen.getByRole("status");
    expect(bar).toHaveTextContent(/Pagamento em atraso/i);
    expect(bar).toHaveTextContent(/regulariza até/i);
    // Link para a página de faturação
    expect(screen.getByRole("link", { name: /ver faturação/i })).toBeInTheDocument();
    // Grace NÃO é dispensável
    expect(screen.queryByRole("button", { name: /dispensar/i })).not.toBeInTheDocument();
  });

  it("past_due_locked: mostra alerta vermelho (role=alert) de acesso limitado", () => {
    mockBilling(sub({ status: "past_due", reason: "past_due_locked", readOnly: true }));
    renderBanner();

    const bar = screen.getByRole("alert");
    expect(bar).toHaveTextContent(/Acesso limitado a leitura/i);
    expect(screen.queryByRole("button", { name: /dispensar/i })).not.toBeInTheDocument();
  });

  it("canceled: mostra alerta vermelho (role=alert)", () => {
    mockBilling(sub({ status: "canceled", reason: "canceled", readOnly: true }));
    renderBanner();

    expect(screen.getByRole("alert")).toHaveTextContent(/Acesso limitado a leitura/i);
  });

  it("trial a acabar (≤3 dias): mostra info (role=status) dispensável", () => {
    mockBilling(sub({ status: "trialing", reason: "trialing", trialEnd: iso(2) }));
    renderBanner();

    const bar = screen.getByRole("status");
    expect(bar).toHaveTextContent(/período de teste termina/i);
    // Info É dispensável
    expect(screen.getByRole("button", { name: /dispensar/i })).toBeInTheDocument();
  });

  it("trial_expired (self-serve, T9): alerta vermelho com link extra para o suporte", () => {
    mockBilling(sub({ status: "trialing", reason: "trial_expired" }));
    renderBanner();

    const bar = screen.getByRole("alert");
    expect(bar).toHaveTextContent(/período experimental terminou/i);
    expect(bar).toHaveTextContent(/fala connosco/i);
    // Dois links: falar com o suporte (/mensagens) + ver faturação (/faturacao)
    expect(screen.getByRole("link", { name: /falar com o suporte/i })).toHaveAttribute("href", "/mensagens");
    expect(screen.getByRole("link", { name: /ver faturação/i })).toHaveAttribute("href", "/faturacao");
    // Não é dispensável (como os outros alertas vermelhos)
    expect(screen.queryByRole("button", { name: /dispensar/i })).not.toBeInTheDocument();
  });
});

describe("BillingBanner — estados calmos (invisível)", () => {
  it("active: sem banner", () => {
    mockBilling(sub({ status: "active", reason: "active" }));
    renderBanner();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("none: sem banner", () => {
    mockBilling(sub({ status: "none", reason: "none", modules: [], monthlyTotalEur: 0 }));
    renderBanner();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("incomplete: sem banner (o aviso vive na página, não na faixa)", () => {
    mockBilling(sub({ status: "incomplete", reason: "incomplete" }));
    renderBanner();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("trial ainda longe (>3 dias): sem banner", () => {
    mockBilling(sub({ status: "trialing", reason: "trialing", trialEnd: iso(10) }));
    renderBanner();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("enquanto carrega: sem banner", () => {
    mockBilling(undefined, { isLoading: true });
    renderBanner();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("BillingBanner — não aparece na própria página de faturação", () => {
  it("grace em /faturacao: sem banner (evita redundância)", () => {
    mockBilling(sub({ status: "past_due", reason: "grace", graceEndsAt: iso(5) }));
    renderBanner("/faturacao");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("BillingBanner — dispensar o trial persiste por período", () => {
  it("clicar dispensar esconde o banner e grava em localStorage", () => {
    const trialEnd = iso(2);
    mockBilling(sub({ status: "trialing", reason: "trialing", trialEnd }));
    renderBanner();

    // Visível
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dispensar/i }));

    // Desaparece + persiste o período dispensado
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("billing.banner.trialDismissedFor")).toBe(trialEnd);
  });

  it("ao re-montar com o mesmo período já dispensado, o banner não volta", () => {
    const trialEnd = iso(2);
    window.localStorage.setItem("billing.banner.trialDismissedFor", trialEnd);
    mockBilling(sub({ status: "trialing", reason: "trialing", trialEnd }));
    renderBanner();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
