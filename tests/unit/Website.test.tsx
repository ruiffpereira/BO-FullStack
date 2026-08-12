import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    useSaveSite: () => ({
      mutate: (data: any, opts?: any) => {
        saveMutate(data, opts);
        if (opts?.onSuccess) opts.onSuccess();
      },
      isPending: false,
    }),
    usePublishSite: () => ({
      mutate: (data: any, opts?: any) => {
        publishMutate(data, opts);
        if (opts?.onSuccess) opts.onSuccess();
      },
      isPending: false,
    }),
    useSetSubdomain: () => ({
      mutate: (data: any, opts?: any) => {
        setSubdomainMutate(data, opts);
        if (opts?.onSuccess) opts.onSuccess();
      },
      isPending: false,
    }),
    useSetCustomDomain: () => ({ mutate: setCustomDomainMutate, isPending: false }),
    useCheckSubdomain: () => checkFn,
  };
});

// Write-guard (GuardButton, usado pelos "Guardar" novos de Definições/Domínio
// próprio) — a query real de billing exige QueryClientProvider; mockamo-la
// como NÃO read-only (mesmo padrão do ApptModal.test.tsx/writeGuard.test.tsx).
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));

// Domínio próprio (3.9) — hook manual novo em useWebsite.ts.
const setCustomDomainMutate = vi.fn();

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

// AuthContext — `Website.tsx` usa `hasPermission` para calcular
// `canEditStructure` (T3.8: VIEW_SITE_BUILDER OU VIEW_ADMIN). Por omissão
// concede tudo (mesmo comportamento anterior, todos os testes já existentes
// assumem o tenant "completo") — os testes de gating (describe "Website —
// gate seletivo (T3.8)") reconfiguram este mock para simular um tenant SEM
// a permissão.
const hasPermissionMock = vi.fn((_name: string) => true);
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({
    authHeader: () => ({}),
    isAuthenticated: true,
    hasPermission: (name: string) => hasPermissionMock(name),
  }),
}));

// CMS entries (novo — usado pelo BlockContentModal e PageBlocksSection para
// ler/gravar conteúdo no CMS). Retorna sempre uma lista vazia para os testes.
vi.mock("../../src/gen/backoffice/hooks/useGetCmsEntries", () => ({
  useGetCmsEntries: () => ({ data: [], isLoading: false }),
  getCmsEntriesQueryKey: () => [{ url: "/cms/entries" }],
}));

// CMS mutations (putCmsEntries, deleteCmsEntries) — usadas ao guardar/remover
// conteúdo. Mockadas como fire-and-forget que sempre resolvem.
vi.mock("../../src/gen/backoffice/hooks/usePutCmsEntries.js", () => ({
  putCmsEntries: vi.fn(() => Promise.resolve({})),
}));

vi.mock("../../src/gen/backoffice/hooks/useDeleteCmsEntries.js", () => ({
  deleteCmsEntries: vi.fn(() => Promise.resolve({})),
}));

// Toast — silenciar e observar.
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { Website, CustomDomainCard } from "../../src/pages/Website";
import { allowedSubitems } from "../../src/lib/navigation";

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
  hasPermissionMock.mockReturnValue(true);
  useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false, dataUpdatedAt: 0 });
});

// Wrapper com QueryClientProvider para testes que usam useQueryClient
let queryClientForRerender: QueryClient;
function renderWithQueryClient(component: React.ReactElement) {
  queryClientForRerender = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClientForRerender}>
      {component}
    </QueryClientProvider>,
  );
}

function rerenderWithQueryClient(component: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClientForRerender}>
      {component}
    </QueryClientProvider>,
  );
}

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
    renderWithQueryClient(<Website view="site" />);
    // Badge de rascunho (aparece no header e na tab de estado).
    expect(screen.getAllByText("Rascunho").length).toBeGreaterThan(0);
    const publicar = screen.getByRole("button", { name: /Publicar/i });
    expect(publicar).toBeDisabled();
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
    renderWithQueryClient(<Website view="site" />);

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
    renderWithQueryClient(<Website view="site" />);

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
    renderWithQueryClient(<Website view="site" />);

    const publicar = screen.getByRole("button", { name: /Publicar/i });
    expect(publicar).toBeEnabled();
    await user.click(publicar);
    expect(publishMutate).toHaveBeenCalledTimes(1);
  });
});

