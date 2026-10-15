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
    { type: "titulo", label: "Título", fields: { text: { type: "text", i18n: true }, level: { type: "choice", options: ["h1", "h2"], default: "h2" } } },
    { type: "texto", label: "Texto", fields: { body: { type: "md", i18n: true } } },
    { type: "menu", label: "Menu", fields: {} },
    { type: "imagem", label: "Imagem", fields: {} },
  ],
  parts: { topo: ["menu", "imagem"], rodape: ["texto", "menu"] },
  starters: [{ id: "branco", label: "Em branco", layout: 1, comps: [] }],
};

const comp = (id: string, type: string, col: string | number, v: unknown) => ({ id, type, style: "normal", col, v });

const data = () => ({
  enabled: true,
  revision: 1,
  languages: ["pt", "en"],
  defaultLanguage: "pt",
  catalog,
  manifest: {
    backgrounds: [{ id: "claro", label: "Claro" }, { id: "escuro", label: "Escuro" }],
    styles: { titulo: [{ id: "seccao", label: "Secção" }, { id: "frase", label: "Frase grande" }] },
    parts: { topo: ["menu"] },
    specials: { faixa: { label: "Faixa a passar", desc: "Nomes", fields: { eyebrow: { type: "text", i18n: true } } } },
  },
  pages: [
    { id: "p1", slug: "", isHome: true, sortOrder: 0, title: { pt: "Início", en: "Home" }, status: "published" },
    { id: "p2", slug: "obras", sortOrder: 1, title: { pt: "Obras", en: "Works" }, status: "draft" },
  ],
  items: {
    p1: [
      { id: "i1", kind: "block", blockId: "b1", hidden: false },
      { id: "i2", kind: "special", specialType: "faixa", specialData: { eyebrow: { pt: "Olá", en: "Hi" } }, hidden: false },
      { id: "i3", kind: "block", blockId: "b2", hidden: false },
    ],
    p2: [{ id: "i4", kind: "block", blockId: "b1", hidden: false }],
  },
  blocks: [
    {
      id: "b1", name: "Herói", folderId: null, sortOrder: 0, layout: 3, bg: "claro", anchor: null,
      comps: [comp("c1", "titulo", "all", { text: { pt: "Olá", en: "Hi" }, level: "h2" }), comp("c2", "texto", 2, { body: { pt: "Corpo", en: "Body" } }), comp("c3", "texto", 3, { body: { pt: "Outro", en: "Other" } })],
    },
    { id: "b2", name: "Contactos", folderId: null, sortOrder: 1, layout: 1, bg: "claro", anchor: null, comps: [] },
    { id: "b3", name: "Equipa", folderId: null, sortOrder: 2, layout: 1, bg: "claro", anchor: null, comps: [] },
  ],
  folders: [],
  parts: { topo: null, rodape: null },
  redirects: [],
  publish: { mode: "github", status: "live", liveRevision: 1, requestedAt: null, error: null },
  limits: {},
});

function renderPage() {
  const d = data();
  state.query = { isPending: false, isError: false, data: d, refetch: vi.fn(async () => ({ data: d })) };
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Paginas />
    </QueryClientProvider>,
  );
}

const sideNav = () => screen.getByRole("navigation", { name: "Páginas do site" });
const openItem = (name: string) => fireEvent.click(screen.getByRole("button", { name: `Editar ${name}` }));

