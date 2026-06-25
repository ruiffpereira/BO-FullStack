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