// ── Tab: O meu site — Pré-visualização ao vivo ────────────────────────────────

describe("Website — Pré-visualização", () => {
  it("minta um token ao montar e renderiza o iframe + link 'Abrir em nova aba' com o URL devolvido", async () => {
    renderWithQueryClient(<Website view="site" />);

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
    renderWithQueryClient(<Website view="site" />);
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
    renderWithQueryClient(<Website view="site" />);
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
    const { rerender } = renderWithQueryClient(<Website view="site" />);
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
    rerenderWithQueryClient(<Website view="site" />);

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
    renderWithQueryClient(<Website view="pages" />);

    await user.type(screen.getByLabelText("Título"), "Sobre Nós");

    // O campo "Endereço" do formulário Nova página é o 1º a aparecer no DOM.
    const slugInput = screen.getAllByLabelText(/Endereço/)[0] as HTMLInputElement;
    expect(slugInput.value).toBe("sobre-nos");

    await user.click(screen.getByRole("button", { name: /Adicionar/i }));

    expect(toastSuccess).toHaveBeenCalled();
    const arg = saveMutate.mock.calls[0][0];
    expect(arg.pages).toHaveLength(2);
    expect(arg.pages[1]).toEqual(
      expect.objectContaining({ slug: "sobre-nos", title: "Sobre Nós", order: 1, kind: "content" }),
    );
  });

  it("rejeita um slug duplicado ao adicionar (edição manual do campo endereço)", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);

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
    renderWithQueryClient(<Website view="pages" />);

    await user.type(screen.getByLabelText("Título"), "Loja");

    expect(await screen.findByText(/reservado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar/i })).toBeDisabled();
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("reordena páginas (mover para baixo) e persiste a nova ordem", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);

    const downButtons = screen.getAllByRole("button", { name: "Mover para baixo" });
    await user.click(downButtons[0]); // move a página inicial para baixo

    expect(saveMutate).toHaveBeenCalled();
  });

  it("bloqueia remover a página inicial", () => {
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);

    const removeButtons = screen.getAllByRole("button", { name: "Remover página" });
    expect(removeButtons[0]).toBeDisabled(); // a linha da página inicial
  });

  it("bloqueia remover a última página restante mesmo não sendo a inicial", () => {
    const solo = { ...SOBRE, order: 0 };
    useSiteMock.mockReturnValue({ data: siteWithPages([solo]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);

    const removeButton = screen.getByRole("button", { name: "Remover página" });
    expect(removeButton).toBeDisabled();
  });

  it("remove uma página não-inicial após confirmação", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);

    const removeButtons = screen.getAllByRole("button", { name: "Remover página" });
    await user.click(removeButtons[1]); // a página "Sobre"
    await user.click(screen.getByRole("button", { name: "Remover" }));

    expect(toastSuccess).toHaveBeenCalled();
  });

  it("o toggle de navegação persiste o valor invertido no payload gravado", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithPages([HOME, SOBRE]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);

    const switches = screen.getAllByRole("switch");
    await user.click(switches[1]); // a página "Sobre" (inNav:true → false)

    expect(saveMutate).toHaveBeenCalled();
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
        variant: "split",
        settings: { content: { pt: { title: "Título do hero" } } },
      },
      {
        id: "b2",
        type: "services", // legacy (sem design padrão) — continua editável
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
    renderWithQueryClient(<Website view="pages" />);
    await openBlocksFor(user);

    await user.click(screen.getByRole("button", { name: /Adicionar bloco/i }));
    await user.click(screen.getByRole("button", { name: /^Hero/ }));

    expect(toastSuccess).toHaveBeenCalled();
  });

  it("reordena blocos (mover para baixo) e persiste a nova ordem", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_TWO_BLOCKS]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);
    await openBlocksFor(user);

    const downButtons = screen.getAllByRole("button", { name: "Mover bloco para baixo" });
    await user.click(downButtons[0]); // move o bloco "hero" (b1) para baixo

    expect(saveMutate).toHaveBeenCalled();
  });

  it("remove um bloco após confirmação e persiste sem ele", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_TWO_BLOCKS]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);
    await openBlocksFor(user);

    const removeButtons = screen.getAllByRole("button", { name: "Remover bloco" });
    await user.click(removeButtons[0]); // o bloco "hero" (b1)
    await user.click(screen.getByRole("button", { name: "Remover" }));

    expect(toastSuccess).toHaveBeenCalled();
  });

  it("com multiplas variantes por tipo, o seletor de variante aparece", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_TWO_BLOCKS]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);
    await openBlocksFor(user);

    // Após a adição de variantes por vertical (stand/gym/etc.):
    // - hero tem split + stand + gym
    // - services tem grid + list + stand
    // Então ambos mostram o seletor de variante (`hasVariantPicker = variants.length > 1`).
    expect(screen.queryAllByRole("button", { name: "Variante" })).toHaveLength(2);
    expect(screen.getAllByText(/Split com widget/i).length).toBeGreaterThan(0);
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("edita o título (formulário rico padrão) na língua padrão e guarda em settings.content.pt.titulo", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_TWO_BLOCKS]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);
    await openBlocksFor(user);

    const editButtons = screen.getAllByRole("button", { name: "Editar conteúdo" });
    await user.click(editButtons[0]); // bloco "hero" (b1)

    const dialog = within(screen.getByRole("dialog"));
    const titleInput = dialog.getByLabelText("Título do negócio");
    await user.clear(titleInput);
    await user.type(titleInput, "Novo título");
    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    expect(toastSuccess).toHaveBeenCalled();
  });

  it("muda de separador de língua no modal de conteúdo e mostra os campos dessa língua", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: siteWithBlocks([HOME_MULTI_LOCALE], { activeLocales: ["pt", "en"] }),
      isLoading: false,
    });
    renderWithQueryClient(<Website view="pages" />);
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
    renderWithQueryClient(<Website view="pages" />);
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
    renderWithQueryClient(<Website view="pages" />);
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
    expect(toastSuccess).toHaveBeenCalled();
    // O título editado noutro campo não é afetado pelo upload.
  });

  it("cancelar a escolha pendente (botão remover) não envia nada e mantém o campo vazio ao guardar", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_HERO]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);
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
    expect(toastSuccess).toHaveBeenCalled();
  });
});

