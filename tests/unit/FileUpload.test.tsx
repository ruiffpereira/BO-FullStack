import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock do hook gerado (Kubb) que faz o upload real para a API.
const { uploadImage } = vi.hoisted(() => ({ uploadImage: vi.fn() }));
vi.mock("../../src/gen/backoffice/hooks/useUploadImage.js", () => ({ uploadImage }));

import { FileUpload } from "../../src/components/FileUpload";

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => uploadImage.mockReset());

describe("FileUpload", () => {
  it("mostra a zona de upload com o label quando vazio", () => {
    render(<FileUpload module="cms" onUploaded={() => {}} label="Carregar imagem" />);
    expect(screen.getByText("Carregar imagem")).toBeInTheDocument();
    expect(screen.getByText("Ou arrasta aqui")).toBeInTheDocument();
  });

  it("mostra a pré-visualização quando há currentUrl", () => {
    render(<FileUpload module="cms" currentUrl="https://x/img.webp" onUploaded={() => {}} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://x/img.webp");
  });

  it("rejeita ficheiros que não são imagem", async () => {
    render(<FileUpload module="cms" accept="any" onUploaded={() => {}} />);
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput(), { target: { files: [pdf] } });
    expect(await screen.findByText(/apenas imagens/i)).toBeInTheDocument();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("faz upload de uma imagem e chama onUploaded", async () => {
    uploadImage.mockResolvedValue({ fileUrl: "https://x/up.webp", key: "k1" });
    const onUploaded = vi.fn();
    render(<FileUpload module="cms" onUploaded={onUploaded} />);
    const img = new File(["x"], "photo.png", { type: "image/png" });
    fireEvent.change(fileInput(), { target: { files: [img] } });
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith("https://x/up.webp", "k1"));
    expect(uploadImage).toHaveBeenCalledWith({ image: img, module: "cms" });
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://x/up.webp");
  });

  it("remove a pré-visualização e chama onDeleted", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    render(
      <FileUpload
        module="cms"
        currentUrl="https://x/img.webp"
        onUploaded={() => {}}
        onDeleted={onDeleted}
      />,
    );
    // Único botão presente na pré-visualização é o de remover (X).
    await user.click(screen.getByRole("button"));
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
