import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// uploadImage (Kubb) — mockado; os testes de texto não tocam nele.
const uploadImageMock = vi.fn(() => Promise.resolve({ fileUrl: "https://cdn/x.webp", key: "k", srcSet: "" }));
vi.mock("../../src/gen/backoffice/hooks/useUploadImage.js", () => ({
  uploadImage: (...args: unknown[]) => uploadImageMock(...args),
}));

import { Composer } from "../../src/components/chat/Composer";

beforeEach(() => vi.clearAllMocks());

describe("Composer", () => {
  it("envia o texto ao clicar em Enviar e limpa a caixa", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn(() => Promise.resolve());
    render(<Composer onSend={onSend} />);

    const ta = screen.getByRole("textbox");
    await user.type(ta, "Olá suporte");
    await user.click(screen.getByLabelText("Enviar"));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith({ body: "Olá suporte", attachments: null });
    await waitFor(() => expect((ta as HTMLTextAreaElement).value).toBe(""));
  });

  it("envia com Enter (sem Shift)", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn(() => Promise.resolve());
    render(<Composer onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "Mensagem{Enter}");
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith({ body: "Mensagem", attachments: null });
  });

  it("não envia mensagem vazia (botão desativado)", async () => {
    const onSend = vi.fn(() => Promise.resolve());
    render(<Composer onSend={onSend} />);
    const sendBtn = screen.getByLabelText("Enviar") as HTMLButtonElement;
    expect(sendBtn).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });
});
