import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Site } from "../../src/hooks/useWebsite";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Hooks de website — controlados por cada teste.
const useSiteMock = vi.fn();
const saveMutate = vi.fn();
const publishMutate = vi.fn();
const setSubdomainMutate = vi.fn();
const checkFn = vi.fn();

// Upload de imagem (hook gerado pelo Kubb) — usado pelo uploader dos campos
// `image` do editor de blocos (T-imagem) e pelo logótipo da Marca.
const { uploadImage } = vi.hoisted(() => ({ uploadImage: vi.fn() }));
vi.mock("../../src/gen/backoffice/hooks/useUploadImage.js", () => ({ uploadImage }));

vi.mock("../../src/hooks/useWebsite", async () => {
  const actual = await vi.importActual<typeof import("../../src/hooks/useWebsite")>(
    "../../src/hooks/useWebsite",
  );
  return {
    ...actual,
    useSite: () => useSiteMock(),
    useSaveSite: () => ({ mutate: saveMutate, isPending: false }),
    usePublishSite: () => ({ mutate: publishMutate, isPending: false }),
    useSetSubdomain: () => ({ mutate: setSubdomainMutate, isPending: false }),
    useCheckSubdomain: () => checkFn,
  };
});

// Templates de arranque (T19) — fonte única na API, consumidos via o hook
// gerado pelo Kubb. Mockamos o módulo para controlar loading/erro/dados sem
// servidor nem React Query (mesmo padrão do Faturacao.test.tsx).
const useWebsiteTemplatesMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetWebsiteTemplates", () => ({
  useGetWebsiteTemplates: () => useWebsiteTemplatesMock(),
}));

// Preview ao vivo (mint de token) — mockado como os outros hooks Kubb (mesmo
// padrão do Faturacao.test.tsx para usePostBillingPortal/usePostBillingSubscribe).
// Capturamos as `options.mutation` passadas pelo componente para conseguirmos
// simular onSuccess/onError diretamente nos testes.
const previewMintMutate = vi.fn();
let previewMintOptions: any;
vi.mock("../../src/gen/backoffice/hooks/usePostWebsitePreviewToken", () => ({
  usePostWebsitePreviewToken: (options: any) => {
    previewMintOptions = options;
    return { mutate: previewMintMutate, isPending: false };
  },
}));

const TEMPLATES = [
  {
    id: "barber",
    label: "Barbearia",
    vertical: "Barbearia · marcações",
    description: "Página focada em serviços e reservas, com estilo escuro e moderno.",
    site: {
      template: "barber",
      theme: { preset: "ink", accent: "amber", font: "grotesk", logo: null },
      defaultLocale: "pt",
      activeLocales: ["pt"],
      nav: { items: [], cta: null },
      pages: [{ id: "home", slug: "", inNav: true, order: 0, kind: "content", blocks: [] }],
      footer: {},
    },
  },
  {
    id: "gym",
    label: "Ginásio",
    vertical: "Ginásio · mensalidades",
    description: "Energia e prova social, com destaque para planos e resultados.",
    site: {
      template: "gym",
      theme: { preset: "slate", accent: "emerald", font: "grotesk", logo: null },
      defaultLocale: "pt",
      activeLocales: ["pt"],
      nav: { items: [], cta: null },
      pages: [{ id: "home", slug: "", inNav: true, order: 0, kind: "content", blocks: [] }],
      footer: {},
    },
  },
];

function mockWebsiteTemplates(
  data: typeof TEMPLATES | undefined,
  opts: { isLoading?: boolean; isError?: boolean } = {},
) {
  useWebsiteTemplatesMock.mockReturnValue({
    data,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
  });
}

// AuthContext — não é usado diretamente pela página (os hooks estão mockados),
// mas é importado transitivamente; stub simples.
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({
    authHeader: () => ({}),
    isAuthenticated: true,
    hasPermission: () => true,
  }),
}));

// Toast — silenciar e observar.
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { Website } from "../../src/pages/Website";

function makeSite(overrides: Partial<Site> = {}): Site {
  return {
    siteId: null,
    subdomain: null,
    template: null,
    defaultLocale: "pt",
    activeLocales: ["pt"],
    theme: null,
    nav: null,
    pages: [],
    footer: null,
    published: false,
    publishedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false, dataUpdatedAt: 0 });
  mockWebsiteTemplates(TEMPLATES);
});

// Nota (T2.3, migração sidebar-com-submenus): a página `Website` deixou de ter
// `Tabs` de topo — cada separador é agora uma rota própria (`/website`,
// `/website/template`, `/website/paginas`, `/website/marca`,
// `/website/rodape-nav`, `/website/dominio`) e o componente recebe a vista
// pedida via a prop `view` (mesmo padrão de `Clientes`/`Loja`/`Financeiro`/
// `Agenda`). Os testes abaixo montam `<Website view="..." />` diretamente em
// vez de clicar numa barra de tabs — a navegação real por submenu/URL fica
// coberta pelo e2e (`rbac-matriz.spec.ts`).

