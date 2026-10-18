import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({ query: {} as Record<string, unknown> }));

vi.mock("../../../src/hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({ readOnly: false, reason: "ok", message: "" }),
}));

vi.mock("../../../src/hooks/useSiteBuilder", async () => {
  const actual = await vi.importActual<typeof import("../../../src/hooks/useSiteBuilder")>("../../../src/hooks/useSiteBuilder");
  return {
    ...actual,
    useSiteBuilderQuery: () => state.query,
    useSaveSiteBuilder: () => ({ mutateAsync: vi.fn() }),
    usePublishSiteBuilder: () => ({ mutateAsync: vi.fn() }),
  };
});

import { Paginas } from "../../../src/pages/paginas/Paginas";

const catalog = { components: [{ type: "titulo", label: "Título", fields: { text: { type: "text", i18n: true } } }] };

const data = () => ({
  enabled: true,
  revision: 1,
  languages: ["pt", "en"],
  defaultLanguage: "pt",
  catalog,
  manifest: { backgrounds: [{ id: "claro", label: "Claro" }], specials: {} },
  pages: [
    { id: "p1", slug: "", isHome: true, sortOrder: 0, title: { pt: "Início", en: "Home" }, status: "published" },
    { id: "p2", slug: "obras", sortOrder: 1, title: { pt: "Obras", en: "Works" }, status: "draft" },
  ],
  items: {
    p1: [{ id: "i1", kind: "block", blockId: "b1", hidden: false }],
    p2: [{ id: "i2", kind: "block", blockId: "b1", hidden: false }],
  },
  blocks: [
    { id: "b1", name: "Herói", folderId: null, sortOrder: 0, layout: 1, bg: "claro", anchor: null, comps: [] },
    { id: "b2", name: "Contactos", folderId: "f1", sortOrder: 0, layout: 1, bg: "claro", anchor: null, comps: [] },
  ],
  folders: [{ id: "f1", name: "Rodapés", sortOrder: 0 }, { id: "f2", name: "Vazia", sortOrder: 1 }],
  parts: { topo: null, rodape: null },
  redirects: [],
  publish: { mode: "coolify", status: "live", liveRevision: 1, requestedAt: null, error: null },
  limits: {},
});

function renderPage(d: unknown = data()) {
  state.query = { isPending: false, isError: false, data: d, refetch: vi.fn(async () => ({ data: d })) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Paginas />
    </QueryClientProvider>,
  );
}

const nav = () => screen.getByRole("navigation", { name: "Páginas do site" });
const names = () => within(nav()).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");

