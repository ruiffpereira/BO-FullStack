import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({ save: vi.fn(), image: vi.fn(), video: vi.fn(), pdf: vi.fn() }));
vi.mock("../../../src/gen/backoffice/hooks/useUploadImage.js", () => ({ uploadImage: mocks.image }));
vi.mock("../../../src/gen/backoffice/hooks/useUploadVideo.js", () => ({ uploadVideo: mocks.video }));
vi.mock("../../../src/gen/backoffice/hooks/useUploadPdf.js", () => ({ uploadPdf: mocks.pdf }));
vi.mock("../../../src/hooks/useSiteBuilder", async () => {
  const actual = await vi.importActual<typeof import("../../../src/hooks/useSiteBuilder")>("../../../src/hooks/useSiteBuilder");
  return {
    ...actual,
    useSaveSiteBuilder: () => ({ mutateAsync: mocks.save }),
    usePublishSiteBuilder: () => ({ mutateAsync: vi.fn() }),
  };
});

import { findMissing } from "../../../src/pages/paginas/state/missing";
import {
  PendingUploadError,
  clearPending,
  collectPending,
  hasPending,
  registerPending,
  replaceUrls,
  uploadPending,
} from "../../../src/pages/paginas/state/pending";
import { BuilderProvider, initState, reduce, useBuilder } from "../../../src/pages/paginas/state/store";
import { setFieldValue } from "../../../src/pages/paginas/fields/edit";
import type { Catalog, Work } from "../../../src/pages/paginas/state/types";
import { block, sampleWork } from "./fixtures";

const png = (name = "foto.png") => new File(["x"], name, { type: "image/png" });
const pdf = (name = "cat.pdf") => new File(["%PDF-"], name, { type: "application/pdf" });
const mp4 = (name = "v.mp4") => new File(["x"], name, { type: "video/mp4" });

const catalog: Catalog = {
  components: [
    { type: "imagem", label: "Imagem", fields: { image: { type: "media", kind: "image" } } },
    { type: "documentos", label: "Documentos", fields: { items: { type: "list", of: { file: { type: "media", kind: "file" } } } } },
  ],
};

function workWith(values: Record<string, unknown>): Work {
  const w = sampleWork();
  w.blocks = [block("b1", { comps: [{ id: "c1", type: "imagem", style: "normal", col: "all", v: values }] })];
  return w;
}

beforeEach(() => {
  clearPending();
  Object.values(mocks).forEach((m) => m.mockReset());
});

describe("pending · registo e varrimento", () => {
  it("encontra os marcadores registados em qualquer fundura; ignora blob: desconhecidos", () => {
    const a = registerPending(png(), "image");
    const b = registerPending(pdf(), "file");
    const w = workWith({
      image: { same: true, values: { pt: a } },
      items: [{ _id: "k1", file: { same: false, values: { pt: b, en: b } } }],
      texto: "blob:que-ninguem-registou",
    });
    expect(collectPending(w)).toEqual([a, b]);
    expect(hasPending(w)).toBe(true);
    expect(hasPending(workWith({ image: { same: true, values: { pt: "https://cdn/a.webp" } } }))).toBe(false);
  });

  it("replaceUrls devolve a mesma referência quando nada muda", () => {
    const w = workWith({ image: { same: true, values: { pt: "https://cdn/a.webp" } } });
    expect(replaceUrls(w, { "blob:x": "https://cdn/x" })).toBe(w);
  });
});

