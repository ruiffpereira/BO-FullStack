import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Mensagens (B43): separadores por folha, lista de clientes, só-ver, admin só com o Suporte ─────────────────────
// Mockamos a auth (can/permissions), os hooks de dados e, nos testes das abas, o fio (ChatConversationView).

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => authMock() }));

const customerConvsMock = vi.fn();
const customerThreadMock = vi.fn();
const teamPeopleMock = vi.fn();
const teamThreadMock = vi.fn();
const summaryMock = vi.fn();
const replyMutate = vi.fn();
const sendTeamMutate = vi.fn();
vi.mock("../../src/hooks/useMessages", () => ({
  useCustomerConversations: (o: unknown) => customerConvsMock(o),
  useCustomerThread: (id: string | null) => customerThreadMock(id),
  useReplyCustomer: () => ({ mutateAsync: replyMutate }),
  useMarkCustomerRead: () => ({ mutate: vi.fn() }),
  useTeamPeople: (e: boolean) => teamPeopleMock(e),
  useTeamThread: (k: string | null) => teamThreadMock(k),
  useSendTeam: () => ({ mutateAsync: sendTeamMutate }),
  useMarkTeamRead: () => ({ mutate: vi.fn() }),
  useMessagesSummary: () => summaryMock(),
  fetchOlderCustomer: vi.fn(),
  fetchOlderTeam: vi.fn(),
}));

vi.mock("../../src/hooks/useChat", async (orig) => {
  const real = await orig<typeof import("../../src/hooks/useChat")>();
  return {
    ...real,
    useSupportThread: () => ({ data: undefined, isLoading: false }),
    useAdminThread: () => ({ data: undefined, isLoading: false }),
    useSendSupportMessage: () => ({ mutateAsync: vi.fn() }),
    useSendAdminMessage: () => ({ mutateAsync: vi.fn() }),
    useMarkSupportRead: () => ({ mutate: vi.fn() }),
    useMarkAdminRead: () => ({ mutate: vi.fn() }),
  };
});

vi.mock("../../src/gen/backoffice/hooks/useUploadImage.js", () => ({ uploadImage: vi.fn() }));
vi.mock("../../src/gen/backoffice/hooks/useUploadPdf.js", () => ({ uploadPdf: vi.fn() }));

// O fio real só entra nos testes de "só-ver"; nas abas é um marcador com o scope que lhe foi dado.
const realView = vi.hoisted(() => ({ on: false }));
vi.mock("../../src/components/chat/ChatConversationView", async (orig) => {
  const real = await orig<typeof import("../../src/components/chat/ChatConversationView")>();
  return {
    ...real,
    ChatConversationView: (p: { scope: unknown; active?: boolean }) =>
      realView.on ? real.ChatConversationView(p as never) : <div data-testid="conv-view">{JSON.stringify(p.scope)}</div>,
  };
});
// `MensagensTab` (inbox do admin) tem as suas queries: marcador.
vi.mock("../../src/components/chat/MensagensTab", () => ({ MensagensTab: () => <div data-testid="admin-inbox" /> }));

import { Mensagens } from "../../src/pages/Mensagens";
import { ClientesChatTab } from "../../src/components/chat/ClientesChatTab";
import { BackofficeChatTab } from "../../src/components/chat/BackofficeChatTab";
import { ChatConversationView } from "../../src/components/chat/ChatConversationView";
import { VIEW_ONLY_MESSAGE } from "../../src/lib/teamAccess";
import { canFromGrants } from "../../src/lib/teamTree";

/** Auth de um membro com estas FOLHAS (mesma regra do `can` real: edit implica view; agrupador = alguma folha). */
function memberAuth(leaves: Record<string, "view" | "edit">) {
  const grants = Object.entries(leaves).map(([key, level]) => ({ key, level }));
  return {
    permissions: [],
    isMember: true,
    supportSession: null,
    userId: "u1",
    authHeader: () => ({}),
    can: (key: string, level: "view" | "edit" = "view") => canFromGrants(grants, key, level),
  };
}
const ownerAuth = () => ({ permissions: [], isMember: false, supportSession: null, userId: "u1", authHeader: () => ({}), can: () => true });
const adminAuth = () => ({ ...ownerAuth(), permissions: [{ name: "VIEW_ADMIN" }] });

