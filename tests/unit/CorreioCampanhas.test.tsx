import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Correio → Campanhas (B42 · fase 9) ────────────────────────────────────────────────────────────────────────────
// Hooks gerados mockados; o GuardButton é o real (prova o «só ver»); `can()` diz que folhas o utilizador edita.

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => authMock() }));
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));

const statusMock = vi.fn();
const listMock = vi.fn();
const getMock = vi.fn();
const statsMock = vi.fn();
const createMock = vi.fn();
const patchMock = vi.fn();
const previewMock = vi.fn();
const testMock = vi.fn();
const sendMock = vi.fn();
const scheduleMock = vi.fn();
const duplicateMock = vi.fn();
const cancelMock = vi.fn();
const deleteMock = vi.fn();
const confirmMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

const mut = (fn: unknown) => () => ({ mutateAsync: fn, mutate: fn, isPending: false });
vi.mock("../../src/gen/backoffice/hooks/useGetMailCampaignsStatus.js", () => ({ useGetMailCampaignsStatus: () => statusMock() }));
vi.mock("../../src/gen/backoffice/hooks/useGetMailCampaigns.js", () => ({ useGetMailCampaigns: (p: unknown, o: unknown) => listMock(p, o) }));
vi.mock("../../src/gen/backoffice/hooks/useGetMailCampaignsCampaignid.js", () => ({ useGetMailCampaignsCampaignid: (id: string, o: unknown) => getMock(id, o) }));
vi.mock("../../src/gen/backoffice/hooks/useGetMailCampaignsCampaignidStats.js", () => ({ useGetMailCampaignsCampaignidStats: () => statsMock() }));
vi.mock("../../src/gen/backoffice/hooks/usePostMailCampaigns.js", () => ({ usePostMailCampaigns: mut((...a: unknown[]) => createMock(...a)) }));
vi.mock("../../src/gen/backoffice/hooks/usePatchMailCampaignsCampaignid.js", () => ({ usePatchMailCampaignsCampaignid: mut((...a: unknown[]) => patchMock(...a)) }));
vi.mock("../../src/gen/backoffice/hooks/usePostMailCampaignsPreviewAudience.js", () => ({ usePostMailCampaignsPreviewAudience: mut((...a: unknown[]) => previewMock(...a)) }));
vi.mock("../../src/gen/backoffice/hooks/usePostMailCampaignsCampaignidTest.js", () => ({ usePostMailCampaignsCampaignidTest: mut((...a: unknown[]) => testMock(...a)) }));
vi.mock("../../src/gen/backoffice/hooks/usePostMailCampaignsCampaignidSend.js", () => ({ usePostMailCampaignsCampaignidSend: mut((...a: unknown[]) => sendMock(...a)) }));
vi.mock("../../src/gen/backoffice/hooks/usePostMailCampaignsCampaignidSchedule.js", () => ({ usePostMailCampaignsCampaignidSchedule: mut((...a: unknown[]) => scheduleMock(...a)) }));
vi.mock("../../src/gen/backoffice/hooks/usePostMailCampaignsCampaignidDuplicate.js", () => ({ usePostMailCampaignsCampaignidDuplicate: mut((...a: unknown[]) => duplicateMock(...a)) }));
vi.mock("../../src/gen/backoffice/hooks/usePostMailCampaignsCampaignidCancel.js", () => ({ usePostMailCampaignsCampaignidCancel: mut((...a: unknown[]) => cancelMock(...a)) }));
vi.mock("../../src/gen/backoffice/hooks/useDeleteMailCampaignsCampaignid.js", () => ({ useDeleteMailCampaignsCampaignid: mut((...a: unknown[]) => deleteMock(...a)) }));
vi.mock("../../src/gen/backoffice/hooks/useGetProducts.js", () => ({
  useGetProducts: () => ({ data: { rows: [{ productId: "p1", name: "Pomada" }] }, isError: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetScheduleServices.js", () => ({
  useGetScheduleServices: () => ({ data: [{ serviceId: "s1", name: "Corte", active: true }], isError: false }),
}));
const langsMock = vi.fn();
vi.mock("../../src/hooks/useSettingsLanguages", () => ({ useGetSettingsLanguages: () => langsMock() }));
vi.mock("../../src/components/confirm", () => ({ confirmDialog: (...a: unknown[]) => confirmMock(...a) }));
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { CorreioCampanhas } from "../../src/pages/CorreioCampanhas";
import { CorreioCampanha } from "../../src/pages/CorreioCampanha";

const OPEN = { available: true, reason: null, message: null, paused: false, pausedReason: null, fromDomain: "news.tifas.pt", testDailyLimit: 10 };
const LOCKED = { available: false, reason: "no_own_domain", message: "Disponível quando o teu domínio estiver configurado.", paused: false, pausedReason: null, fromDomain: null, testDailyLimit: 10 };

const SUMMARY = (over: object) => ({
  campaignId: "c1",
  name: "Promoção",
  status: "sent",
  languages: ["pt"],
  defaultLanguage: "pt",
  scheduledAt: null,
  startedAt: null,
  sentAt: "2026-10-10T10:00:00.000Z",
  failReason: null,
  counts: { total: 100, sent: 100, delivered: 90, opened: 45, clicked: 9, bounced: 1, complained: 0, failed: 0 },
  createdAt: "2026-10-09T10:00:00.000Z",
  updatedAt: "2026-10-10T10:00:00.000Z",
  ...over,
});

const DRAFT = (over: object = {}) => ({
  ...SUMMARY({ status: "draft", sentAt: null, counts: {} }),
  segment: { type: "tag", tag: "vip" },
  content: { pt: [{ type: "title", text: "Olá" }] },
  subjects: { pt: "Novidades" },
  preheaders: {},
  readiness: { ok: true, errors: [] },
  ...over,
});

/** `edit`: folhas em que o utilizador pode editar (o dono = `null`, pode tudo). */
function setAuth(edit: string[] | null) {
  authMock.mockReturnValue({
    supportSession: null,
    isMember: edit !== null,
    member: null,
    can: (key: string, level: string = "view") => (edit === null ? true : level === "view" ? true : edit.includes(key)),
  });
}

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/correio/campanhas" element={<CorreioCampanhas />} />
          <Route path="/correio/campanhas/:campaignId" element={<CorreioCampanha />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ok = (data: unknown) => ({ data, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  setAuth(null);
  statusMock.mockReturnValue(ok(OPEN));
  listMock.mockReturnValue(ok({ items: [SUMMARY({})], total: 1, page: 1, limit: 25 }));
  getMock.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  statsMock.mockReturnValue(ok({ total: 100, queued: 0, sent: 100, delivered: 90, opened: 45, clicked: 9, unsubscribed: 2, bounced: 1, complained: 1, skipped: 0, failed: 0 }));
  previewMock.mockResolvedValue({ count: 42 });
  langsMock.mockReturnValue({
    data: {
      available: [
        { code: "pt", name: "Português", flag: "" },
        { code: "en", name: "English", flag: "" },
      ],
      selected: ["pt", "en"],
      default: "pt",
    },
  });
  createMock.mockResolvedValue(DRAFT({ readiness: { ok: false, errors: ["Falta o assunto (pt)."] } }));
  patchMock.mockImplementation(async () => DRAFT());
  confirmMock.mockResolvedValue(true);
});

describe("Campanhas — bloqueio e pausa", () => {
  it("sem domínio: mostra a mensagem do status, sem «Nova campanha»", () => {
    statusMock.mockReturnValue(ok(LOCKED));
    listMock.mockReturnValue(ok({ items: [], total: 0, page: 1, limit: 25 }));
    renderAt("/correio/campanhas");
    expect(screen.getByTestId("campaigns-locked")).toHaveTextContent("Disponível quando o teu domínio estiver configurado.");
    expect(screen.queryByRole("button", { name: "Nova campanha" })).toBeNull();
  });

  it("bloqueado mas com histórico: aviso em cima e a lista continua visível", () => {
    statusMock.mockReturnValue(ok(LOCKED));
    renderAt("/correio/campanhas");
    expect(screen.getByTestId("campaigns-locked")).toBeInTheDocument();
    expect(screen.getAllByTestId("campaign-row")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Nova campanha" })).toBeNull();
  });

  it("a ligação directa a «nova» também fica bloqueada", () => {
    statusMock.mockReturnValue(ok(LOCKED));
    renderAt("/correio/campanhas/nova");
    expect(screen.getByTestId("campaigns-locked")).toBeInTheDocument();
    expect(screen.queryByTestId("campaign-wizard")).toBeNull();
  });

  it("pausa: aviso na lista", () => {
    statusMock.mockReturnValue(ok({ ...OPEN, paused: true, pausedReason: "queixas" }));
    renderAt("/correio/campanhas");
    expect(screen.getByTestId("campaigns-paused")).toHaveTextContent("pausados");
    expect(screen.getByTestId("campaigns-paused")).toHaveTextContent("queixas");
  });
});

describe("Campanhas — lista", () => {
  it("mostra estado, aberturas e cliques de uma enviada", () => {
    listMock.mockReturnValue(
      ok({
        items: [SUMMARY({}), SUMMARY({ campaignId: "c2", name: "Rascunho A", status: "draft", sentAt: null }), SUMMARY({ campaignId: "c3", name: "Para sexta", status: "scheduled", scheduledAt: "2026-12-01T09:00:00.000Z", sentAt: null })],
        total: 3,
        page: 1,
        limit: 25,
      }),
    );
    renderAt("/correio/campanhas");
    const rows = screen.getAllByTestId("campaign-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Enviada");
    expect(within(rows[0]).getByTestId("campaign-row-stats")).toHaveTextContent("90 entregues · 45 aberturas (50%) · 9 cliques (10%)");
    expect(rows[1]).toHaveTextContent("Rascunho");
    expect(within(rows[1]).queryByTestId("campaign-row-stats")).toBeNull();
    expect(rows[2]).toHaveTextContent("Agendada");
  });

  it("o filtro por estado vai ao servidor", async () => {
    renderAt("/correio/campanhas");
    await userEvent.click(screen.getByRole("tab", { name: "Agendada" }));
    expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: "scheduled", page: 1 }), expect.anything());
  });

  it("só-ver: «Nova campanha» fica desactivada", () => {
    setAuth([]);
    renderAt("/correio/campanhas");
    expect(screen.getByRole("button", { name: "Nova campanha" })).toBeDisabled();
  });

  it("«Nova campanha» abre o assistente", async () => {
    renderAt("/correio/campanhas");
    await userEvent.click(screen.getByRole("button", { name: "Nova campanha" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/correio/campanhas/nova");
    expect(screen.getByTestId("campaign-wizard")).toBeInTheDocument();
  });
});

describe("Nova campanha — passo 1, destinatários", () => {
  it("a contagem ao vivo vem do preview-audience e muda com o segmento", async () => {
    renderAt("/correio/campanhas/nova");
    await waitFor(() => expect(screen.getByTestId("campaign-audience-count")).toHaveTextContent("42"));
    expect(previewMock).toHaveBeenLastCalledWith({ data: { segment: { type: "all" } } });

    previewMock.mockResolvedValue({ count: 7 });
    await userEvent.selectOptions(screen.getByLabelText("Quem recebe"), "agenda_recent");
    fireEvent.change(screen.getByLabelText("Últimos N dias"), { target: { value: "15" } });
    await waitFor(() => expect(screen.getByTestId("campaign-audience-count")).toHaveTextContent("7"));
    expect(previewMock).toHaveBeenLastCalledWith({ data: { segment: { type: "agenda_recent", days: 15 } } });
  });

  it("etiqueta vazia: ainda não pede contagem nem deixa avançar", async () => {
    renderAt("/correio/campanhas/nova");
    await userEvent.type(screen.getByLabelText("Nome da campanha (só tu o vês)"), "Outubro");
    await userEvent.selectOptions(screen.getByLabelText("Quem recebe"), "tag");
    expect(screen.getByTestId("campaign-audience")).toHaveTextContent("Completa o segmento");
    expect(screen.getByTestId("campaign-next")).toBeDisabled();
  });

  it("sem nome não avança; com nome cria o rascunho e passa ao passo 2", async () => {
    getMock.mockImplementation((id: string) => (id === "c1" ? ok(DRAFT({ content: {}, subjects: {} })) : { data: undefined, isLoading: false, isError: false }));
    renderAt("/correio/campanhas/nova");
    expect(screen.getByTestId("campaign-next")).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Nome da campanha (só tu o vês)"), "Outubro");
    await userEvent.click(screen.getByTestId("campaign-next"));
    await waitFor(() => expect(createMock).toHaveBeenCalledWith({ data: expect.objectContaining({ name: "Outubro", segment: { type: "all" } }) }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/correio/campanhas/c1?passo=2"));
    await waitFor(() => expect(screen.getByTestId("campaign-step-body-conteudo")).toBeInTheDocument());
  });

  it("o stepper tem os 4 passos e a legenda curta para o telemóvel", () => {
    renderAt("/correio/campanhas/nova");
    for (const n of ["Destinatários", "Conteúdo", "Teste", "Enviar"]) {
      expect(screen.getByRole("button", { name: new RegExp(`Passo \\d: ${n}`) })).toBeInTheDocument();
    }
    expect(screen.getByTestId("campaign-step-caption")).toHaveTextContent("Passo 1 de 4 · Destinatários");
    // Para a frente só por «Seguinte»: os passos seguintes estão desactivados.
    expect(screen.getByTestId("campaign-step-conteudo")).toBeDisabled();
  });
});

describe("Nova campanha — passo 2, conteúdo", () => {
  beforeEach(() => {
    getMock.mockImplementation((id: string) => (id === "c1" ? ok(DRAFT({ content: {}, subjects: {} })) : { data: undefined, isLoading: false, isError: false }));
  });

  it("um separador por língua, cada um com o seu assunto e blocos", async () => {
    renderAt("/correio/campanhas/c1?passo=2");
    await userEvent.type(screen.getByLabelText("Assunto (PT)"), "Olá");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar título" }));
    await userEvent.type(screen.getByLabelText("Título"), "Bem-vindo");

    await userEvent.click(screen.getByRole("tab", { name: "Língua English" }));
    expect(screen.getByLabelText("Assunto (EN)")).toHaveValue("");
    expect(screen.getByTestId("campaign-blocks-empty")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Assunto (EN)"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar texto" }));
    await userEvent.type(screen.getByLabelText("Texto"), "Hi there");

    await userEvent.click(screen.getByTestId("campaign-next"));
    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    const { campaignId, data } = patchMock.mock.calls[0][0];
    expect(campaignId).toBe("c1");
    expect(data.content).toEqual({ pt: [{ type: "title", text: "Bem-vindo" }], en: [{ type: "text", text: "Hi there" }] });
    expect(data.subjects).toEqual({ pt: "Olá", en: "Hello" });
  });

  it("adicionar, reordenar e remover blocos", async () => {
    renderAt("/correio/campanhas/c1?passo=2");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar título" }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar texto" }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar botão" }));
    const types = () => screen.getAllByTestId("campaign-block").map((b) => b.getAttribute("data-block-type"));
    expect(types()).toEqual(["title", "text", "button"]);
    await userEvent.click(screen.getByRole("button", { name: "Subir bloco 3" }));
    expect(types()).toEqual(["title", "button", "text"]);
    await userEvent.click(screen.getByRole("button", { name: "Descer bloco 1" }));
    expect(types()).toEqual(["button", "title", "text"]);
    await userEvent.click(screen.getByRole("button", { name: "Remover bloco 1" }));
    expect(types()).toEqual(["title", "text"]);
  });

  it("URL que não é https é recusada no cliente e trava o «Seguinte»", async () => {
    renderAt("/correio/campanhas/c1?passo=2");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar botão" }));
    await userEvent.type(screen.getByLabelText("Texto do botão"), "Reservar");
    await userEvent.type(screen.getByLabelText("Ligação (https://…)"), "http://exemplo.pt");
    expect(screen.getByTestId("campaign-block-error")).toHaveTextContent("https://");
    expect(screen.getByTestId("campaign-next")).toBeDisabled();

    await userEvent.clear(screen.getByLabelText("Ligação (https://…)"));
    await userEvent.type(screen.getByLabelText("Ligação (https://…)"), "javascript:alert(1)");
    expect(screen.getByTestId("campaign-block-error")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Ligação (https://…)"));
    await userEvent.type(screen.getByLabelText("Ligação (https://…)"), "https://exemplo.pt/reservar");
    expect(screen.queryByTestId("campaign-block-error")).toBeNull();
    expect(screen.getByTestId("campaign-next")).toBeEnabled();
  });

  it("produto: escolhe-se da lista do negócio e leva o refId", async () => {
    renderAt("/correio/campanhas/c1?passo=2");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar produto" }));
    await userEvent.selectOptions(screen.getByLabelText("Produto"), "p1");
    expect(screen.getByLabelText("Título no email")).toHaveValue("Pomada");
    await userEvent.type(screen.getByLabelText("Assunto (PT)"), "Novo");
    await userEvent.click(screen.getByTestId("campaign-next"));
    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(patchMock.mock.calls[0][0].data.content.pt).toEqual([{ type: "product", refId: "p1", title: "Pomada" }]);
  });

  it("a pré-visualização mostra o assunto e os blocos; os erros do servidor aparecem no passo", async () => {
    getMock.mockImplementation((id: string) =>
      id === "c1" ? ok(DRAFT({ readiness: { ok: false, errors: ["Falta o assunto (pt)."] } })) : { data: undefined, isLoading: false, isError: false },
    );
    renderAt("/correio/campanhas/c1?passo=2");
    expect(screen.getByTestId("campaign-readiness-1")).toHaveTextContent("Falta o assunto (pt).");
    expect(within(screen.getByTestId("campaign-preview")).getByText("Olá")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Assunto (PT)"), "Ofertas");
    expect(screen.getByTestId("preview-subject")).toHaveTextContent("NovidadesOfertas");
  });
});

describe("Nova campanha — passo 3, teste", () => {
  it("«Enviar para mim» chama o teste e mostra o limite diário", async () => {
    getMock.mockImplementation((id: string) => (id === "c1" ? ok(DRAFT()) : { data: undefined, isLoading: false, isError: false }));
    testMock.mockResolvedValue({ sent: true, to: "dono@tifas.pt" });
    renderAt("/correio/campanhas/c1?passo=3");
    expect(screen.getByTestId("campaign-test-limit")).toHaveTextContent("10 testes por dia");
    await userEvent.click(screen.getByRole("button", { name: "Enviar para mim" }));
    await waitFor(() => expect(testMock).toHaveBeenCalledWith({ campaignId: "c1", data: {} }));
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("dono@tifas.pt"));
  });

  it("limite diário atingido: mostra o texto PT", async () => {
    getMock.mockImplementation((id: string) => (id === "c1" ? ok(DRAFT()) : { data: undefined, isLoading: false, isError: false }));
    testMock.mockRejectedValue({ response: { status: 429, data: { error: "CAMPAIGN_TEST_LIMIT" } } });
    renderAt("/correio/campanhas/c1?passo=3");
    await userEvent.click(screen.getByRole("button", { name: "Enviar para mim" }));
    await waitFor(() => expect(screen.getByTestId("campaign-error")).toHaveTextContent("limite de testes"));
  });

  it("pausa: o teste fica desactivado", () => {
    statusMock.mockReturnValue(ok({ ...OPEN, paused: true }));
    getMock.mockImplementation((id: string) => (id === "c1" ? ok(DRAFT()) : { data: undefined, isLoading: false, isError: false }));
    renderAt("/correio/campanhas/c1?passo=3");
    expect(screen.getByRole("button", { name: "Enviar para mim" })).toBeDisabled();
  });
});

describe("Nova campanha — passo 4, enviar ou agendar", () => {
  beforeEach(() => {
    getMock.mockImplementation((id: string) => (id === "c1" ? ok(DRAFT()) : { data: undefined, isLoading: false, isError: false }));
  });

  it("Enviar agora pede confirmação, envia e abre a ficha", async () => {
    sendMock.mockResolvedValue(DRAFT({ status: "sending" }));
    renderAt("/correio/campanhas/c1?passo=4");
    await waitFor(() => expect(screen.getByTestId("campaign-summary-audience")).toHaveTextContent("42 subscritos"));
    await userEvent.click(screen.getByRole("button", { name: "Enviar agora" }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ campaignId: "c1" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/correio/campanhas/c1"));
  });

  it("recusar a confirmação não envia", async () => {
    confirmMock.mockResolvedValue(false);
    renderAt("/correio/campanhas/c1?passo=4");
    await waitFor(() => expect(screen.getByTestId("campaign-summary-audience")).toHaveTextContent("42"));
    await userEvent.click(screen.getByRole("button", { name: "Enviar agora" }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("Agendar manda a data em ISO", async () => {
    scheduleMock.mockResolvedValue(DRAFT({ status: "scheduled" }));
    renderAt("/correio/campanhas/c1?passo=4");
    const agendar = screen.getByRole("button", { name: "Agendar" });
    expect(agendar).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Ou agendar para"), { target: { value: "2030-05-01T09:30" } });
    await waitFor(() => expect(agendar).toBeEnabled());
    await userEvent.click(agendar);
    await waitFor(() => expect(scheduleMock).toHaveBeenCalled());
    const arg = scheduleMock.mock.calls[0][0];
    expect(arg.campaignId).toBe("c1");
    expect(new Date(arg.data.at).getTime()).toBe(new Date("2030-05-01T09:30").getTime());
  });

  it("Editar sem Enviar: não há «Enviar agora» nem «Agendar»", () => {
    setAuth(["correio.campanhas"]);
    renderAt("/correio/campanhas/c1?passo=4");
    expect(screen.queryByRole("button", { name: "Enviar agora" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Agendar" })).toBeNull();
    expect(screen.getByTestId("campaign-no-send")).toBeInTheDocument();
  });

  it("o que falta (readiness) aparece e trava o envio", () => {
    getMock.mockImplementation((id: string) =>
      id === "c1" ? ok(DRAFT({ readiness: { ok: false, errors: ["Falta o conteúdo (pt)."] } })) : { data: undefined, isLoading: false, isError: false },
    );
    renderAt("/correio/campanhas/c1?passo=4");
    expect(screen.getByTestId("campaign-readiness-3")).toHaveTextContent("Falta o conteúdo (pt).");
    expect(screen.getByRole("button", { name: "Enviar agora" })).toBeDisabled();
  });

  it("erro da API (CAMPAIGN_INCOMPLETE) mostra o que falta", async () => {
    sendMock.mockRejectedValue({ response: { status: 400, data: { error: "CAMPAIGN_INCOMPLETE", details: ["Falta o assunto (en)."] } } });
    renderAt("/correio/campanhas/c1?passo=4");
    await waitFor(() => expect(screen.getByTestId("campaign-summary-audience")).toHaveTextContent("42"));
    await userEvent.click(screen.getByRole("button", { name: "Enviar agora" }));
    await waitFor(() => expect(screen.getByTestId("campaign-error")).toHaveTextContent("Falta o assunto (en)."));
  });
});

describe("Ficha da campanha", () => {
  const SENT = SUMMARY({ segment: { type: "all" } });

  it("enviada: estado e estatísticas (entregues, aberturas, cliques, anulações, bounces, queixas)", () => {
    getMock.mockImplementation((id: string) => (id === "c1" ? ok(SENT) : { data: undefined, isLoading: false, isError: false }));
    renderAt("/correio/campanhas/c1");
    expect(screen.getByTestId("campaign-status")).toHaveTextContent("Enviada");
    const v = (id: string) => within(screen.getByTestId(`campaign-stat-${id}`));
    expect(v("delivered").getByText("90")).toBeInTheDocument();
    expect(v("opened").getByText("45")).toBeInTheDocument();
    expect(v("opened").getByText("50%")).toBeInTheDocument();
    expect(v("clicked").getByText("9")).toBeInTheDocument();
    expect(v("unsubscribed").getByText("2")).toBeInTheDocument();
    expect(v("bounced").getByText("1")).toBeInTheDocument();
    expect(v("complained").getByText("1")).toBeInTheDocument();
    // Enviada: não se cancela.
    expect(screen.queryByRole("button", { name: /Cancelar agendamento|Parar o envio/ })).toBeNull();
  });

  it("agendada: Cancelar agendamento pede confirmação e chama a API", async () => {
    getMock.mockImplementation((id: string) =>
      id === "c1" ? ok(SUMMARY({ status: "scheduled", scheduledAt: "2030-01-01T10:00:00.000Z", segment: { type: "all" } })) : { data: undefined, isLoading: false, isError: false },
    );
    cancelMock.mockResolvedValue({});
    renderAt("/correio/campanhas/c1");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar agendamento" }));
    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith({ campaignId: "c1" }));
  });

  it("Editar sem Enviar: vê Duplicar mas não Cancelar", () => {
    setAuth(["correio.campanhas"]);
    getMock.mockImplementation((id: string) =>
      id === "c1" ? ok(SUMMARY({ status: "scheduled", scheduledAt: "2030-01-01T10:00:00.000Z", segment: { type: "all" } })) : { data: undefined, isLoading: false, isError: false },
    );
    renderAt("/correio/campanhas/c1");
    expect(screen.getByRole("button", { name: "Duplicar" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Cancelar agendamento" })).toBeNull();
  });

  it("só-ver: Duplicar fica desactivado", () => {
    setAuth([]);
    getMock.mockImplementation((id: string) => (id === "c1" ? ok(SENT) : { data: undefined, isLoading: false, isError: false }));
    renderAt("/correio/campanhas/c1");
    expect(screen.getByRole("button", { name: "Duplicar" })).toBeDisabled();
  });

  it("Duplicar cria o rascunho e abre-o", async () => {
    getMock.mockImplementation((id: string) => (id === "c1" ? ok(SENT) : id === "c9" ? ok(DRAFT({ campaignId: "c9" })) : { data: undefined, isLoading: false, isError: false }));
    duplicateMock.mockResolvedValue(DRAFT({ campaignId: "c9", name: "Promoção (cópia)" }));
    renderAt("/correio/campanhas/c1");
    await userEvent.click(screen.getByRole("button", { name: "Duplicar" }));
    await waitFor(() => expect(duplicateMock).toHaveBeenCalledWith({ campaignId: "c1" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/correio/campanhas/c9"));
  });

  it("campanha que não existe: mensagem", () => {
    getMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { response: { status: 404 } }, refetch: vi.fn() });
    renderAt("/correio/campanhas/xx");
    expect(screen.getByTestId("campaign-load-error")).toHaveTextContent("já não existe");
  });
});
