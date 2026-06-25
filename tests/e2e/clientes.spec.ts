import { test, expect } from "./fixtures/auth";
import { ClientesPage } from "./pages/ClientesPage";

test.describe("Clientes — Lista & pesquisa", () => {
  test("a página carrega com o cabeçalho e a pesquisa", async ({ page }) => {
    const p = new ClientesPage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
    await expect(p.searchInput()).toBeVisible();
  });

  test("pesquisa sem correspondência mostra estado vazio", async ({ page }) => {
    const p = new ClientesPage(page);
    await p.goto();
    await p.searchInput().fill(`zzz-sem-resultados-${Date.now()}`);
    await page.waitForTimeout(600);
    await expect(page.getByText(/sem clientes/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Clientes — CRUD", () => {
  test("criar cliente → aparece na lista", async ({ page }) => {
    const p = new ClientesPage(page);
    await p.goto();

    const name = `Cliente E2E ${Date.now()}`;
    await p.createClient(name);
    await p.expectClientVisible(name);
  });

  test("submeter sem nome → modal continua aberto", async ({ page }) => {
    const p = new ClientesPage(page);
    await p.goto();
    await p.openNewModal();
    await page.locator('[role="dialog"] button[type="submit"]').first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3_000 });
  });
});
