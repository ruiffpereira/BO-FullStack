import { describe, it, expect } from "vitest";
import { REVEAL_ON_HOVER, REVEAL_DIM_ON_HOVER } from "../../src/ui/reveal";

// Acções só com hover são invisíveis em toque e teclado (834/390). `REVEAL_ON_HOVER` mostra-as com foco e sem hover.
const files = import.meta.glob("../../src/**/*.{tsx,jsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("REVEAL_ON_HOVER", () => {
  it("inclui foco e dispositivos sem hover", () => {
    for (const c of [REVEAL_ON_HOVER, REVEAL_DIM_ON_HOVER]) {
      expect(c).toContain("group-focus-within:");
      expect(c).toContain("[@media(hover:none)]:");
    }
  });

  it("nenhum componente esconde acções com `opacity-0 group-hover:opacity-100` à mão (usar REVEAL_ON_HOVER)", () => {
    const bad = Object.entries(files)
      .filter(([f]) => !f.includes("/gen/"))
      // Tooltip/overlay decorativo (Conteudos: «Trocar imagem» sobre a foto) não é acção; tem o clique no cartão.
      .filter(([, src]) => !src.includes("[@media(hover:hover)")) // só esconde em dispositivos COM hover (MailThreadList)
      .filter(([, src]) => /opacity-0[^"'`\n]*group-hover:opacity-100/.test(src.replace(/uploadingIdx === i \? "opacity-100" : "opacity-0 group-hover:opacity-100"/g, "")))
      .map(([f]) => f);
    expect(bad).toEqual([]);
  });
});
