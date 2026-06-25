import { test, expect } from "@playwright/test";

// All tests in this file run WITHOUT saved auth state
test.use({ storageState: { cookies: [], origins: [] } });

const PROTECTED_ROUTES = ["/despesas", "/admin", "/financeiro", "/clientes", "/loja", "/agenda"];

test.describe("Rotas sem autenticação", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} sem auth → mostra login`, async ({ page }) => {
      await page.goto(route);

      // App mostra o login no mesmo URL (SPA, sem redirect) — a garantia é que
      // se vê o ecrã de login e NÃO o conteúdo protegido.
      await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "Entrar", level: 1 })).toBeVisible();
    });
  }

  test("rota raiz / sem auth → redireciona para login", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 15_000 });
  });

  test("rota inexistente sem auth → mostra login", async ({ page }) => {
    await page.goto("/rota-que-nao-existe");
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Dados sensíveis", () => {
  test("campo password nunca visível em respostas da API via Network", async ({ page }) => {
    const sensitiveResponses: string[] = [];

    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/api/")) {
        try {
          const body = await response.text();
          if (/"password"\s*:/.test(body)) {
            sensitiveResponses.push(`${url}: contains 'password' field`);
          }
        } catch {
          // ignore non-text responses
        }
      }
    });

    // Navigate through login so API calls are made
    await page.goto("/");
    await page.waitForSelector('button[type="submit"]', { timeout: 10_000 });

    expect(sensitiveResponses).toHaveLength(0);
  });
});
