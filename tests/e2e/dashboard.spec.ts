import { test, expect } from "./fixtures/auth";
import { DashboardPage } from "./pages/DashboardPage";

test.describe("Dashboard", () => {
  test("página carrega sem erros", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForLoad();

    // No error boundary or crash indicators
    await expect(page.locator("text=/something went wrong|erro inesperado/i")).not.toBeVisible();
    await expect(page.locator("h2, h1").first()).toBeVisible();
  });

  test("sidebar com link Dashboard sempre visível", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForLoad();

    // Dashboard is accessible to all authenticated users
    await expect(dashboard.navItem("Dashboard")).toBeVisible();
  });

  test("topbar mostra título da página", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForLoad();

    await expect(page.locator("header").locator("text=Dashboard")).toBeVisible();
  });

  test("tema alterna entre claro e escuro", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForLoad();

    const html = page.locator("html");
    const initialClass = await html.getAttribute("class");

    // Click theme toggle (moon/sun icon button in topbar)
    await page.locator('header button[aria-label="Tema"], header button[title="Tema"]').click();

    const newClass = await html.getAttribute("class");
    expect(newClass).not.toEqual(initialClass);
  });
});