describe("pending · uploadPending", () => {
  it("envia imagem, vídeo e PDF pelos endpoints certos e troca os marcadores pelos URLs", async () => {
    mocks.image.mockResolvedValue({ fileUrl: "https://cdn/img.webp", key: "k1" });
    mocks.video.mockResolvedValue({ fileUrl: "https://cdn/v.mp4", key: "k2" });
    mocks.pdf.mockResolvedValue({ fileUrl: "https://cdn/c.pdf", key: "k3" });
    const i = registerPending(png(), "image");
    const v = registerPending(mp4(), "video");
    const p = registerPending(pdf(), "file");
    const w = workWith({ image: { same: true, values: { pt: i } }, video: { same: true, values: { pt: v } }, doc: { same: false, values: { pt: p, en: p } } });

    const { work, map } = await uploadPending(w);

    expect(mocks.image).toHaveBeenCalledWith({ image: expect.any(File), module: "cms" });
    expect(mocks.video).toHaveBeenCalledWith({ file: expect.any(File), module: "cms" });
    expect(mocks.pdf).toHaveBeenCalledWith({ file: expect.any(File) });
    expect(mocks.pdf).toHaveBeenCalledTimes(1); // o mesmo marcador em duas línguas sobe uma vez
    expect(map).toEqual({ [i]: "https://cdn/img.webp", [v]: "https://cdn/v.mp4", [p]: "https://cdn/c.pdf" });
    expect(JSON.stringify(work)).not.toContain("blob:");
    expect((work.blocks[0].comps[0] as { v: Record<string, unknown> }).v.doc).toEqual({ same: false, values: { pt: "https://cdn/c.pdf", en: "https://cdn/c.pdf" } });
  });

  it("sem pendentes não chama a API e devolve o mesmo trabalho", async () => {
    const w = workWith({ image: { same: true, values: { pt: "https://cdn/a.webp" } } });
    const r = await uploadPending(w);
    expect(r.work).toBe(w);
    expect(mocks.image).not.toHaveBeenCalled();
  });

  it("falha: lança com o nome do ficheiro e a razão do servidor, e nada é devolvido", async () => {
    mocks.image.mockRejectedValue({ response: { data: { error: "Imagem demasiado grande" } } });
    const w = workWith({ image: { same: true, values: { pt: registerPending(png("grande.png"), "image") } } });
    await expect(uploadPending(w)).rejects.toThrow(PendingUploadError);
    await expect(uploadPending(w)).rejects.toThrow("Não foi possível carregar «grande.png»: Imagem demasiado grande");
  });

  it("não repete um envio já feito (ex.: o save falhou depois e a cliente volta a gravar)", async () => {
    mocks.image.mockResolvedValue({ fileUrl: "https://cdn/img.webp", key: "k" });
    const u = registerPending(png(), "image");
    const w = workWith({ image: { same: true, values: { pt: u } } });
    await uploadPending(w);
    const again = await uploadPending(w);
    expect(mocks.image).toHaveBeenCalledTimes(1);
    expect(again.map).toEqual({ [u]: "https://cdn/img.webp" });
  });
});

describe("missing · um pendente conta como valor presente", () => {
  const lang = { languages: ["pt", "en"], defaultLanguage: "pt" };

  it("base com marcador e outra língua vazia: falta só a que está vazia", () => {
    const u = registerPending(png(), "image");
    const w = workWith({ image: { same: false, values: { pt: u } } });
    expect(findMissing(w, catalog, null, lang)).toEqual([{ entity: "block", id: "b1", path: "comps.c1.v.image", locale: "en" }]);
  });

  it("marcador em todas as línguas: não falta nada; com same:true nunca falta", () => {
    const a = registerPending(png(), "image");
    const b = registerPending(png(), "image");
    expect(findMissing(workWith({ image: { same: false, values: { pt: a, en: b } } }), catalog, null, lang)).toEqual([]);
    expect(findMissing(workWith({ image: { same: true, values: { pt: a } } }), catalog, null, lang)).toEqual([]);
  });
});

// ── o Guardar do store ────────────────────────────────────────────────────────

const data = () => ({
  enabled: true,
  revision: 4,
  languages: ["pt", "en"],
  defaultLanguage: "pt",
  catalog,
  manifest: { backgrounds: [{ id: "claro", label: "Claro" }], specials: {} },
  pages: [{ id: "p1", slug: "", isHome: true, sortOrder: 0, title: { pt: "Início", en: "Home" }, status: "published" }],
  items: { p1: [{ id: "i1", kind: "block", blockId: "b1", hidden: false }] },
  blocks: [{ id: "b1", name: "Herói", folderId: null, sortOrder: 0, layout: 1, bg: "claro", anchor: null, comps: [{ id: "c1", type: "imagem", style: "normal", col: "all", v: {} }] }],
  folders: [],
  parts: { topo: null, rodape: null },
  redirects: [],
  publish: { mode: "coolify", status: "live", liveRevision: 4, requestedAt: null, error: null },
  limits: {},
});

function Harness() {
  const b = useBuilder();
  const comp = b.state.work.blocks[0].comps[0] as { v: Record<string, unknown> };
  return (
    <div>
      <button
        onClick={() => {
          const url = registerPending(png("capa.png"), "image");
          b.edit((w) => setFieldValue(w, { entity: "block", id: "b1", compId: "c1" }, "image", { same: true, values: { pt: url } }));
        }}
      >
        escolher
      </button>
      <button onClick={() => void b.save()}>gravar</button>
      <span data-testid="status">{b.state.status}</span>
      <span data-testid="dirty">{String(b.dirty)}</span>
      <span data-testid="failure">{b.state.failure?.message ?? ""}</span>
      <span data-testid="value">{JSON.stringify(comp.v)}</span>
      <span data-testid="undo">{String(b.canUndo)}</span>
    </div>
  );
}

