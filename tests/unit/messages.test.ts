import { describe, it, expect } from "vitest";
import {
  backofficeUnread,
  customerPreview,
  orderBackofficeEntries,
  SUPPORT_KEY,
} from "../../src/lib/messages";
import { customerThreadToChat, teamThreadToChat } from "../../src/hooks/useMessages";
import { leafForPath, moduleForPath } from "../../src/lib/navigation";

const person = (over: Record<string, unknown>) =>
  ({
    key: "m1",
    kind: "member",
    name: "Ana",
    removed: false,
    conversationId: null,
    unread: 0,
    lastMessageAt: null,
    lastMessage: null,
    ...over,
  }) as any;

describe("orderBackofficeEntries — separador Backoffice (B43)", () => {
  const support = { unread: 2, lastMessageAt: "2026-10-01T10:00:00.000Z", lastMessage: { preview: "Olá do suporte" } };

  it("o Suporte vai SEMPRE em primeiro, mesmo com uma conversa de equipa mais recente", () => {
    const out = orderBackofficeEntries(
      [person({ key: "m1", name: "Ana", lastMessageAt: "2026-10-18T09:00:00.000Z" })],
      support as any,
    );
    expect(out.map((e) => e.key)).toEqual([SUPPORT_KEY, "m1"]);
    expect(out[0]).toMatchObject({ kind: "support", name: "Suporte", unread: 2, preview: "Olá do suporte" });
  });

  it("as pessoas ficam por ordem da última mensagem (mais recente primeiro); sem conversa no fim, por nome", () => {
    const out = orderBackofficeEntries(
      [
        person({ key: "zé", name: "Zé" }),
        person({ key: "a", name: "Ana", lastMessageAt: "2026-10-10T10:00:00.000Z" }),
        person({ key: "owner", kind: "owner", name: "Dono", lastMessageAt: "2026-10-18T10:00:00.000Z" }),
        person({ key: "b", name: "Bia" }),
      ],
      support as any,
    );
    expect(out.map((e) => e.key)).toEqual([SUPPORT_KEY, "owner", "a", "b", "zé"]);
    expect(out[1].kind).toBe("owner");
  });

  it("sem a folha do Suporte (support null) a lista só tem a equipa", () => {
    const out = orderBackofficeEntries([person({ key: "m1" })], null);
    expect(out.map((e) => e.key)).toEqual(["m1"]);
  });

  it("só com `mensagens.suporte` (sem `people`) mostra só o Suporte, com o contador vindo do resumo", () => {
    const out = orderBackofficeEntries([], { unread: 4 }, { supportVisible: true });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: SUPPORT_KEY, unread: 4 });
  });

  it("membro removido mantém o nome guardado e a marca `removed`", () => {
    const out = orderBackofficeEntries([person({ key: "m9", name: "Rui (removida)", removed: true })], null);
    expect(out[0]).toMatchObject({ name: "Rui (removida)", removed: true });
  });
});

describe("contadores e pré-visualização", () => {
  it("Backoffice = equipa + suporte (cada um pode ser null sem a folha)", () => {
    expect(backofficeUnread({ team: 2, support: 3 })).toBe(5);
    expect(backofficeUnread({ team: null, support: 3 })).toBe(3);
    expect(backofficeUnread({ team: null, support: null })).toBe(0);
    expect(backofficeUnread(undefined)).toBe(0);
  });

  it("a conversa de cliente mostra 'Tu: ' quando a última foi do negócio", () => {
    const base = { conversationId: "c", customerId: "u", customerName: "Rita", unread: 0 };
    expect(customerPreview({ ...base, lastMessage: { senderRole: "business", preview: "Feito" } } as any)).toBe("Tu: Feito");
    expect(customerPreview({ ...base, lastMessage: { senderRole: "customer", preview: "Olá" } } as any)).toBe("Olá");
    expect(customerPreview({ ...base, lastMessage: null } as any)).toBe("—");
  });
});

describe("normalização dos fios para o ChatConversationView", () => {
  it("cliente: o negócio é `business` (as minhas); o nome do membro só vai nas mensagens do negócio", () => {
    const t = customerThreadToChat({
      conversationId: "cv1",
      customerId: "cu1",
      customerName: "Rita",
      customerEmail: "rita@x.pt",
      hasMore: false,
      unread: 1,
      otherLastReadAt: null,
      messages: [
        { messageId: "m1", conversationId: "cv1", senderRole: "customer", senderName: "Rita", body: "Olá", createdAt: "2026-10-18T10:00:00.000Z" },
        { messageId: "m2", conversationId: "cv1", senderRole: "business", senderName: "Ana", body: "Bom dia", createdAt: "2026-10-18T10:01:00.000Z" },
      ],
    } as any);
    expect(t.title).toBe("Rita");
    expect(t.subtitle).toBe("rita@x.pt");
    expect(t.messages.map((m) => [m.senderRole, m.senderName])).toEqual([
      ["customer", null],
      ["business", "Ana"],
    ]);
  });

  it("equipa: `mine` → `me`/`other`, conversa ainda por abrir → id vazio, removido → só leitura", () => {
    const t = teamThreadToChat({
      conversationId: null,
      person: { key: "m1", name: "Ana (removida)", removed: true },
      readOnly: true,
      hasMore: false,
      unread: 0,
      messages: [
        { messageId: "a", conversationId: "x", senderKey: "owner", senderName: "Dono", mine: true, body: "1", createdAt: "2026-10-18T10:00:00.000Z" },
        { messageId: "b", conversationId: "x", senderKey: "m1", senderName: "Ana", mine: false, body: "2", createdAt: "2026-10-18T10:01:00.000Z" },
      ],
    } as any);
    expect(t.conversationId).toBe("");
    expect(t.readOnly).toBe(true);
    expect(t.title).toBe("Ana (removida)");
    expect(t.messages.map((m) => m.senderRole)).toEqual(["me", "other"]);
  });
});

describe("navigation — Mensagens por folha (B43)", () => {
  it.each([
    ["/mensagens", "mensagens.clientes"],
    ["/mensagens/backoffice", "mensagens.equipa"],
  ])("%s → %s", (path, leaf) => {
    expect(leafForPath(path)).toBe(leaf);
    expect(moduleForPath(path)).toBe("mensagens");
  });
});
