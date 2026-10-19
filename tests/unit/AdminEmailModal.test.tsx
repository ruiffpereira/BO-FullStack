import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Admin → Utilizadores → "Email" (B42 · fase 4) e o cartão Email do Sistema.
// Hooks gerados mockados por caminho; capturamos as `options.mutation` para testar erros.

const getMock = vi.fn();
const statusMock = vi.fn();
const confirmMock = vi.fn();
const promptMock = vi.fn();
const mailboxesMock = vi.fn();
const mutates = {
  put: vi.fn(),
  del: vi.fn(),
  verify: vi.fn(),
  platform: vi.fn(),
  own: vi.fn(),
  move: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  news: vi.fn(),
};
const opts: Record<string, any> = {};

vi.mock("../../src/gen/backoffice/hooks/useGetAdminUsersUseridEmailDomain.js", () => ({
  useGetAdminUsersUseridEmailDomain: () => getMock(),
  getAdminUsersUseridEmailDomainQueryKey: (id: string) => [{ url: "/admin/users/:userId/email-domain", params: { userId: id } }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePutAdminUsersUseridEmailDomain.js", () => ({
  usePutAdminUsersUseridEmailDomain: (o: any) => ((opts.put = o), { mutate: mutates.put, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useDeleteAdminUsersUseridEmailDomain.js", () => ({
  useDeleteAdminUsersUseridEmailDomain: (o: any) => ((opts.del = o), { mutate: mutates.del, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainVerify.js", () => ({
  usePostAdminUsersUseridEmailDomainVerify: (o: any) => ((opts.verify = o), { mutate: mutates.verify, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainUsePlatform.js", () => ({
  usePostAdminUsersUseridEmailDomainUsePlatform: (o: any) => ((opts.platform = o), { mutate: mutates.platform, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainUseOwn.js", () => ({
  usePostAdminUsersUseridEmailDomainUseOwn: (o: any) => ((opts.own = o), { mutate: mutates.own, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainMailboxesMove.js", () => ({
  usePostAdminUsersUseridEmailDomainMailboxesMove: (o: any) => ((opts.move = o), { mutate: mutates.move, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainPause.js", () => ({
  usePostAdminUsersUseridEmailDomainPause: (o: any) => ((opts.pause = o), { mutate: mutates.pause, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainResume.js", () => ({
  usePostAdminUsersUseridEmailDomainResume: (o: any) => ((opts.resume = o), { mutate: mutates.resume, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridEmailDomainNews.js", () => ({
  usePostAdminUsersUseridEmailDomainNews: (o: any) => ((opts.news = o), { mutate: mutates.news, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetAdminEmailStatus.js", () => ({
  useGetAdminEmailStatus: () => statusMock(),
}));
// Secção «Caixas» (B42 · fases 5 e 6): aqui só interessa que o modal a monta; o detalhe testa-se em AdminMailboxesSection.test.tsx.
vi.mock("../../src/gen/backoffice/hooks/useGetAdminUsersUseridMailboxes.js", () => ({
  useGetAdminUsersUseridMailboxes: () => mailboxesMock(),
  getAdminUsersUseridMailboxesQueryKey: (id: string) => [{ url: "/admin/users/:userId/mailboxes", params: { userId: id } }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridMailboxesBusiness.js", () => ({
  usePostAdminUsersUseridMailboxesBusiness: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridMailboxesMailboxidDisable.js", () => ({
  usePostAdminUsersUseridMailboxesMailboxidDisable: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminUsersUseridMailboxesMailboxidEnable.js", () => ({
  usePostAdminUsersUseridMailboxesMailboxidEnable: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/components/GuardButton", () => ({
  GuardButton: ({ children, isLoading, ...rest }: any) => <button {...rest}>{children}</button>,
}));
vi.mock("../../src/components/confirm", () => ({
  confirmDialog: (...a: unknown[]) => confirmMock(...a),
  promptDialog: (...a: unknown[]) => promptMock(...a),
}));
const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    info: (...a: unknown[]) => toastInfo(...a),
  },
}));

import { AdminEmailModal, EmailStatusCard } from "../../src/components/AdminEmailModal";

const TENANT = { userId: "u1", name: "Barbearia Central" };
const REC = (over: object) => ({ record: "DKIM", type: "TXT", name: "resend._domainkey.tifas", value: "p=ABC123", status: "not_started", verified: false, ...over });

const SEM_DOMINIO = { configured: true, platformDomain: "rufvision.com", suggestedDomain: "barbearia-central.rufvision.com", domain: null };
const base = {
  domain: "tifas.rufvision.com",
  kind: "platform-subdomain",
  verified: false,
  lastCheckedAt: null,
  sendingEnabled: true,
  useForSending: true,
  active: false,
  fromLocalPart: "geral",
  senderName: "Tifas",
  records: [REC({}), REC({ type: "MX", name: "send.tifas", value: "feedback-smtp.eu-west-1.amazonses.com", priority: 10 })],
};
const envelope = (d: object) => ({ configured: true, platformDomain: "rufvision.com", suggestedDomain: null, domain: { ...base, ...d } });

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminEmailModal tenant={TENANT} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(opts)) delete opts[k];
  getMock.mockReturnValue({ data: envelope({}), isLoading: false, isError: false });
  mailboxesMock.mockReturnValue({ data: { configured: true, moduleEnabled: true, mailboxes: [] }, isLoading: false, isError: false });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("AdminEmailModal", () => {
  it("sem domínio: formulário com a sugestão, nome e parte local; Configurar envia o PUT", () => {
    getMock.mockReturnValue({ data: SEM_DOMINIO, isLoading: false, isError: false });
    renderModal();
    expect(screen.getByLabelText("Domínio de email")).toHaveValue("barbearia-central.rufvision.com");
    expect(screen.getByLabelText("Nome do remetente")).toHaveValue("Barbearia Central");
    expect(screen.getByLabelText("Parte local do endereço")).toHaveValue("geral");
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    expect(mutates.put).toHaveBeenCalledWith({
      userId: "u1",
      data: { domain: "barbearia-central.rufvision.com", fromLocalPart: "geral", senderName: "Barbearia Central" },
    });
  });

  it("Configurar fica desactivado com o domínio vazio", () => {
    getMock.mockReturnValue({ data: { ...SEM_DOMINIO, suggestedDomain: null }, isLoading: false, isError: false });
    renderModal();
    expect(screen.getByRole("button", { name: "Configurar" })).toBeDisabled();
  });

  it("não verificado: mostra o estado, quantos registos faltam e a tabela", () => {
    renderModal();
    expect(screen.getByTestId("email-domain-state")).toHaveTextContent("Não verificado");
    expect(screen.getByText("faltam 2 registos")).toBeInTheDocument();
    expect(screen.getAllByTestId("dns-record-row")).toHaveLength(2);
    expect(screen.getByText(/10/)).toBeInTheDocument(); // prioridade do MX
    // Não verificado + a usar o domínio → só se oferece "Voltar ao envio da plataforma".
    expect(screen.getByRole("button", { name: "Voltar ao envio da plataforma" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verificar agora" })).toBeInTheDocument();
  });

  it("verificado e activo: Verificado ✓ e a morada de envio", () => {
    getMock.mockReturnValue({
      data: envelope({ verified: true, active: true, records: [REC({ verified: true, status: "verified" })] }),
      isLoading: false,
      isError: false,
    });
    renderModal();
    expect(screen.getByTestId("email-domain-state")).toHaveTextContent("Verificado ✓");
    expect(screen.queryByText(/falta/)).not.toBeInTheDocument();
    expect(screen.getByTestId("email-sending-state")).toHaveTextContent("geral@tifas.rufvision.com");
  });

  it("voltou à plataforma: oferece 'Usar o domínio do negócio' (activo só se verificado)", () => {
    getMock.mockReturnValue({ data: envelope({ useForSending: false }), isLoading: false, isError: false });
    const { unmount } = renderModal();
    expect(screen.getByRole("button", { name: "Usar o domínio do negócio" })).toBeDisabled();
    unmount();

    getMock.mockReturnValue({ data: envelope({ useForSending: false, verified: true }), isLoading: false, isError: false });
    renderModal();
    const btn = screen.getByRole("button", { name: "Usar o domínio do negócio" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(mutates.own).toHaveBeenCalledWith({ userId: "u1" });
  });

  it("Voltar ao envio da plataforma e Verificar agora chamam a API", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao envio da plataforma" }));
    expect(mutates.platform).toHaveBeenCalledWith({ userId: "u1" });
    fireEvent.click(screen.getByRole("button", { name: "Verificar agora" }));
    expect(mutates.verify).toHaveBeenCalledWith({ userId: "u1" });
  });

  it("Verificar agora: avisa se ainda falta verificar", () => {
    renderModal();
    opts.verify.mutation.onSuccess({ domain: { verified: false } });
    expect(toastInfo).toHaveBeenCalled();
    opts.verify.mutation.onSuccess({ domain: { verified: true } });
    expect(toastSuccess).toHaveBeenCalledWith("Domínio verificado");
  });

  it("Copiar: nome e valor vão para a área de transferência", async () => {
    renderModal();
    fireEvent.click(screen.getAllByRole("button", { name: "Copiar nome" })[0]);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("resend._domainkey.tifas"));
    fireEvent.click(screen.getAllByRole("button", { name: "Copiar valor" })[0]);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("p=ABC123"));
    expect(toastSuccess).toHaveBeenCalledWith("Valor copiado");
  });

  it("Remover domínio pede confirmação e só apaga se confirmado", async () => {
    confirmMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Remover domínio" }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    expect(mutates.del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remover domínio" }));
    await waitFor(() => expect(mutates.del).toHaveBeenCalledWith({ userId: "u1" }));
  });

  it("Alterar domínio abre o formulário com os valores actuais", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Alterar domínio" }));
    expect(screen.getByLabelText("Domínio de email")).toHaveValue("tifas.rufvision.com");
    expect(screen.getByLabelText("Nome do remetente")).toHaveValue("Tifas");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it.each([
    ["domain_taken", 409, "Esse domínio de email já pertence a outro cliente."],
    ["email_provider_error", 502, "O fornecedor de email (Resend) não aceitou o pedido. Tenta de novo daqui a pouco."],
    ["domain_not_verified", 409, "O domínio ainda não está verificado — põe os registos no DNS e carrega em «Verificar agora»."],
  ])("erro %s → mensagem PT", (key, status, msg) => {
    renderModal();
    opts.put.mutation.onError({ response: { status, data: { error: key, message: "raw" } } });
    expect(toastError).toHaveBeenCalledWith(msg);
  });

  it("400 → 'Domínio inválido.'", () => {
    renderModal();
    opts.put.mutation.onError({ response: { status: 400, data: { error: "Validation" } } });
    expect(toastError).toHaveBeenCalledWith("Domínio inválido.");
  });

  it("use-own com 409 domain_not_verified mostra a mensagem", () => {
    renderModal();
    opts.own.mutation.onError({ response: { status: 409, data: { error: "domain_not_verified" } } });
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("ainda não está verificado"));
  });

  it("erro a carregar", () => {
    getMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { response: { data: { error: "boom" } } } });
    renderModal();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});

// ── Fase 7: dois domínios, domínio próprio, mover caixas, pausa ─────────────────────────────────────────────────
const SUB = { ...base, kind: "platform-subdomain", domain: "tifas.rufvision.com", verified: true, active: true, mailRecords: null };
const OWN = {
  ...base,
  kind: "own",
  domain: "tifas.pt",
  verified: true,
  active: true,
  senderName: "Tifas",
  existingEmail: false,
  mailMode: "root",
  mailDomain: "tifas.pt",
  records: [REC({ verified: true, status: "verified" })],
  mailRecords: [
    { type: "MX", name: "tifas.pt", value: "10 mail.rufvision.com" },
    { type: "TXT", name: "stalwart._domainkey.tifas.pt", value: "v=DKIM1; p=XYZ" },
  ],
};
const SENDING_OK = { paused: false, pausedAt: null, reason: null, pausedBy: null, limits: { mailboxPerDay: 200, tenantPerDay: 500 } };
const twoDomains = (over: object = {}, sending: object = SENDING_OK) => ({
  configured: true,
  platformDomain: "rufvision.com",
  suggestedDomain: null,
  domain: OWN,
  domains: [SUB, OWN],
  sendingFrom: "geral@tifas.pt",
  mail: { configured: true, mxHost: "mail.rufvision.com" },
  sending,
  ...over,
});
const onlySub = (over: object = {}) => twoDomains({ domain: SUB, domains: [SUB], sendingFrom: "geral@tifas.rufvision.com", ...over });

describe("AdminEmailModal — domínio próprio (fase 7)", () => {
  it("mostra os dois domínios e de onde se envia agora", () => {
    getMock.mockReturnValue({ data: twoDomains(), isLoading: false, isError: false });
    renderModal();
    expect(screen.getByTestId("email-sending-from")).toHaveTextContent("geral@tifas.pt");
    expect(screen.getByTestId("email-domain-block-platform-subdomain")).toHaveTextContent("tifas.rufvision.com");
    expect(screen.getByTestId("email-domain-block-own")).toHaveTextContent("tifas.pt");
    expect(screen.getByTestId("email-domain-block-own")).toHaveTextContent("Domínio próprio");
  });

  it("registos da caixa (MX e DKIM) numa tabela à parte, sem coluna de estado", () => {
    getMock.mockReturnValue({ data: twoDomains(), isLoading: false, isError: false });
    renderModal();
    const own = within(screen.getByTestId("email-domain-block-own"));
    const mail = within(own.getByTestId("mail-records"));
    expect(mail.getAllByTestId("mail-record-row")).toHaveLength(2);
    expect(mail.getByText("10 mail.rufvision.com")).toBeInTheDocument();
    expect(mail.queryByText("Estado")).toBeNull();
    // Os do envio ficam na tabela deles.
    expect(own.getAllByTestId("dns-record-row")).toHaveLength(1);
  });

  it("com os dois domínios, verificar / voltar / remover levam o kind", async () => {
    getMock.mockReturnValue({ data: twoDomains(), isLoading: false, isError: false });
    confirmMock.mockResolvedValue(true);
    renderModal();
    const sub = within(screen.getByTestId("email-domain-block-platform-subdomain"));
    const own = within(screen.getByTestId("email-domain-block-own"));
    fireEvent.click(sub.getByRole("button", { name: "Verificar agora" }));
    expect(mutates.verify).toHaveBeenLastCalledWith({ userId: "u1", params: { kind: "platform-subdomain" } });
    // O interruptor do envio só existe no domínio próprio.
    expect(sub.queryByRole("button", { name: "Voltar ao envio da plataforma" })).toBeNull();
    fireEvent.click(own.getByRole("button", { name: "Voltar ao envio da plataforma" }));
    expect(mutates.platform).toHaveBeenCalledWith({ userId: "u1", params: { kind: "own" } });
    fireEvent.click(sub.getByRole("button", { name: "Remover domínio" }));
    await waitFor(() => expect(mutates.del).toHaveBeenCalledWith({ userId: "u1", params: { kind: "platform-subdomain" } }));
  });

  it("só com o subdomínio: «Adicionar domínio próprio» abre a pergunta do email existente e o aviso do MX", () => {
    getMock.mockReturnValue({ data: onlySub(), isLoading: false, isError: false });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar domínio próprio" }));
    expect(screen.getByLabelText("Domínio de email")).toHaveValue("");
    // Domínio próprio → aparece «Já tem email neste domínio?»; um subdomínio da plataforma não.
    fireEvent.change(screen.getByLabelText("Domínio de email"), { target: { value: "tifas.pt" } });
    expect(screen.getByTestId("own-domain-mail")).toBeInTheDocument();
    expect(screen.getByTestId("mx-warning")).toHaveTextContent("corta o email");
    fireEvent.change(screen.getByLabelText("Domínio de email"), { target: { value: "x.rufvision.com" } });
    expect(screen.queryByTestId("own-domain-mail")).toBeNull();
  });

  it("caminho (a) sem email → caixa na raiz: PUT com existingEmail false e mail root", () => {
    getMock.mockReturnValue({ data: onlySub(), isLoading: false, isError: false });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar domínio próprio" }));
    fireEvent.change(screen.getByLabelText("Domínio de email"), { target: { value: "tifas.pt" } });
    // Sem responder à pergunta não se configura.
    expect(screen.getByRole("button", { name: "Configurar" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Não, o domínio ainda não tem email/));
    expect(screen.getByLabelText(/Na raiz do domínio/)).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    expect(mutates.put).toHaveBeenCalledWith({
      userId: "u1",
      data: { domain: "tifas.pt", fromLocalPart: "geral", senderName: "Barbearia Central", existingEmail: false, mail: "root" },
    });
  });

  it("caminho (c) com email existente: a raiz fica indisponível e vai o subdomínio", () => {
    getMock.mockReturnValue({ data: onlySub(), isLoading: false, isError: false });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar domínio próprio" }));
    fireEvent.change(screen.getByLabelText("Domínio de email"), { target: { value: "tifas.pt" } });
    fireEvent.click(screen.getByLabelText(/Sim, já usa email neste domínio/));
    expect(screen.getByLabelText(/Na raiz do domínio/)).toBeDisabled();
    expect(screen.getByLabelText(/Num subdomínio/)).toBeChecked();
    expect(screen.getByText("geral@contacto.tifas.pt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    expect(mutates.put).toHaveBeenCalledWith({
      userId: "u1",
      data: expect.objectContaining({ domain: "tifas.pt", existingEmail: true, mail: "subdomain" }),
    });
  });

  it("caminho (c) sem caixa: «Sem caixa» manda mail none", () => {
    getMock.mockReturnValue({ data: onlySub(), isLoading: false, isError: false });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar domínio próprio" }));
    fireEvent.change(screen.getByLabelText("Domínio de email"), { target: { value: "tifas.pt" } });
    fireEvent.click(screen.getByLabelText(/Sim, já usa email neste domínio/));
    fireEvent.click(screen.getByLabelText(/Sem caixa neste domínio/));
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    expect(mutates.put).toHaveBeenCalledWith({
      userId: "u1",
      data: expect.objectContaining({ existingEmail: true, mail: "none" }),
    });
  });

  it("um subdomínio da plataforma não leva existingEmail nem mail", () => {
    getMock.mockReturnValue({
      data: twoDomains({ domain: OWN, domains: [OWN], suggestedDomain: "tifas.rufvision.com" }),
      isLoading: false,
      isError: false,
    });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar subdomínio da plataforma" }));
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    expect(mutates.put).toHaveBeenCalledWith({
      userId: "u1",
      data: { domain: "tifas.rufvision.com", fromLocalPart: "geral", senderName: "Barbearia Central" },
    });
  });

  it("erros novos em PT: mx_conflict, mx_not_ready, kind_required", () => {
    renderModal();
    opts.put.mutation.onError({ response: { status: 409, data: { error: "mx_conflict" } } });
    expect(toastError).toHaveBeenLastCalledWith(expect.stringContaining("corta"));
    opts.move.mutation.onError({ response: { status: 409, data: { error: "mx_not_ready" } } });
    expect(toastError).toHaveBeenLastCalledWith(expect.stringContaining("MX"));
    opts.del.mutation.onError({ response: { status: 400, data: { error: "kind_required" } } });
    expect(toastError).toHaveBeenLastCalledWith(expect.stringContaining("dois domínios"));
  });

  const boxes = (addr: string) => ({
    data: { configured: true, moduleEnabled: true, mailboxes: [{ mailboxId: "m1", address: addr, kind: "business", status: "active" }] },
    isLoading: false,
    isError: false,
  });

  it("mover as caixas para o domínio próprio pede confirmação e chama {to: own}", async () => {
    getMock.mockReturnValue({ data: twoDomains(), isLoading: false, isError: false });
    mailboxesMock.mockReturnValue(boxes("geral@tifas.rufvision.com"));
    confirmMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderModal();
    const btn = screen.getByRole("button", { name: "Mover as caixas para o domínio próprio" });
    fireEvent.click(btn);
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    expect(mutates.move).not.toHaveBeenCalled();
    fireEvent.click(btn);
    await waitFor(() => expect(mutates.move).toHaveBeenCalledWith({ userId: "u1", data: { to: "own" } }));
  });

  it("mover fica desactivado com o domínio por verificar", () => {
    getMock.mockReturnValue({ data: twoDomains({ domains: [SUB, { ...OWN, verified: false }] }), isLoading: false, isError: false });
    mailboxesMock.mockReturnValue(boxes("geral@tifas.rufvision.com"));
    renderModal();
    expect(screen.getByRole("button", { name: "Mover as caixas para o domínio próprio" })).toBeDisabled();
  });

  it("caixas já no domínio próprio: oferece voltar ({to: platform})", async () => {
    getMock.mockReturnValue({ data: twoDomains(), isLoading: false, isError: false });
    mailboxesMock.mockReturnValue(boxes("geral@tifas.pt"));
    confirmMock.mockResolvedValue(true);
    renderModal();
    expect(screen.queryByRole("button", { name: "Mover as caixas para o domínio próprio" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voltar as caixas ao subdomínio da plataforma" }));
    await waitFor(() => expect(mutates.move).toHaveBeenCalledWith({ userId: "u1", data: { to: "platform" } }));
  });

  it("resultado do mover: conta as movidas e avisa das que ficaram", () => {
    renderModal();
    opts.move.mutation.onSuccess({
      target: "own",
      moved: [{ mailboxId: "a" }, { mailboxId: "b" }],
      skipped: [{ mailboxId: "c", reason: "address_taken" }],
    });
    expect(toastSuccess).toHaveBeenCalledWith("2 caixas mudaram de endereço.");
    expect(toastInfo).toHaveBeenCalledWith(expect.stringContaining("endereço novo já existe"));
  });

  it("pausar envios pede o motivo e chama a API; cancelar não faz nada", async () => {
    getMock.mockReturnValue({ data: twoDomains(), isLoading: false, isError: false });
    promptMock.mockResolvedValueOnce(null).mockResolvedValueOnce("queixas de spam");
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Pausar envios" }));
    await waitFor(() => expect(promptMock).toHaveBeenCalledTimes(1));
    expect(mutates.pause).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Pausar envios" }));
    await waitFor(() => expect(mutates.pause).toHaveBeenCalledWith({ userId: "u1", data: { reason: "queixas de spam" } }));
  });

  it("pausado: mostra o motivo e Retomar envios", () => {
    getMock.mockReturnValue({
      data: twoDomains({}, { ...SENDING_OK, paused: true, pausedAt: "2026-10-18T10:00:00.000Z", reason: "3 queixas", pausedBy: "auto" }),
      isLoading: false,
      isError: false,
    });
    renderModal();
    expect(screen.getByTestId("email-pause")).toHaveTextContent("Envios pausados");
    expect(screen.getByTestId("email-pause-reason")).toHaveTextContent("automática");
    expect(screen.getByTestId("email-pause-reason")).toHaveTextContent("3 queixas");
    expect(screen.queryByRole("button", { name: "Pausar envios" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retomar envios" }));
    expect(mutates.resume).toHaveBeenCalledWith({ userId: "u1" });
  });
});

// ── Fase 9: news. das campanhas ─────────────────────────────────────────────────────────────────────────────────
describe("AdminEmailModal — Preparar campanhas (news.)", () => {
  it("domínio próprio verificado sem news.: mostra «Preparar campanhas (news.)» e chama POST …/news", () => {
    getMock.mockReturnValue({ data: twoDomains({ domain: { ...OWN, news: null } , domains: [SUB, { ...OWN, news: null }] }), isLoading: false, isError: false });
    renderModal();
    expect(screen.getByTestId("news-section")).toHaveTextContent("news.tifas.pt");
    fireEvent.click(screen.getByRole("button", { name: "Preparar campanhas (news.)" }));
    expect(mutates.news).toHaveBeenCalledWith({ userId: "u1" });
  });

  it("com news. criado: mostra o nome, o estado e os registos com ✓/✗", () => {
    const news = {
      domain: "news.tifas.pt",
      configured: true,
      verified: false,
      lastCheckedAt: null,
      records: [REC({ name: "news-a", verified: true, status: "verified" }), REC({ name: "news-b" })],
    };
    getMock.mockReturnValue({ data: twoDomains({ domains: [SUB, { ...OWN, news }] }), isLoading: false, isError: false });
    renderModal();
    expect(screen.getByTestId("news-domain-name")).toHaveTextContent("news.tifas.pt");
    expect(screen.getByTestId("news-state")).toHaveTextContent("Não verificado");
    const rows = within(screen.getByTestId("news-records")).getAllByTestId("news-record-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("✓ Verificado");
    expect(rows[1]).toHaveTextContent("✗");
    expect(screen.queryByRole("button", { name: "Preparar campanhas (news.)" })).toBeNull();
  });

  it("domínio próprio por verificar ou só o da plataforma: não aparece a secção", () => {
    getMock.mockReturnValue({ data: twoDomains({ domains: [SUB, { ...OWN, verified: false }] }), isLoading: false, isError: false });
    renderModal();
    expect(screen.queryByTestId("news-section")).toBeNull();
  });

  it("409 own_domain_required tem texto PT", () => {
    renderModal();
    opts.news.mutation.onError({ response: { status: 409, data: { error: "own_domain_required" } } });
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("domínio próprio"));
  });
});

describe("EmailStatusCard (Admin → Sistema)", () => {
  const status = (stalwart: object, resend: object = {}) => ({
    data: {
      platformDomain: "rufvision.com",
      resend: { configured: true, domains: { total: 3, verified: 2, unverified: 1 }, sentThisMonth: 42, period: "2026-10", ...resend },
      stalwart,
    },
    isLoading: false,
    isError: false,
  });

  it("Resend: configurado, domínios e envios do mês", () => {
    statusMock.mockReturnValue(status({ configured: false, reachable: null, authenticated: null, status: "not_configured" }));
    render(<EmailStatusCard />);
    const r = within(screen.getByTestId("email-resend"));
    expect(r.getByText("Configurado")).toBeInTheDocument();
    expect(r.getByText(/2 verificados · 1 por verificar/)).toBeInTheDocument();
    expect(r.getByText("42")).toBeInTheDocument();
  });

  it.each([
    ["not_configured", "Por configurar"],
    ["ok", "OK"],
    ["unreachable", "Inalcançável"],
    ["auth_failed", "Credencial errada"],
  ])("Stalwart %s → %s", (st, label) => {
    statusMock.mockReturnValue(status({ configured: st !== "not_configured", reachable: null, authenticated: null, status: st }));
    render(<EmailStatusCard />);
    expect(within(screen.getByTestId("email-stalwart")).getByText(label)).toBeInTheDocument();
  });

  it("tenants pausados: lista com o motivo e Retomar", () => {
    statusMock.mockReturnValue({
      data: {
        platformDomain: "rufvision.com",
        resend: { configured: true, domains: { total: 0, verified: 0, unverified: 0 }, sentThisMonth: 0 },
        stalwart: { status: "ok" },
        pausedTenants: [{ userId: "u9", name: "Barbearia Norte", pausedAt: "2026-10-18T10:00:00.000Z", reason: "queixas", pausedBy: "auto" }],
      },
      isLoading: false,
      isError: false,
    });
    render(<EmailStatusCard />);
    const row = screen.getByTestId("email-paused-row");
    expect(row).toHaveTextContent("Barbearia Norte");
    expect(row).toHaveTextContent("queixas");
    fireEvent.click(within(row).getByRole("button", { name: /Retomar/ }));
    expect(mutates.resume).toHaveBeenCalledWith({ userId: "u9" });
  });

  it("sem tenants pausados: «Nenhum»", () => {
    statusMock.mockReturnValue(status({ status: "ok" }));
    render(<EmailStatusCard />);
    expect(within(screen.getByTestId("email-paused-tenants")).getByText("Nenhum.")).toBeInTheDocument();
  });

  it("erro a carregar", () => {
    statusMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<EmailStatusCard />);
    expect(screen.getByText("Não foi possível carregar.")).toBeInTheDocument();
  });
});
