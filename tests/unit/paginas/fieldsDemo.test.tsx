import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../src/hooks/useSiteBuilder", async () => {
  const actual = await vi.importActual<typeof import("../../../src/hooks/useSiteBuilder")>("../../../src/hooks/useSiteBuilder");
  return { ...actual, useSaveSiteBuilder: () => ({ mutateAsync: vi.fn() }), usePublishSiteBuilder: () => ({ mutateAsync: vi.fn() }) };
});

import { CenterColumn } from "../../../src/pages/paginas/components/CenterColumn";
import { BuilderProvider, useBuilder } from "../../../src/pages/paginas/state/store";

const d = {
  enabled: true,
  revision: 1,
  languages: ["pt", "en"],
  defaultLanguage: "pt",
  catalog: {
    components: [
      { type: "titulo", label: "Título", fields: { text: { type: "text", i18n: true }, level: { type: "choice", options: ["h1", "h2"], default: "h2", seo: true } } },
    ],
  },
  manifest: { specials: { faixa: { label: "Faixa a passar", fields: { eyebrow: { type: "text", i18n: true } } } } },
  pages: [{ id: "p1", slug: "", isHome: true, sortOrder: 0, title: { pt: "Início", en: "Home" }, status: "published" }],
  items: { p1: [{ id: "i9", kind: "special", specialType: "faixa", specialData: { eyebrow: { pt: "Olá", en: "Hi" } }, hidden: false }] },
  blocks: [{ id: "b1", name: "Herói", folderId: null, sortOrder: 0, layout: 1, bg: "claro", anchor: null, comps: [{ id: "c1", type: "titulo", style: "normal", col: "all", v: { text: { pt: "Olá", en: "Hi" } } }] }],
  folders: [],
  parts: { topo: null, rodape: null },
  redirects: [],
  publish: { mode: "github", status: "live", liveRevision: 1, requestedAt: null, error: null },
  limits: {},
};

function Open({ libId, itemId }: { libId?: string; itemId?: string }) {
  const b = useBuilder();
  useEffect(() => {
    if (libId) b.select({ libId });
    else if (itemId) b.select({ sel: { kind: "item", id: itemId } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <CenterColumn className="flex" onBack={() => {}} onAdd={() => {}} flash={null} onFlash={() => {}} />
      <button onClick={b.undo}>desfazer</button>
      <span data-testid="dirty">{String(b.dirty)}</span>
    </>
  );
}

const renderOpen = (props: { libId?: string; itemId?: string }) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BuilderProvider data={d as never} refetch={async () => d as never}>
        <Open {...props} />
      </BuilderProvider>
    </QueryClientProvider>,
  );

describe("F13 · demo no marcador do editor", () => {
  it("bloco da biblioteca aberto: campos do 1.º componente ligados ao reducer; escrever seguido = um desfazer", async () => {
    renderOpen({ libId: "b1" });
    expect(screen.getByRole("heading", { name: "Herói" })).toBeInTheDocument();
    expect(screen.getByLabelText("Texto (PT)")).toHaveValue("Olá");
    // campo seo no fim, na caixa Google (SEO)
    expect(screen.getByRole("region", { name: "Google (SEO)" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Texto (EN)"), "!!");
    expect(screen.getByLabelText("Texto (EN)")).toHaveValue("Hi!!");
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
    fireEvent.click(screen.getByText("desfazer"));
    expect(screen.getByLabelText("Texto (EN)")).toHaveValue("Hi"); // as duas teclas foram UMA entrada
    expect(screen.getByTestId("dirty")).toHaveTextContent("false");
  });

  it("especial aberto: campos do manifest", () => {
    renderOpen({ itemId: "i9" });
    expect(screen.getByLabelText("Etiqueta (PT)")).toHaveValue("Olá");
  });
});
