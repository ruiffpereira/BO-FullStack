import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SiteAnalyticsResponse } from "../../src/hooks/useSiteAnalytics";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// A página Estatísticas tem 3 estados conduzidos por useSiteAnalytics:
//  1) configured:false reason:"no-analytics-site" → empty state "ainda não disponíveis"
//  2) configured:false reason:"no-domain"          → formulário de domínio
//  3) configured:true                               → KPIs + gráficos (+ snippet se `tracking`)
// Mockamos o módulo de hooks para controlar cada estado de forma isolada.

const useSiteAnalyticsMock = vi.fn();
const useSetSiteDomainMock = vi.fn(() => ({ mutate: vi.fn(), isPending: false }));

vi.mock("../../src/hooks/useSiteAnalytics", () => ({
  useSiteAnalytics: (...args: unknown[]) => useSiteAnalyticsMock(...args),
  useSetSiteDomain: () => useSetSiteDomainMock(),
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
  useSetSiteDomainMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe("Estatisticas — estado não configurado (no-analytics-site)", () => {
  it("mostra o empty state 'ainda não disponíveis' e não o formulário de domínio", () => {
    mockAnalytics({ configured: false, reason: "no-analytics-site" });
    render(<Estatisticas />);

    expect(
      screen.getByText("Estatísticas ainda não disponíveis"),
    ).toBeInTheDocument();
    // Não pede o domínio neste estado
    expect(
      screen.queryByText("Define o domínio do teu site"),
    ).not.toBeInTheDocument();
    // E não mostra KPIs
    expect(screen.queryByText("Visitantes")).not.toBeInTheDocument();
  });
});

describe("Estatisticas — estado sem domínio (no-domain)", () => {
  it("mostra o formulário de domínio com o input", () => {
    mockAnalytics({ configured: false, reason: "no-domain" });
    render(<Estatisticas />);

    expect(screen.getByText("Define o domínio do teu site")).toBeInTheDocument();
    // Input do domínio presente (placeholder "exemplo.pt")
    expect(screen.getByPlaceholderText("exemplo.pt")).toBeInTheDocument();
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
    expect(
      screen.queryByText("Define o domínio do teu site"),
    ).not.toBeInTheDocument();
  });
});

describe("Estatisticas — snippet de tracking (sites fora da plataforma)", () => {
  it("mostra o snippet copiável quando a API devolve `tracking`", () => {
    mockAnalytics({
      configured: true,
      domain: "tifas.pt",
      period: "30d",
      aggregate: {},
      timeseries: [],
      topPages: [],
      sources: [],
      tracking: { websiteId: "abc-123", src: "https://umami.rufvision.com/script.js" },
    });
    render(<Estatisticas />);

    expect(screen.getByText("Site fora da plataforma?")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        '<script defer src="https://umami.rufvision.com/script.js" data-website-id="abc-123"></script>',
      ),
    ).toBeInTheDocument();
  });

  // É o caso de um site DO ENGINE: desde 2026-09-22 a API omite `tracking`
  // para quem já recebe o script injectado pelo renderer.
  it("NÃO mostra o snippet quando a API não devolve `tracking`", () => {
    mockAnalytics({
      configured: true,
      domain: "exemplo.pt",
      period: "30d",
      aggregate: {},
      timeseries: [],
      topPages: [],
      sources: [],
    });
    render(<Estatisticas />);

    expect(screen.queryByText("Site fora da plataforma?")).not.toBeInTheDocument();
  });
});