describe("Website", () => {
  it("(a) estado: mostra Rascunho e Publicar desativado quando o setup está incompleto", () => {
    render(<Website view="site" />);
    // Badge de rascunho (aparece no header e na tab de estado).
    expect(screen.getAllByText("Rascunho").length).toBeGreaterThan(0);
    const publicar = screen.getByRole("button", { name: /Publicar/i });
    expect(publicar).toBeDisabled();
  });

  it("(b) escolher um template chama save com um Site JSON com template + pages", async () => {
    const user = userEvent.setup();
    render(<Website view="template" />);

    // Escolher a Barbearia (não há site montado → aplica direto, sem confirmar).
    await user.click(screen.getByRole("button", { name: /Barbearia/i }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const arg = saveMutate.mock.calls[0][0];
    expect(arg).toEqual(
      expect.objectContaining({
        template: "barber",
        pages: expect.arrayContaining([
          expect.objectContaining({ id: "home" }),
        ]),
      }),
    );
    expect(Array.isArray(arg.pages)).toBe(true);
    expect(arg.pages.length).toBeGreaterThanOrEqual(1);
  });

  it("(b2) Template: renderiza a galeria a partir do endpoint (GET /website/templates)", () => {
    render(<Website view="template" />);

    expect(useWebsiteTemplatesMock).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Barbearia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ginásio/i })).toBeInTheDocument();
    expect(screen.getByText("Ginásio · mensalidades")).toBeInTheDocument();
  });

  it("(b3) Template: aplicar chama useSaveSite com o payload `site` exato do template escolhido", async () => {
    const user = userEvent.setup();
    render(<Website view="template" />);

    await user.click(screen.getByRole("button", { name: /Ginásio/i }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate.mock.calls[0][0]).toEqual(TEMPLATES[1].site);
  });

  it("(b4) Template: mostra um estado de carregamento enquanto o endpoint não responde", () => {
    mockWebsiteTemplates(undefined, { isLoading: true });
    render(<Website view="template" />);

    expect(screen.queryByRole("button", { name: /Barbearia/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível carregar/i)).not.toBeInTheDocument();
  });

  it("(b5) Template: mostra uma mensagem de erro em PT quando o endpoint falha", async () => {
    mockWebsiteTemplates(undefined, { isError: true });
    render(<Website view="template" />);

    expect(await screen.findByText(/Não foi possível carregar os templates/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Barbearia/i })).not.toBeInTheDocument();
  });

  it("(c) domínio: mostra a razão de indisponibilidade devolvida pela verificação", async () => {
    const user = userEvent.setup();
    checkFn.mockResolvedValue({ value: "admin", available: false, reason: "reserved" });
    render(<Website view="domain" />);

    const input = screen.getByPlaceholderText("a-tua-marca");
    await user.type(input, "admin");

    await waitFor(() => {
      expect(screen.getByText(/Reservado/i)).toBeInTheDocument();
    });
  });

  it("(d) Publicar fica ativo e chama publish com subdomínio + páginas + template + marca", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: makeSite({
        siteId: "s1",
        template: "barber",
        subdomain: "acme",
        theme: { accent: "amber" },
        // A home (slug vazio) precisa de ≥1 bloco para o gate de publicação
        // (ver describe "Publicar bloqueado sem conteúdo na página inicial").
        pages: [{ id: "home", slug: "", blocks: [{ id: "b1", type: "hero" }] }],
      }),
      isLoading: false,
    });
    render(<Website view="site" />);

    const publicar = screen.getByRole("button", { name: /Publicar/i });
    expect(publicar).toBeEnabled();
    await user.click(publicar);
    expect(publishMutate).toHaveBeenCalledTimes(1);
  });
});

// ── Publicar: gate de conteúdo na página inicial ──────────────────────────────

describe("Website — Publicar bloqueado sem conteúdo na página inicial", () => {
  const baseSite = {
    siteId: "s1",
    template: "barber" as const,
    subdomain: "acme",
    theme: { accent: "amber" },
  };

  it("bloqueia Publicar e mostra o passo pendente quando a home (slug vazio) não tem blocos", () => {
    useSiteMock.mockReturnValue({
      data: makeSite({
        ...baseSite,
        pages: [{ id: "home", slug: "", blocks: [] }],
      }),
      isLoading: false,
    });
    render(<Website view="site" />);

    const publicar = screen.getByRole("button", { name: /Publicar/i });
    expect(publicar).toBeDisabled();
    expect(
      screen.getByText(/Adiciona pelo menos um bloco à página inicial/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Adiciona conteúdo à página inicial")).toBeInTheDocument();
  });

  it("permite Publicar quando a home tem pelo menos um bloco", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: makeSite({
        ...baseSite,
        pages: [{ id: "home", slug: "", blocks: [{ id: "b1", type: "hero" }] }],
      }),
      isLoading: false,
    });
    render(<Website view="site" />);

    const publicar = screen.getByRole("button", { name: /Publicar/i });
    expect(publicar).toBeEnabled();
    await user.click(publicar);
    expect(publishMutate).toHaveBeenCalledTimes(1);
  });
});

