import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageThread } from "../../src/components/chat/MessageThread";
import type { ChatAttachment, ChatMessage } from "../../src/hooks/useChat";

let counter = 0;
function msg(over: Partial<ChatMessage>): ChatMessage {
  counter += 1;
  return {
    messageId: `m${counter}`,
    conversationId: "c1",
    senderRole: "tenant",
    senderUserId: "u1",
    body: "Olá",
    attachments: null,
    createdAt: "2026-06-30T10:00:00.000Z",
    ...over,
  };
}

function renderThread(props: Partial<Parameters<typeof MessageThread>[0]> = {}) {
  return render(
    <MessageThread
      messages={[]}
      meRole="tenant"
      otherLastReadAt={null}
      hasMore={false}
      loadingOlder={false}
      onLoadOlder={() => {}}
      isLoading={false}
      {...props}
    />,
  );
}

describe("MessageThread", () => {
  it("mostra estado vazio quando não há mensagens", () => {
    renderThread({ messages: [] });
    expect(screen.getByText("Sem mensagens ainda.")).toBeInTheDocument();
  });

  it("renderiza bolhas enviadas e recebidas", () => {
    renderThread({
      messages: [
        msg({ senderRole: "tenant", body: "Pergunta do tenant" }),
        msg({ senderRole: "admin", body: "Resposta do suporte" }),
      ],
    });
    expect(screen.getByText("Pergunta do tenant")).toBeInTheDocument();
    expect(screen.getByText("Resposta do suporte")).toBeInTheDocument();
  });

  it("mostra 'Visto' quando o outro lado leu a última mensagem minha", () => {
    renderThread({
      messages: [msg({ senderRole: "tenant", body: "Lida?", createdAt: "2026-06-30T10:00:00.000Z" })],
      otherLastReadAt: "2026-06-30T10:05:00.000Z",
    });
    expect(screen.getByText("Visto")).toBeInTheDocument();
  });

  it("mostra 'Entregue' quando ainda não foi lida", () => {
    renderThread({
      messages: [msg({ senderRole: "tenant", body: "Por ler" })],
      otherLastReadAt: null,
    });
    expect(screen.getByText("Entregue")).toBeInTheDocument();
  });

  it("mostra estado de envio otimista (pending → 'A enviar…')", () => {
    renderThread({
      messages: [msg({ senderRole: "tenant", body: "A caminho", pending: true })],
    });
    expect(screen.getByText("A enviar…")).toBeInTheDocument();
  });

  it("mostra 'Não enviada' quando falha", () => {
    renderThread({
      messages: [msg({ senderRole: "tenant", body: "Falhou", failed: true })],
    });
    expect(screen.getByText("Não enviada")).toBeInTheDocument();
  });

  // `isSafeHttpUrl` (MessageThread.tsx) — anti-XSS: só http(s) é clicável. Um
  // anexo com URL javascript:/data: renderiza como texto simples (ícone +
  // nome), nunca como <a href>, senão um clique executava o URL malicioso.
  it("anexo com URL javascript: não renderiza link clicável", () => {
    const attachments: ChatAttachment[] = [{ url: "javascript:alert(1)", name: "Malicioso.txt" }];
    renderThread({
      messages: [msg({ senderRole: "tenant", body: null, attachments })],
    });
    expect(screen.getByText("Malicioso.txt")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("anexo com URL data: não renderiza link clicável", () => {
    const attachments: ChatAttachment[] = [
      { url: "data:text/html,<script>alert(1)</script>", name: "Falso.pdf" },
    ];
    renderThread({
      messages: [msg({ senderRole: "tenant", body: null, attachments })],
    });
    expect(screen.getByText("Falso.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("anexo com URL https: renderiza link clicável normal", () => {
    const attachments: ChatAttachment[] = [{ url: "https://example.com/ficheiro.pdf", name: "Ficheiro.pdf" }];
    renderThread({
      messages: [msg({ senderRole: "tenant", body: null, attachments })],
    });
    const link = screen.getByRole("link", { name: /Ficheiro\.pdf/ });
    expect(link).toHaveAttribute("href", "https://example.com/ficheiro.pdf");
  });
});
