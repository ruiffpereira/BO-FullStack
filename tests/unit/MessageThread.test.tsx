import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageThread } from "../../src/components/chat/MessageThread";
import type { ChatMessage } from "../../src/hooks/useChat";

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
});