// ── Tab: O meu site — Pré-visualização ao vivo ────────────────────────────────

describe("Website — Pré-visualização", () => {
  it("minta um token ao montar e renderiza o iframe + link 'Abrir em nova aba' com o URL devolvido", async () => {
    render(<Website view="site" />);

    // Mint-on-mount (view "site" é a default).
    expect(previewMintMutate).toHaveBeenCalledTimes(1);

    act(() => {
      previewMintOptions.mutation.onSuccess({
        token: "tok-1",
        url: "http://renderer.test/preview?token=tok-1",
      });
    });

    const iframe = screen.getByTitle("Pré-visualização do site") as HTMLIFrameElement;
    expect(iframe).toHaveAttribute("src", "http://renderer.test/preview?token=tok-1");

    const link = screen.getByRole("link", { name: /Abrir em nova aba/i });
    expect(link).toHaveAttribute("href", "http://renderer.test/preview?token=tok-1");
  });

  it("quando a API não devolve `url` mas devolve `token`, constrói o URL a partir de VITE_SITE_ROOT_URL", async () => {
    render(<Website view="site" />);
    expect(previewMintMutate).toHaveBeenCalledTimes(1);

    act(() => {
      previewMintOptions.mutation.onSuccess({ token: "tok-2", url: null });
    });

    const iframe = screen.getByTitle("Pré-visualização do site") as HTMLIFrameElement;
    expect(iframe).toHaveAttribute("src", "http://localhost:3000/preview?token=tok-2");

    const link = screen.getByRole("link", { name: /Abrir em nova aba/i });
    expect(link).toHaveAttribute("href", "http://localhost:3000/preview?token=tok-2");
  });

  it("falha ao mintar (onError, ou onSuccess sem url nem token) → sem iframe, mostra erro e sem link clicável", async () => {
    render(<Website view="site" />);
    expect(previewMintMutate).toHaveBeenCalledTimes(1);

    act(() => {
      previewMintOptions.mutation.onError();
    });

    expect(screen.queryByTitle("Pré-visualização do site")).not.toBeInTheDocument();
    expect(screen.getByText(/não foi possível gerar a pré-visualização/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Abrir em nova aba/i })).not.toBeInTheDocument();

    // Também cobre onSuccess sem url nem token.
    act(() => {
      previewMintOptions.mutation.onSuccess({});
    });
    expect(screen.queryByTitle("Pré-visualização do site")).not.toBeInTheDocument();
    expect(screen.getByText(/não foi possível gerar a pré-visualização/i)).toBeInTheDocument();
  });

  it("refresh-on-save: um save noutra parte da página (dataUpdatedAt muda) remint o token da pré-visualização", async () => {
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false, dataUpdatedAt: 1 });
    const { rerender } = render(<Website view="site" />);
    expect(previewMintMutate).toHaveBeenCalledTimes(1);

    act(() => {
      previewMintOptions.mutation.onSuccess({
        token: "tok-1",
        url: "http://renderer.test/preview?token=tok-1",
      });
    });
    expect(screen.getByTitle("Pré-visualização do site")).toBeInTheDocument();

    // Simula um save bem sucedido noutra tab (ex.: Marca/Template/Páginas) —
    // qualquer save invalida a query `website.site`, o que muda `dataUpdatedAt`.
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false, dataUpdatedAt: 2 });
    rerender(<Website view="site" />);

    expect(previewMintMutate).toHaveBeenCalledTimes(2);
  });
});

// ── Tab: Páginas (gestor de páginas, T23) ──────────────────────────────────────