function renderHarness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const d = data();
  return render(
    <QueryClientProvider client={qc}>
      <BuilderProvider data={d as never} refetch={async () => d as never}>
        <Harness />
      </BuilderProvider>
    </QueryClientProvider>,
  );
}

describe("Guardar · upload diferido", () => {
  it("escolher não envia nada; o Guardar envia, grava SÓ com URLs reais e limpa o trabalho", async () => {
    mocks.image.mockResolvedValue({ fileUrl: "https://cdn/capa.webp", key: "k" });
    mocks.save.mockResolvedValue({ revision: 5, redirectsAdded: [] });
    renderHarness();

    fireEvent.click(screen.getByText("escolher"));
    expect(mocks.image).not.toHaveBeenCalled();
    expect(screen.getByTestId("value").textContent).toContain("blob:");

    fireEvent.click(screen.getByText("gravar"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.image).toHaveBeenCalledTimes(1);

    const body = mocks.save.mock.calls[0][0].data;
    expect(JSON.stringify(body)).not.toContain("blob:");
    expect(body.blocks.upsert[0].comps[0].v.image).toEqual({ same: true, values: { pt: "https://cdn/capa.webp" } });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("idle"));
    expect(screen.getByTestId("dirty")).toHaveTextContent("false");
    expect(screen.getByTestId("value").textContent).toContain("https://cdn/capa.webp");
    expect(screen.getByTestId("value").textContent).not.toContain("blob:");
  });

  it("falha de upload: o Guardar pára com mensagem, não grava e o ficheiro continua por carregar", async () => {
    mocks.image.mockRejectedValue({ response: { data: { error: "Storage indisponível" } } });
    renderHarness();

    fireEvent.click(screen.getByText("escolher"));
    fireEvent.click(screen.getByText("gravar"));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByTestId("failure")).toHaveTextContent("Não foi possível carregar «capa.png»: Storage indisponível");
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
    expect(screen.getByTestId("value").textContent).toContain("blob:");
  });

  it("depois de uma falha, voltar a gravar tenta outra vez e grava", async () => {
    mocks.image.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ fileUrl: "https://cdn/capa.webp", key: "k" });
    mocks.save.mockResolvedValue({ revision: 5, redirectsAdded: [] });
    renderHarness();

    fireEvent.click(screen.getByText("escolher"));
    fireEvent.click(screen.getByText("gravar"));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    fireEvent.click(screen.getByText("gravar"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(mocks.save.mock.calls[0][0].data)).not.toContain("blob:");
  });

  it("o save falha (422) depois do upload: o URL real fica no trabalho e não se envia o ficheiro de novo", async () => {
    mocks.image.mockResolvedValue({ fileUrl: "https://cdn/capa.webp", key: "k" });
    mocks.save
      .mockRejectedValueOnce({ response: { status: 422, data: { code: "VALIDATION", issues: [{ code: "BAD", entity: "block", id: "b1", message: "x" }] } } })
      .mockResolvedValueOnce({ revision: 5, redirectsAdded: [] });
    renderHarness();

    fireEvent.click(screen.getByText("escolher"));
    fireEvent.click(screen.getByText("gravar"));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("invalid"));
    expect(screen.getByTestId("value").textContent).toContain("https://cdn/capa.webp");

    fireEvent.click(screen.getByText("gravar"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.image).toHaveBeenCalledTimes(1);
  });

  it("mediaUploaded troca os marcadores no estado atual SEM criar entrada nova no desfazer", () => {
    const u = registerPending(png(), "image");
    let st = initState(workWith({}), 1);
    st = reduce(st, { type: "edit", update: (w) => setFieldValue(w, { entity: "block", id: "b1", compId: "c1" }, "image", { same: true, values: { pt: u } }) });
    expect(st.history.stack).toHaveLength(2);
    st = reduce(st, { type: "mediaUploaded", map: { [u]: "https://cdn/capa.webp" } });
    expect(st.history.stack).toHaveLength(2);
    expect(JSON.stringify(st.work)).toContain("https://cdn/capa.webp");
    expect(JSON.stringify(st.history.stack[st.history.i])).toContain("https://cdn/capa.webp");
    expect(reduce(st, { type: "mediaUploaded", map: { [u]: "https://cdn/capa.webp" } })).toBe(st); // já trocado: nada a fazer
  });
});
