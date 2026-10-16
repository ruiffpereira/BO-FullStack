import { test, expect } from "@playwright/test";
import { PaginasPage, VIEWPORTS, shot, uniq } from "./pages/PaginasPage";

/**
 * Capturas para revisão a olho (lista, conteúdo, editor, definições, admin) nas três larguras, gravadas em
 * `Backoffice/.capturas-f16/<nome>-<largura>.png` (gitignored). Os toasts ficam anulados para não taparem nada.
 */

test.use({ storageState: { cookies: [], origins: [] } });

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · capturas — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("lista, conteúdo, editor e definições", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      await p.createPage(`Cap-${u}`, `cap-${u}`);
      await p.addStarter("Título e texto");
      await p.openItem("Título e texto");
      await p.renameBlock(`Bloco-${u}`);
      await p.compHead(0).click();
      await page.getByRole("textbox", { name: "Texto (PT)" }).fill(`Titulo ${u}`);
      await page.getByRole("textbox", { name: "Texto (EN)" }).fill(`Title ${u}`);
      await expect(p.saveBtn).toBeEnabled();
      await shot(page, "3-editor");
      await p.backToPage();
      await shot(page, "2-conteudo");
      await p.openTab("Definições e SEO");
      await shot(page, "4-definicoes");
      await p.showList();
      await shot(page, "1-lista");
    });

    test("definições do site (cliente)", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      await p.openSettings();
      await shot(page, "5-definicoes-site");
    });
  });
}