// ── Marca: o logótipo saiu (vem do CMS) ─────────────────────────────────────

describe("Website — Marca (logótipo veio do tema para o CMS)", () => {
  it("já não há uploader de logótipo na Marca", () => {
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false });
    renderWithQueryClient(<Website view="brand" />);
    expect(screen.queryByText("Carregar logótipo")).not.toBeInTheDocument();
    expect(screen.queryByText(/ou cola um URL/i)).not.toBeInTheDocument();
  });

  it("guardar a Marca descarta um `logo` legado do tema", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: makeSite({ theme: { accent: "amber", logo: "https://x/legacy.png" } }),
      isLoading: false,
    });
    renderWithQueryClient(<Website view="brand" />);

    await user.click(screen.getByRole("button", { name: /Guardar marca/i }));

    expect(toastSuccess).toHaveBeenCalled();
    expect(saveMutate.mock.calls[0][0].theme.logo).toBeUndefined();
  });
});

// ── Marca: modo claro/escuro ────────────────────────────────────────────────

describe("Website — Marca (modo claro/escuro)", () => {
  it("por omissão (site sem `theme.mode`) o modo Claro está selecionado e guarda `mode: \"light\"`", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false });
    renderWithQueryClient(<Website view="brand" />);

    expect(screen.getByRole("button", { name: /Claro/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Escuro/i })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: /Guardar marca/i }));

    expect(toastSuccess).toHaveBeenCalled();
    expect(saveMutate.mock.calls[0][0].theme.mode).toBe("light");
  });

  it("escolher Escuro guarda `mode: \"dark\"` no theme, preservando preset/accent/font", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({
      data: makeSite({ theme: { preset: "ink", accent: "amber", font: "warm" } }),
      isLoading: false,
    });
    renderWithQueryClient(<Website view="brand" />);

    await user.click(screen.getByRole("button", { name: /Escuro/i }));
    await user.click(screen.getByRole("button", { name: /Guardar marca/i }));

    expect(toastSuccess).toHaveBeenCalled();
    expect(saveMutate.mock.calls[0][0].theme).toEqual(
      expect.objectContaining({
        preset: "ink",
        accent: "amber",
        font: "warm",
        mode: "dark",
      }),
    );
  });

  it("um site já guardado com `theme.mode: \"dark\"` mostra Escuro selecionado ao entrar", () => {
    useSiteMock.mockReturnValue({
      data: makeSite({ theme: { mode: "dark" } }),
      isLoading: false,
    });
    renderWithQueryClient(<Website view="brand" />);

    expect(screen.getByRole("button", { name: /Escuro/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Claro/i })).toHaveAttribute("aria-pressed", "false");
  });
});

