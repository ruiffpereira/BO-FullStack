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