const conv = (over: Record<string, unknown>) => ({
  conversationId: "cv1",
  customerId: "cu1",
  customerName: "Rita Costa",
  customerEmail: "rita@x.pt",
  lastMessageAt: "2026-10-18T10:00:00.000Z",
  unread: 0,
  lastMessage: { senderRole: "customer", preview: "Posso mudar a hora?", createdAt: "2026-10-18T10:00:00.000Z" },
  ...over,
});

function renderAt(ui: React.ReactElement, path = "/mensagens") {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  realView.on = false;
  authMock.mockReturnValue(ownerAuth());
  summaryMock.mockReturnValue({ data: { customers: 2, team: 1, support: 0, total: 3 } });
  customerConvsMock.mockReturnValue({ data: { conversations: [], hasMore: false, unreadTotal: 0 }, isLoading: false, isError: false });
  customerThreadMock.mockReturnValue({ data: undefined, isLoading: false });
  teamPeopleMock.mockReturnValue({ data: { people: [], support: null, unreadTotal: 0 }, isLoading: false });
  teamThreadMock.mockReturnValue({ data: undefined, isLoading: false });
});

describe("Mensagens — separadores por folha", () => {
  it("o dono vê os dois separadores (Clientes e Backoffice)", () => {
    renderAt(<Mensagens view="clientes" />);
    expect(screen.getByRole("tab", { name: "Clientes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Backoffice" })).toBeInTheDocument();
  });

  it("membro sem `mensagens.clientes` não vê o separador Clientes (e é levado ao Backoffice)", () => {
    authMock.mockReturnValue(memberAuth({ "mensagens.equipa": "edit", "mensagens.suporte": "view" }));
    renderAt(<Mensagens view="clientes" />);
    // Sem mais do que um separador não há barra; a página mostra a lista da equipa/Suporte.
    expect(screen.queryByRole("tab", { name: "Clientes" })).toBeNull();
    expect(screen.queryByTestId("clientes-empty")).toBeNull();
  });

  it("membro só com `mensagens.clientes` não vê o separador Backoffice", () => {
    authMock.mockReturnValue(memberAuth({ "mensagens.clientes": "view" }));
    renderAt(<Mensagens view="clientes" />);
    expect(screen.queryByRole("tab", { name: "Backoffice" })).toBeNull();
    expect(screen.getByPlaceholderText("Procurar cliente…")).toBeInTheDocument();
  });

  it("o admin da plataforma vê só a inbox do Suporte — sem separadores, sem Clientes nem Equipa", () => {
    authMock.mockReturnValue(adminAuth());
    renderAt(<Mensagens view="clientes" />);
    expect(screen.getByTestId("admin-inbox")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(customerConvsMock).not.toHaveBeenCalled();
    expect(teamPeopleMock).not.toHaveBeenCalled();
  });
});

describe("ClientesChatTab — lista", () => {
  it("mostra as conversas (nome, pré-visualização, por ler) e abre o fio ao clicar", async () => {
    customerConvsMock.mockReturnValue({
      data: {
        conversations: [
          conv({ conversationId: "cv1", customerName: "Rita Costa", unread: 3 }),
          conv({ conversationId: "cv2", customerId: "cu2", customerName: "Tiago", lastMessage: { senderRole: "business", preview: "Feito", createdAt: "2026-10-17T10:00:00.000Z" } }),
        ],
        hasMore: false,
        unreadTotal: 3,
      },
      isLoading: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderAt(<ClientesChatTab />);

    const rows = screen.getAllByTestId("customer-conversation");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Rita Costa")).toBeInTheDocument();
    expect(within(rows[0]).getByTestId("conversation-unread")).toHaveTextContent("3");
    expect(within(rows[1]).getByText("Tu: Feito")).toBeInTheDocument();

    await user.click(rows[0]);
    expect(screen.getByTestId("conv-view")).toHaveTextContent('"kind":"customer"');
    expect(screen.getByTestId("conv-view")).toHaveTextContent("cv1");
  });

  it("filtros Por ler / Todas pedem o filtro certo à API", async () => {
    const user = userEvent.setup();
    renderAt(<ClientesChatTab />);
    expect(customerConvsMock).toHaveBeenLastCalledWith(expect.objectContaining({ filter: "all" }));
    await user.click(screen.getByRole("button", { name: /Por ler/ }));
    expect(customerConvsMock).toHaveBeenLastCalledWith(expect.objectContaining({ filter: "unread" }));
    await user.click(screen.getByRole("button", { name: "Todas" }));
    expect(customerConvsMock).toHaveBeenLastCalledWith(expect.objectContaining({ filter: "all" }));
  });

  it("a pesquisa (nome/email) vai à API com atraso", async () => {
    const user = userEvent.setup();
    renderAt(<ClientesChatTab />);
    await user.type(screen.getByPlaceholderText("Procurar cliente…"), "rita");
    await waitFor(() => expect(customerConvsMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: "rita" })));
  });

  it("vazio: mensagens diferentes para 'Por ler' e para pesquisa sem resultados", async () => {
    const user = userEvent.setup();
    renderAt(<ClientesChatTab />);
    expect(screen.getByTestId("clientes-empty")).toHaveTextContent("Ainda não há conversas com clientes.");
    await user.click(screen.getByRole("button", { name: /Por ler/ }));
    expect(screen.getByTestId("clientes-empty")).toHaveTextContent("Não tens conversas por ler.");
  });

  it("deep-link `?conversa=<id>` abre essa conversa (sino e ficha do cliente)", () => {
    renderAt(<ClientesChatTab />, "/mensagens?conversa=cv9");
    expect(screen.getByTestId("conv-view")).toHaveTextContent("cv9");
  });
});

describe("BackofficeChatTab — Suporte fixo em primeiro", () => {
  it("o Suporte vem primeiro e depois a equipa por ordem da última mensagem", () => {
    teamPeopleMock.mockReturnValue({
      data: {
        people: [
          { key: "m1", kind: "member", name: "Ana", removed: false, unread: 0, lastMessageAt: "2026-10-10T10:00:00.000Z", lastMessage: { preview: "ok" } },
          { key: "owner", kind: "owner", name: "Dono", removed: false, unread: 1, lastMessageAt: "2026-10-18T10:00:00.000Z", lastMessage: { preview: "olá" } },
        ],
        support: { unread: 0, lastMessageAt: "2026-09-01T10:00:00.000Z", lastMessage: { preview: "antigo" } },
        unreadTotal: 1,
      },
      isLoading: false,
    });
    renderAt(<BackofficeChatTab />, "/mensagens/backoffice");
    const rows = [...screen.getAllByTestId("support-conversation"), ...screen.getAllByTestId("team-conversation")];
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Suporte"),
      expect.stringContaining("Dono"),
      expect.stringContaining("Ana"),
    ]);
    // Ordem no DOM: o Suporte é o 1.º botão da lista.
    const all = screen.getAllByRole("button");
    expect(all[0]).toHaveTextContent("Suporte");
  });

  it("sem `mensagens.suporte` o Suporte não aparece", () => {
    authMock.mockReturnValue(memberAuth({ "mensagens.equipa": "view" }));
    teamPeopleMock.mockReturnValue({
      data: { people: [{ key: "m1", kind: "member", name: "Ana", removed: false, unread: 0 }], support: null, unreadTotal: 0 },
      isLoading: false,
    });
    renderAt(<BackofficeChatTab />, "/mensagens/backoffice");
    expect(screen.queryByTestId("support-conversation")).toBeNull();
    expect(screen.getByTestId("team-conversation")).toHaveTextContent("Ana");
  });

  it("só com `mensagens.suporte` não pede as pessoas (a API recusaria) e mostra só o Suporte", () => {
    authMock.mockReturnValue(memberAuth({ "mensagens.suporte": "edit" }));
    summaryMock.mockReturnValue({ data: { customers: null, team: null, support: 2, total: 2 } });
    renderAt(<BackofficeChatTab />, "/mensagens/backoffice");
    expect(teamPeopleMock).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("support-conversation")).toBeInTheDocument();
    expect(screen.queryByTestId("team-conversation")).toBeNull();
  });

  it("abrir uma pessoa usa o scope `team` com a chave (owner/memberId); o Suporte usa `support`", async () => {
    teamPeopleMock.mockReturnValue({
      data: {
        people: [{ key: "m1", kind: "member", name: "Ana", removed: false, unread: 0 }],
        support: { unread: 0 },
        unreadTotal: 0,
      },
      isLoading: false,
    });
    const user = userEvent.setup();
    renderAt(<BackofficeChatTab />, "/mensagens/backoffice");
    await user.click(screen.getByTestId("team-conversation"));
    expect(screen.getByTestId("conv-view")).toHaveTextContent('"kind":"team"');
    expect(screen.getByTestId("conv-view")).toHaveTextContent('"personKey":"m1"');
  });
});

