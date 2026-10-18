import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

// «Definições do site»: o cliente edita o nome; manifest e publicação só numa sessão de suporte.
// Hooks gerados mockados; guardamos as `options.mutation` para testar o que o modal faz com o resultado.

const s = vi.hoisted(() => ({
  support: null as unknown,
  dirty: false,
  adopt: vi.fn(),
  reload: vi.fn(async () => {}),
  importZip: vi.fn(),
  siteName: "Winterplateau" as string | null,
  shareImage: null as string | null,
  shareImageAlt: null as Record<string, string> | null,
  upload: vi.fn(),
  supportData: {} as Record<string, unknown>,
  settings: vi.fn(),
  manifest: vi.fn(),
  publish: vi.fn(),
  test: vi.fn(),
  opts: {} as Record<string, any>,
}));

const hook = (name: string, fn: (...a: unknown[]) => unknown) => (o: any) => {
  s.opts[name] = o?.mutation;
  return { mutate: fn, isPending: false };
};
vi.mock("../../../src/context/AuthContext", () => ({ useAuth: () => ({ supportSession: s.support }) }));
vi.mock("../../../src/pages/paginas/state/store", () => ({
  useBuilder: () => ({ dirty: s.dirty, adoptRevision: s.adopt, reload: s.reload, siteName: s.siteName, lang: { defaultLanguage: "pt", languages: ["pt", "en"] } }),
}));
vi.mock("../../../src/pages/paginas/state/pending", () => ({ defaultUploader: (...a: unknown[]) => s.upload(...a) }));
vi.mock("../../../src/hooks/useSiteBuilder", () => ({
  useSiteBuilderQuery: () => ({ data: { siteName: s.siteName, shareImage: s.shareImage, shareImageAlt: s.shareImageAlt } }),
  siteBuilderQueryKey: () => [{ url: "/cms/site-builder" }],
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("../../../src/gen/backoffice/hooks/usePutCmsSiteBuilderSettings.js", () => ({
  usePutCmsSiteBuilderSettings: (o: any) => hook("settings", s.settings)(o),
}));
vi.mock("../../../src/gen/backoffice/hooks/useGetCmsSiteBuilderSupport.js", () => ({
  useGetCmsSiteBuilderSupport: () => ({ data: s.supportData, isLoading: false, isError: false }),
  getCmsSiteBuilderSupportQueryKey: () => [{ url: "/cms/site-builder/support" }],
}));
vi.mock("../../../src/gen/backoffice/hooks/usePutCmsSiteBuilderSupportManifest.js", () => ({
  usePutCmsSiteBuilderSupportManifest: (o: any) => hook("manifest", s.manifest)(o),
}));
vi.mock("../../../src/gen/backoffice/hooks/usePutCmsSiteBuilderSupportPublish.js", () => ({
  usePutCmsSiteBuilderSupportPublish: (o: any) => hook("publish", s.publish)(o),
}));
vi.mock("../../../src/gen/backoffice/hooks/usePostCmsSiteBuilderSupportPublishTest.js", () => ({
  usePostCmsSiteBuilderSupportPublishTest: (o: any) => hook("test", s.test)(o),
}));
vi.mock("../../../src/gen/backoffice/hooks/useImportSiteZip.js", () => ({
  useImportSiteZip: () => ({ mutateAsync: s.importZip }),
}));
vi.mock("../../../src/components/GuardButton", () => ({
  GuardButton: ({ children, isLoading: _l, ...rest }: any) => <button {...rest}>{children}</button>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  SiteSettingsModal, buildPublishBody, buildShareAlt, hasExistingContent, manifestFailure, formatBytes, importSummaryLine, importLanguagesLine, importDoneMessage,
  importFileProblem, canImport, importFailure,
} from "../../../src/pages/paginas/components/SiteSettingsModal";

const apiErr = (status: number, data: unknown) => ({ response: { status, data } });
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const renderModal = () => render(<SiteSettingsModal open onClose={vi.fn()} />);

beforeEach(() => {
  vi.clearAllMocks();
  s.opts = {};
  s.support = null;
  s.dirty = false;
  s.siteName = "Winterplateau";
  s.shareImage = null;
  s.shareImageAlt = null;
  s.supportData = {
    manifestSummary: { version: 1, styleTypes: 3, backgrounds: 2, icons: 4, specials: ["edificio3d"] },
    publish: { mode: "coolify", coolifyApp: "k14crbgmw4findxbx2erv80a", force: false, hasToken: true, status: "live", liveAt: null, error: null },
  };
});

describe("Definições do site — nome", () => {
  it("o cliente vê o nome e não vê manifest nem publicação", () => {
    renderModal();
    expect(screen.getByLabelText("Nome")).toHaveValue("Winterplateau");
    expect(screen.queryByRole("region", { name: "Manifest" })).not.toBeInTheDocument();
    expect(screen.queryByText("Carregar manifest")).not.toBeInTheDocument();
    expect(screen.queryByText("Guardar webhook")).not.toBeInTheDocument();
  });

  it("só guarda quando muda, aparado; vazio envia null; adopta a revisão nova", () => {
    renderModal();
    const save = screen.getByRole("button", { name: "Guardar nome" });
    expect(save).toBeDisabled();
    type("Nome", "  Winterplateau Lda  ");
    fireEvent.click(save);
    expect(s.settings).toHaveBeenCalledWith({ data: { siteName: "Winterplateau Lda" } });
    type("Nome", "   ");
    fireEvent.click(save);
    expect(s.settings).toHaveBeenLastCalledWith({ data: { siteName: null } });
    act(() => s.opts.settings.onSuccess({ siteName: null, revision: 7 }));
    expect(s.adopt).toHaveBeenCalledWith(7);
  });

  it("com alterações por guardar nas páginas não deixa gravar o nome", () => {
    s.dirty = true;
    renderModal();
    type("Nome", "Outro");
    expect(screen.getByRole("button", { name: "Guardar nome" })).toBeDisabled();
  });

  it("400 com a lista do zod mostra a primeira mensagem", () => {
    renderModal();
    act(() => s.opts.settings.onError(apiErr(400, { error: [{ path: ["siteName"], message: "siteName: máximo 80 caracteres" }] })));
    expect(screen.getByRole("alert")).toHaveTextContent("siteName: máximo 80 caracteres");
  });
});

describe("Definições do site — imagem de partilha", () => {
  it("o cliente vê a secção; escolher sobe a imagem e Guardar envia imagem + alt por língua (vazios saem)", async () => {
    s.upload.mockResolvedValue("https://cdn/media/u1/share.webp");
    renderModal();
    expect(screen.getByTestId("share-image-section")).toBeInTheDocument();
    const save = screen.getByTestId("share-image-save");
    expect(save).toBeDisabled();
    const file = new File(["x"], "capa.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("share-image-file"), { target: { files: [file] } });
    await waitFor(() => expect(s.upload).toHaveBeenCalledWith(file, "image"));
    type("Descrição da imagem (alt) · PT", "  Fachada  ");
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    expect(s.settings).toHaveBeenCalledWith({ data: { shareImage: "https://cdn/media/u1/share.webp", shareImageAlt: { pt: "Fachada" } } });
  });

  it("ficheiro que não é imagem é recusado sem subir; Tirar imagem envia null", () => {
    s.shareImage = "https://cdn/media/u1/old.webp";
    renderModal();
    fireEvent.change(screen.getByTestId("share-image-file"), { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    expect(s.upload).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("JPEG, PNG ou WebP");
    fireEvent.click(screen.getByRole("button", { name: "Tirar imagem" }));
    fireEvent.click(screen.getByTestId("share-image-save"));
    expect(s.settings).toHaveBeenCalledWith({ data: { shareImage: null, shareImageAlt: null } });
  });

  it("com alterações por guardar nas páginas não deixa gravar", () => {
    s.dirty = true;
    renderModal();
    type("Descrição da imagem (alt) · EN", "Front");
    expect(screen.getByTestId("share-image-save")).toBeDisabled();
  });
});

describe("Definições do site — sessão de suporte", () => {
  beforeEach(() => { s.support = { actor: "dono" }; });

  it("mostra o resumo do manifest e carrega o JSON colado", () => {
    renderModal();
    expect(screen.getByText(/2 fundos, 4 ícones, 1 especiais \(edificio3d\)/)).toBeInTheDocument();
    type("Manifest (JSON)", '{"version":1}');
    fireEvent.click(screen.getByRole("button", { name: "Carregar manifest" }));
    expect(s.manifest).toHaveBeenCalledWith({ data: { version: 1 } });
  });

  it("JSON inválido não é enviado", () => {
    renderModal();
    type("Manifest (JSON)", "{oops");
    fireEvent.click(screen.getByRole("button", { name: "Carregar manifest" }));
    expect(s.manifest).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("não é JSON válido");
  });

  it("publicação: mostra a app configurada; cola o webhook aparado; Desligar envia null", () => {
    renderModal();
    expect(screen.getByTestId("publish-current")).toHaveTextContent("k14crbgmw4findxbx2erv80a");
    expect(screen.queryByTestId("publish-no-token")).not.toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Guardar webhook" });
    expect(save).toBeDisabled();
    type(/webhook do Coolify/i, "  https://coolify.exemplo.com/api/v1/deploy?uuid=abcdef123456&force=false  ");
    fireEvent.click(save);
    expect(s.publish).toHaveBeenCalledWith({ data: { webhookUrl: "https://coolify.exemplo.com/api/v1/deploy?uuid=abcdef123456&force=false" } });
    fireEvent.click(screen.getByRole("button", { name: "Desligar" }));
    expect(s.publish).toHaveBeenLastCalledWith({ data: { webhookUrl: null } });
  });

  it("sem token na API: aviso; por configurar: sem Desligar e Testar desligado", () => {
    s.supportData.publish = { mode: "runtime", coolifyApp: null, force: false, hasToken: false, status: "idle" };
    renderModal();
    expect(screen.getByTestId("publish-no-token")).toHaveTextContent("COOLIFY_DEPLOY_TOKEN");
    expect(screen.queryByRole("button", { name: "Desligar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Testar" })).toBeDisabled();
  });

  it("Testar fica desligado com um webhook escrito; o resultado mostra cada verificação", () => {
    renderModal();
    const testBtn = screen.getByRole("button", { name: "Testar" });
    expect(testBtn).not.toBeDisabled();
    type(/webhook do Coolify/i, "https://x/api/v1/deploy?uuid=abcdef123456");
    expect(testBtn).toBeDisabled();
    type(/webhook do Coolify/i, "");
    fireEvent.click(testBtn);
    expect(s.test).toHaveBeenCalled();
    act(() =>
      s.opts.test.onSuccess({
        ok: false,
        checks: [
          { id: "token", ok: true, message: "A API tem o token do Coolify." },
          { id: "health", ok: true, message: "O Coolify responde." },
          { id: "application", ok: false, message: "A app não existe no Coolify (ou é de outra equipa)." },
        ],
      }),
    );
    const box = screen.getByTestId("publish-test-result");
    expect(box).toHaveTextContent("A ligação não está completa.");
    expect(box).toHaveTextContent("App do site: A app não existe no Coolify");
  });
});

describe("puros", () => {
  it("hasExistingContent: páginas, blocos ou só topo/rodapé contam", () => {
    expect(hasExistingContent({ pages: 0, blocks: 0, parts: 0 })).toBe(false);
    expect(hasExistingContent({ pages: 0, blocks: 0, parts: 1 })).toBe(true);
    expect(hasExistingContent({ pages: 1, blocks: 0 })).toBe(true);
    expect(hasExistingContent(undefined)).toBe(false);
  });

  it("buildShareAlt: apara, só as línguas do site, vazio = null", () => {
    expect(buildShareAlt({ pt: " Fachada ", en: "", fr: "x" }, ["pt", "en"])).toEqual({ pt: "Fachada" });
    expect(buildShareAlt({ pt: "  " }, ["pt"])).toBeNull();
  });

  it("buildPublishBody", () => {
    expect(buildPublishBody("  https://c/api/v1/deploy?uuid=abcdef123456  ")).toEqual({ webhookUrl: "https://c/api/v1/deploy?uuid=abcdef123456" });
    expect(buildPublishBody("   ")).toEqual({ webhookUrl: null });
  });

  it("manifestFailure: 422, 409 em uso, 413", () => {
    expect(manifestFailure(apiErr(422, { issues: [{ path: "styles.titulo", message: "Estilo inválido" }] }))).toEqual({
      kind: "issues", issues: ["styles.titulo: Estilo inválido"],
    });
    expect(manifestFailure(apiErr(409, { code: "MANIFEST_IN_USE", usages: [{ kind: "style", key: "grande", entity: "block" }] }))).toEqual({
      kind: "inUse", usages: ['Estilo "grande" — num bloco'],
    });
    expect(manifestFailure(apiErr(413, {}))).toEqual({ kind: "message", message: "O manifest é demasiado grande (máximo 1 MB)." });
  });
});

// ── Migrar site (zip) ────────────────────────────────────────────────────────────

const okResult = (existing = { pages: 0, blocks: 0 }, over: Record<string, unknown> = {}) => ({
  dryRun: true,
  summary: { pages: 9, blocks: 45, folders: 0, languages: ["pt", "en", "fr"], files: [{ name: "hero.jpg", kind: "image", bytes: 2048 }, { name: "menu.pdf", kind: "pdf", bytes: 3 * 1024 * 1024 }] },
  existing,
  warnings: ["media/sobra.png não é usado"],
  ...over,
});
const zip = (name = "site.zip", size = 1000) => { const f = new File(["x"], name, { type: "application/zip" }); Object.defineProperty(f, "size", { value: size }); return f; };
const pickZip = (f = zip()) => { fireEvent.change(screen.getByTestId("import-file"), { target: { files: [f] } }); };

describe("Migrar site — fluxo", () => {
  beforeEach(() => { s.support = { actor: "dono" }; });

  it("ao escolher corre o dry-run e mostra o resumo, as línguas, os ficheiros e os avisos", async () => {
    s.importZip.mockResolvedValue(okResult());
    renderModal();
    const f = zip();
    pickZip(f);
    expect(screen.getByTestId("import-checking")).toHaveTextContent("A verificar…");
    expect(await screen.findByTestId("import-summary")).toHaveTextContent("9 páginas · 45 blocos · 0 pastas");
    expect(s.importZip).toHaveBeenCalledWith({ data: { file: f, mode: "dry-run" } });
    expect(screen.getByTestId("import-summary")).toHaveTextContent("PT · EN · FR");
    expect(screen.getByTestId("import-files")).toHaveTextContent("hero.jpg");
    expect(screen.getByTestId("import-files")).toHaveTextContent("PDF · 3,0 MB");
    expect(screen.getByTestId("import-warnings")).toHaveTextContent("sobra.png");
    expect(screen.queryByTestId("import-existing-warning")).not.toBeInTheDocument();
    expect(screen.getByTestId("import-submit")).not.toBeDisabled();
  });

  it("com conteúdo existente exige a confirmação e envia replace=true", async () => {
    s.importZip.mockResolvedValueOnce(okResult({ pages: 3, blocks: 12 }));
    renderModal();
    pickZip();
    expect(await screen.findByTestId("import-existing-warning")).toHaveTextContent("Este site já tem conteúdo (3 páginas, 12 blocos). Importar substitui tudo.");
    expect(screen.getByTestId("import-submit")).toBeDisabled();
    fireEvent.click(screen.getByTestId("import-confirm-replace"));
    expect(screen.getByTestId("import-submit")).not.toBeDisabled();
    s.importZip.mockResolvedValueOnce(okResult({ pages: 3, blocks: 12 }, { dryRun: false }));
    fireEvent.click(screen.getByTestId("import-submit"));
    await waitFor(() => expect(s.reload).toHaveBeenCalled());
    expect(s.importZip).toHaveBeenLastCalledWith({ data: { file: expect.any(File), mode: "apply", replace: "true" } });
  });

  it("sem conteúdo existente importa sem replace e recarrega o editor", async () => {
    s.importZip.mockResolvedValueOnce(okResult());
    renderModal();
    pickZip();
    await screen.findByTestId("import-summary");
    s.importZip.mockResolvedValueOnce(okResult(undefined, { dryRun: false }));
    fireEvent.click(screen.getByTestId("import-submit"));
    await waitFor(() => expect(s.reload).toHaveBeenCalled());
    expect(s.importZip).toHaveBeenLastCalledWith({ data: { file: expect.any(File), mode: "apply" } });
    expect(screen.queryByTestId("import-summary")).not.toBeInTheDocument();
  });

  it("422 lista os problemas, sem botão activo", async () => {
    s.importZip.mockRejectedValue(apiErr(422, { code: "VALIDATION", issues: [{ path: "content.json", message: "Falta o campo pages" }, { message: "Ficheiro em falta: a.jpg" }] }));
    renderModal();
    pickZip();
    const box = await screen.findByTestId("import-issues");
    expect(box).toHaveTextContent("content.json: Falta o campo pages");
    expect(box).toHaveTextContent("Ficheiro em falta: a.jpg");
    expect(screen.getByTestId("import-submit")).toBeDisabled();
  });

  it("ficheiro que não é .zip ou é grande de mais nem chega à API", async () => {
    renderModal();
    pickZip(zip("site.rar"));
    expect(await screen.findByTestId("import-error")).toHaveTextContent("tem de ser um .zip");
    pickZip(zip("site.zip", 61 * 1024 * 1024));
    await waitFor(() => expect(screen.getByTestId("import-error")).toHaveTextContent("demasiado grande"));
    expect(s.importZip).not.toHaveBeenCalled();
  });

  it("erro no apply mostra a mensagem e não recarrega", async () => {
    s.importZip.mockResolvedValueOnce(okResult());
    renderModal();
    pickZip();
    await screen.findByTestId("import-summary");
    s.importZip.mockRejectedValueOnce(apiErr(429, {}));
    fireEvent.click(screen.getByTestId("import-submit"));
    expect(await screen.findByTestId("import-error")).toHaveTextContent("Demasiados pedidos");
    expect(s.reload).not.toHaveBeenCalled();
  });

  it("com alterações por guardar nas páginas não deixa importar", async () => {
    s.dirty = true;
    s.importZip.mockResolvedValue(okResult());
    renderModal();
    pickZip();
    await screen.findByTestId("import-summary");
    expect(screen.getByTestId("import-submit")).toBeDisabled();
  });

  it("o cliente (sem sessão de suporte) não vê a secção", () => {
    s.support = null;
    renderModal();
    expect(screen.queryByTestId("import-section")).not.toBeInTheDocument();
  });
});

describe("Migrar site — puros", () => {
  it("formatBytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2,0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5,0 MB");
    expect(formatBytes(-1)).toBe("—");
  });
  it("resumo, línguas e toast (singular/plural)", () => {
    expect(importSummaryLine({ pages: 9, blocks: 45, folders: 0 })).toBe("9 páginas · 45 blocos · 0 pastas");
    expect(importSummaryLine({ pages: 1, blocks: 1, folders: 1 })).toBe("1 página · 1 bloco · 1 pasta");
    expect(importLanguagesLine(["pt", "en"])).toBe("PT · EN");
    expect(importDoneMessage(okResult() as never)).toBe("Site importado: 9 páginas, 45 blocos, 2 ficheiros");
  });
  it("importFileProblem", () => {
    expect(importFileProblem({ name: "a.ZIP", size: 10 })).toBeNull();
    expect(importFileProblem({ name: "a.tar", size: 10 })).toMatch(/\.zip/);
    expect(importFileProblem({ name: "a.zip", size: 60 * 1024 * 1024 + 1 })).toMatch(/60 MB/);
  });
  it("canImport", () => {
    const base = { checked: true, confirmReplace: false, busy: false, dirty: false };
    expect(canImport({ ...base, checked: false })).toBe(false);
    expect(canImport({ ...base, existing: { pages: 0, blocks: 0 } })).toBe(true);
    expect(canImport({ ...base, existing: { pages: 2, blocks: 0 } })).toBe(false);
    expect(canImport({ ...base, existing: { pages: 0, blocks: 4 }, confirmReplace: true })).toBe(true);
    expect(canImport({ ...base, busy: true })).toBe(false);
    expect(canImport({ ...base, dirty: true })).toBe(false);
  });
  it("importFailure: 409 (conteúdo / manifest em uso), 413, 429, 503", () => {
    expect(importFailure(apiErr(409, { code: "HAS_CONTENT", pages: 2, blocks: 5 }))).toMatchObject({ kind: "message", message: expect.stringContaining("2 páginas, 5 blocos") });
    expect(importFailure(apiErr(409, { code: "MANIFEST_IN_USE", usages: [{ kind: "style", key: "g", entity: "block" }] }))).toEqual({ kind: "inUse", usages: ['Estilo "g" — num bloco'] });
    expect(importFailure(apiErr(413, { code: "TOO_BIG" }))).toMatchObject({ kind: "message", message: expect.stringContaining("60 MB") });
    expect(importFailure(apiErr(429, {}))).toMatchObject({ kind: "message", message: expect.stringContaining("Demasiados pedidos") });
    expect(importFailure(apiErr(503, {}))).toMatchObject({ kind: "message", message: expect.stringContaining("armazenamento") });
  });
});
