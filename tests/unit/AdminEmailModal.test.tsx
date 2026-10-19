import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Admin → Utilizadores → "Email" (B42 · fase 4) e o cartão Email do Sistema.
// Hooks gerados mockados por caminho; capturamos as `options.mutation` para testar erros.

const getMock = vi.fn();
const statusMock = vi.fn();
const confirmMock = vi.fn();
const mutates = {
  put: vi.fn(),
  del: vi.fn(),
  verify: vi.fn(),
  platform: vi.fn(),
  own: vi.fn(),
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
vi.mock("../../src/gen/backoffice/hooks/useGetAdminEmailStatus.js", () => ({
  useGetAdminEmailStatus: () => statusMock(),
}));
// Secção «Caixas» (B42 · fases 5 e 6): aqui só interessa que o modal a monta; o detalhe testa-se em AdminMailboxesSection.test.tsx.
vi.mock("../../src/gen/backoffice/hooks/useGetAdminUsersUseridMailboxes.js", () => ({
  useGetAdminUsersUseridMailboxes: () => ({ data: { configured: true, moduleEnabled: true, mailboxes: [] }, isLoading: false, isError: false }),
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

  it("erro a carregar", () => {
    statusMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<EmailStatusCard />);
    expect(screen.getByText("Não foi possível carregar.")).toBeInTheDocument();
  });
});
