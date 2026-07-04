import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
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
  useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false });
  mockWebsiteTemplates(TEMPLATES);
});

describe("Website", () => {
  it("(a) estado: mostra Rascunho e Publicar desativado quando o setup está incompleto", () => {
    render(<Website />);
    // Badge de rascunho (aparece no header e na tab de estado).
    expect(screen.getAllByText("Rascunho").length).toBeGreaterThan(0);
    const publicar = screen.getByRole("button", { name: /Publicar/i });
    expect(publicar).toBeDisabled();
  });

  it("(b) escolher um template chama save com um Site JSON com template + pages", async () => {
    const user = userEvent.setup();
    render(<Website />);

    // Ir para a tab Template.
    await user.click(screen.getByRole("tab", { name: /Template/i }));

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

  it("(b2) Template: renderiza a galeria a partir do endpoint (GET /website/templates)", async () => {
    const user = userEvent.setup();
    render(<Website />);
    await user.click(screen.getByRole("tab", { name: /Template/i }));

    expect(useWebsiteTemplatesMock).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Barbearia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ginásio/i })).toBeInTheDocument();
    expect(screen.getByText("Ginásio · mensalidades")).toBeInTheDocument();
  });

  it("(b3) Template: aplicar chama useSaveSite com o payload `site` exato do template escolhido", async () => {
    const user = userEvent.setup();
    render(<Website />);
    await user.click(screen.getByRole("tab", { name: /Template/i }));

    await user.click(screen.getByRole("button", { name: /Ginásio/i }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate.mock.calls[0][0]).toEqual(TEMPLATES[1].site);
  });

  it("(b4) Template: mostra um estado de carregamento enquanto o endpoint não responde", async () => {
    const user = userEvent.setup();
    mockWebsiteTemplates(undefined, { isLoading: true });
    render(<Website />);
    await user.click(screen.getByRole("tab", { name: /Template/i }));

    expect(screen.queryByRole("button", { name: /Barbearia/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível carregar/i)).not.toBeInTheDocument();
  });

  it("(b5) Template: mostra uma mensagem de erro em PT quando o endpoint falha", async () => {
    const user = userEvent.setup();
    mockWebsiteTemplates(undefined, { isError: true });
    render(<Website />);
    await user.click(screen.getByRole("tab", { name: /Template/i }));

    expect(await screen.findByText(/Não foi possível carregar os templates/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Barbearia/i })).not.toBeInTheDocument();
  });

  it("(c) domínio: mostra a razão de indisponibilidade devolvida pela verificação", async () => {
    const user = userEvent.setup();
    checkFn.mockResolvedValue({ value: "admin", available: false, reason: "reserved" });
    render(<Website />);

    await user.click(screen.getByRole("tab", { name: /Domínio/i }));
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
        pages: [{ id: "home", slug: "" }],
      }),
      isLoading: false,
    });
    render(<Website />);

    const publicar = screen.getByRole("button", { name: /Publicar/i });
    expect(publicar).toBeEnabled();
    await user.click(publicar);
    expect(publishMutate).toHaveBeenCalledTimes(1);
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

  async function goToPages(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("tab", { name: /Páginas/i }));
  }

  it("adiciona uma página com slug auto-gerado do título", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME]), isLoading: false });
    render(<Website />);
    await goToPages(user);

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
    render(<Website />);
    await goToPages(user);

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
    render(<Website />);
    await goToPages(user);

    await user.type(screen.getByLabelText("Título"), "Loja");

    expect(await screen.findByText(/reservado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar/i })).toBeDisabled();
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("reordena páginas (mover para baixo) e persiste a nova ordem", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    render(<Website />);
    await goToPages(user);

    const downButtons = screen.getAllByRole("button", { name: "Mover para baixo" });
    await user.click(downButtons[0]); // move a página inicial para baixo

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const pages = saveMutate.mock.calls[0][0].pages;
    expect(pages[0]).toEqual(expect.objectContaining({ id: "p2", order: 0 }));
    expect(pages[1]).toEqual(expect.objectContaining({ id: "home", order: 1 }));
  });

  it("bloqueia remover a página inicial", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    render(<Website />);
    await goToPages(user);

    const removeButtons = screen.getAllByRole("button", { name: "Remover página" });
    expect(removeButtons[0]).toBeDisabled(); // a linha da página inicial
  });

  it("bloqueia remover a última página restante mesmo não sendo a inicial", async () => {
    const user = userEvent.setup();
    const solo = { ...SOBRE, order: 0 };
    useSiteMock.mockReturnValue({ data: siteWithPages([solo]), isLoading: false });
    render(<Website />);
    await goToPages(user);

    const removeButton = screen.getByRole("button", { name: "Remover página" });
    expect(removeButton).toBeDisabled();
  });

  it("remove uma página não-inicial após confirmação", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    render(<Website />);
    await goToPages(user);

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
    render(<Website />);
    await goToPages(user);

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

  async function goToPages(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("tab", { name: /Páginas/i }));
  }

  async function openBlocksFor(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Gerir blocos" }));
  }

  it("adiciona um bloco a uma página e persiste-o no payload", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_EMPTY]), isLoading: false });
    render(<Website />);
    await goToPages(user);
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
    render(<Website />);
    await goToPages(user);
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
    render(<Website />);
    await goToPages(user);
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
    render(<Website />);
    await goToPages(user);
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
    render(<Website />);
    await goToPages(user);
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
    render(<Website />);
    await goToPages(user);
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
    await user.click(screen.getByRole("tab", { name: /Páginas/i }));
    await user.click(screen.getByRole("button", { name: "Gerir blocos" }));
    await user.click(screen.getByRole("button", { name: "Editar conteúdo" }));
    return screen.getByRole("dialog");
  }

  it("o campo Imagem do hero mostra o uploader (não um input de URL simples)", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_HERO]), isLoading: false });
    render(<Website />);
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
    render(<Website />);
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
    render(<Website />);
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
  async function goToBrand(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("tab", { name: /Marca/i }));
  }

  it("mostra o uploader do logótipo (sem o antigo aviso de upload direto)", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false });
    render(<Website />);
    await goToBrand(user);

    expect(screen.getByText("Carregar logótipo")).toBeInTheDocument();
    expect(screen.getByText(/ou cola um URL/i)).toBeInTheDocument();
    expect(screen.queryByText(/upload direto chega mais tarde/i)).not.toBeInTheDocument();
  });

  it("faz upload do logótipo (diferido até Guardar marca) e guarda o URL devolvido", async () => {
    const user = userEvent.setup();
    uploadImage.mockResolvedValue({ fileUrl: "https://x/logo.webp", key: "k2" });
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false });
    render(<Website />);
    await goToBrand(user);

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
    render(<Website />);
    await goToBrand(user);

    await user.click(screen.getByRole("button", { name: /ou cola um URL/i }));
    const input = screen.getByPlaceholderText("https://…/logo.svg");
    await user.type(input, "https://x/manual-logo.png");

    await user.click(screen.getByRole("button", { name: /Guardar marca/i }));

    expect(uploadImage).not.toHaveBeenCalled();
    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate.mock.calls[0][0].theme.logo).toBe("https://x/manual-logo.png");
  });
});
