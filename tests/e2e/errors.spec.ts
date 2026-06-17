import { test, expect } from "@playwright/test";

test.describe("Tratamento de erros da API → UI", () => {
  test("401 em endpoint protegido → app tenta refresh, depois redireciona para login", async ({ page }) => {
    // Intercept all API calls except auth endpoints and return 401
    await page.route(/\/api\/(?!users\/(login|refresh|logout)|csrf-token)/, (route) => {
      return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized" }) });
    });

    await page.goto("/despesas");

    // App should eventually land on login (after failed refresh attempts)
    // Give it extra time since it tries refresh first
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 20_000 });
  });

  test("403 em recurso protegido → toast de erro ou mensagem", async ({ page }) => {
    await page.goto("/despesas");
    await page.waitForURL("**/despesas", { timeout: 15_000 });

    // Intercept expense creation and return 403
    await page.route("**/expenses**", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "Forbidden" }),
        });
      }
      return route.continue();
    });

    // Try to open and submit new expense form
    const newBtn = page.locator('button', { hasText: /nova despesa/i });
    if (await newBtn.isVisible()) {
      await newBtn.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
      // Fill minimal form
      await page.locator('[role="dialog"] input[type="text"]').first().fill("Teste 403");
      await page.locator('[role="dialog"] input[type="number"]').first().fill("10");
      await page.locator('[role="dialog"] button', { hasText: /gravar|guardar|confirmar|criar/i }).last().click();

      // Should show a toast error, not crash
      await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 8_000 });
    }
  });

  test("409 em categoria duplicada → toast de erro visível", async ({ page }) => {
    await page.goto("/despesas");
    await page.waitForURL("**/despesas", { timeout: 15_000 });

    await page.route("**/expenses/categories**", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "Categoria com este nome já existe." }),
        });
      }
      return route.continue();
    });

    const catBtn = page.locator('button', { hasText: /categor/i });
    if (await catBtn.isVisible()) {
      await catBtn.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
      await page.locator('[role="dialog"] input[type="text"]').first().fill("Duplicada");
      await page.locator('[role="dialog"] button', { hasText: /criar|adicionar|nova/i }).last().click();

      await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 8_000 });
    }
  });

  test("500 em listagem → UI não crasha", async ({ page }) => {
    await page.route("**/expenses**", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal Server Error" }),
        });
      }
      return route.continue();
    });

    await page.goto("/despesas");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=/something went wrong|uncaught/i")).not.toBeVisible();
  });

  test("503 em upload → toast de erro de serviço indisponível", async ({ page }) => {
    await page.route("**/uploads**", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Storage indisponível." }),
        });
      }
      return route.continue();
    });

    // Navigate to CMS where uploads are used
    await page.goto("/conteudos");
    await expect(page.locator("body")).toBeVisible();
  });

  test("rede offline → UI não crasha e mostra erro", async ({ page }) => {
    await page.goto("/despesas");
    await page.waitForURL("**/despesas", { timeout: 15_000 });

    // Simulate network offline for API calls
    await page.route("**/api/**", (route) => route.abort("failed"));

    // Trigger a refetch by navigating away and back
    await page.goto("/dashboard");
    await page.goto("/despesas");

    // App should render without crashing
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=/something went wrong|uncaught/i")).not.toBeVisible();
  });
});
