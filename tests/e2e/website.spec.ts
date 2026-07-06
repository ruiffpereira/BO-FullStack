import { test, expect } from "./fixtures/auth";
import { WebsitePage } from "./pages/WebsitePage";

test.describe("Website — Navegação (submenu, T2.3)", () => {
  test("a página carrega com o cabeçalho e o submenu da sidebar", async ({ page }) => {
    const p = new WebsitePage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
    for (const label of ["O meu site", "Template", "Páginas", "Marca", "Rodapé & Nav", "Domínio"]) {
      await expect(p.tab(label)).toBeVisible();
    }
  });

  test("navegar para Template e Domínio muda a URL e mostra o conteúdo de cada vista", async ({ page }) => {
    const p = new WebsitePage(page);
    await p.goto();

    await p.goToTab("Template");
    await expect(page).toHaveURL(/\/website\/template/);
    await expect(page.getByText(/Escolhe um ponto de partida/i)).toBeVisible({ timeout: 8_000 });

    await p.goToTab("Domínio");
    await expect(page).toHaveURL(/\/website\/dominio/);
    await expect(page.getByPlaceholder("a-tua-marca")).toBeVisible({ timeout: 8_000 });
  });
});