describe("Website — Páginas (gestor de páginas)", () => {
  const HOME = {
    id: "home",
    slug: "",
    title: "Início",
    inNav: true,
    order: 0,
    kind: "content",
    blocks: [],
  };
  const SOBRE = {
    id: "p2",
    slug: "sobre",
    title: "Sobre",
    inNav: true,
    order: 1,
    kind: "content",
    blocks: [],
  };

  function siteWithPages(pages: Site["pages"]): Site {
    return makeSite({ pages });
  }

  it("adiciona uma página com slug auto-gerado do título", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME]), isLoading: false });
    render(<Website view="pages" />);

    await user.type(screen.getByLabelText("Título"), "Sobre Nós");

    // O campo "Endereço" do formulário Nova página é o 1º a aparecer no DOM.
    const slugInput = screen.getAllByLabelText(/Endereço/)[0] as HTMLInputElement;
    expect(slugInput.value).toBe("sobre-nos");

    await user.click(screen.getByRole("button", { name: /Adicionar/i }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const arg = saveMutate.mock.calls[0][0];
    expect(arg.pages).toHaveLength(2);
    expect(arg.pages[1]).toEqual(
      expect.objectContaining({ slug: "sobre-nos", title: "Sobre Nós", order: 1, kind: "content" }),
    );
  });

  it("rejeita um slug duplicado ao adicionar (edição manual do campo endereço)", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    render(<Website view="pages" />);

    await user.type(screen.getByLabelText("Título"), "Sobre Nós Novamente");
    // O campo "Endereço" do formulário Nova página é o 1º a aparecer no DOM
    // (a linha "Sobre" também tem um input de slug próprio, com aria-label
    // "Endereço da página").
    const slugInput = screen.getAllByLabelText(/Endereço/)[0];
    await user.clear(slugInput);
    await user.type(slugInput, "sobre");

    expect(await screen.findByText(/Já existe uma página/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar/i })).toBeDisabled();
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("rejeita um slug reservado ao adicionar", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME]), isLoading: false });
    render(<Website view="pages" />);

    await user.type(screen.getByLabelText("Título"), "Loja");

    expect(await screen.findByText(/reservado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar/i })).toBeDisabled();
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("reordena páginas (mover para baixo) e persiste a nova ordem", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    render(<Website view="pages" />);

    const downButtons = screen.getAllByRole("button", { name: "Mover para baixo" });
    await user.click(downButtons[0]); // move a página inicial para baixo

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    expect(pages[0]).toEqual(expect.objectContaining({ id: "p2", order: 0 }));
    expect(pages[1]).toEqual(expect.objectContaining({ id: "home", order: 1 }));
  });

  it("bloqueia remover a página inicial", () => {
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    render(<Website view="pages" />);

    const removeButtons = screen.getAllByRole("button", { name: "Remover página" });
    expect(removeButtons[0]).toBeDisabled(); // a linha da página inicial
  });

  it("bloqueia remover a última página restante mesmo não sendo a inicial", () => {
    const solo = { ...SOBRE, order: 0 };
    useSiteMock.mockReturnValue({ data: siteWithPages([solo]), isLoading: false });
    render(<Website view="pages" />);

    const removeButton = screen.getByRole("button", { name: "Remover página" });
    expect(removeButton).toBeDisabled();
  });

  it("remove uma página não-inicial após confirmação", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    render(<Website view="pages" />);

    const removeButtons = screen.getAllByRole("button", { name: "Remover página" });
    await user.click(removeButtons[1]); // a página "Sobre"
    await user.click(screen.getByRole("button", { name: "Remover" }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe("home");
  });

  it("o toggle de navegação persiste o valor invertido no payload gravado", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    render(<Website view="pages" />);

    const switches = screen.getAllByRole("switch");
    await user.click(switches[1]); // a página "Sobre" (inNav:true → false)

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const sobre = pages.find((p: any) => p.id === "p2");
    expect(sobre.inNav).toBe(false);
  });
});

// ── Blocos por página (gestor de blocos, T24) ─────────────────────────────────

