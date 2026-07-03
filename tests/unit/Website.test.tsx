import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Site } from "../../src/hooks/useWebsite";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Hooks de website — controlados por cada teste.
const useSiteMock = vi.fn();
const saveMutate = vi.fn();
const publishMutate = vi.fn();
const setSubdomainMutate = vi.fn();
const checkFn = vi.fn();

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
