import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({ query: {} as Record<string, unknown> }));

vi.mock("../../../src/hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({ readOnly: false, reason: "ok", message: "" }),
}));
vi.mock("../../../src/context/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/context/AuthContext")>()),
  useAuth: () => ({ username: "Winterplateau" }),
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
    { type: "faq", label: "Perguntas", fields: { items: { type: "list", of: { q: { type: "text", i18n: true } } } } },
    { type: "botao", label: "Botão", fields: { label: { type: "text", i18n: true }, dest: { type: "dest" } } },
  ],
};

const comp = (id: string, type: string, v: unknown) => ({ id, type, style: "normal", col: "all", v });

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
    { id: "p3", slug: "braga", parentId: "p2", sortOrder: 0, title: { pt: "Braga", en: "Braga" }, status: "draft" },
    { id: "p4", slug: "contactos", sortOrder: 2, title: { pt: "Contactos", en: "Contacts" }, status: "draft" },
  ],
  items: {
    p1: [{ id: "i1", kind: "block", blockId: "b1", hidden: false }],
    p2: [], p3: [], p4: [],
  },
  blocks: [
    {
      id: "b1", name: "Herói", folderId: null, sortOrder: 0, layout: 1, bg: "claro", anchor: null,
      comps: [
        comp("c1", "titulo", { text: { pt: "Olá", en: "Hi" }, level: "h1" }),
        comp("c2", "faq", { items: [{ _id: "r1", q: { pt: "Quanto custa?", en: "How much?" } }, { _id: "r2", q: { pt: "Onde fica?" } }] }),
        comp("c3", "botao", { label: { pt: "Ver", en: "See" }, dest: { kind: "page", pageId: "p4" } }),
      ],
    },
  ],
  folders: [],
  parts: { topo: null, rodape: null },
  redirects: [{ fromPath: "/obra-antiga", pageId: "p2" }],
  publish: { mode: "coolify", status: "live", liveRevision: 1, requestedAt: null, error: null },
  limits: {},
});

function renderPage(d: unknown = data()) {
  state.query = { isPending: false, isError: false, data: d, refetch: vi.fn(async () => ({ data: d })) };
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Paginas />
    </QueryClientProvider>,
  );
}

const sideNav = () => screen.getByRole("navigation", { name: "Páginas do site" });
const goPage = (name: string) => fireEvent.click(within(sideNav()).getByRole("button", { name: new RegExp(`^${name}`) }));
const openSettings = () => fireEvent.click(screen.getByRole("tab", { name: "Definições e SEO" }));