describe("Website — Blocos (gestor de blocos por página)", () => {
  const HOME_EMPTY = {
    id: "home",
    slug: "",
    title: "Início",
    inNav: true,
    order: 0,
    kind: "content",
    blocks: [],
  };

  const HOME_TWO_BLOCKS = {
    id: "home",
    slug: "",
    title: "Início",
    inNav: true,
    order: 0,
    kind: "content",
    blocks: [
      {
        id: "b1",
        type: "hero",
        variant: "centered",
        settings: { content: { pt: { title: "Título do hero" } } },
      },
      {
        id: "b2",
        type: "services",
        variant: "grid",
        settings: { content: { pt: { title: "Os nossos serviços" } } },
      },
    ],
  };

  const HOME_MULTI_LOCALE = {
    id: "home",
    slug: "",
    title: "Início",
    inNav: true,
    order: 0,
    kind: "content",
    blocks: [
      {
        id: "b1",
        type: "hero",
        variant: "centered",
        settings: {
          content: {
            pt: { title: "Título PT" },
            en: { title: "Title EN" },
          },
        },
      },
    ],
  };

  function siteWithBlocks(pages: Site["pages"], overrides: Partial<Site> = {}): Site {
    return makeSite({ pages, activeLocales: ["pt"], defaultLocale: "pt", ...overrides });
  }

  async function openBlocksFor(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Gerir blocos" }));
  }

  it("adiciona um bloco a uma página e persiste-o no payload", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_EMPTY]), isLoading: false });
    render(<Website view="pages" />);
    await openBlocksFor(user);

    await user.click(screen.getByRole("button", { name: /Adicionar bloco/i }));
    await user.click(screen.getByRole("button", { name: /^Hero/ }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const home = pages.find((p: any) => p.id === "home");
    expect(home.blocks).toHaveLength(1);
    expect(home.blocks[0]).toEqual(
      expect.objectContaining({ type: "hero", variant: "centered" }),
    );
  });

  it("reordena blocos (mover para baixo) e persiste a nova ordem", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_TWO_BLOCKS]), isLoading: false });
    render(<Website view="pages" />);
    await openBlocksFor(user);

    const downButtons = screen.getAllByRole("button", { name: "Mover bloco para baixo" });
    await user.click(downButtons[0]); // move o bloco "hero" (b1) para baixo

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const home = pages.find((p: any) => p.id === "home");
    expect(home.blocks[0].id).toBe("b2");
    expect(home.blocks[1].id).toBe("b1");
  });

  it("remove um bloco após confirmação e persiste sem ele", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_TWO_BLOCKS]), isLoading: false });
    render(<Website view="pages" />);
    await openBlocksFor(user);

    const removeButtons = screen.getAllByRole("button", { name: "Remover bloco" });
    await user.click(removeButtons[0]); // o bloco "hero" (b1)
    await user.click(screen.getByRole("button", { name: "Remover" }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const home = pages.find((p: any) => p.id === "home");
    expect(home.blocks).toHaveLength(1);
    expect(home.blocks[0].id).toBe("b2");
  });

  it("muda a variante de um bloco via Combobox e persiste-a", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_TWO_BLOCKS]), isLoading: false });
    render(<Website view="pages" />);
    await openBlocksFor(user);

    const variantButtons = screen.getAllByRole("button", { name: "Variante" });
    await user.click(variantButtons[1]); // bloco "services" (b2)
    await user.click(screen.getByRole("button", { name: "Lista" }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const home = pages.find((p: any) => p.id === "home");
    const services = home.blocks.find((b: any) => b.id === "b2");
    expect(services.variant).toBe("list");
  });

  it("edita o título (formulário rico) na língua padrão e guarda em settings.content.pt.title", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_TWO_BLOCKS]), isLoading: false });
    render(<Website view="pages" />);
    await openBlocksFor(user);

    const editButtons = screen.getAllByRole("button", { name: "Editar conteúdo" });
    await user.click(editButtons[0]); // bloco "hero" (b1)

    const dialog = within(screen.getByRole("dialog"));
    const titleInput = dialog.getByLabelText("Título");
    await user.clear(titleInput);
    await user.type(titleInput, "Novo título");
    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const home = pages.find((p: any) => p.id === "home");
    const hero = home.blocks.find((b: any) => b.id === "b1");
    expect(hero.settings.content.pt.title).toBe("Novo título");
  });

  it("muda de separador de língua no modal de conteúdo e mostra os campos dessa língua", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: siteWithBlocks([HOME_MULTI_LOCALE], { activeLocales: ["pt", "en"] }),
      isLoading: false,
    });
    render(<Website view="pages" />);
    await openBlocksFor(user);

    await user.click(screen.getByRole("button", { name: "Editar conteúdo" }));

    const dialog = within(screen.getByRole("dialog"));
    const titleInputPt = dialog.getByLabelText("Título") as HTMLInputElement;
    expect(titleInputPt.value).toBe("Título PT");

    await user.click(dialog.getByRole("tab", { name: "EN" }));

    const titleInputEn = dialog.getByLabelText("Título") as HTMLInputElement;
    expect(titleInputEn.value).toBe("Title EN");
  });
});

// ── Blocos: upload de imagem (T-imagem) ───────────────────────────────────────

