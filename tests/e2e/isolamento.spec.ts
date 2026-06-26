import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";

// Cada teste autentica o seu próprio tenant — começa sem sessão.
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Isolamento multi-tenant na UI: o seed cria dados distintos para tenantA e
 * tenantB (prefixos A/B). Cada tenant só pode ver os seus — nunca os do outro.
 */
test.describe("Isolamento multi-tenant — cada tenant só vê os seus dados", () => {
  test("Clientes: A vê os seus, não vê os de B", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    await page.goto("/clientes");
    await expect(page.getByText("Cliente A • Ana")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Cliente A • Bruno")).toBeVisible();
    await expect(page.getByText(/Cliente B •/)).toHaveCount(0);
  });

  test("Clientes: B vê os seus, não vê os de A", async ({ page, context }) => {
    await loginAs(context, "tenantB@e2e");
    await page.goto("/clientes");
    await expect(page.getByText("Cliente B • Ana")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Cliente A •/)).toHaveCount(0);
  });

  test("Loja: A só vê o seu produto (A-SKU-001), não o de B", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    await page.goto("/loja");
    await expect(page.getByText("A-SKU-001")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("B-SKU-001")).toHaveCount(0);
  });

  test("Despesas: A só vê as suas, não as de B", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    await page.goto("/despesas");
    await expect(page.getByText(/Despesa A •/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Despesa B •/)).toHaveCount(0);
  });
});
