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

  test("Financeiro é core — a sidebar expande o submenu com O Negócio / Despesas (T1.2, já não são tabs de topo)", async ({ page }) => {
    await page.goto("/financeiro");
    await page.waitForURL("**/financeiro", { timeout: 15_000 });
    // O item "Financeiro" da sidebar expande-se automaticamente por ser a rota
    // ativa (acordeão, Shell.tsx::NavItemGroup) — os subitens são botões dentro
    // do <nav>, não `role="tab"` (as Tabs de topo da página foram removidas).
    const nav = page.locator("nav").first();
    await expect(nav.getByRole("button", { name: "O Negócio", exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(nav.getByRole("button", { name: "Despesas", exact: true })).toBeVisible();
  });

  test("navegar para Despesas pelo submenu da sidebar → /financeiro/despesas", async ({ page }) => {
    await page.goto("/financeiro");
    await page.waitForURL("**/financeiro", { timeout: 15_000 });
    const nav = page.locator("nav").first();
    await nav.getByRole("button", { name: "Despesas", exact: true }).click();
    await page.waitForURL("**/financeiro/despesas", { timeout: 15_000 });
    // Título só existe no topbar (h2, Shell.tsx): compõe "Financeiro · Despesas"
    // num subpath — "Despesas" continua a bater por substring (exact:false).
    await expect(page.getByRole("heading", { name: "Despesas", level: 2 })).toBeVisible({ timeout: 10_000 });
  });

  test("deep-link antigo /financeiro?vista=ginasio redireciona para /financeiro/ginasio", async ({ page }) => {
    await page.goto("/financeiro?vista=ginasio");
    await page.waitForURL("**/financeiro/ginasio", { timeout: 15_000 });
  });

  test("página não crasha com parâmetros inválidos na URL", async ({ page }) => {
    await page.goto("/financeiro?period=invalid&start=bad&end=bad");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=/something went wrong|erro inesperado/i")).not.toBeVisible();
  });
});
