import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { AdminPage } from "./pages/AdminPage";
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

    test("admin: construtor de páginas", async ({ page, context }) => {
      await loginAs(context, "admin@e2e");
      await withSessionRetry(page, context, "admin@e2e", () => page.goto("/admin"), async () => {
        await expect(page.getByRole("button", { name: "Eliminar" }).first()).toBeVisible({ timeout: 15_000 });
      });
      const row = await new AdminPage(page).userRowFromStart("pagesgate@e2e");
      await row.getByRole("button", { name: "Construtor de páginas" }).click();
      const dialog = page.getByRole("dialog", { name: "Construtor de páginas" });
      await expect(dialog.getByRole("region", { name: "Publicação" })).toBeVisible({ timeout: 10_000 });
      await shot(page, "5-admin");
    });
  });
}