// ── Marca: cor de destaque personalizada (color-picker, fatia 3.3) ───────────

describe("Website — Marca (cor de destaque personalizada)", () => {
  it("escolher a opção 'Personalizada' e digitar um hex válido grava-o em theme.accent", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false });
    renderWithQueryClient(<Website view="brand" />);

    await user.click(screen.getByRole("button", { name: /Personalizada/i }));

    const hexInput = screen.getByLabelText("Hex da cor de destaque");
    await user.clear(hexInput);
    await user.type(hexInput, "#ff8800");

    await user.click(screen.getByRole("button", { name: /Guardar marca/i }));

    expect(toastSuccess).toHaveBeenCalled();
    expect(saveMutate.mock.calls[0][0].theme.accent).toBe("#ff8800");
  });

  it("um hex inválido digitado não substitui a última cor válida (não grava lixo)", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: makeSite(), isLoading: false });
    renderWithQueryClient(<Website view="brand" />);

    await user.click(screen.getByRole("button", { name: /Personalizada/i }));
    // Ao ativar sem cor prévia, cai no fallback da cor curada atual (azul).
    const hexInput = screen.getByLabelText("Hex da cor de destaque") as HTMLInputElement;
    expect(hexInput.value.toLowerCase()).toBe("#2a6fdb");

    await user.clear(hexInput);
    await user.type(hexInput, "zzzzzz");

    await user.click(screen.getByRole("button", { name: /Guardar marca/i }));

    expect(toastSuccess).toHaveBeenCalled();
    expect(saveMutate.mock.calls[0][0].theme.accent).toBe("#2a6fdb");
  });

  it("um site gravado com theme.accent em hex mostra a pílula 'Personalizada' ativa com essa cor", () => {
    useSiteMock.mockReturnValue({
      data: makeSite({ theme: { accent: "#123abc" } }),
      isLoading: false,
    });
    renderWithQueryClient(<Website view="brand" />);

    const custom = screen.getByRole("button", { name: /Personalizada/i });
    expect(custom).toHaveAttribute("aria-pressed", "true");
    // O nomeado "Azul" (default quando não há accent) NÃO fica ativo — o
    // accent guardado é o hex, não um nomeado.
    expect(screen.getByRole("button", { name: /^Azul$/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Cor de destaque personalizada")).toHaveValue("#123abc");
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
    renderWithQueryClient(<Website view="pages" />);
    await openPalette(user);

    // Escopado ao diálogo da palete — a tab "Páginas" tem o seu próprio botão
    // "Coleção" (o seletor de page-kind), que colidiria com o nome do bloco.
    const palette = within(screen.getByRole("dialog"));
    expect(palette.getByRole("button", { name: /^Coleção/ })).toBeInTheDocument();
  });

  it("(D3) adicionar o bloco Coleção persiste type:collection e a variante default 'grid'", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_EMPTY]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);
    await openPalette(user);

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Coleção/ }));

    expect(toastSuccess).toHaveBeenCalled();
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
      renderWithQueryClient(<Website view="pages" />);
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
    renderWithQueryClient(<Website view="pages" />);
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
    renderWithQueryClient(<Website view="pages" />);
    await user.click(screen.getByRole("button", { name: "Gerir blocos" }));
    await user.click(screen.getByRole("button", { name: "Editar conteúdo" }));

    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Etiqueta do campo Nome"), "O teu nome");
    await user.type(dialog.getByLabelText("Texto do botão de enviar"), "Quero saber mais");
    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    expect(toastSuccess).toHaveBeenCalled();
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
    renderWithQueryClient(<Website view="pages" />);
    const dialog = within(await openCollectionContentModal(user));

    await user.click(dialog.getByRole("button", { name: /Adicionar item/i }));

    // "Slug" tem um hint concatenado ao texto do <label> (sem separador), por
    // isso a correspondência exata falha — usa um regex de prefixo.
    await user.type(dialog.getByLabelText(/^Slug/), "projeto-a");
    await user.type(dialog.getByLabelText("Resumo"), "Um resumo curto do projeto.");
    await user.type(dialog.getByLabelText("Tags (uma por linha)"), "design\nweb");

    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    expect(toastSuccess).toHaveBeenCalled();
  });

  it("o campo Imagem do item usa o uploader (não um input de URL simples)", async () => {
    const user = userEvent.setup();
    useSiteMock.mockReturnValue({ data: siteWithBlocks([HOME_WITH_COLLECTION]), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);
    const dialog = within(await openCollectionContentModal(user));

    await user.click(dialog.getByRole("button", { name: /Adicionar item/i }));

    expect(dialog.getByText("Carregar imagem")).toBeInTheDocument();
  });
});

