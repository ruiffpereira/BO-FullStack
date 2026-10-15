import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Admin → Utilizadores → "Construtor de páginas" (F16). Hooks gerados mockados por caminho; guardamos as
// `options.mutation` de cada um para testar o que o modal faz com o resultado (mensagens por código).

const s = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  enabled: vi.fn(),
  manifest: vi.fn(),
  publish: vi.fn(),
  test: vi.fn(),
  opts: {} as Record<string, any>,
  confirm: vi.fn(),
}));

const hook = (name: string, fn: () => unknown) => (o: any) => {
  s.opts[name] = o?.mutation;
  return { mutate: fn, isPending: false };
};
vi.mock("../../src/gen/backoffice/hooks/useGetAdminUsersUseridSiteBuilder.js", () => ({
  useGetAdminUsersUseridSiteBuilder: () => s.query,
  getAdminUsersUseridSiteBuilderQueryKey: () => [{ url: "/admin/users/:userId/site-builder" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePutAdminUsersUseridSiteBuilder.js", () => ({
  usePutAdminUsersUseridSiteBuilder: (o: any) => hook("enabled", s.enabled)(o),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutAdminUsersUseridSiteBuilderManifest.js", () => ({
  usePutAdminUsersUseridSiteBuilderManifest: (o: any) => hook("manifest", s.manifest)(o),
}));
vi.mock("../../src/gen/backoffice/hooks/usePutAdminUsersUseridSiteBuilderPublish.js", () => ({
  usePutAdminUsersUseridSiteBuilderPublish: (o: any) => hook("publish", s.publish)(o),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridSiteBuilderPublishTest.js", () => ({
  usePostAdminUsersUseridSiteBuilderPublishTest: (o: any) => hook("test", s.test)(o),
}));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ authHeader: () => ({}) }) }));
vi.mock("../../src/components/GuardButton", () => ({
  GuardButton: ({ children, isLoading: _l, ...rest }: any) => <button {...rest}>{children}</button>,
}));
vi.mock("../../src/components/confirm", () => ({ confirmDialog: (...a: unknown[]) => s.confirm(...a) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SiteBuilderModal } from "../../src/components/AdminSiteBuilder";

const GET = (over: Record<string, unknown> = {}) => ({
  enabled: true,
  manifestSummary: { version: 1, styleTypes: 3, backgrounds: 2, icons: 4, specials: ["edificio3d"] },
  publish: { mode: "github", repo: "acme/site", workflow: "deploy.yml", ref: "main", hasToken: true, status: "live" },
  ...over,
});

const apiErr = (status: number, data: unknown) => ({ response: { status, data } });

function renderModal(data: unknown = GET()) {
  s.query = { data, isLoading: false, isError: false };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SiteBuilderModal user={{ userId: "u1", name: "Winterplateau" }} onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose };
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  s.opts = {};
});

