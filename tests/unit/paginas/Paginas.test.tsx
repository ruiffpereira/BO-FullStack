import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  save: vi.fn(),
}));

vi.mock("../../../src/hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({ readOnly: false, reason: "ok", message: "" }),
}));

vi.mock("../../../src/hooks/useSiteBuilder", async () => {
  const actual = await vi.importActual<typeof import("../../../src/hooks/useSiteBuilder")>("../../../src/hooks/useSiteBuilder");
  return {
    ...actual,
    useSiteBuilderQuery: () => state.query,
    useSaveSiteBuilder: () => ({ mutateAsync: state.save }),
    usePublishSiteBuilder: () => ({ mutateAsync: vi.fn() }),
  };
});

import { Paginas } from "../../../src/pages/paginas/Paginas";
import { BuilderProvider, useBuilder } from "../../../src/pages/paginas/state/store";

const catalog = {
  components: [{ type: "titulo", label: "Título", fields: { text: { type: "text", i18n: true } } }],
};

const data = (over: Record<string, unknown> = {}) => ({
  enabled: true,
  revision: 4,
  languages: ["pt", "en"],
  defaultLanguage: "pt",
  catalog,
  manifest: { backgrounds: [{ id: "claro", label: "Claro" }], specials: {} },
  pages: [
    { id: "p1", slug: "", isHome: true, sortOrder: 0, title: { pt: "Início", en: "Home" }, status: "published" },
    { id: "p2", slug: "obras", sortOrder: 1, title: { pt: "Obras", en: "Works" }, status: "draft" },
  ],
  items: { p1: [], p2: [] },
  blocks: [],
  folders: [],
  parts: { topo: null, rodape: null },
  redirects: [],
  publish: { mode: "coolify", status: "live", liveRevision: 4, requestedAt: null, error: null },
  limits: {},
  ...over,
});

function setQuery(d: unknown, extra: Record<string, unknown> = {}) {
  state.query = { isPending: false, isError: false, data: d, refetch: vi.fn(async () => ({ data: d })), ...extra };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Paginas />
    </QueryClientProvider>,
  );
}

describe("Paginas", () => {
  beforeEach(() => {
    state.save.mockReset();
  });

  it("construtor desligado: estado vazio, sem barra de topo", () => {
    setQuery({ enabled: false });
    renderPage();
    expect(screen.getByText("O construtor de páginas ainda não está ativo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });

  it("sem fundos no manifest: avisa que o site não está configurado e desliga os blocos", () => {
    setQuery(data({ manifest: { backgrounds: [], specials: {} } }));
    renderPage();
    expect(screen.getByText(/ainda não está configurado para o construtor/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo bloco" })).toBeDisabled();
    // As páginas continuam a poder criar-se.
    expect(screen.getByRole("navigation", { name: "Páginas do site" })).toBeInTheDocument();
  });

  it("com fundos no manifest: sem aviso", () => {
    setQuery(data());
    renderPage();
    expect(screen.queryByText(/ainda não está configurado/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo bloco" })).toBeEnabled();
  });

  it("carregado: lista de páginas, barra de topo e Guardar desligado sem alterações", () => {
    setQuery(data());
    renderPage();
    expect(screen.getByRole("navigation", { name: "Páginas do site" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Início" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refazer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByText("No ar")).toBeInTheDocument();
    expect(screen.queryByText(/por traduzir/)).not.toBeInTheDocument();
  });

  it("escolher outra página mostra-a no centro", () => {
    setQuery(data());
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Obras" }));
    expect(screen.getByRole("heading", { name: "Obras" })).toBeInTheDocument();
    // o selo aparece no centro e na linha da lista
    expect(screen.getAllByText("Rascunho")).toHaveLength(2);
  });

  it("traduções em falta: chip 'N por traduzir', Guardar bloqueado", () => {
    setQuery(data({ pages: [{ id: "p1", slug: "", isHome: true, sortOrder: 0, title: { pt: "Início" }, status: "draft" }], items: { p1: [] } }));
    renderPage();
    expect(screen.getByText(/1 por traduzir/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /por traduzir/ }));
    expect(screen.getByRole("heading", { name: "Início" })).toBeInTheDocument();
  });

});

// A ligação do provider à API: edit → save → 409 / 422 / sucesso (o desenho do editor vem depois).
function Harness() {
  const b = useBuilder();
  return (
    <div>
      <button onClick={() => b.edit((w) => ({ ...w, folders: [...w.folders, { id: "f9", name: "Nova", sortOrder: 0 }] }))}>editar</button>
      <button onClick={() => void b.save()}>gravar</button>
      <span data-testid="status">{b.state.status}</span>
      <span data-testid="dirty">{String(b.dirty)}</span>
      <span data-testid="rev">{b.state.revision}</span>
      <span data-testid="issues">{b.state.issues.length}</span>
    </div>
  );
}

function renderHarness(d: ReturnType<typeof data>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BuilderProvider data={d as never} refetch={async () => d as never}>
        <Harness />
      </BuilderProvider>
    </QueryClientProvider>,
  );
}

describe("BuilderProvider · gravar", () => {
  beforeEach(() => { state.save.mockReset(); });

  it("sem alterações não chama a API", () => {
    renderHarness(data());
    fireEvent.click(screen.getByText("gravar"));
    expect(state.save).not.toHaveBeenCalled();
  });

  it("manda o changeset mínimo com a baseRevision e, no sucesso, assume a revisão nova", async () => {
    state.save.mockResolvedValue({ revision: 5, redirectsAdded: [] });
    renderHarness(data());
    fireEvent.click(screen.getByText("editar"));
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
    fireEvent.click(screen.getByText("gravar"));
    await waitFor(() => expect(screen.getByTestId("rev")).toHaveTextContent("5"));
    expect(state.save).toHaveBeenCalledWith({
      data: { baseRevision: 4, folders: { upsert: [{ id: "f9", name: "Nova", sortOrder: 0 }] } },
    });
    expect(screen.getByTestId("dirty")).toHaveTextContent("false");
  });

  it("409 REVISION_CONFLICT: o trabalho fica (dirty) até a cliente escolher", async () => {
    state.save.mockImplementation(async () => { throw { response: { status: 409, data: { code: "REVISION_CONFLICT", revision: 9 } } }; });
    renderHarness(data());
    fireEvent.click(screen.getByText("editar"));
    fireEvent.click(screen.getByText("gravar"));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("conflict"));
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
  });

  it("422 VALIDATION: guarda os issues", async () => {
    const issues = [{ code: "BAD_SLUG", entity: "page", id: "p2", path: "slug", message: "Endereço inválido." }];
    state.save.mockImplementation(async () => { throw { response: { status: 422, data: { code: "VALIDATION", issues } } }; });
    renderHarness(data());
    fireEvent.click(screen.getByText("editar"));
    fireEvent.click(screen.getByText("gravar"));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("invalid"));
    expect(screen.getByTestId("issues")).toHaveTextContent("1");
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
  });

  it("faltam traduções: bloqueia o save sem chamar a API", () => {
    renderHarness(data({ pages: [{ id: "p1", slug: "", isHome: true, sortOrder: 0, title: { pt: "Início" }, status: "draft" }], items: { p1: [] } }));
    fireEvent.click(screen.getByText("editar"));
    fireEvent.click(screen.getByText("gravar"));
    expect(state.save).not.toHaveBeenCalled();
  });
});