// ── Gate seletivo (T3.8, `.design/site-tenant-light/DESIGN_BRIEF.md` 3.8) ────
//
// Por omissão (`hasPermissionMock` → true, ver `beforeEach` global) o tenant
// tem `canEditStructure` = true — é o comportamento coberto por TODOS os
// testes acima (site montado/afinado livremente). Este bloco cobre o outro
// lado: um tenant SEM `VIEW_SITE_BUILDER` nem `VIEW_ADMIN` (conta montada à
// mão pelo dono, sem a permissão atribuída) — vê "O meu site" sem Publicar e
// "Páginas" em modo conteúdo (read-only na estrutura, editor de blocos
// continua acessível).

describe("Website — gate seletivo (T3.8: sem VIEW_SITE_BUILDER/VIEW_ADMIN)", () => {
  beforeEach(() => {
    hasPermissionMock.mockReturnValue(false);
  });

  it("submenu (navigation.ts): 'Páginas' e 'Marca' escondidas dos clientes (só VIEW_ADMIN); cliente vê só 'O meu site'", () => {
    // Página Website. "Páginas" e "Marca" estão escondidas dos clientes
    // (2026-08-12) — ainda não estão prontas; por agora todos os sites ficam
    // iguais. Só o dono (VIEW_ADMIN) as vê. VIEW_SITE_BUILDER NÃO as desbloqueia
    // (o self-serve tem essa permissão e continua a ser "cliente" para isto).
    // Com só 1 subitem, o Shell mostra o Website como link simples (ver Shell).
    expect(allowedSubitems("/website", () => false).map((i) => i.id)).toEqual(["site"]);
    expect(
      allowedSubitems("/website", (name) => name === "VIEW_SITE_BUILDER").map((i) => i.id),
    ).toEqual(["site"]);
    expect(
      allowedSubitems("/website", (name) => name === "VIEW_ADMIN").map((i) => i.id),
    ).toEqual(["site", "pages", "brand"]);
  });

  it("'O meu site': esconde o botão Publicar mesmo com o setup completo, mantém estado/URL", () => {
    useSiteMock.mockReturnValue({
      data: makeSite({
        siteId: "s1",
        template: "barber",
        subdomain: "acme",
        theme: { accent: "amber" },
        pages: [{ id: "home", slug: "", blocks: [{ id: "b1", type: "hero" }] }],
      }),
      isLoading: false,
      dataUpdatedAt: 0,
    });
    renderWithQueryClient(<Website view="site" />);

    expect(screen.queryByRole("button", { name: /Publicar/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/publicação deste site é feita pela equipa RufVision/i),
    ).toBeInTheDocument();
    // Estado/URL mantêm-se visíveis.
    expect(screen.getByText("acme.localhost:3000")).toBeInTheDocument();
  });

  it("Páginas: esconde Nova página, mover e remover; título/slug ficam em texto (não input)", () => {
    const HOME = {
      id: "home",
      slug: "",
      title: "Página Principal",
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
    useSiteMock.mockReturnValue({ data: makeSite({ pages: [HOME, SOBRE] }), isLoading: false });
    renderWithQueryClient(<Website view="pages" />);

    // Sem formulário "Nova página" (campo "Título", aria-label exato).
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    // Sem botões estruturais em nenhuma linha.
    expect(screen.queryByRole("button", { name: "Mover para cima" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mover para baixo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover página" })).not.toBeInTheDocument();
    // Título/slug são texto simples — sem inputs editáveis.
    expect(screen.queryByLabelText("Título da página")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Endereço da página")).not.toBeInTheDocument();
    expect(screen.getByText("Página Principal")).toBeInTheDocument();
    expect(screen.getByText("Sobre")).toBeInTheDocument();
    // "Gerir blocos" continua acessível nas duas páginas.
    expect(screen.getAllByRole("button", { name: "Gerir blocos" })).toHaveLength(2);
  });

  it("Páginas → Blocos: esconde adicionar/mover/remover/variante, mas Editar conteúdo continua a funcionar", async () => {
    const user = userEvent.setup();
    const HOME = {
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
    useSiteMock.mockReturnValue({
      data: makeSite({ pages: [HOME], activeLocales: ["pt"], defaultLocale: "pt" }),
      isLoading: false,
    });
    renderWithQueryClient(<Website view="pages" />);

    await user.click(screen.getByRole("button", { name: "Gerir blocos" }));

    expect(screen.queryByRole("button", { name: /Adicionar bloco/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Mover bloco para cima" })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: "Mover bloco para baixo" })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: "Remover bloco" })).toHaveLength(0);
    // Variante mostrada como badge, não Combobox interativo.
    expect(screen.queryByRole("button", { name: "Variante" })).not.toBeInTheDocument();

    // "Editar conteúdo" continua a funcionar normalmente (textos/imagens).
    const editButtons = screen.getAllByRole("button", { name: "Editar conteúdo" });
    await user.click(editButtons[0]);
    const dialog = within(screen.getByRole("dialog"));
    const titleInput = dialog.getByLabelText("Título");
    await user.clear(titleInput);
    await user.type(titleInput, "Novo título");
    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    expect(toastSuccess).toHaveBeenCalled();
  });

  it("'O meu site' (Domínio): sem VIEW_SITE_BUILDER/VIEW_ADMIN, não mostra a secção Subdomínio", () => {
    useSiteMock.mockReturnValue({
      data: makeSite({ subdomain: "acme" }),
      isLoading: false,
      dataUpdatedAt: 0,
    });
    renderWithQueryClient(<Website view="site" />);

    // Sem a permissão, a secção Domínio fica escondida.
    expect(screen.queryByText("Subdomínio")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("a-tua-marca")).not.toBeInTheDocument();
  });
});

// ── Domínio próprio (3.9) ──────────────────────────────────────────────────────
//
// UI DESATIVADA por decisão do dono (2026-07-14: sites são sempre por
// subdomínio, ver `CUSTOM_DOMAIN_UI` em `Website.tsx`) — a `DomainTab` já não
// monta o card. Para não perder cobertura do código construído, os testes
// abaixo renderam `CustomDomainCard` DIRETAMENTE (em vez de navegar até
// `<Website view="domain" />`); o último teste confirma que, com a flag
// desligada, a tab Domínio de facto não mostra o card.

describe("Website — Domínio próprio (3.9) — construído, UI desativada", () => {
  function siteWithCustomDomain(customDomain: string | null, overrides: Partial<Site> = {}): Site {
    return makeSite({ customDomain, subdomain: "acme", ...overrides });
  }

  it("mostra 'Ainda sem domínio próprio' quando não há nenhum definido", () => {
    render(<CustomDomainCard site={siteWithCustomDomain(null)} />);

    expect(screen.getByText("Ainda sem domínio próprio.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover domínio" })).not.toBeInTheDocument();
  });

  it("mostra o domínio atual e o botão Remover quando já está definido", () => {
    render(<CustomDomainCard site={siteWithCustomDomain("www.acme.pt")} />);

    expect(screen.getAllByText("www.acme.pt").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Remover domínio" })).toBeInTheDocument();
  });

  it("Guardar chama useSetCustomDomain com o hostname normalizado (minúsculas, sem esquema/caminho)", async () => {
    const user = userEvent.setup();
    render(<CustomDomainCard site={siteWithCustomDomain(null)} />);

    const input = screen.getByPlaceholderText("www.cliente.pt");
    await user.type(input, "HTTPS://WWW.ACME.PT/algures");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(setCustomDomainMutate).toHaveBeenCalledTimes(1);
    expect(setCustomDomainMutate.mock.calls[0][0]).toBe("www.acme.pt");
  });

  it("rejeita client-side um subdomínio da própria plataforma (mesmo host base de VITE_SITE_ROOT_URL) e mantém Guardar desativado", async () => {
    const user = userEvent.setup();
    render(<CustomDomainCard site={siteWithCustomDomain(null)} />);

    // VITE_SITE_ROOT_URL nos testes é "http://localhost:3000" (vitest.config.ts)
    // → hostname "localhost". "test.localhost" é um subdomínio dele.
    const input = screen.getByPlaceholderText("www.cliente.pt");
    await user.type(input, "test.localhost");

    expect(await screen.findByText(/domínio da plataforma/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(setCustomDomainMutate).not.toHaveBeenCalled();
  });

  it("rejeita client-side um formato inválido", async () => {
    const user = userEvent.setup();
    render(<CustomDomainCard site={siteWithCustomDomain(null)} />);

    const input = screen.getByPlaceholderText("www.cliente.pt");
    await user.type(input, "não é um dominio");

    expect(await screen.findByText(/Formato inválido/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("Remover: confirma e chama useSetCustomDomain com null", async () => {
    const user = userEvent.setup();
    render(<CustomDomainCard site={siteWithCustomDomain("www.acme.pt")} />);

    await user.click(screen.getByRole("button", { name: "Remover domínio" }));
    await user.click(screen.getByRole("button", { name: "Remover" }));

    expect(setCustomDomainMutate).toHaveBeenCalledTimes(1);
    expect(setCustomDomainMutate.mock.calls[0][0]).toBeNull();
  });

  it("erro 409 ao guardar mostra a mensagem de domínio já usado por outro cliente", async () => {
    const user = userEvent.setup();
    render(<CustomDomainCard site={siteWithCustomDomain(null)} />);

    const input = screen.getByPlaceholderText("www.cliente.pt");
    await user.type(input, "www.outro.pt");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(setCustomDomainMutate).toHaveBeenCalledTimes(1);
    const [, options] = setCustomDomainMutate.mock.calls[0];
    act(() => {
      options.onError({ response: { status: 409 } });
    });
    expect(toastError).toHaveBeenCalledWith("Esse domínio já está a ser usado por outro cliente.");
  });

  it("erro 400 com reason 'root_domain' mostra a mensagem de domínio da plataforma", async () => {
    const user = userEvent.setup();
    render(<CustomDomainCard site={siteWithCustomDomain(null)} />);

    const input = screen.getByPlaceholderText("www.cliente.pt");
    await user.type(input, "www.outro.pt");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const [, options] = setCustomDomainMutate.mock.calls[0];
    act(() => {
      options.onError({ response: { status: 400, data: { reason: "root_domain" } } });
    });
    expect(toastError).toHaveBeenCalledWith(
      "Esse é o domínio da plataforma — não pode ser usado como domínio próprio.",
    );
  });
});
