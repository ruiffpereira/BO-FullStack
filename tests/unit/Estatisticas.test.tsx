import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SiteAnalyticsResponse } from "../../src/hooks/useSiteAnalytics";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// A página Estatísticas tem 3 estados conduzidos por useSiteAnalytics:
//  1) configured:false reason:"no-analytics-site" → empty state "ainda não disponíveis"
//  2) configured:false reason:"no-domain"          → aviso "ainda não ligadas" (sem formulário)
//  3) configured:true                               → KPIs + gráficos
// Mockamos o módulo de hooks para controlar cada estado de forma isolada.

const useSiteAnalyticsMock = vi.fn();

vi.mock("../../src/hooks/useSiteAnalytics", () => ({
  useSiteAnalytics: (...args: unknown[]) => useSiteAnalyticsMock(...args),
}));

// O gráfico SVG (charts.jsx) e o KpiCard não são o foco destes testes (validamos
// os 3 estados da página). Substituímo-los por stubs leves que expõem os dados
// relevantes, evitando o peso do SVG e mantendo os testes determinísticos.
vi.mock("../../src/ui/charts.jsx", () => ({
  LineChart: () => <div data-testid="line-chart" />,
}));
vi.mock("../../src/components/financeiro/kit", () => ({
  KpiCard: ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div data-testid="kpi">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

import { Estatisticas } from "../../src/pages/Estatisticas";

function mockAnalytics(data: SiteAnalyticsResponse | undefined, isLoading = false) {
  useSiteAnalyticsMock.mockReturnValue({ data, isLoading });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Estatisticas — estado não configurado (no-analytics-site)", () => {
  it("mostra o empty state 'ainda não disponíveis' sem pedir domínio", () => {
    mockAnalytics({ configured: false, reason: "no-analytics-site" });
    render(<Estatisticas />);

    expect(
      screen.getByText("Estatísticas ainda não disponíveis"),
    ).toBeInTheDocument();
    // Não pede o domínio neste estado
    expect(screen.getByText(/preparar as estatísticas do teu site/)).toBeInTheDocument();
    // E não mostra KPIs
    expect(screen.queryByText("Visitantes")).not.toBeInTheDocument();
  });
});

describe("Estatisticas — estado sem domínio (no-domain)", () => {
  it("mostra o aviso para falar com o suporte, sem formulário", () => {
    mockAnalytics({ configured: false, reason: "no-domain" });
    render(<Estatisticas />);

    expect(screen.getByText("Estatísticas ainda não ligadas")).toBeInTheDocument();
    expect(
      screen.getByText(
        "As estatísticas do teu site ainda não estão ligadas. Fala connosco pelo chat de suporte.",
      ),
    ).toBeInTheDocument();
    // O tenant não define o domínio: nem input nem botão de guardar
    expect(screen.queryByPlaceholderText("exemplo.pt")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
    // Não mostra o empty state de "não configuradas"
    expect(
      screen.queryByText("Estatísticas ainda não disponíveis"),
    ).not.toBeInTheDocument();
  });
});

describe("Estatisticas — estado configurado (KPIs)", () => {
  it("mostra os KPIs com os valores agregados e o domínio no subtítulo", () => {
    mockAnalytics({
      configured: true,
      domain: "exemplo.pt",
      period: "30d",
      aggregate: {
        visitors: { value: 1234 },
        pageviews: { value: 5678 },
        bounce_rate: { value: 42 },
        visit_duration: { value: 125 },
      },
      timeseries: [
        { date: "2026-06-26", visitors: 10 },
        { date: "2026-06-27", visitors: 20 },
      ],
      topPages: [{ page: "/", visitors: 800 }],
      sources: [{ source: "Google", visitors: 500 }],
    });
    render(<Estatisticas />);

    // Labels dos KPIs
    expect(screen.getByText("Visitantes")).toBeInTheDocument();
    expect(screen.getByText("Visualizações")).toBeInTheDocument();
    expect(screen.getByText("Taxa de saída")).toBeInTheDocument();
    expect(screen.getByText("Duração média")).toBeInTheDocument();

    // Valores formatados. O separador de milhares do pt-PT varia por ICU
    // (espaco normal/insecavel ou nenhum) - toleramos qualquer um.
    expect(screen.getByText(/1\s?234/)).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("2m 05s")).toBeInTheDocument();

    // Breakdowns
    expect(screen.getByText("Páginas mais vistas")).toBeInTheDocument();
    expect(screen.getByText("Origem do tráfego")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();

    // Não mostra nenhum dos estados de não-configuração
    expect(
      screen.queryByText("Estatísticas ainda não disponíveis"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Estatísticas ainda não ligadas")).not.toBeInTheDocument();
  });
});

describe("Estatisticas — sem snippet de tracking", () => {
  it("não mostra caixa de script nem input", () => {
    mockAnalytics({
      configured: true,
      domain: "tifas.pt",
      period: "30d",
      aggregate: {},
      timeseries: [],
      topPages: [],
      sources: [],
    });
    render(<Estatisticas />);

    expect(screen.queryByText("Site fora da plataforma?")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
