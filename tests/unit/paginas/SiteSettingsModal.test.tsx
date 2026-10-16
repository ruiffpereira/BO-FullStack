import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// «Definições do site»: o cliente edita o nome; manifest e publicação só numa sessão de suporte.
// Hooks gerados mockados; guardamos as `options.mutation` para testar o que o modal faz com o resultado.

const s = vi.hoisted(() => ({
  support: null as unknown,
  dirty: false,
  adopt: vi.fn(),
  siteName: "Winterplateau" as string | null,
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
vi.mock("../../../src/pages/paginas/state/store", () => ({ useBuilder: () => ({ dirty: s.dirty, adoptRevision: s.adopt }) }));
vi.mock("../../../src/hooks/useSiteBuilder", () => ({
  useSiteBuilderQuery: () => ({ data: { siteName: s.siteName } }),
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
vi.mock("../../../src/components/GuardButton", () => ({
  GuardButton: ({ children, isLoading: _l, ...rest }: any) => <button {...rest}>{children}</button>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SiteSettingsModal, buildPublishBody, manifestFailure } from "../../../src/pages/paginas/components/SiteSettingsModal";

const apiErr = (status: number, data: unknown) => ({ response: { status, data } });
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const renderModal = () => render(<SiteSettingsModal open onClose={vi.fn()} />);

beforeEach(() => {
  vi.clearAllMocks();
  s.opts = {};
  s.support = null;
  s.dirty = false;
  s.siteName = "Winterplateau";
  s.supportData = {
    manifestSummary: { version: 1, styleTypes: 3, backgrounds: 2, icons: 4, specials: ["edificio3d"] },
    publish: { mode: "github", repo: "acme/site", workflow: "deploy.yml", ref: "main", hasToken: false, usesGlobalToken: true, status: "live" },
  };
});

describe("Definições do site — nome", () => {
  it("o cliente vê o nome e não vê manifest nem publicação", () => {
    renderModal();
    expect(screen.getByLabelText("Nome")).toHaveValue("Winterplateau");
    expect(screen.queryByRole("region", { name: "Manifest" })).not.toBeInTheDocument();
    expect(screen.queryByText("Carregar manifest")).not.toBeInTheDocument();
    expect(screen.queryByText("Guardar publicação")).not.toBeInTheDocument();
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

  it("publicação: só o repositório; workflow/branch vazios vão a null; token só se escrito", () => {
    renderModal();
    expect(screen.getByLabelText("Repositório")).toHaveValue("acme/site");
    expect(screen.getByLabelText(/usa o da plataforma/)).toBeInTheDocument();
    type("Repositório", "ruiffpereira/winterplateau");
    type("Workflow", "");
    fireEvent.click(screen.getByRole("button", { name: "Guardar publicação" }));
    expect(s.publish).toHaveBeenCalledWith({ data: { repo: "ruiffpereira/winterplateau", workflow: null, ref: "main" } });
  });

  it("Testar fica desligado com o formulário alterado", () => {
    renderModal();
    const testBtn = screen.getByRole("button", { name: "Testar" });
    expect(testBtn).not.toBeDisabled();
    type("Repositório", "outro/repo");
    expect(testBtn).toBeDisabled();
  });
});

describe("puros", () => {
  it("buildPublishBody", () => {
    expect(buildPublishBody({ repo: " a/b ", workflow: "", ref: " ", token: "" })).toEqual({ repo: "a/b", workflow: null, ref: null });
    expect(buildPublishBody({ repo: "a/b", workflow: "x.yml", ref: "dev", token: " t " })).toEqual({ repo: "a/b", workflow: "x.yml", ref: "dev", token: "t" });
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
