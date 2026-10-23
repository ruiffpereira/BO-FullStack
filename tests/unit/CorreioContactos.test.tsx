import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Correio → Contactos (B42 · fase 8) ────────────────────────────────────────────────────────────────────────────
// Hooks gerados mockados; o GuardButton é o real (prova o «só ver»); a rota é /correio/contactos (folha correio.contactos).

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => authMock() }));
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));

const contactsMock = vi.fn();
const exportMock = vi.fn();
const patchMutate = vi.fn();
const unsubMutate = vi.fn();
const importMutate = vi.fn();
const confirmMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const opts: Record<string, any> = {};

vi.mock("../../src/gen/backoffice/hooks/useGetMailContacts.js", () => ({
  useGetMailContacts: (params: unknown, o: unknown) => contactsMock(params, o),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetMailContactsExport.js", () => ({
  getMailContactsExport: (...a: unknown[]) => exportMock(...a),
}));
vi.mock("../../src/gen/backoffice/hooks/usePatchMailContactsContactid.js", () => ({
  usePatchMailContactsContactid: (o: any) => ((opts.patch = o), { mutate: patchMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostMailContactsContactidUnsubscribe.js", () => ({
  usePostMailContactsContactidUnsubscribe: (o: any) => ((opts.unsub = o), { mutate: unsubMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostMailContactsImport.js", () => ({
  usePostMailContactsImport: (o: any) => ((opts.import = o), { mutate: importMutate, isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetMailMailboxes.js", () => ({
  useGetMailMailboxes: () => ({ data: { mailboxes: [] } }),
}));
vi.mock("../../src/gen/backoffice/hooks/useGetMailMailboxesMailboxidEmailsEmailidAttachmentsAttachmentid.js", () => ({
  getMailMailboxesMailboxidEmailsEmailidAttachmentsAttachmentid: vi.fn(),
}));
vi.mock("../../src/components/confirm", () => ({ confirmDialog: (...a: unknown[]) => confirmMock(...a) }));
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { CorreioContactos } from "../../src/pages/CorreioContactos";

const C = (over: object) => ({
  contactId: "c1",
  email: "maria@x.pt",
  name: "Maria",
  customerId: null,
  status: "subscribed",
  source: "site",
  subscribedAt: "2026-10-01T10:00:00.000Z",
  unsubscribedAt: null,
  consentText: "Quero novidades",
  tags: ["vip"],
  language: "pt",
  createdAt: "2026-10-01T10:00:00.000Z",
  ...over,
});

const LIST = {
  items: [
    C({}),
    C({ contactId: "c2", email: "joao@x.pt", name: null, status: "unsubscribed", source: "balcao", tags: [], subscribedAt: null }),
    C({ contactId: "c3", email: "ana@x.pt", status: "unsubscribed_by_user", source: "importacao", unsubscribedAt: "2026-10-05T10:00:00.000Z" }),
    C({ contactId: "c4", email: "rui@x.pt", status: "bounced", source: "app", subscribedAt: null }),
  ],
  total: 4,
  page: 1,
  limit: 25,
  counts: { subscribed: 1, unsubscribed: 1, unsubscribed_by_user: 1, bounced: 1, complained: 2 },
};

function setAuth(canEdit: boolean) {
  authMock.mockReturnValue({
    supportSession: null,
    isMember: !canEdit,
    member: null,
    can: (_key: string, level: string = "view") => (level === "edit" ? canEdit : true),
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/correio/contactos"]}>
        <CorreioContactos />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(opts)) delete opts[k];
  setAuth(true);
  contactsMock.mockReturnValue({ data: LIST, isLoading: false, isError: false });
});

describe("Correio → Contactos — lista", () => {
  it("mostra o estado (Subscrito / Não subscrito / Anulou / Bloqueado), a origem, as etiquetas e os contadores", () => {
    renderPage();
    const rows = screen.getAllByTestId("contact-row");
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByTestId("contact-status")).toHaveTextContent("Subscrito");
    expect(within(rows[0]).getByText("Site")).toBeInTheDocument();
    expect(within(rows[0]).getByTestId("contact-tags")).toHaveTextContent("vip");
    expect(within(rows[1]).getByTestId("contact-status")).toHaveTextContent("Não subscrito");
    expect(within(rows[1]).getByText("Balcão")).toBeInTheDocument();
    expect(within(rows[2]).getByTestId("contact-status")).toHaveTextContent("Anulou");
    expect(within(rows[3]).getByTestId("contact-status")).toHaveTextContent("Bloqueado");
    expect(within(screen.getByTestId("contacts-count-subscribed")).getByText("1")).toBeInTheDocument();
    // Bloqueados = bounced + complained.
    expect(within(screen.getByTestId("contacts-count-blocked")).getByText("3")).toBeInTheDocument();
  });

  it("filtros e pesquisa vão ao servidor", async () => {
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "subscribed");
    expect(contactsMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: "subscribed", page: 1 }), expect.anything());
    await userEvent.selectOptions(screen.getByLabelText("Origem"), "balcao");
    expect(contactsMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: "subscribed", source: "balcao" }), expect.anything());
    fireEvent.change(screen.getByLabelText("Pesquisar contactos"), { target: { value: "maria" } });
    await waitFor(() => expect(contactsMock).toHaveBeenLastCalledWith(expect.objectContaining({ q: "maria" }), expect.anything()));
    fireEvent.change(screen.getByLabelText("Etiqueta"), { target: { value: "vip" } });
    await waitFor(() => expect(contactsMock).toHaveBeenLastCalledWith(expect.objectContaining({ tag: "vip" }), expect.anything()));
  });

  it("sem contactos: estado vazio", () => {
    contactsMock.mockReturnValue({ data: { items: [], total: 0, page: 1, limit: 25, counts: {} }, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByTestId("contacts-empty")).toHaveTextContent("Ainda sem contactos");
  });

  it("Anular subscrição só nos subscritos; pede confirmação e chama a API", async () => {
    confirmMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderPage();
    const rows = screen.getAllByTestId("contact-row");
    expect(within(rows[1]).queryByRole("button", { name: /Anular subscrição/ })).toBeNull();
    const btn = within(rows[0]).getByRole("button", { name: "Anular subscrição de maria@x.pt" });
    await userEvent.click(btn);
    expect(unsubMutate).not.toHaveBeenCalled();
    await userEvent.click(btn);
    await waitFor(() => expect(unsubMutate).toHaveBeenCalledWith({ contactId: "c1" }));
  });

  it("editar etiquetas: separa por vírgula e faz PATCH", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Etiquetas de maria@x.pt" }));
    const tags = within(screen.getByRole("dialog")).getByLabelText(/^Etiquetas/);
    expect(tags).toHaveValue("vip");
    fireEvent.change(tags, { target: { value: "vip, verão, vip" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(patchMutate).toHaveBeenCalledWith({
      contactId: "c1",
      data: { name: "Maria", tags: ["vip", "verão"], language: "pt" },
    });
  });
});

describe("Correio → Contactos — importar CSV", () => {
  async function toConsentStep(csv = "email,nome\nmaria@x.pt,Maria\njoao@x.pt,João") {
    await userEvent.click(screen.getByRole("button", { name: "Importar CSV" }));
    fireEvent.change(screen.getByLabelText("Conteúdo do CSV"), { target: { value: csv } });
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
  }

  it("sem linhas de dados não se avança", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Importar CSV" }));
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Conteúdo do CSV"), { target: { value: "email" } });
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("o consentimento é obrigatório: Importar fica desactivado até marcar a caixa", async () => {
    renderPage();
    await toConsentStep();
    const importBtn = screen.getByRole("button", { name: "Importar" });
    expect(importBtn).toBeDisabled();
    await userEvent.click(importBtn);
    expect(importMutate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox", { name: /Confirmo que estes contactos deram consentimento/ }));
    expect(importBtn).toBeEnabled();
  });

  it("confirmado: envia consentConfirmed true, o csv e as etiquetas", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Importar CSV" }));
    fireEvent.change(screen.getByLabelText("Conteúdo do CSV"), { target: { value: "email\na@x.pt\nb@x.pt" } });
    fireEvent.change(screen.getByLabelText(/Etiquetas a juntar/), { target: { value: "evento, 2026" } });
    expect(screen.getByTestId("import-rows")).toHaveTextContent("2 linhas");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Importar" }));
    expect(importMutate).toHaveBeenCalledWith({
      data: { consentConfirmed: true, csv: "email\na@x.pt\nb@x.pt", tags: ["evento", "2026"] },
    });
  });

  it("relatório: totais e as linhas recusadas com o motivo em PT", async () => {
    renderPage();
    await toConsentStep();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Importar" }));
    act(() => {
      opts.import.mutation.onSuccess({
        total: 4,
        created: 1,
        updated: 1,
        rejected: 2,
        skipped: [
          { line: 3, email: "x@", reason: "invalid_email" },
          { line: 4, email: "ana@x.pt", reason: "already_unsubscribed" },
        ],
      });
    });
    const report = await screen.findByTestId("import-report");
    const rows = within(report).getAllByTestId("import-skipped-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Email inválido");
    expect(rows[1]).toHaveTextContent("Já anulou a subscrição");
    expect(report).toHaveTextContent("Recusadas");
  });

  it("erro 400 consent_confirmation_required → mensagem PT", () => {
    renderPage();
    opts.import.mutation.onError({ response: { status: 400, data: { error: "x", code: "CONSENT_CONFIRMATION_REQUIRED" } } });
    expect(toastError).toHaveBeenCalledWith("Tens de confirmar que estes contactos deram consentimento.");
  });

  it("cada abertura recomeça sem o consentimento marcado", async () => {
    renderPage();
    await toConsentStep();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await toConsentStep();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
});

describe("Correio → Contactos — exportar e só-ver", () => {
  it("Exportar pede o CSV com os filtros actuais e descarrega-o", async () => {
    const createObjectURL = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    exportMock.mockResolvedValue("email,nome\nmaria@x.pt,Maria\n");
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "subscribed");
    await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledWith({ status: "subscribed" }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  });

  it("só-ver: Importar, Etiquetas e Anular ficam desactivados; Exportar continua", () => {
    setAuth(false);
    renderPage();
    expect(screen.getByRole("button", { name: "Importar CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Etiquetas de maria@x.pt" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anular subscrição de maria@x.pt" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeEnabled();
  });
});