describe("ChatConversationView — só-ver não escreve", () => {
  const thread = { conversationId: "cv1", messages: [], hasMore: false, unread: 0, otherLastReadAt: null, title: "Rita" };

  beforeEach(() => {
    realView.on = true;
    customerThreadMock.mockReturnValue({ data: thread, isLoading: false });
  });

  it("clientes com `mensagens.clientes` só Ver: caixa desactivada com o motivo, nada se envia", async () => {
    authMock.mockReturnValue(memberAuth({ "mensagens.clientes": "view" }));
    renderAt(<ChatConversationView scope={{ kind: "customer", conversationId: "cv1" }} />);
    expect(screen.getByRole("textbox", { name: "Mensagem" })).toBeDisabled();
    expect(screen.getByLabelText("Enviar")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(VIEW_ONLY_MESSAGE);
    expect(replyMutate).not.toHaveBeenCalled();
  });

  it("clientes com Responder (edit): envia pela API do negócio", async () => {
    authMock.mockReturnValue(memberAuth({ "mensagens.clientes": "edit" }));
    replyMutate.mockResolvedValue({ messageId: "n1", conversationId: "cv1", senderRole: "business", senderUserId: "", body: "Já tratei", attachments: null, createdAt: new Date().toISOString() });
    const user = userEvent.setup();
    renderAt(<ChatConversationView scope={{ kind: "customer", conversationId: "cv1" }} />);
    await user.type(screen.getByRole("textbox", { name: "Mensagem" }), "Já tratei");
    await user.click(screen.getByLabelText("Enviar"));
    await waitFor(() => expect(replyMutate).toHaveBeenCalledWith({ body: "Já tratei", attachments: null }));
  });

  it("equipa com `mensagens.equipa` só Ver: não escreve", () => {
    authMock.mockReturnValue(memberAuth({ "mensagens.equipa": "view" }));
    teamThreadMock.mockReturnValue({ data: { ...thread, conversationId: "t1" }, isLoading: false });
    renderAt(<ChatConversationView scope={{ kind: "team", personKey: "owner" }} />);
    expect(screen.getByRole("textbox", { name: "Mensagem" })).toBeDisabled();
    expect(sendTeamMutate).not.toHaveBeenCalled();
  });

  it("membro removido: conversa só de leitura mesmo para o dono, com a nota própria", () => {
    authMock.mockReturnValue(ownerAuth());
    teamThreadMock.mockReturnValue({ data: { ...thread, readOnly: true, title: "Ana (removida)" }, isLoading: false });
    renderAt(<ChatConversationView scope={{ kind: "team", personKey: "m1" }} />);
    expect(screen.getByRole("textbox", { name: "Mensagem" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("já não está na equipa");
  });

  it("clientes e equipa aceitam anexar PDF (o Suporte só fotos)", () => {
    authMock.mockReturnValue(ownerAuth());
    const { unmount } = renderAt(<ChatConversationView scope={{ kind: "customer", conversationId: "cv1" }} />);
    expect(screen.getByLabelText("Anexar foto ou PDF")).toBeInTheDocument();
    unmount();
    renderAt(<ChatConversationView scope={{ kind: "support" }} />);
    expect(screen.getByLabelText("Anexar imagem")).toBeInTheDocument();
  });
});