describe("Paginas · lista lateral", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("os três grupos, as páginas com selo e os blocos com pastas", () => {
    renderPage();
    for (const g of ["Páginas", "Blocos", "Partes comuns"]) expect(within(nav()).getByText(g)).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: "Início" })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByText("Rascunho")).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: "Rodapés" })).toBeInTheDocument(); // o nome da pasta
    expect(within(nav()).getByRole("button", { name: "Contactos" })).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: "Topo" })).toBeInTheDocument();
    expect(within(nav()).getByText("Sem pasta")).toBeInTheDocument();
  });

  it("nenhum botão tem 'páginas' no nome (o item da sidebar continua a ser o único)", () => {
    renderPage();
    expect(screen.queryAllByRole("button", { name: "Páginas" })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /páginas/i })).toHaveLength(0);
    // e os nomes das linhas não levam o pormenor (caminho, uso) — só o título
    expect(screen.getByRole("button", { name: "Obras" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Obras" })).toHaveLength(1);
  });

  it("'Nova' cria uma página de primeiro nível com os blocos comuns, abre-a e o desfazer tira-a", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Nova página" }));
    const nova = within(nav()).getByRole("button", { name: "Nova página", description: /\/nova-pagina/ });
    expect(nova).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Nova página" })).toBeInTheDocument();
    expect(screen.getByText(/1 bloco/)).toBeInTheDocument(); // o Herói, que está em todas
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(within(nav()).queryByText("/nova-pagina")).not.toBeInTheDocument();
  });

  it("'+' numa linha cria a subpágina dentro dela (vazia); a home não tem '+'", () => {
    renderPage();
    expect(within(nav()).getAllByRole("button", { name: "Criar subpágina" })).toHaveLength(1); // só a Obras
    fireEvent.click(within(nav()).getByRole("button", { name: "Criar subpágina" }));
    expect(within(nav()).getByText("/obras/nova-pagina")).toBeInTheDocument();
    expect(screen.getByText(/0 blocos/)).toBeInTheDocument();
    // a mãe ganha a seta de abrir/fechar, que esconde a filha
    fireEvent.click(within(nav()).getByRole("button", { name: "Abrir ou fechar o ramo" }));
    expect(within(nav()).queryByText("/obras/nova-pagina")).not.toBeInTheDocument();
  });

  it("pasta nova: nasce com o nome em edição, Enter grava, Esc cancela", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Nova pasta" }));
    const input = within(nav()).getByRole("textbox", { name: "Nome da pasta" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "Heróis" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(within(nav()).getByRole("button", { name: "Heróis" })).toBeInTheDocument();
    // renomear clicando; Esc deixa como estava
    fireEvent.click(within(nav()).getByRole("button", { name: "Heróis" }));
    const again = within(nav()).getByRole("textbox", { name: "Nome da pasta" });
    fireEvent.change(again, { target: { value: "Outro" } });
    fireEvent.keyDown(again, { key: "Escape" });
    expect(within(nav()).getByRole("button", { name: "Heróis" })).toBeInTheDocument();
    expect(within(nav()).queryByRole("button", { name: "Outro" })).not.toBeInTheDocument();
  });

  it("apagar pasta: desligado com blocos lá dentro, funciona na vazia e desfaz-se", () => {
    renderPage();
    const del = within(nav()).getAllByRole("button", { name: "Apagar pasta" });
    expect(del).toHaveLength(2);
    expect(del[0]).toBeDisabled(); // Rodapés tem o Contactos
    expect(del[1]).toBeEnabled(); // Vazia
    fireEvent.click(del[1]);
    expect(within(nav()).queryByRole("button", { name: "Vazia" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(within(nav()).getByRole("button", { name: "Vazia" })).toBeInTheDocument();
  });

  it("pesquisa por nome mostra só blocos; 'Novo' bloco abre a paleta", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Novo bloco" }));
    expect(screen.getByRole("dialog", { name: "Novo bloco" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Procurar bloco" }), { target: { value: "cont" } });
    expect(within(nav()).getByRole("button", { name: "Contactos" })).toBeInTheDocument();
    expect(within(nav()).queryByRole("button", { name: "Herói" })).not.toBeInTheDocument();
    expect(within(nav()).queryByRole("button", { name: "Rodapés" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Procurar bloco" }), { target: { value: "zzz" } });
    expect(within(nav()).getByText("Nenhum bloco com esse nome.")).toBeInTheDocument();
  });

  it("escolher um bloco ou uma parte comum mostra-o no centro", () => {
    renderPage();
    fireEvent.click(within(nav()).getByRole("button", { name: "Contactos" }));
    expect(screen.getByRole("heading", { name: "Contactos" })).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: "Contactos" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(within(nav()).getByRole("button", { name: "Rodapé" }));
    expect(screen.getByRole("heading", { name: "Rodapé" })).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: "Início" })).not.toHaveAttribute("aria-current");
  });

  it("grupos: fechar guarda no localStorage e volta a abrir assim", () => {
    const first = renderPage();
    const toggles = () => within(nav()).getAllByRole("button", { name: "Abrir ou fechar" });
    expect(toggles()).toHaveLength(3);
    fireEvent.click(toggles()[1]); // Blocos
    expect(within(nav()).queryByRole("textbox", { name: "Procurar bloco" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("bo.paginas.lista.v1")!).closed).toEqual(["blocks"]);
    first.unmount();
    renderPage();
    expect(within(nav()).queryByRole("textbox", { name: "Procurar bloco" })).not.toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: "Início" })).toBeInTheDocument();
  });

  it("sem localStorage a lista funciona na mesma", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("cheio"); });
    renderPage();
    fireEvent.click(within(nav()).getAllByRole("button", { name: "Abrir ou fechar" })[2]);
    expect(within(nav()).queryByText("Sem pasta")).toBeInTheDocument();
    expect(names().length).toBeGreaterThan(5);
  });

  it("traduções em falta: bolinha no grupo, na página e na pasta do bloco", () => {
    const d = data();
    d.catalog = { components: [{ type: "titulo", label: "Título", fields: { text: { type: "text", i18n: true } } }] };
    d.pages = [{ ...d.pages[0], title: { pt: "Início" } }, d.pages[1]] as never;
    d.blocks = [{ ...d.blocks[0] }, { ...d.blocks[1], comps: [{ id: "c1", type: "titulo", col: 1, style: null, v: { text: { pt: "Olá" } } }] }] as never;
    renderPage(d);
    const dots = within(nav()).getAllByRole("img", { name: "Falta traduzir" });
    // grupo Páginas, a página Início, grupo Blocos, a pasta Rodapés e o bloco Contactos
    expect(dots).toHaveLength(5);
  });
});
