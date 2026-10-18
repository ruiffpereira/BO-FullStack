import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SharePreview, effectiveShareImage, shareSizeWarning } from "../../../src/pages/paginas/components/SharePreview";

describe("SharePreview — puros", () => {
  it("shareSizeWarning: 1200×630 e parecidos passam; pequena ou fora do formato avisa; sem medida nada", () => {
    expect(shareSizeWarning({ w: 1200, h: 630 })).toBeNull();
    expect(shareSizeWarning({ w: 1600, h: 840 })).toBeNull();
    expect(shareSizeWarning({ w: 500, h: 262 })).toMatch(/pequena demais/);
    expect(shareSizeWarning({ w: 1200, h: 1200 })).toMatch(/cortada/);
    expect(shareSizeWarning(null)).toBeNull();
    expect(shareSizeWarning({ w: 0, h: 0 })).toBeNull();
  });

  it("effectiveShareImage: a da página ganha; sem ela a do site; nenhuma → null", () => {
    expect(effectiveShareImage("p.webp", "s.webp")).toEqual({ url: "p.webp", fromSite: false });
    expect(effectiveShareImage(null, "s.webp")).toEqual({ url: "s.webp", fromSite: true });
    expect(effectiveShareImage("", null)).toBeNull();
  });
});

describe("SharePreview — cartões", () => {
  it("Facebook por omissão, troca para X; sem imagem diz que sai pequeno; imagem do site avisa", () => {
    const { rerender } = render(<SharePreview image={null} title="Obras · Winterplateau" description="Fachadas" siteName="Winterplateau" />);
    expect(screen.getByTestId("share-card-facebook")).toHaveTextContent("Obras · Winterplateau");
    expect(screen.getByTestId("share-preview")).toHaveTextContent("o cartão sai pequeno");
    fireEvent.click(screen.getByRole("button", { name: "X" }));
    expect(screen.getByTestId("share-card-x")).toHaveTextContent("De Winterplateau");
    rerender(<SharePreview image="https://cdn/s.webp" fromSite alt="Fachada" title="T" description="" siteName="W" />);
    expect(screen.getByRole("img", { name: "Fachada" })).toHaveAttribute("src", "https://cdn/s.webp");
    expect(screen.getByTestId("share-preview")).toHaveTextContent("usa a imagem de partilha do site");
  });
});
