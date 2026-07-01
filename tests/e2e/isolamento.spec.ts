import { test, expect } from "@playwright/test";
import { loginAs, nextClientIp } from "./fixtures/login";

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

  test("Ginásio: A só vê o seu exercício (Supino A), não o de B", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    await page.goto("/ginasio");
    await expect(page.getByText("Supino A")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Supino B")).toHaveCount(0);
  });

  test("Conteúdos (CMS): A só vê as suas entradas, não as de B", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    await page.goto("/conteudos");
    await expect(page.getByText("Bem-vindo A").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Bem-vindo B")).toHaveCount(0);
  });

  test("Deep-link: A não consegue abrir a ficha de um cliente de B por URL", async ({ page, context, request }) => {
    const API = process.env.VITE_API_BASE_URL ?? "http://localhost:3002/api";
    // Obter, via API, o id de um cliente do tenant B.
    const loginB = await request.post(`${API}/users/login`, { data: { username: "tenantB@e2e", password: "E2ePass123!" }, headers: { "CF-Connecting-IP": nextClientIp() } });
    const tokenB = (await loginB.json()).accessToken as string;
    const custB = await request.get(`${API}/customers`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const bId = (await custB.json()).rows[0].customerId as string;

    // Login como A e tentar abrir a ficha do cliente de B pelo deep-link.
    await loginAs(context, "tenantA@e2e");
    await page.goto(`/clientes?cliente=${bId}`);
    await expect(page.getByText("Clientes", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    // A API recusa o recurso de outro tenant → os dados de B nunca aparecem.
    await expect(page.getByText(/Cliente B •/)).toHaveCount(0);
  });
});
