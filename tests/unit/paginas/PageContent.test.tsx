import { beforeEach, describe, expect, it, vi } from "vitest";
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

const catalog = {
  components: [
    { type: "titulo", label: "Título", fields: { text: { type: "text", i18n: true }, level: { type: "choice", default: "h2" } } },
    { type: "texto", label: "Texto", fields: { body: { type: "md", i18n: true } } },
  ],
  starters: [
    { id: "branco", label: "Em branco", layout: 1, comps: [] },
    { id: "titulo-texto", label: "Título e texto", layout: 1, comps: [{ type: "titulo", col: "all" }, { type: "texto", col: "all" }] },
  ],
};

const data = (specials: Record<string, unknown> = {}) => ({
  enabled: true,
  revision: 1,
  languages: ["pt", "en"],
  defaultLanguage: "pt",
  catalog,
  manifest: { backgrounds: [{ id: "claro", label: "Claro" }], specials },
  pages: [
    { id: "p1", slug: "", isHome: true, sortOrder: 0, title: { pt: "Início", en: "Home" }, status: "published" },
    { id: "p2", slug: "obras", sortOrder: 1, title: { pt: "Obras", en: "Works" }, status: "draft" },
  ],
  items: {
    p1: [
      { id: "i1", kind: "block", blockId: "b1", hidden: false },
      { id: "i2", kind: "block", blockId: "b2", hidden: false },
    ],
    p2: [{ id: "i3", kind: "block", blockId: "b1", hidden: false }],
  },
  blocks: [
    { id: "b1", name: "Herói", folderId: null, sortOrder: 0, layout: 1, bg: "claro", anchor: null, comps: [{ id: "c1", type: "titulo", style: "normal", col: "all", v: { text: { pt: "Olá", en: "Hi" } } }] },
    { id: "b2", name: "Contactos", folderId: null, sortOrder: 1, layout: 1, bg: "claro", anchor: null, comps: [] },
    { id: "b3", name: "Equipa", folderId: null, sortOrder: 2, layout: 1, bg: "claro", anchor: null, comps: [] },
  ],
  folders: [],
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

const cards = () => screen.getAllByRole("button", { name: /^Editar / }).map((b) => b.getAttribute("aria-label"));
const menuOf = (name: string) => fireEvent.click(screen.getByRole("button", { name: `Mais opções de ${name}` }));
const sideNav = () => screen.getByRole("navigation", { name: "Páginas do site" });

describe("Paginas · conteúdo da página", () => {
  beforeEach(() => window.localStorage.clear());

  it("cabeçalho, separadores, Topo e Rodapé trancados e os itens com selos", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Conteúdo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Definições e SEO" })).toBeInTheDocument();
    expect(cards()).toEqual(["Editar topo do site", "Editar Herói", "Editar Contactos", "Editar rodapé do site"]);
    expect(screen.getByText("Partilhado em 2")).toBeInTheDocument(); // o Herói está em duas páginas
    expect(screen.getByText(/2 blocos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^SEO \d+$/ }));
    expect(screen.getByRole("tab", { name: "Definições e SEO" })).toHaveAttribute("aria-selected", "true");
  });

  it("menu: a cópia só nesta página só aparece num bloco partilhado; Duplicar põe a cópia logo a seguir", () => {
    renderPage();
    menuOf("Contactos");
    expect(screen.queryByRole("menuitem", { name: "Usar uma cópia só nesta página" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicar" }));
    expect(cards()).toEqual(["Editar topo do site", "Editar Herói", "Editar Contactos", "Editar Contactos (cópia)", "Editar rodapé do site"]);
    menuOf("Herói");
    fireEvent.click(screen.getByRole("menuitem", { name: "Usar uma cópia só nesta página" }));
    expect(screen.getByRole("button", { name: "Editar Herói (cópia)" })).toBeInTheDocument();
    expect(screen.queryByText("Partilhado em 2")).not.toBeInTheDocument();
  });

  it("esconder mostra o selo e muda o menu para Mostrar", () => {
    renderPage();
    menuOf("Contactos");
    fireEvent.click(screen.getByRole("menuitem", { name: "Esconder nesta página" }));
    expect(screen.getByText("Escondido aqui")).toBeInTheDocument();
    menuOf("Contactos");
    expect(screen.getByRole("menuitem", { name: "Mostrar nesta página" })).toBeInTheDocument();
  });

  it("retirar pede confirmação, o bloco fica na biblioteca e o desfazer repõe", () => {
    renderPage();
    menuOf("Contactos");
    fireEvent.click(screen.getByRole("menuitem", { name: "Retirar desta página" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/continua guardado em Blocos/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Editar Contactos" })).toBeInTheDocument();
    menuOf("Contactos");
    fireEvent.click(screen.getByRole("menuitem", { name: "Retirar desta página" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Retirar" }));
    expect(screen.queryByRole("button", { name: "Editar Contactos" })).not.toBeInTheDocument();
    expect(within(sideNav()).getByRole("button", { name: "Contactos" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(screen.getByRole("button", { name: "Editar Contactos" })).toBeInTheDocument();
  });

  it("＋ entre itens abre a paleta e Usar um que já existe insere nessa posição, partilhado", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar bloco aqui" })[1]); // entre Herói e Contactos
    const dialog = screen.getByRole("dialog", { name: "Adicionar bloco a «Início»" });
    expect(within(dialog).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Bloco novo", "Usar um que já existe", "Copiar um que já existe"]); // sem especiais no manifest
    fireEvent.click(within(dialog).getByRole("tab", { name: "Usar um que já existe" }));
    expect(within(dialog).queryByRole("button", { name: /Herói/ })).not.toBeInTheDocument(); // já está nesta página
    fireEvent.click(within(dialog).getByRole("button", { name: /Equipa/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cards()).toEqual(["Editar topo do site", "Editar Herói", "Editar Equipa", "Editar Contactos", "Editar rodapé do site"]);
  });

  it("Adicionar bloco no fim com um ponto de partida cria um bloco novo na biblioteca e na página", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar bloco" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Título e texto/ }));
    expect(cards().at(-2)).toBe("Editar Título e texto");
    expect(within(sideNav()).getByRole("button", { name: "Título e texto" })).toBeInTheDocument();
  });

  it("especiais: o separador só aparece com especiais no manifest", () => {
    renderPage(data({ faixa: { label: "Faixa a passar", desc: "Nomes em contínuo", fields: {} } }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar bloco" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: "Especiais deste site" }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Faixa a passar/ }));
    expect(cards().at(-2)).toBe("Editar Faixa a passar");
    expect(screen.getByText("Especial")).toBeInTheDocument();
  });

  it("clicar num bloco abre o editor do bloco e Voltar à página regressa", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Editar Herói" }));
    expect(screen.getByRole("heading", { name: "Herói" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Voltar à página/ }));
    expect(screen.getByRole("button", { name: "Editar Herói" })).toBeInTheDocument();
  });
});