describe("Website — Blocos (upload de imagem)", () => {
  const HOME_HERO = {
    id: "home",
    slug: "",
    title: "Início",
    inNav: true,
    order: 0,
    kind: "content",
    blocks: [
      {
        id: "b1",
        type: "hero",
        variant: "centered",
        settings: { content: { pt: { title: "Título do hero" } } },
      },
    ],
  };

  function siteWithBlocks(pages: Site["pages"]): Site {
    return makeSite({ pages, activeLocales: ["pt"], defaultLocale: "pt" });
  }

  async function openHeroContentModal(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Gerir blocos" }));
    await user.click(screen.getByRole("button", { name: "Editar conteúdo" }));
    return screen.getByRole("dialog");
  }

  it("o campo Imagem do hero mostra o uploader (não um input de URL simples)", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_HERO]), isLoading: false });
    render(<Website view="pages" />);
    const dialog = await openHeroContentModal(user);

    expect(within(dialog).getByText("Carregar imagem")).toBeInTheDocument();
    expect(within(dialog).getByText(/ou cola um URL/i)).toBeInTheDocument();
    // Já não existe um <label> "Imagem" ligado a um <input type="text"> simples.
    expect(within(dialog).queryByLabelText("Imagem")).not.toBeInTheDocument();
  });

  it("faz upload de uma imagem no bloco (diferido até Guardar) e persiste o URL devolvido", async () => {
    const user = userEvent.setup();
    uploadImage.mockResolvedValue({ fileUrl: "https://x/hero.webp", key: "k1" });
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_HERO]), isLoading: false });
    render(<Website view="pages" />);
    const dialog = await openHeroContentModal(user);

    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const img = new File(["x"], "hero.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [img] } });

    // Upload diferido: nada é enviado ao escolher o ficheiro.
    expect(uploadImage).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(uploadImage).toHaveBeenCalledWith({ image: img, module: "website" }),
    );
    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const home = pages.find((p: any) => p.id === "home");
    const hero = home.blocks.find((b: any) => b.id === "b1");
    expect(hero.settings.content.pt.imageUrl).toBe("https://x/hero.webp");
    // O título editado noutro campo não é afetado pelo upload.
    expect(hero.settings.content.pt.title).toBe("Título do hero");
  });

  it("cancelar a escolha pendente (botão remover) não envia nada e mantém o campo vazio ao guardar", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_HERO]), isLoading: false });
    render(<Website view="pages" />);
    const dialog = await openHeroContentModal(user);

    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const img = new File(["x"], "hero.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [img] } });

    // Remove a escolha pendente antes de Guardar (botão "x" sobre a pré-visualização).
    const previewImg = within(dialog).getByAltText("Preview");
    const removeBtn = previewImg.parentElement!.querySelector("button") as HTMLButtonElement;
    fireEvent.click(removeBtn);

    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    expect(uploadImage).not.toHaveBeenCalled();
    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const home = pages.find((p: any) => p.id === "home");
    const hero = home.blocks.find((b: any) => b.id === "b1");
    expect(hero.settings.content.pt.imageUrl ?? "").toBe("");
  });
});

// ── Marca: upload do logótipo ──────────────────────────────────────────────────

describe("Website — Marca (upload do logótipo)", () => {
  it("mostra o uploader do logótipo (sem o antigo aviso de upload direto)", async () => {
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false });
    render(<Website view="brand" />);

    expect(screen.getByText("Carregar logótipo")).toBeInTheDocument();
    expect(screen.getByText(/ou cola um URL/i)).toBeInTheDocument();
    expect(screen.queryByText(/upload direto chega mais tarde/i)).not.toBeInTheDocument();
  });

  it("faz upload do logótipo (diferido até Guardar marca) e guarda o URL devolvido", async () => {
    const user = userEvent.setup();
    uploadImage.mockResolvedValue({ fileUrl: "https://x/logo.webp", key: "k2" });
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false });
    render(<Website view="brand" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const img = new File(["x"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [img] } });

    expect(uploadImage).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Guardar marca/i }));

    await waitFor(() =>
      expect(uploadImage).toHaveBeenCalledWith({ image: img, module: "website" }),
    );
    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate.mock.calls[0][0].theme.logo).toBe("https://x/logo.webp");
  });

  it("cola um URL manualmente quando não há upload", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false });
    render(<Website view="brand" />);

    await user.click(screen.getByRole("button", { name: /ou cola um URL/i }));
    const input = screen.getByPlaceholderText("https://…/logo.svg");
    await user.type(input, "https://x/manual-logo.png");

    await user.click(screen.getByRole("button", { name: /Guardar marca/i }));

    expect(uploadImage).not.toHaveBeenCalled();
    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate.mock.calls[0][0].theme.logo).toBe("https://x/manual-logo.png");
  });
});

// ── Blocos: palete completa (site-editor-complete D3+D4) ─────────────────────