describe("Paginas · Definições e SEO", () => {
  beforeEach(() => window.localStorage.clear());

  it("mostra o nome, o endereço com o prefixo da mãe, o estado e a pré-visualização com o nome do site", () => {
    renderPage();
    goPage("Braga");
    openSettings();
    expect(screen.getByRole("textbox", { name: "Endereço" })).toHaveValue("braga");
    expect(screen.getByText("/obras/")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Endereço em EN" })).toHaveAttribute("placeholder", "braga");
    expect(screen.getByRole("button", { name: "Rascunho" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("serp")).toHaveTextContent("Braga · Winterplateau");
    expect(screen.getByTestId("serp")).toHaveTextContent("obras › braga");
    expect(screen.getByText(/Título \d+\/60/)).toBeInTheDocument();
    expect(screen.getByText(/Descrição 0\/160/)).toBeInTheDocument();
  });

  it("escrever actualiza a pré-visualização, a pontuação e o selo SEM perder o foco", () => {
    renderPage();
    goPage("Contactos");
    openSettings();
    const box = screen.getByRole("textbox", { name: "Descrição no Google (PT)" });
    box.focus();
    const before = within(screen.getByRole("status", { name: /Pontuação de SEO/ })).getByText(/^\d+$/).textContent;
    fireEvent.change(box, { target: { value: "d".repeat(100) } });
    const same = screen.getByRole("textbox", { name: "Descrição no Google (PT)" });
    expect(same).toBe(box); // a mesma caixa: não foi re-montada
    expect(document.activeElement).toBe(box);
    expect(screen.getByText(/Descrição 100\/160/)).toBeInTheDocument();
    expect(screen.getByText(/Descrição com 100 caracteres/)).toBeInTheDocument();
    expect(within(screen.getByRole("status", { name: /Pontuação de SEO/ })).getByText(/^\d+$/).textContent).not.toBe(before);
  });

  it("mudar o endereço avisa que o antigo continua a funcionar; os antigos do servidor só se leem", () => {
    renderPage();
    goPage("Obras");
    openSettings();
    const old = screen.getByText("/obra-antiga");
    expect(old.closest("li")!.querySelector("button")).toBeNull(); // sem «remover»: a API gere-os
    expect(screen.queryByText(/vai continuar a funcionar/)).toBeNull();
    const slug = screen.getByRole("textbox", { name: "Endereço" });
    fireEvent.change(slug, { target: { value: "projectos" } });
    expect(screen.getByRole("textbox", { name: "Endereço" })).toBe(slug);
    const note = screen.getByText(/O endereço antigo vai continuar a funcionar/);
    expect(note).toHaveTextContent("/obras → /projectos");
    expect(note).toHaveTextContent("1 subpágina");
  });

  it("o endereço normaliza-se ao escrever e tira o '-' do fim ao sair", () => {
    renderPage();
    goPage("Contactos");
    openSettings();
    const slug = screen.getByRole("textbox", { name: "Endereço" });
    fireEvent.change(slug, { target: { value: "Fale Connosco " } });
    expect(slug).toHaveValue("fale-connosco-");
    fireEvent.blur(slug);
    expect(slug).toHaveValue("fale-connosco");
  });

  it("endereço repetido avisa no campo", () => {
    renderPage();
    goPage("Contactos");
    openSettings();
    fireEvent.change(screen.getByRole("textbox", { name: "Endereço" }), { target: { value: "obras" } });
    expect(screen.getByText("Já existe outra página com este endereço.")).toBeInTheDocument();
  });

  it("a home não se apaga e não tem endereço editável", () => {
    renderPage();
    openSettings();
    expect(screen.getByRole("textbox", { name: "Endereço" })).toBeDisabled();
    expect(screen.getByText("A página inicial não pode ser apagada.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apagar página" })).toBeNull();
  });

  it("apagar bloqueado: motivos clicáveis que levam lá", () => {
    renderPage();
    goPage("Obras");
    openSettings();
    expect(screen.getByRole("button", { name: "Apagar página" })).toBeDisabled();
    expect(screen.getByText("Esta página não pode ser apagada enquanto:")).toBeInTheDocument();
    const note = screen.getByText("Esta página não pode ser apagada enquanto:").closest("[role=note]") as HTMLElement;
    fireEvent.click(within(note).getByRole("button", { name: "Braga" })); // a subpágina
    expect(screen.getByRole("heading", { name: "Braga" })).toBeInTheDocument();
  });

  it("apagar uma página referenciada por um bloco: bloqueada, e o motivo leva ao bloco", () => {
    renderPage();
    goPage("Contactos");
    openSettings();
    // «Contactos» é o destino do botão do Herói
    expect(screen.getByRole("button", { name: "Apagar página" })).toBeDisabled();
    const note = screen.getByText("Esta página não pode ser apagada enquanto:").closest("[role=note]") as HTMLElement;
    fireEvent.click(within(note).getByRole("button", { name: "Herói" }));
    expect(screen.getByRole("heading", { name: "Herói" })).toBeInTheDocument();
  });

  it("apagar sem motivos: Cancelar não apaga, Apagar apaga e o desfazer repõe", () => {
    const d = data();
    d.blocks[0].comps = d.blocks[0].comps.slice(0, 2);
    renderPage(d);
    goPage("Contactos");
    openSettings();
    fireEvent.click(screen.getByRole("button", { name: "Apagar página" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(within(sideNav()).getByRole("button", { name: /^Contactos/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apagar página" }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
    expect(within(sideNav()).queryByRole("button", { name: /^Contactos/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(within(sideNav()).getByRole("button", { name: /^Contactos/ })).toBeInTheDocument();
  });

  it("«SEO do site» lista as páginas com o 1.º problema, a média e o que o site faz sozinho; clicar abre as definições", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "SEO do site" }));
    const dialog = screen.getByRole("dialog", { name: "SEO do site" });
    expect(within(dialog).getByText(/Média do site: \d+\/100/)).toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem").length).toBeGreaterThan(4);
    expect(within(dialog).getByText("Mapa do site (sitemap.xml) só com as páginas no ar, e instruções para os motores de busca (robots.txt)")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Contactos/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("tab", { name: "Definições e SEO" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Contactos" })).toBeInTheDocument();
  });

  it("o selo SEO do caminho do editor de bloco abre as definições da página", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Editar Herói" }));
    fireEvent.click(screen.getByRole("button", { name: /^SEO \d+$/ }));
    expect(screen.getByRole("tab", { name: "Definições e SEO" })).toHaveAttribute("aria-selected", "true");
  });

  it("Ver onde abre o bloco, o componente e a linha da lista e foca a caixa em falta", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /por traduzir/ }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Pergunta (EN)" }) ?? null));
    expect(screen.getByRole("heading", { name: "Herói" })).toBeInTheDocument();
  });

  it("Ver onde numa página leva às Definições e SEO e foca a caixa da língua", async () => {
    const d = data();
    (d.pages[3] as { seo?: unknown }).seo = { description: { pt: "Falamos consigo." } };
    renderPage(d);
    fireEvent.click(screen.getByRole("button", { name: /por traduzir/ }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Descrição no Google (EN)" })));
    expect(screen.getByRole("tab", { name: "Definições e SEO" })).toHaveAttribute("aria-selected", "true");
  });
});
