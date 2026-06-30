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

test.describe("Clientes — contribuinte na fatura (wantsInvoice)", () => {
  test("criar com toggle ligado + NIF → persiste (ficha mostra NIF; editar mostra toggle ligado)", async ({ page }) => {
    const p = new ClientesPage(page);
    await p.goto();

    const name = `Cliente Fatura ${Date.now()}`;
    const nif = "501234567";
    await p.createClientWithInvoice(name, nif);

    // Reabre o cliente: a ficha mostra o NIF preenchido.
    await p.searchInput().fill(name);
    await page.waitForTimeout(500);
    await p.openClient(name);
    await expect(page.getByText(`NIF ${nif}`)).toBeVisible({ timeout: 8_000 });

    // No modal de edição, o toggle de contribuinte está LIGADO e o NIF persistiu.
    await p.openEditFromProfile();
    await expect(p.invoiceToggle()).toHaveAttribute("aria-checked", "true");
    // No modal de edição o campo NIF é identificado pelo label "NIF".
    await expect(page.getByLabel("NIF", { exact: true })).toHaveValue(nif);
  });
});
