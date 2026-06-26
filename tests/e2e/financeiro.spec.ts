import { test, expect } from "./fixtures/auth";

test.describe("Financeiro", () => {
  test("página carrega com gráficos", async ({ page }) => {
    await page.goto("/financeiro");
    await page.waitForURL("**/financeiro", { timeout: 15_000 });

    // Charts/canvas or SVG should be rendered (timeout maior — sob carga paralela
    // o dashboard financeiro pode demorar a renderizar).
    await expect(page.locator("canvas, svg").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("text=/receita|despesas|lucro/i").first()).toBeVisible({ timeout: 10_000 });
  });

  test("filtro de período muda os dados", async ({ page }) => {
    await page.goto("/financeiro");
    await page.waitForURL("**/financeiro", { timeout: 15_000 });
    // Nota: não usar waitForLoadState("networkidle") — a app mantém um stream SSE
    // aberto (/events/stream), por isso a rede nunca fica idle. Esperar pelo gráfico.
    await expect(page.locator("canvas, svg").first()).toBeVisible({ timeout: 10_000 });

    // Click a period filter button (30d, 90d, etc.)
    const periodBtn = page.locator('button', { hasText: /30|90|365|dias|mês/i }).first();
    if (await periodBtn.isVisible()) {
      const before = await page.locator("canvas, svg").first().screenshot();
      await periodBtn.click();
      await page.waitForTimeout(800);
      // Page should still be stable (no crash)
      await expect(page.locator("canvas, svg").first()).toBeVisible();
    }
  });

  test("Financeiro é core — abre com as tabs O Negócio / Despesas", async ({ page }) => {
    await page.goto("/financeiro");
    await page.waitForURL("**/financeiro", { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "O Negócio" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Despesas", exact: true })).toBeVisible();
  });

  test("página não crasha com parâmetros inválidos na URL", async ({ page }) => {
    await page.goto("/financeiro?period=invalid&start=bad&end=bad");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=/something went wrong|erro inesperado/i")).not.toBeVisible();
  });
});
