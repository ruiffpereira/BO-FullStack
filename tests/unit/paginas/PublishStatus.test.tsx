import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  publish: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../../../src/hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({ readOnly: false, reason: "ok", message: "" }),
}));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));
vi.mock("../../../src/hooks/useSiteBuilder", async () => {
  const actual = await vi.importActual<typeof import("../../../src/hooks/useSiteBuilder")>("../../../src/hooks/useSiteBuilder");
  return {
    ...actual,
    useSaveSiteBuilder: () => ({ mutateAsync: vi.fn() }),
    usePublishSiteBuilder: () => ({ mutateAsync: h.publish }),
  };
});

import { POLL_MS, publishErrorMessage, publishRefetchInterval, readApiFailure } from "../../../src/hooks/useSiteBuilder";
import { PublishNowButton, StatusText, publishLine } from "../../../src/pages/paginas/components/PublishStatus";
import { BuilderProvider, useBuilder } from "../../../src/pages/paginas/state/store";

type Pub = Record<string, unknown>;
const data = (publish: Pub) => ({
  enabled: true,
  revision: 4,
  languages: ["pt"],
  defaultLanguage: "pt",
  catalog: { components: [] },
  manifest: { backgrounds: [{ id: "claro", label: "Claro" }], specials: {} },
  pages: [{ id: "p1", slug: "", isHome: true, sortOrder: 0, title: { pt: "Início" }, status: "published" }],
  items: { p1: [] },
  blocks: [],
  folders: [],
  parts: { topo: null, rodape: null },
  redirects: [],
  publish,
  limits: {},
});

function Dirtier() {
  const { edit } = useBuilder();
  return (
    <button onClick={() => edit((w) => ({ ...w, pages: w.pages.map((p) => ({ ...p, title: { pt: "Outro" } })) }))}>sujar</button>
  );
}

function renderBar(publish: Pub) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, "invalidateQueries");
  render(
    <QueryClientProvider client={qc}>
      <BuilderProvider data={data(publish) as never} refetch={async () => undefined}>
        <StatusText />
        <PublishNowButton />
        <Dirtier />
      </BuilderProvider>
    </QueryClientProvider>,
  );
  return { spy };
}

const apiErr = (status: number, data: unknown) => ({ response: { status, data } });
const github = (over: Pub = {}) => ({ mode: "github", status: "live", liveRevision: 4, requestedAt: null, error: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("publishLine — cada estado", () => {
  const base = { save: "idle" as const, dirty: false };
  it("alterações por guardar vêm antes de tudo o que é publicação", () => {
    expect(publishLine({ ...base, dirty: true, publish: github({ status: "running" }) as never }).text).toBe("Alterações por guardar");
  });
  it("a guardar / conflito / erro", () => {
    expect(publishLine({ ...base, save: "saving", publish: github() as never }).text).toBe("A guardar…");
    expect(publishLine({ ...base, save: "conflict", publish: github() as never }).text).toBe("Conta alterada noutro sítio");
    expect(publishLine({ ...base, save: "invalid", publish: github() as never }).text).toBe("Não foi possível guardar");
  });
  it("pending e running → A publicar no site…", () => {
    expect(publishLine({ ...base, publish: github({ status: "pending" }) as never }).text).toBe("A publicar no site…");
    expect(publishLine({ ...base, publish: github({ status: "running" }) as never }).text).toBe("A publicar no site…");
  });
  it("failed → Falhou: <motivo>, com e sem motivo", () => {
    expect(publishLine({ ...base, publish: github({ status: "failed", error: "Workflow não encontrado" }) as never }).text).toBe("Falhou: Workflow não encontrado");
    expect(publishLine({ ...base, publish: github({ status: "failed" }) as never }).text).toBe("Falhou a publicação");
  });
  it("live → No ar · hh:mm (do último pedido, ou da gravação desta sessão); sem hora → No ar", () => {
    const iso = "2026-10-15T14:05:00";
    const hhmm = new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    expect(publishLine({ ...base, publish: github({ requestedAt: iso }) as never }).text).toBe(`No ar · ${hhmm}`);
    expect(publishLine({ ...base, publish: github(), savedAt: iso }).text).toBe(`No ar · ${hhmm}`);
    expect(publishLine({ ...base, publish: github() as never }).text).toBe("No ar");
  });
  it("runtime: No ar logo após gravar; github sem publicações: Guardado", () => {
    expect(publishLine({ ...base, publish: { mode: "runtime", status: "idle" } as never }).text).toBe("No ar");
    expect(publishLine({ ...base, publish: github({ status: "idle" }) as never }).text).toBe("Guardado");
  });
});

describe("refetch do estado", () => {
  it("só repete (10 s) em pending/running; pára em live, failed, idle e sem dados", () => {
    expect(POLL_MS).toBe(10_000);
    expect(publishRefetchInterval({ publish: { status: "pending" } })).toBe(10_000);
    expect(publishRefetchInterval({ publish: { status: "running" } })).toBe(10_000);
    for (const status of ["live", "failed", "idle"]) expect(publishRefetchInterval({ publish: { status } })).toBe(false);
    expect(publishRefetchInterval(undefined)).toBe(false);
    expect(publishRefetchInterval({ enabled: false })).toBe(false);
  });
});

describe("barra: estado e Publicar agora", () => {
  it("mostra o estado a partir do publish do GET", () => {
    renderBar(github({ status: "running" }));
    expect(screen.getByRole("status")).toHaveTextContent("A publicar no site…");
  });

  it("alterações por guardar: o estado muda e o botão fica desligado", () => {
    renderBar(github());
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeEnabled();
    fireEvent.click(screen.getByText("sujar"));
    expect(screen.getByRole("status")).toHaveTextContent("Alterações por guardar");
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeDisabled();
  });

  it("modo runtime: sem botão, e o estado é No ar", () => {
    renderBar({ mode: "runtime", status: "idle", liveRevision: null, requestedAt: null, error: null });
    expect(screen.queryByRole("button", { name: "Publicar agora" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No ar");
  });

  it("a correr: Publicar agora desligado", () => {
    renderBar(github({ status: "running" }));
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeDisabled();
  });

  it("202: avisa e volta a ler o estado", async () => {
    h.publish.mockResolvedValue({ publish: { status: "pending" } });
    const { spy } = renderBar(github());
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("A publicar no site…"));
    expect(spy).toHaveBeenCalled();
    expect(h.toastError).not.toHaveBeenCalled();
  });

  it.each([
    [409, "PUBLISH_NOT_GITHUB", /publica sozinho ao guardar/],
    [409, "PUBLISH_NOT_CONFIGURED", /ainda não está configurada/],
    [409, "PUBLISH_IN_PROGRESS", /publicação a decorrer/],
    [429, "TOO_SOON", /Espera um minuto/],
    [502, "DISPATCH_FAILED", /Não foi possível pedir a publicação/],
  ])("%i %s → mensagem humana", async (status, code, msg) => {
    h.publish.mockRejectedValue(apiErr(status, { code, error: "texto técnico da API" }));
    renderBar(github());
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledTimes(1));
    const shown = h.toastError.mock.calls[0][0] as string;
    expect(shown).toMatch(msg);
    expect(shown).not.toMatch(/texto técnico/);
  });

  it("publishErrorMessage: erro desconhecido devolve a mensagem da API", () => {
    expect(publishErrorMessage(readApiFailure(apiErr(500, { error: "Erro interno" })))).toBe("Erro interno");
  });
});