describe("Admin — Construtor de páginas", () => {
  it("mostra o estado, o resumo do manifest e o lembrete de permissões com link", () => {
    const { onClose } = renderModal();
    expect(screen.getByRole("dialog", { name: "Construtor de páginas" })).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText(/2 fundos, 4 ícones, 1 especiais \(edificio3d\)/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Admin → Permissões" });
    expect(link).toHaveAttribute("href", "/admin/permissoes");
    expect(screen.getByText("VIEW_SITE_PAGES")).toBeInTheDocument();
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalled();
  });

  it("activar envia enabled:true; desactivar pede confirmação", async () => {
    renderModal(GET({ enabled: false }));
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));
    await act(async () => {});
    expect(s.enabled).toHaveBeenCalledWith({ userId: "u1", data: { enabled: true } });
  });

  it("desactivar só envia depois de confirmar", async () => {
    s.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    await act(async () => {});
    expect(s.enabled).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    await act(async () => {});
    expect(s.enabled).toHaveBeenCalledWith({ userId: "u1", data: { enabled: false } });
  });

  describe("manifest", () => {
    it("JSON ilegível não chega à API", () => {
      renderModal();
      type("Manifest (JSON)", "{ nao e json");
      fireEvent.click(screen.getByRole("button", { name: "Carregar manifest" }));
      expect(screen.getByRole("alert")).toHaveTextContent("não é JSON válido");
      expect(s.manifest).not.toHaveBeenCalled();
    });

    it("sem texto o botão está desligado; com JSON envia o objecto", () => {
      renderModal();
      expect(screen.getByRole("button", { name: "Carregar manifest" })).toBeDisabled();
      type("Manifest (JSON)", '{"version":1,"backgrounds":[{"id":"claro","label":"Claro"}]}');
      fireEvent.click(screen.getByRole("button", { name: "Carregar manifest" }));
      expect(s.manifest).toHaveBeenCalledWith({
        userId: "u1",
        data: { version: 1, backgrounds: [{ id: "claro", label: "Claro" }] },
      });
    });

    it("ficheiro .json enche a caixa de texto", async () => {
      renderModal();
      const file = new File(['{"version":1}'], "manifest.json", { type: "application/json" });
      await act(async () => {
        fireEvent.change(screen.getByLabelText("Ficheiro do manifest"), { target: { files: [file] } });
      });
      expect(await screen.findByDisplayValue('{"version":1}')).toBeInTheDocument();
      expect(screen.getByText("manifest.json")).toBeInTheDocument();
    });

    it("422: lista cada erro de validação com o caminho", () => {
      renderModal();
      type("Manifest (JSON)", "{}");
      act(() =>
        s.opts.manifest.onError(
          apiErr(422, {
            code: "VALIDATION",
            issues: [
              { code: "BAD_MANIFEST", entity: "manifest", id: "", path: "backgrounds", message: "Tem de ter pelo menos um fundo." },
              { code: "BAD_ID", entity: "manifest", id: "", path: "styles.titulo.0.id", message: "Id inválido." },
            ],
          }),
        ),
      );
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("2 problemas");
      expect(alert).toHaveTextContent("backgrounds: Tem de ter pelo menos um fundo.");
      expect(alert).toHaveTextContent("styles.titulo.0.id: Id inválido.");
    });

    it("409 MANIFEST_IN_USE: mostra o que está em uso, em português", () => {
      renderModal();
      type("Manifest (JSON)", "{}");
      act(() =>
        s.opts.manifest.onError(
          apiErr(409, {
            code: "MANIFEST_IN_USE",
            usages: [
              { kind: "background", key: "escuro", entity: "block", id: "b1", path: "bg" },
              { kind: "special", key: "edificio3d", entity: "item", id: "i1", path: "items.p1.i1" },
              { kind: "style", key: "titulo:frase", entity: "part", id: "topo", path: "comps.c1.style" },
            ],
          }),
        ),
      );
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Não foi gravado");
      expect(alert).toHaveTextContent('Fundo "escuro" — num bloco');
      expect(alert).toHaveTextContent('Especial "edificio3d" — numa página');
      expect(alert).toHaveTextContent('Estilo "titulo:frase" — numa parte comum');
    });

    it("sessão de suporte: 403 IMPERSONATION_FORBIDDEN mostra a mensagem", () => {
      renderModal();
      type("Manifest (JSON)", "{}");
      act(() => s.opts.manifest.onError(apiErr(403, { code: "IMPERSONATION_FORBIDDEN" })));
      expect(screen.getByRole("alert")).toHaveTextContent("não está disponível numa sessão de suporte");
    });

    it("sucesso limpa a caixa", () => {
      renderModal();
      type("Manifest (JSON)", "{}");
      act(() => s.opts.manifest.onSuccess());
      expect(screen.getByLabelText("Manifest (JSON)")).toHaveValue("");
    });
  });

  describe("publicação", () => {
    it("o token nunca vem preenchido: só diz que está definido", () => {
      renderModal();
      const token = screen.getByLabelText(/Token do GitHub/);
      expect(token).toHaveValue("");
      expect(token).toHaveAttribute("type", "password");
      expect(token).toHaveAttribute("placeholder", "Deixa vazio para manter o actual");
      expect(screen.getByText(/definido \(escreve para trocar\)/)).toBeInTheDocument();
      expect(screen.getByDisplayValue("acme/site")).toBeInTheDocument();
    });

    it("sem token definido o rótulo não diz 'definido'", () => {
      renderModal(GET({ publish: { mode: "github", repo: "a/b", workflow: "d.yml", ref: "main", hasToken: false, status: "idle" } }));
      expect(screen.queryByText(/definido/)).not.toBeInTheDocument();
    });

    it("token vazio não é enviado (a API mantém o actual)", () => {
      renderModal();
      type("Repositório", "acme/outro");
      fireEvent.click(screen.getByRole("button", { name: "Guardar publicação" }));
      expect(s.publish).toHaveBeenCalledTimes(1);
      const body = s.publish.mock.calls[0][0].data;
      expect(body).toEqual({ mode: "github", repo: "acme/outro", workflow: "deploy.yml", ref: "main" });
      expect("token" in body).toBe(false);
    });

    it("token escrito segue, e o campo esvazia depois de guardar", () => {
      renderModal();
      type(/Token do GitHub/, "  github_pat_abc  ");
      fireEvent.click(screen.getByRole("button", { name: "Guardar publicação" }));
      expect(s.publish.mock.calls[0][0].data.token).toBe("github_pat_abc");
      act(() => s.opts.publish.onSuccess());
      expect(screen.getByLabelText(/Token do GitHub/)).toHaveValue("");
    });

    it("sem alterações não há nada a guardar; passar a runtime esconde repo e token", () => {
      renderModal();
      expect(screen.getByRole("button", { name: "Guardar publicação" })).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Modo"), { target: { value: "runtime" } });
      expect(screen.queryByLabelText("Repositório")).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Token do GitHub/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Guardar publicação" }));
      expect(s.publish.mock.calls[0][0].data).toEqual({ mode: "runtime" });
    });

    it("Testar mostra o {ok,message} da API; fica desligado com alterações por guardar", () => {
      renderModal();
      const testar = screen.getByRole("button", { name: "Testar" });
      expect(testar).toBeEnabled();
      fireEvent.click(testar);
      expect(s.test).toHaveBeenCalledWith({ userId: "u1" });
      act(() => s.opts.test.onSuccess({ ok: false, status: 404, message: "Workflow não encontrado" }));
      expect(screen.getByRole("status")).toHaveTextContent("Falhou: Workflow não encontrado");
      act(() => s.opts.test.onSuccess({ ok: true, status: 200, message: "Token válido" }));
      expect(screen.getByRole("status")).toHaveTextContent("Ligação confirmada: Token válido");
      type("Workflow", "outro.yml");
      expect(screen.getByRole("button", { name: "Testar" })).toBeDisabled();
    });

    it("mostra o estado da última publicação", () => {
      renderModal(GET({ publish: { mode: "github", repo: "a/b", workflow: "d.yml", ref: "main", hasToken: true, status: "failed" } }));
      expect(screen.getByText("Falhou")).toBeInTheDocument();
    });

    it("erro do servidor na gravação aparece no modal", () => {
      renderModal();
      act(() => s.opts.publish.onError(apiErr(400, { error: "repo inválido" })));
      expect(screen.getByRole("alert")).toHaveTextContent("repo inválido");
    });
  });

  it("GET em sessão de suporte (403 IMPERSONATION_FORBIDDEN) mostra a mensagem", () => {
    s.query = { isLoading: false, isError: true, error: apiErr(403, { code: "IMPERSONATION_FORBIDDEN" }) };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SiteBuilderModal user={{ userId: "u1", name: "X" }} onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("não está disponível numa sessão de suporte");
  });
});