describe("Paginas · editor de bloco (F14)", () => {
  beforeEach(() => window.localStorage.clear());

  it("caminho: página › bloco, 'N de M' e anterior/seguinte percorrem os itens da página", () => {
    renderPage();
    openItem("Herói");
    expect(screen.getByRole("button", { name: "Voltar à página Início" })).toBeInTheDocument();
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloco anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Bloco seguinte" }));
    // o 2.º item é um especial: o editor muda e só tem os campos do manifest
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Faixa a passar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bloco seguinte" }));
    expect(screen.getByText("3 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contactos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloco seguinte" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Voltar à página Início" }));
    expect(screen.getByRole("button", { name: "Editar Herói" })).toBeInTheDocument();
  });

  it("aviso de bloco partilhado e disposição: reduzir colunas reposiciona os componentes", () => {
    renderPage();
    openItem("Herói");
    expect(screen.getByRole("note")).toHaveTextContent("Este bloco está em 2 páginas (Início, Obras)");
    // 3 colunas: o texto de c3 está na coluna 3
    expect(screen.getByText("Coluna 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2 colunas" }));
    expect(screen.queryByText("Coluna 3")).not.toBeInTheDocument();
    expect(screen.getAllByText("Coluna 2")).toHaveLength(2);
    expect(screen.getByText("Toda a largura")).toBeInTheDocument();
  });

  it("componente aberto: estilos do manifest, Onde fica, campos; escolher estilo muda o componente", () => {
    renderPage();
    openItem("Herói");
    fireEvent.click(screen.getByRole("button", { name: /^Título/ }));
    expect(screen.getByRole("button", { name: "Frase grande" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Frase grande" }));
    expect(screen.getByRole("button", { name: "Frase grande" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: "Onde fica" })).toBeInTheDocument();
    expect(screen.getByLabelText("Texto (PT)")).toHaveValue("Olá");
    // o selo H2 do título
    expect(screen.getAllByText("H2")).toHaveLength(2); // o selo na linha e a opção no campo
  });

  it("Adicionar componente: o novo traz o valor por omissão (título H2) e abre", () => {
    renderPage();
    openItem("Contactos");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar componente" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Título/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByText("H2")).toHaveLength(2); // o selo na linha e a opção no campo
    expect(screen.getByLabelText("Texto (PT)")).toBeInTheDocument();
  });

  it("Copiar um que já existe: lista os componentes de todos os blocos e copia", () => {
    renderPage();
    openItem("Contactos");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar componente" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: "Copiar um que já existe" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Procurar componente" }), { target: { value: "outro" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Texto/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Texto (PT)")).toHaveValue("Outro");
  });

  it("Topo: a paleta só mostra os componentes permitidos", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Editar topo do site" }));
    expect(screen.getByRole("heading", { name: "Topo" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Fundo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Disposição" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome do bloco")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar secção" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /^Menu/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^Imagem/ })).not.toBeInTheDocument(); // o manifest restringe
    expect(within(dialog).queryByRole("button", { name: /^Título/ })).not.toBeInTheDocument();
  });

  it("especial: só os campos do manifest — sem estilos, componentes nem disposição", () => {
    renderPage();
    openItem("Faixa a passar");
    expect(screen.getByLabelText("Etiqueta (PT)")).toHaveValue("Olá");
    expect(screen.queryByRole("button", { name: /Adicionar (componente|secção)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Disposição" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirar desta página" })).toBeInTheDocument();
  });

  it("vindo de Blocos: 'Onde é usado' e Apagar bloco desactivado enquanto está em uso", () => {
    renderPage();
    fireEvent.click(within(sideNav()).getByRole("button", { name: "Herói" }));
    expect(screen.getByText("Onde é usado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para Obras" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apagar bloco" })).toBeDisabled();
    expect(screen.queryByText(/de \d$/)).not.toBeInTheDocument(); // sem "N de M" nem anterior/seguinte
  });

  it("bloco sem uso: Apagar bloco pede confirmação e apaga", () => {
    renderPage();
    fireEvent.click(within(sideNav()).getByRole("button", { name: "Equipa" }));
    expect(screen.getByText(/Não está em nenhuma página/)).toBeInTheDocument();
    const del = screen.getByRole("button", { name: "Apagar bloco" });
    expect(del).toBeEnabled();
    fireEvent.click(del);
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
    expect(within(sideNav()).queryByRole("button", { name: "Equipa" })).not.toBeInTheDocument();
  });

  it("Retirar desta página (vindo da página) pede confirmação e volta à página", () => {
    renderPage();
    openItem("Contactos");
    fireEvent.click(screen.getByRole("button", { name: "Retirar desta página" }));
    fireEvent.click(screen.getByRole("button", { name: "Retirar" }));
    expect(screen.queryByRole("button", { name: "Editar Contactos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Herói" })).toBeInTheDocument();
  });

  it("desfazer repõe o que o editor mudou", () => {
    renderPage();
    openItem("Contactos");
    fireEvent.click(screen.getByRole("button", { name: "Escuro" }));
    expect(screen.getByRole("button", { name: "Escuro" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(screen.getByRole("button", { name: "Escuro" })).toHaveAttribute("aria-pressed", "false");
  });
});