describe("Website — Blocos (palete completa: Coleção + funcionais)", () => {
  const HOME_EMPTY = {
    id: "home",
    slug: "",
    title: "Início",
    inNav: true,
    order: 0,
    kind: "content",
    blocks: [],
  };

  function siteWithBlocks(pages: Site["pages"]): Site {
    return makeSite({ pages, activeLocales: ["pt"], defaultLocale: "pt" });
  }

  async function openPalette(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Gerir blocos" }));
    await user.click(screen.getByRole("button", { name: /Adicionar bloco/i }));
  }

  it("(D3) a palete inclui o bloco Coleção — a page-kind \"Coleção\" deixa de ser beco sem saída", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_EMPTY]), isLoading: false });
    render(<Website view="pages" />);
    await openPalette(user);

    // Escopado ao diálogo da palete — a tab "Páginas" tem o seu próprio botão
    // "Coleção" (o seletor de page-kind), que colidiria com o nome do bloco.
    const palette = within(screen.getByRole("dialog"));
    expect(palette.getByRole("button", { name: /^Coleção/ })).toBeInTheDocument();
  });

  it("(D3) adicionar o bloco Coleção persiste type:collection e a variante default 'grid'", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_EMPTY]), isLoading: false });
    render(<Website view="pages" />);
    await openPalette(user);

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Coleção/ }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const home = pages.find((p: any) => p.id === "home");
    expect(home.blocks[0]).toEqual(expect.objectContaining({ type: "collection", variant: "grid" }));
  });

  it.each([
    ["booking", "Marcações"],
    ["products", "Produtos"],
    ["gym", "Ginásio"],
    ["lead", "Captação de leads"],
  ])(
    "(D4) o bloco funcional '%s' mostra um formulário com etiquetas PT, não o editor genérico chave/valor",
    async (type, label) => {
      const user = userEvent.setup();
      useSiteMock.mockReturnValue({
        data: siteWithBlocks([
          { ...HOME_EMPTY, blocks: [{ id: "b1", type, settings: { content: { pt: {} } } }] },
        ]),
        isLoading: false,
      });
      render(<Website view="pages" />);
      await user.click(screen.getByRole("button", { name: "Gerir blocos" }));

      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      await user.click(screen.getByRole("button", { name: "Editar conteúdo" }));

      const dialog = within(screen.getByRole("dialog"));
      // O rótulo "Eyebrow" é comum a todos os 4 tipos funcionais e só existe
      // no formulário rico (o editor genérico não tem rótulos, só "chave"/"valor").
      expect(dialog.getByLabelText("Eyebrow")).toBeInTheDocument();
      expect(dialog.queryByPlaceholderText("chave")).not.toBeInTheDocument();
      expect(dialog.queryByText(/Editor genérico/i)).not.toBeInTheDocument();
    },
  );

  it("(D4) mostra o aviso de dados reais nos blocos funcionais e não o mostra num bloco de marketing", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: siteWithBlocks([
        {
          ...HOME_EMPTY,
          blocks: [
            { id: "b1", type: "products", settings: { content: { pt: {} } } },
            { id: "b2", type: "hero", variant: "centered", settings: { content: { pt: {} } } },
          ],
        },
      ]),
      isLoading: false,
    });
    render(<Website view="pages" />);
    await user.click(screen.getByRole("button", { name: "Gerir blocos" }));

    const editButtons = screen.getAllByRole("button", { name: "Editar conteúdo" });

    await user.click(editButtons[0]); // bloco "products"
    expect(
      within(screen.getByRole("dialog")).getByText(/Os produtos vêm da tua Loja/i),
    ).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));

    await user.click(editButtons[1]); // bloco "hero" — conteúdo/marketing, sem aviso
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("(D4) editar um campo do formulário rico do bloco 'lead' persiste-o em settings.content", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: siteWithBlocks([
        { ...HOME_EMPTY, blocks: [{ id: "b1", type: "lead", variant: "split", settings: { content: { pt: {} } } }] },
      ]),
      isLoading: false,
    });
    render(<Website view="pages" />);
    await user.click(screen.getByRole("button", { name: "Gerir blocos" }));
    await user.click(screen.getByRole("button", { name: "Editar conteúdo" }));

    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Etiqueta do campo Nome"), "O teu nome");
    await user.type(dialog.getByLabelText("Texto do botão de enviar"), "Quero saber mais");
    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const home = pages.find((p: any) => p.id === "home");
    const content = home.blocks[0].settings.content.pt;
    expect(content.labelName).toBe("O teu nome");
    expect(content.submitLabel).toBe("Quero saber mais");
  });
});

// ── Blocos: bloco Coleção — editor de itens (site-editor-complete D3) ────────

describe("Website — Blocos (Coleção — editor de itens)", () => {
  const HOME_WITH_COLLECTION = {
    id: "home",
    slug: "",
    title: "Início",
    inNav: true,
    order: 0,
    kind: "collection",
    blocks: [{ id: "b1", type: "collection", variant: "grid", settings: { content: { pt: {} } } }],
  };

  function siteWithBlocks(pages: Site["pages"]): Site {
    return makeSite({ pages, activeLocales: ["pt"], defaultLocale: "pt" });
  }

  async function openCollectionContentModal(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Gerir blocos" }));
    await user.click(screen.getByRole("button", { name: "Editar conteúdo" }));
    return screen.getByRole("dialog");
  }

  it("adicionar um item preenche o formulário e persiste o CollectionItem (slug/summary/tags)", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_WITH_COLLECTION]), isLoading: false });
    render(<Website view="pages" />);
    const dialog = within(await openCollectionContentModal(user));

    await user.click(dialog.getByRole("button", { name: /Adicionar item/i }));

    // "Slug" tem um hint concatenado ao texto do <label> (sem separador), por
    // isso a correspondência exata falha — usa um regex de prefixo.
    await user.type(dialog.getByLabelText(/^Slug/), "projeto-a");
    await user.type(dialog.getByLabelText("Resumo"), "Um resumo curto do projeto.");
    await user.type(dialog.getByLabelText("Tags (uma por linha)"), "design\nweb");

    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    const home = pages.find((p: any) => p.id === "home");
    const items = home.blocks[0].settings.content.pt.items;
    expect(items).toEqual([
      expect.objectContaining({
        slug: "projeto-a",
        summary: "Um resumo curto do projeto.",
        tags: ["design", "web"],
      }),
    ]);
  });

  it("o campo Imagem do item usa o uploader (não um input de URL simples)", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_WITH_COLLECTION]), isLoading: false });
    render(<Website view="pages" />);
    const dialog = within(await openCollectionContentModal(user));

    await user.click(dialog.getByRole("button", { name: /Adicionar item/i }));

    expect(dialog.getByText("Carregar imagem")).toBeInTheDocument();
  });
});

