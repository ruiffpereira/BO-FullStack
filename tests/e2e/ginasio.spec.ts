import { test, expect } from "./fixtures/auth";
import { GinasioPage } from "./pages/GinasioPage";

test.describe("Ginásio — Smoke", () => {
  test("a página carrega com o cabeçalho", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
  });

  test("abrir 'Novo exercício' mostra o modal", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.goto();
    await p.openNewExercise();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test("a pesquisa de exercícios está disponível", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.goto();
    await expect(p.searchInput()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Ginásio — Mensalidades", () => {
  test("a tab Mensalidades mostra os KPIs do financeiro", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.goto();
    await p.openMensalidades();
    await expect(p.kpiRecebido()).toBeVisible({ timeout: 8_000 });
  });

  test("criar uma subscrição no catálogo", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.goto();
    await p.openMensalidades();
    await p.openSubscricoesSubtab();
    const nome = `E2E ${Date.now()}`;
    await p.createSubscription(nome, "25");
    await expect(page.getByRole("heading", { name: nome })).toBeVisible({ timeout: 8_000 });
  });
});
