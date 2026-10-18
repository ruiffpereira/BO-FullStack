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
import { PROGRESS_CAP, PublishBar, PublishNowButton, StatusText, progressPercent, publishBar, publishLine } from "../../../src/pages/paginas/components/PublishStatus";
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
const coolify = (over: Pub = {}) => ({ mode: "coolify", status: "live", liveRevision: 4, requestedAt: null, error: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("publishLine — cada estado", () => {
  const base = { save: "idle" as const, dirty: false };
  it("alterações por guardar vêm antes de tudo o que é publicação", () => {
    expect(publishLine({ ...base, dirty: true, publish: coolify({ status: "running" }) as never }).text).toBe("Alterações por guardar");
  });
  it("a guardar / conflito / erro", () => {
    expect(publishLine({ ...base, save: "saving", publish: coolify() as never }).text).toBe("A guardar…");
    expect(publishLine({ ...base, save: "conflict", publish: coolify() as never }).text).toBe("Conta alterada noutro sítio");
    expect(publishLine({ ...base, save: "invalid", publish: coolify() as never }).text).toBe("Não foi possível guardar");
  });
  it("pending e running → A publicar no site…", () => {
    expect(publishLine({ ...base, publish: coolify({ status: "pending" }) as never }).text).toBe("A publicar no site…");
    expect(publishLine({ ...base, publish: coolify({ status: "running" }) as never }).text).toBe("A publicar no site…");
  });
  it("failed → Falhou a publicação (em coolify o motivo vai na barra); noutro modo com o motivo", () => {
    expect(publishLine({ ...base, publish: coolify({ status: "failed", error: "O Coolify indicou que o deploy falhou." }) as never }).text).toBe("Falhou a publicação");
    expect(publishLine({ ...base, publish: { mode: "runtime", status: "failed", error: "X" } as never }).text).toBe("Falhou: X");
    expect(publishLine({ ...base, publish: coolify({ status: "failed" }) as never }).text).toBe("Falhou a publicação");
  });
  it("live → No ar · hh:mm de liveAt (nunca a hora do pedido); sem hora → No ar", () => {
    const iso = "2026-10-15T14:05:00";
    const later = "2026-10-15T14:09:00";
    const hhmm = (s: string) => new Date(s).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    expect(publishLine({ ...base, publish: coolify({ liveAt: later, requestedAt: iso }) as never }).text).toBe(`No ar · ${hhmm(later)}`);
    expect(publishLine({ ...base, publish: coolify({ requestedAt: iso }) as never }).text).toBe("No ar");
    // Em coolify a gravação desta sessão ainda não está no ar: não conta.
    expect(publishLine({ ...base, publish: coolify({ liveAt: iso }) as never, savedAt: later }).text).toBe(`No ar · ${hhmm(iso)}`);
  });
  it("runtime → a gravação desta sessão ganha ao liveAt lido no arranque", () => {
    const iso = "2026-10-15T14:05:00";
    const later = "2026-10-15T14:09:00";
    const hhmm = (s: string) => new Date(s).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    const runtime = { mode: "runtime", status: "idle", liveAt: iso } as never;
    expect(publishLine({ ...base, publish: runtime }).text).toBe(`No ar · ${hhmm(iso)}`);
    expect(publishLine({ ...base, publish: runtime, savedAt: later }).text).toBe(`No ar · ${hhmm(later)}`);
  });
  it("runtime: No ar logo após gravar; coolify sem publicações: Guardado", () => {
    expect(publishLine({ ...base, publish: { mode: "runtime", status: "idle" } as never }).text).toBe("No ar");
    expect(publishLine({ ...base, publish: coolify({ status: "idle" }) as never }).text).toBe("Guardado");
  });
});

describe("refetch do estado", () => {
  it("só repete (5 s) em pending/running; pára em live, failed, idle e sem dados", () => {
    expect(POLL_MS).toBe(5_000);
    expect(publishRefetchInterval({ publish: { status: "pending" } })).toBe(5_000);
    expect(publishRefetchInterval({ publish: { status: "running" } })).toBe(5_000);
    for (const status of ["live", "failed", "idle"]) expect(publishRefetchInterval({ publish: { status } })).toBe(false);
    expect(publishRefetchInterval(undefined)).toBe(false);
    expect(publishRefetchInterval({ enabled: false })).toBe(false);
  });
});

describe("barra: estado e Publicar agora", () => {
  it("mostra o estado a partir do publish do GET", () => {
    renderBar(coolify({ status: "running" }));
    expect(screen.getByRole("status")).toHaveTextContent("A publicar no site…");
  });

  it("alterações por guardar: o estado muda e o botão fica desligado", () => {
    renderBar(coolify());
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
    renderBar(coolify({ status: "running" }));
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeDisabled();
  });

  it("202: avisa e volta a ler o estado", async () => {
    h.publish.mockResolvedValue({ publish: { status: "pending" } });
    const { spy } = renderBar(coolify());
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("A publicar no site…"));
    expect(spy).toHaveBeenCalled();
    expect(h.toastError).not.toHaveBeenCalled();
  });

  it.each([
    [409, "PUBLISH_NOT_COOLIFY", /publica sozinho ao guardar/],
    [409, "PUBLISH_NOT_CONFIGURED", /ainda não está configurada/],
    [409, "PUBLISH_IN_PROGRESS", /publicação a decorrer/],
    [429, "TOO_SOON", /Espera um minuto/],
    [502, "DISPATCH_FAILED", /Não foi possível pedir a publicação/],
  ])("%i %s → mensagem humana", async (status, code, msg) => {
    h.publish.mockRejectedValue(apiErr(status, { code, error: "texto técnico da API" }));
    renderBar(coolify());
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

describe("barra persistente da publicação (Coolify)", () => {
  const T0 = Date.parse("2026-10-18T10:00:00Z");
  const iso = (ms: number) => new Date(ms).toISOString();

  it("progressPercent: decorrido ÷ estimado, tecto de 95 %, sem base → null", () => {
    expect(progressPercent(iso(T0), 100_000, T0 + 40_000)).toBe(40);
    expect(progressPercent(iso(T0), 100_000, T0 + 500_000)).toBe(PROGRESS_CAP);
    expect(progressPercent(iso(T0), 100_000, T0 - 5_000)).toBe(0);
    expect(progressPercent(iso(T0), null, T0 + 1)).toBeNull();
    expect(progressPercent(null, 100_000, T0 + 1)).toBeNull();
    expect(progressPercent("lixo", 100_000, T0 + 1)).toBeNull();
  });

  it("publishBar: cada fase, falha, live só depois de visto a correr, runtime nunca", () => {
    const run = (over: Pub) => coolify({ status: "running", startedAt: iso(T0), estimatedMs: 100_000, ...over }) as never;
    expect(publishBar(coolify({ status: "pending" }) as never, T0, false)).toEqual({ kind: "progress", label: "Em fila…", percent: null });
    expect(publishBar(run({ phase: "queued" }), T0 + 10_000, false)).toEqual({ kind: "progress", label: "Em fila…", percent: 10 });
    expect(publishBar(run({ phase: "building" }), T0 + 50_000, false)).toMatchObject({ label: "A construir o site…", percent: 50 });
    expect(publishBar(run({ phase: "confirming", estimatedMs: null }), T0, false)).toEqual({ kind: "progress", label: "A confirmar…", percent: null });
    expect(publishBar(coolify({ status: "failed", error: "O Coolify indicou que o deploy falhou." }) as never, T0, false)).toEqual({
      kind: "failed",
      label: "Falhou: O Coolify indicou que o deploy falhou.",
    });
    const liveAt = "2026-10-18T10:02:00";
    expect(publishBar(coolify({ liveAt }) as never, T0, false)).toBeNull();
    const t = new Date(liveAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    expect(publishBar(coolify({ liveAt }) as never, T0, true)).toEqual({ kind: "live", label: `Site actualizado · ${t}` });
    expect(publishBar({ mode: "runtime", status: "running" } as never, T0, true)).toBeNull();
    expect(publishBar(coolify({ status: "idle" }) as never, T0, true)).toBeNull();
  });

  function renderPublishBar(publish: Pub) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <BuilderProvider data={data(publish) as never} refetch={async () => undefined}>
          <PublishBar />
        </BuilderProvider>
      </QueryClientProvider>,
    );
  }

  it("a correr: mostra a fase e a percentagem; parado no ar ao abrir: sem barra", () => {
    const now = Date.now();
    renderPublishBar(coolify({ status: "running", phase: "building", startedAt: new Date(now - 30_000).toISOString(), estimatedMs: 60_000 }));
    const bar = screen.getByTestId("publish-bar");
    expect(bar).toHaveTextContent("A construir o site…");
    expect(bar).toHaveTextContent(/5\d%/);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow");
  });

  it("parado no ar ao abrir: sem barra; falhou: barra com o motivo", () => {
    const { unmount } = renderPublishBar(coolify({ liveAt: new Date().toISOString() }));
    expect(screen.queryByTestId("publish-bar")).not.toBeInTheDocument();
    unmount();
    renderPublishBar(coolify({ status: "failed", error: "Tempo esgotado" }));
    expect(screen.getByTestId("publish-bar")).toHaveAttribute("data-kind", "failed");
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou: Tempo esgotado");
  });
});