// ── Rodapé & Nav (D1 footer + D2 nav CTA — site-editor-complete) ─────────────

describe("Website — Rodapé & Nav (D1 footer + D2 nav CTA)", () => {
  it("(D1) mostra os valores atuais do rodapé (nome, tagline, nota legal, colunas+links)", async () => {
    useSiteMock.mockReturnValue({
      data: makeSite({
        footer: {
          name: "Acme",
          tagline: "A tua barbearia de bairro",
          smallPrint: "© 2026 Acme.",
          columns: [{ title: "Empresa", links: [{ label: "Sobre nós", to: "/sobre" }] }],
        },
      }),
      isLoading: false,
    });
    render(<Website view="footer" />);

    // Os campos `name`/`smallPrint` têm hint (texto extra dentro do próprio
    // <label>), por isso o nome acessível não é exatamente a etiqueta — regex
    // de prefixo em vez de string exata (mesmo padrão usado no resto do ficheiro,
    // ex.: `getAllByLabelText(/Endereço/)` na tab Páginas).
    expect(screen.getByLabelText(/^Nome \/ marca/)).toHaveValue("Acme");
    expect(screen.getByLabelText("Tagline")).toHaveValue("A tua barbearia de bairro");
    expect(screen.getByLabelText(/^Nota legal/)).toHaveValue("© 2026 Acme.");
    expect(screen.getByLabelText("Título da coluna 1")).toHaveValue("Empresa");
    expect(screen.getByLabelText("Texto do link 1")).toHaveValue("Sobre nós");
    expect(screen.getByLabelText("Endereço do link 1")).toHaveValue("/sobre");
  });

  it("(D1) adicionar uma coluna + um link persiste o footer completo (campo `to`, não `href`)", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: makeSite({ footer: { name: "Acme" } }),
      isLoading: false,
    });
    render(<Website view="footer" />);

    await user.click(screen.getByRole("button", { name: /Adicionar coluna/i }));
    await user.type(screen.getByLabelText("Título da coluna 1"), "Empresa");
    await user.click(screen.getByRole("button", { name: /Adicionar link/i }));
    await user.type(screen.getByLabelText("Texto do link 1"), "Contactos");
    await user.type(screen.getByLabelText("Endereço do link 1"), "#contacto");

    await user.click(screen.getByRole("button", { name: /Guardar rodapé/i }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const arg = saveMutate.mock.calls[0][0];
    expect(arg.footer).toEqual(
      expect.objectContaining({
        name: "Acme",
        columns: [{ title: "Empresa", links: [{ label: "Contactos", to: "#contacto" }] }],
      }),
    );
  });

  it("(D2) define nav.cta e preserva nav.items ao guardar", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: makeSite({ nav: { items: [{ label: "Início", to: "/" }], cta: null } }),
      isLoading: false,
    });
    render(<Website view="footer" />);

    await user.click(screen.getByRole("switch"));
    await user.type(screen.getByLabelText("Texto do botão"), "Marcar");
    // Tem hint (texto extra dentro do <label>) — regex de prefixo, como acima.
    await user.type(screen.getByLabelText(/^Endereço/), "#marcar");
    await user.click(screen.getByRole("button", { name: /Guardar botão do menu/i }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const arg = saveMutate.mock.calls[0][0];
    expect(arg.nav).toEqual({
      items: [{ label: "Início", to: "/" }],
      cta: { label: "Marcar", to: "#marcar" },
    });
  });

  it("(D2) desligar o CTA existente grava cta:null e continua a preservar nav.items", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: makeSite({
        nav: { items: [{ label: "Início", to: "/" }], cta: { label: "Marcar", to: "#marcar" } },
      }),
      isLoading: false,
    });
    render(<Website view="footer" />);

    // O toggle começa ligado (já há CTA guardado) — desligar limpa o CTA.
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: /Guardar botão do menu/i }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const arg = saveMutate.mock.calls[0][0];
    expect(arg.nav).toEqual({
      items: [{ label: "Início", to: "/" }],
      cta: null,
    });
  });
});
