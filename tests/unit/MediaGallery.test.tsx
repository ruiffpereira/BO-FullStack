import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mocks dos hooks gerados (Kubb) que fazem o upload real — não usados neste
// ficheiro (upload diferido), mas MediaGallery importa-os no topo.
vi.mock("../../src/gen/backoffice/hooks/useUploadImage.js", () => ({ uploadImage: vi.fn() }));
vi.mock("../../src/gen/backoffice/hooks/useUploadVideo.js", () => ({ uploadVideo: vi.fn() }));

import { MediaGallery, type MediaItem } from "../../src/components/MediaGallery";

// jsdom não implementa play()/pause() em <video> — stub mínimo para o clique
// no botão de reproduzir não rebentar o teste.
beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});

const image: MediaItem = { type: "image", url: "https://x/img.webp", key: "k1" };
const video: MediaItem = { type: "video", url: "https://x/vid.mp4", key: "k2" };

describe("MediaGallery", () => {
  it("mostra o estado vazio sem media", () => {
    render(<MediaGallery value={[]} onChange={() => {}} />);
    expect(screen.getByText(/Sem media/)).toBeInTheDocument();
  });

  it("adiciona uma imagem escolhida como pendente (upload diferido)", async () => {
    // O <input type="file"> é criado em memória (não montado no DOM) e
    // clicado via input.click() — apanha-se na criação para simular a escolha.
    const user = userEvent.setup();
    const createElementSpy = vi.spyOn(document, "createElement");
    const onChange = vi.fn();
    render(<MediaGallery value={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Imagem" }));
    const input = createElementSpy.mock.results
      .map((r) => r.value)
      .find((el): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === "file")!;
    const file = new File(["x"], "photo.png", { type: "image/png" });
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: "image", file, pending: true }),
    ]);
    createElementSpy.mockRestore();
  });

  it("remove um item da lista", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MediaGallery value={[image]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("o preview de vídeo é reproduzível: começa sem controlos e o clique no play liga controls e chama play()", async () => {
    const user = userEvent.setup();
    render(<MediaGallery value={[video]} onChange={() => {}} />);
    const videoEl = document.querySelector("video") as HTMLVideoElement;
    expect(videoEl).not.toHaveAttribute("controls");

    await user.click(screen.getByRole("button", { name: "Reproduzir vídeo" }));

    expect(videoEl.play).toHaveBeenCalled();
    expect(videoEl).toHaveAttribute("controls");
    // O botão de overlay desaparece depois de reproduzir (controlos nativos assumem).
    expect(screen.queryByRole("button", { name: "Reproduzir vídeo" })).not.toBeInTheDocument();
  });
});
