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

/**
 * Vista simétrica (tenantB) + mais módulos: garante que o isolamento vale nos dois
 * sentidos e cobre Loja/Encomendas, Despesas, Ginásio, CMS, Agenda pela UI.
 */

const API = process.env.VITE_API_BASE_URL ?? "http://localhost:3002/api";

/** Faz login por API e devolve o accessToken de um tenant. */
async function tokenFor(request: import("@playwright/test").APIRequestContext, user: string): Promise<string> {
  const res = await request.post(`${API}/users/login`, {
    data: { username: user, password: "E2ePass123!" },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login API de ${user} falhou (${res.status()})`).toBeTruthy();
  return (await res.json()).accessToken as string;
}

test.describe("Isolamento multi-tenant — vista simétrica de B + mais módulos", () => {
  test("Loja: B só vê o seu produto (B-SKU-001), não o de A", async ({ page, context }) => {
    await loginAs(context, "tenantB@e2e");
    await page.goto("/loja");
    await expect(page.getByText("B-SKU-001")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("A-SKU-001")).toHaveCount(0);
  });

  test("Despesas: B só vê as suas, não as de A", async ({ page, context }) => {
    await loginAs(context, "tenantB@e2e");
    await page.goto("/despesas");
    await expect(page.getByText(/Despesa B •/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Despesa A •/)).toHaveCount(0);
  });

  test("Ginásio: B só vê o seu exercício (Supino B), não o de A", async ({ page, context }) => {
    await loginAs(context, "tenantB@e2e");
    await page.goto("/ginasio");
    await expect(page.getByText("Supino B")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Supino A")).toHaveCount(0);
  });

  test("Conteúdos (CMS): B só vê as suas entradas, não as de A", async ({ page, context }) => {
    await loginAs(context, "tenantB@e2e");
    await page.goto("/conteudos");
    await expect(page.getByText("Bem-vindo B").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Bem-vindo A")).toHaveCount(0);
  });

  test("Loja/Encomendas: A vê exactamente 1 encomenda (a sua), não a de B", async ({ page, context }) => {
    // O seed cria 1 encomenda por tenant (€39,80). A tabela de Encomendas mostra
    // ID/Total/Data. O isolamento prova-se por A ver SÓ 1 linha (a sua) — se a de B
    // vazasse, apareceriam 2 linhas.
    await loginAs(context, "tenantA@e2e");
    await page.goto("/loja/encomendas");
    // Espera a tabela de encomendas renderizar (cabeçalho "Total").
    await expect(page.getByRole("columnheader", { name: "Total" })).toBeVisible({ timeout: 12_000 });
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1, { timeout: 8_000 });
    await expect(rows.first()).toContainText("€39,80");
  });

  test("Agenda/Marcações: B vê as suas (Ag B), não as de A (Ag A)", async ({ page, context }) => {
    await loginAs(context, "tenantB@e2e");
    await page.goto("/agenda");
    await page.getByRole("button", { name: "Marcações", exact: true }).click();
    await expect(page.getByText("Ag B • PAGA")).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText(/Ag A •/)).toHaveCount(0);
  });
});

test.describe("Isolamento multi-tenant — deep-links de recurso alheio", () => {
  test("Loja: A com ?openProduct=<id de B> nunca mostra o produto de B", async ({ page, context, request }) => {
    // Obter, via API, o productId de B.
    const tokenB = await tokenFor(request, "tenantB@e2e");
    const prodsB = await request.get(`${API}/products`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const bodyB = await prodsB.json();
    const listB = Array.isArray(bodyB) ? bodyB : (bodyB.rows ?? bodyB.products ?? []);
    const bProductId = listB[0].productId as string;

    // Login como A e tentar abrir o produto de B pelo deep-link.
    await loginAs(context, "tenantA@e2e");
    await page.goto(`/loja?openProduct=${bProductId}`);
    // Título só existe no topbar (h2, Shell.tsx) — a página já não tem h1 próprio.
    await expect(page.getByRole("heading", { name: "Loja", level: 2 })).toBeVisible({ timeout: 15_000 });
    // O produto de A é visível; o de B nunca aparece (nem lista nem modal).
    await expect(page.getByText("A-SKU-001")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("B-SKU-001")).toHaveCount(0);
    // O modal de edição não abre para um produto que não é do tenant.
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });

  test("API cross-tenant: A com token de A não consegue GET /customers/:id de B (404/403)", async ({ request }) => {
    // Prova, na fronteira da API (que a UI consome), que o recurso alheio é negado.
    const tokenB = await tokenFor(request, "tenantB@e2e");
    const custB = await request.get(`${API}/customers`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const bId = (await custB.json()).rows[0].customerId as string;

    const tokenA = await tokenFor(request, "tenantA@e2e");
    const res = await request.get(`${API}/customers/${bId}`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect([403, 404], `esperado 403/404 ao ler cliente de B com token de A, veio ${res.status()}`).toContain(res.status());
    // E o corpo nunca traz o nome do cliente de B.
    const txt = await res.text();
    expect(txt).not.toContain("Cliente B •");
  });
});
