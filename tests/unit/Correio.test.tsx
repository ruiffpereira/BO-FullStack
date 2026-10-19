import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Correio → Caixa (B42 · fases 5 e 6) ───────────────────────────────────────────────────────────────────────────
// Mockamos a sessão (can), os hooks gerados e o upload; o QueryClient é real (invalidações). O GuardButton é o real:
// é ele que prova o «só ver» (botão desactivado com o motivo).

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => authMock() }));
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));

const mailboxesMock = vi.fn();
const threadsMock = vi.fn();
const threadMock = vi.fn();
const readMutate = vi.fn();
const unreadMutate = vi.fn();
const archiveMutate = vi.fn();
const unarchiveMutate = vi.fn();
const sendMutateAsync = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetMailMailboxes.js", () => ({
  useGetMailMailboxes: (o: unknown) => mailboxesMock(o),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetMailMailboxesMailboxidThreads.js", () => ({
  useGetMailMailboxesMailboxidThreads: (mb: string, params: unknown, o: unknown) => threadsMock(mb, params, o),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetMailMailboxesMailboxidThreadsThreadid.js", () => ({
  useGetMailMailboxesMailboxidThreadsThreadid: (mb: string, th: string, params: unknown, o: unknown) => threadMock(mb, th, params, o),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostMailMailboxesMailboxidThreadsThreadidRead.js", () => ({
  usePostMailMailboxesMailboxidThreadsThreadidRead: () => ({ mutate: readMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostMailMailboxesMailboxidThreadsThreadidUnread.js", () => ({
  usePostMailMailboxesMailboxidThreadsThreadidUnread: () => ({ mutate: unreadMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostMailMailboxesMailboxidThreadsThreadidArchive.js", () => ({
  usePostMailMailboxesMailboxidThreadsThreadidArchive: () => ({ mutate: archiveMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostMailMailboxesMailboxidThreadsThreadidUnarchive.js", () => ({
  usePostMailMailboxesMailboxidThreadsThreadidUnarchive: () => ({ mutate: unarchiveMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostMailMailboxesMailboxidSend.js", () => ({
  usePostMailMailboxesMailboxidSend: () => ({ mutateAsync: sendMutateAsync, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetMailMailboxesMailboxidEmailsEmailidAttachmentsAttachmentid.js", () => ({
  getMailMailboxesMailboxidEmailsEmailidAttachmentsAttachmentid: vi.fn(),
}));
vi.mock("../../src/gen/backoffice/hooks/useUploadImage.js", () => ({ uploadImage: vi.fn() }));
vi.mock("../../src/gen/backoffice/hooks/useUploadPdf.js", () => ({ uploadPdf: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { Correio } from "../../src/pages/Correio";

const BOX = { mailboxId: "b1", address: "geral@tifas.rufvision.com", kind: "business", displayName: "Geral", own: true, unread: 2 };
const OWN = { mailboxId: "b2", address: "ana@tifas.rufvision.com", kind: "member", displayName: "Ana", own: true, unread: 0 };

const ITEMS = [
  {
    threadId: "t1",
    emailId: "e1",
    subject: "Marcação para sábado",
    preview: "Boa tarde, queria marcar um corte",
    from: [{ name: "Maria Silva", email: "maria@x.pt" }],
    to: [{ name: null, email: "geral@tifas.rufvision.com" }],
    receivedAt: "2026-10-19T09:00:00.000Z",
    unread: true,
    hasAttachment: true,
  },
  {
    threadId: "t2",
    emailId: "e2",
    subject: "Obrigado",
    preview: "Até breve",
    from: [{ name: null, email: "joao@x.pt" }],
    to: [],
    receivedAt: "2026-10-18T09:00:00.000Z",
    unread: false,
    hasAttachment: false,
  },
];

const MSG = {
  emailId: "e1",
  from: [{ name: "Maria Silva", email: "maria@x.pt" }],
  to: [{ name: null, email: "geral@tifas.rufvision.com" }],
  cc: [],
  subject: "Marcação para sábado",
  receivedAt: "2026-10-19T09:00:00.000Z",
  unread: true,
  outgoing: false,
  text: "Boa tarde",
  html: "<p>Boa tarde</p><img src='x' data-cid='logo@x'>",
  hasRemoteImages: true,
  attachments: [{ attachmentId: "a1", name: "orcamento.pdf", type: "application/pdf", size: 2048, cid: null, inline: false }],
};

function setAuth(canEdit: boolean) {
  authMock.mockReturnValue({
    supportSession: null,
    isMember: !canEdit,
    member: null,
    can: (_key: string, level: string = "view") => (level === "edit" ? canEdit : true),
  });
}

function renderAt(url = "/correio") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Correio />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth(true);
  mailboxesMock.mockReturnValue({ data: { configured: true, mailboxes: [BOX] }, isLoading: false, isError: false });
  threadsMock.mockReturnValue({ data: { items: ITEMS, total: 2, page: 1, limit: 25 }, isLoading: false, isError: false });
  threadMock.mockReturnValue({ data: { threadId: "t1", messages: [MSG] }, isLoading: false, isError: false });
  sendMutateAsync.mockResolvedValue({ emailId: "e9", threadId: "t9" });
});

describe("Correio → Caixa — lista, pastas e pesquisa", () => {
  it("mostra remetente, assunto, pré-visualização, clipe de anexo e destaca as não lidas", () => {
    renderAt();
    const rows = screen.getAllByTestId("mail-thread-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Maria Silva")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Marcação para sábado")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/queria marcar um corte/)).toBeInTheDocument();
    expect(within(rows[0]).getByTestId("mail-clip")).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute("data-unread", "true");
    expect(rows[1]).toHaveAttribute("data-unread", "false");
    expect(within(rows[1]).queryByTestId("mail-clip")).toBeNull();
  });

  it("pastas Por ler · Todas · Arquivo · Enviados: a escolhida vai ao servidor", async () => {
    renderAt();
    for (const name of ["Por ler", "Todas", "Arquivo", "Enviados"]) {
      expect(screen.getByRole("tab", { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(threadsMock).toHaveBeenLastCalledWith("b1", expect.objectContaining({ folder: "unread", page: 1 }), expect.anything());
    await userEvent.click(screen.getByRole("tab", { name: "Arquivo" }));
    expect(threadsMock).toHaveBeenLastCalledWith("b1", expect.objectContaining({ folder: "archive" }), expect.anything());
  });

  it("a pesquisa vai como `q` (com um pequeno atraso)", async () => {
    renderAt();
    fireEvent.change(screen.getByLabelText("Pesquisar no correio"), { target: { value: "orçamento" } });
    await waitFor(() =>
      expect(threadsMock).toHaveBeenLastCalledWith("b1", expect.objectContaining({ q: "orçamento" }), expect.anything()),
    );
  });

  it("várias caixas: selector (a do negócio e a minha) e a escolhida muda o pedido", async () => {
    mailboxesMock.mockReturnValue({ data: { configured: true, mailboxes: [BOX, OWN] }, isLoading: false, isError: false });
    renderAt();
    const sel = screen.getByLabelText("Caixa");
    expect(within(sel).getAllByRole("option")).toHaveLength(2);
    await userEvent.selectOptions(sel, "b2");
    expect(threadsMock).toHaveBeenLastCalledWith("b2", expect.anything(), expect.anything());
  });

  it("«Configurar no telemóvel» só aparece nas caixas que posso gerir (canManageAppPassword)", async () => {
    mailboxesMock.mockReturnValue({
      data: { configured: true, mailboxes: [{ ...BOX, canManageAppPassword: true }, { ...OWN, canManageAppPassword: false }] },
      isLoading: false,
      isError: false,
    });
    renderAt();
    expect(screen.getByRole("button", { name: "Configurar no telemóvel" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Caixa"), "b2");
    expect(screen.queryByRole("button", { name: "Configurar no telemóvel" })).toBeNull();
  });

  it("uma só caixa: sem selector", () => {
    renderAt();
    expect(screen.queryByLabelText("Caixa")).toBeNull();
  });

  it("pasta vazia mostra o estado vazio", () => {
    threadsMock.mockReturnValue({ data: { items: [], total: 0, page: 1, limit: 25 }, isLoading: false, isError: false });
    renderAt();
    expect(screen.getByTestId("mail-empty")).toBeInTheDocument();
  });
});

describe("Correio → Caixa — por configurar", () => {
  it("`configured: false` mostra «Por configurar»", () => {
    mailboxesMock.mockReturnValue({ data: { configured: false, mailboxes: [] }, isLoading: false, isError: false });
    renderAt();
    expect(screen.getByTestId("mail-not-configured")).toHaveTextContent("Por configurar");
  });

  it("503 mail_not_configured nas conversas também", () => {
    threadsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 503, data: { error: "mail_not_configured" } } },
    });
    renderAt();
    expect(screen.getByTestId("mail-not-configured")).toBeInTheDocument();
  });

  it("502 mail_provider_error: mensagem em PT e «Tentar de novo»", () => {
    threadsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 502, data: { error: "mail_provider_error" } } },
      refetch: vi.fn(),
    });
    renderAt();
    expect(screen.getByText(/servidor de correio não respondeu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

describe("Correio → Caixa — conversa", () => {
  it("o HTML vai num iframe SEM allow-scripts, com CSP e imagens remotas bloqueadas", () => {
    renderAt("/correio?caixa=b1&conversa=t1");
    const frame = screen.getByTestId("mail-html-frame") as HTMLIFrameElement;
    const sandbox = frame.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-scripts");
    const doc = frame.getAttribute("srcdoc") ?? "";
    expect(doc).toContain("Content-Security-Policy");
    expect(doc).toContain("img-src data:;");
    expect(doc).not.toContain("https:");
    expect(threadMock).toHaveBeenLastCalledWith("b1", "t1", undefined, expect.anything());
  });

  it("«Mostrar imagens» volta a pedir a conversa com remoteImages e abre a CSP a https", async () => {
    renderAt("/correio?caixa=b1&conversa=t1");
    expect(screen.getByTestId("mail-remote-images")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar imagens" }));
    expect(threadMock).toHaveBeenLastCalledWith("b1", "t1", { remoteImages: "true" }, expect.anything());
    expect((screen.getByTestId("mail-html-frame") as HTMLIFrameElement).getAttribute("srcdoc")).toContain("img-src data: https:");
    expect(screen.queryByTestId("mail-remote-images")).toBeNull();
  });

  it("os anexos (não inline) aparecem para descarregar", () => {
    renderAt("/correio?caixa=b1&conversa=t1");
    expect(screen.getByTestId("mail-attachment")).toHaveTextContent("orcamento.pdf");
  });

  it("com Responder: marca lida ao abrir (uma vez)", async () => {
    renderAt("/correio?caixa=b1&conversa=t1");
    await waitFor(() => expect(readMutate).toHaveBeenCalledTimes(1));
    expect(readMutate.mock.calls[0][0]).toEqual({ mailboxId: "b1", threadId: "t1" });
  });

  it("só Ver: lê mas não marca lida, e Responder/Arquivar/Marcar não lido ficam desactivados com o motivo", () => {
    setAuth(false);
    renderAt("/correio?caixa=b1&conversa=t1");
    expect(screen.getByTestId("mail-thread-subject")).toHaveTextContent("Marcação para sábado");
    expect(readMutate).not.toHaveBeenCalled();
    for (const name of ["Responder", "Responder a todos", "Encaminhar", "Arquivar", "Marcar como não lido", "Novo email"]) {
      const btn = screen.getByRole("button", { name });
      expect(btn).toBeDisabled();
      expect(btn.closest("span")).toHaveAttribute("title", "Só tens permissão para ver");
    }
  });

  it("Arquivar chama a API; na pasta Arquivo a acção é «Desarquivar»", async () => {
    renderAt("/correio?caixa=b1&conversa=t1");
    await userEvent.click(screen.getByRole("button", { name: "Arquivar" }));
    expect(archiveMutate.mock.calls[0][0]).toEqual({ mailboxId: "b1", threadId: "t1" });
  });

  it("pasta Arquivo: «Desarquivar»", async () => {
    renderAt("/correio?caixa=b1&conversa=t1&pasta=archive");
    expect(screen.queryByRole("button", { name: "Arquivar" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Desarquivar" }));
    expect(unarchiveMutate).toHaveBeenCalled();
  });

  it("Marcar como não lido chama a API", async () => {
    renderAt("/correio?caixa=b1&conversa=t1");
    await userEvent.click(screen.getByRole("button", { name: "Marcar como não lido" }));
    expect(unreadMutate.mock.calls[0][0]).toEqual({ mailboxId: "b1", threadId: "t1" });
  });

  it("Responder envia mode reply com o emailId da última mensagem e sem destinatários (a API deriva-os)", async () => {
    renderAt("/correio?caixa=b1&conversa=t1");
    await userEvent.click(screen.getByRole("button", { name: "Responder" }));
    const dialog = screen.getByRole("dialog", { name: "Responder" });
    await userEvent.type(within(dialog).getByLabelText("Mensagem"), "Sim, fica marcado.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(sendMutateAsync).toHaveBeenCalledTimes(1));
    const arg = sendMutateAsync.mock.calls[0][0];
    expect(arg.mailboxId).toBe("b1");
    expect(arg.data).toEqual({ mode: "reply", emailId: "e1", text: "Sim, fica marcado." });
  });
});

describe("Correio → Caixa — compositor", () => {
  async function openNew() {
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: "Novo email" }));
    return screen.getByRole("dialog", { name: "Novo email" });
  }

  it("Novo email sem destinatário não envia e diz porquê", async () => {
    const dialog = await openNew();
    await userEvent.type(within(dialog).getByLabelText("Mensagem"), "Olá");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("pelo menos um destinatário");
    expect(sendMutateAsync).not.toHaveBeenCalled();
  });

  it("um endereço inválido bloqueia o envio", async () => {
    const dialog = await openNew();
    await userEvent.type(within(dialog).getByLabelText("Para"), "isto-nao-e-email");
    await userEvent.type(within(dialog).getByLabelText("Mensagem"), "Olá");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Endereço inválido");
    expect(sendMutateAsync).not.toHaveBeenCalled();
  });

  it("mensagem vazia e sem anexos não envia", async () => {
    const dialog = await openNew();
    await userEvent.type(within(dialog).getByLabelText("Para"), "maria@x.pt");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("vazio");
    expect(sendMutateAsync).not.toHaveBeenCalled();
  });

  it("envia mode new com para/cc/bcc/assunto/texto", async () => {
    const dialog = await openNew();
    await userEvent.type(within(dialog).getByLabelText("Para"), "maria@x.pt, joao@x.pt");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cc / Bcc" }));
    await userEvent.type(within(dialog).getByLabelText("Cc"), "ana@x.pt");
    await userEvent.type(within(dialog).getByLabelText("Bcc"), "dono@x.pt");
    await userEvent.type(within(dialog).getByLabelText("Assunto"), "Horários");
    await userEvent.type(within(dialog).getByLabelText("Mensagem"), "Abrimos às 9h.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(sendMutateAsync).toHaveBeenCalledTimes(1));
    expect(sendMutateAsync.mock.calls[0][0]).toEqual({
      mailboxId: "b1",
      data: {
        mode: "new",
        to: ["maria@x.pt", "joao@x.pt"],
        cc: ["ana@x.pt"],
        bcc: ["dono@x.pt"],
        subject: "Horários",
        text: "Abrimos às 9h.",
      },
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("um erro da API (MAIL_NO_RECIPIENTS) aparece em PT e o compositor fica aberto", async () => {
    sendMutateAsync.mockRejectedValue({ response: { status: 400, data: { error: "MAIL_NO_RECIPIENTS" } } });
    const dialog = await openNew();
    await userEvent.type(within(dialog).getByLabelText("Para"), "maria@x.pt");
    await userEvent.type(within(dialog).getByLabelText("Mensagem"), "Olá");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Falta o destinatário."));
    expect(screen.getByRole("dialog", { name: "Novo email" })).toBeInTheDocument();
  });
});
