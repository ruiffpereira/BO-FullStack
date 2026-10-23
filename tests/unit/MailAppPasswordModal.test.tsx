import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Correio → Caixa → «Configurar no telemóvel» (password da app, B42 · fase 7) ───────────────────────────────────
// A password aparece UMA vez, em memória, e some ao fechar. Hooks gerados mockados; GuardButton real.

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => authMock() }));
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => ({ data: { readOnly: false, reason: "active" } }),
}));

const statusMock = vi.fn();
const createMutate = vi.fn();
const revokeMutate = vi.fn();
const confirmMock = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const opts: Record<string, any> = {};

vi.mock("../../src/gen/backoffice/hooks/useGetMailMailboxesMailboxidAppPassword.js", () => ({
  useGetMailMailboxesMailboxidAppPassword: (id: string, o: unknown) => statusMock(id, o),
}));
vi.mock("../../src/gen/backoffice/hooks/usePostMailMailboxesMailboxidAppPassword.js", () => ({
  usePostMailMailboxesMailboxidAppPassword: (o: any) => ((opts.create = o), { mutate: createMutate, reset: vi.fn(), isPending: false }),
}));
vi.mock("../../src/gen/backoffice/hooks/useDeleteMailMailboxesMailboxidAppPassword.js", () => ({
  useDeleteMailMailboxesMailboxidAppPassword: (o: any) => ((opts.revoke = o), { mutate: revokeMutate, isPending: false }),
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

import { MailAppPasswordModal } from "../../src/components/correio/MailAppPasswordModal";

const SETTINGS = {
  username: "geral@tifas.rufvision.com",
  imap: { host: "mail.rufvision.com", port: 993, security: "SSL/TLS" },
  smtp: { host: "mail.rufvision.com", port: 587, security: "STARTTLS" },
};
const BOX = { mailboxId: "b1", address: "geral@tifas.rufvision.com" };

function setAuth(canEdit = true) {
  authMock.mockReturnValue({
    supportSession: null,
    isMember: !canEdit,
    member: null,
    can: (_k: string, level: string = "view") => (level === "edit" ? canEdit : true),
  });
}

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (box: typeof BOX | null) => (
    <QueryClientProvider client={qc}>
      <MailAppPasswordModal mailbox={box} onClose={onClose} />
    </QueryClientProvider>
  );
  const r = render(ui(BOX));
  return { ...r, onClose, rerenderBox: (box: typeof BOX | null) => r.rerender(ui(box)) };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(opts)) delete opts[k];
  setAuth(true);
  statusMock.mockReturnValue({ data: { exists: false, createdAt: null, count: 0, settings: SETTINGS }, isLoading: false, isError: false });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("MailAppPasswordModal", () => {
  it("antes de gerar: mostra servidor, portas e utilizador, e nenhuma password", () => {
    renderModal();
    const cfg = screen.getByTestId("app-password-settings");
    expect(cfg).toHaveTextContent("geral@tifas.rufvision.com");
    expect(cfg).toHaveTextContent("mail.rufvision.com:993 (SSL/TLS)");
    expect(cfg).toHaveTextContent("mail.rufvision.com:587 (STARTTLS)");
    expect(screen.queryByTestId("app-password-once")).toBeNull();
    expect(screen.queryByRole("button", { name: "Revogar passwords da app" })).toBeNull();
  });

  it("gerar chama a API; a password aparece com o aviso de que não volta a aparecer", async () => {
    renderModal();
    await userEvent.click(screen.getByRole("button", { name: "Gerar password da app" }));
    expect(createMutate).toHaveBeenCalledWith({ mailboxId: "b1" });
    act(() => { opts.create.mutation.onSuccess({ password: "abcd-efgh-ijkl-mnop-qrst-uvwx", createdAt: "2026-10-19T10:00:00.000Z", count: 1, settings: SETTINGS }); });
    expect(await screen.findByTestId("app-password-value")).toHaveTextContent("abcd-efgh-ijkl-mnop-qrst-uvwx");
    expect(screen.getByTestId("app-password-warning")).toHaveTextContent("não volta a aparecer");
    await userEvent.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("abcd-efgh-ijkl-mnop-qrst-uvwx"));
  });

  it("fechar apaga a password: ao reabrir não está lá", async () => {
    const { rerenderBox, onClose } = renderModal();
    act(() => { opts.create.mutation.onSuccess({ password: "segredo-uma-vez", count: 1, settings: SETTINGS }); });
    expect(await screen.findByTestId("app-password-value")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Fechar" })[0]);
    expect(onClose).toHaveBeenCalled();
    rerenderBox(null);
    rerenderBox(BOX);
    expect(screen.queryByText("segredo-uma-vez")).toBeNull();
  });

  it("revogar pede confirmação e chama o DELETE", async () => {
    statusMock.mockReturnValue({ data: { exists: true, createdAt: "2026-10-18T10:00:00.000Z", count: 2, settings: SETTINGS }, isLoading: false, isError: false });
    confirmMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderModal();
    expect(screen.getByText("2 passwords da app activas")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Revogar passwords da app" });
    await userEvent.click(btn);
    expect(revokeMutate).not.toHaveBeenCalled();
    await userEvent.click(btn);
    await waitFor(() => expect(revokeMutate).toHaveBeenCalledWith({ mailboxId: "b1" }));
  });

  it("com 5 passwords já não se gera outra; erros PT", () => {
    statusMock.mockReturnValue({ data: { exists: true, createdAt: null, count: 5, settings: SETTINGS }, isLoading: false, isError: false });
    renderModal();
    expect(screen.getByRole("button", { name: "Gerar password da app" })).toBeDisabled();
    opts.create.mutation.onError({ response: { status: 409, data: { error: "x", code: "APP_PASSWORD_LIMIT" } } });
    expect(toastError).toHaveBeenCalledWith("Já há 5 passwords da app. Revoga-as e gera uma nova.");
    opts.create.mutation.onError({ response: { status: 403, data: { error: "x", code: "APP_PASSWORD_OWNER_ONLY" } } });
    expect(toastError).toHaveBeenLastCalledWith("Só o dono desta caixa pode gerir a password da app.");
  });

  it("só-ver (sem Responder): gerar e revogar ficam desactivados", () => {
    setAuth(false);
    statusMock.mockReturnValue({ data: { exists: true, createdAt: null, count: 1, settings: SETTINGS }, isLoading: false, isError: false });
    renderModal();
    expect(screen.getByRole("button", { name: "Gerar password da app" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revogar passwords da app" })).toBeDisabled();
  });
});
