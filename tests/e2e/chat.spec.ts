import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";

// Cada teste autentica o seu próprio utilizador — começa sem sessão.
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Chat de suporte (Admin ↔ tenant). Contas semeadas (seedE2e.ts):
 *  - admin@e2e   → Admin → /mensagens mostra o INBOX de todos os tenants.
 *  - limited@e2e → não-admin (só VIEW_PRODUCTS) → /mensagens mostra A SUA conversa.
 */
test.describe("Chat de suporte", () => {
  test("tenant (não-admin) vê a sua conversa de suporte, sem controlos de admin", async ({ page, context }) => {
    await loginAs(context, "limited@e2e");
    await page.goto("/mensagens");

    await expect(page.getByText("Fala com o suporte")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("textbox", { name: "Mensagem" })).toBeVisible();
    // Não vê os controlos do inbox de admin.
    await expect(page.getByRole("button", { name: "Nova" })).toHaveCount(0);
    await expect(page.getByPlaceholder("Procurar tenant…")).toHaveCount(0);
  });

  test("admin vê o inbox de conversas (Nova + pesquisa)", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    await page.goto("/mensagens");

    await expect(page.getByText("Conversas com os teus clientes")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Nova" })).toBeVisible();
    await expect(page.getByPlaceholder("Procurar tenant…")).toBeVisible();
  });

  test("round-trip: tenant envia, admin recebe no inbox e responde, tenant vê a resposta (tempo real)", async ({ browser }) => {
    const mark = `e2e-${Date.now()}`;
    const ask = `pergunta ${mark}`;
    const reply = `resposta ${mark}`;

    // --- Tenant (limited@e2e) envia uma mensagem ao suporte ---
    const tenantCtx = await browser.newContext();
    await loginAs(tenantCtx, "limited@e2e");
    const tenant = await tenantCtx.newPage();
    await tenant.goto("/mensagens");
    await expect(tenant.getByText("Fala com o suporte")).toBeVisible({ timeout: 15_000 });
    await tenant.getByRole("textbox", { name: "Mensagem" }).fill(ask);
    await tenant.getByRole("button", { name: "Enviar" }).click();
    // Scopar ao histórico (role="log") — o texto também fica na textarea do composer.
    await expect(tenant.getByRole("log").getByText(ask)).toBeVisible({ timeout: 10_000 });

    // --- Admin (admin@e2e) vê a conversa no inbox, abre e responde ---
    const adminCtx = await browser.newContext();
    await loginAs(adminCtx, "admin@e2e");
    const admin = await adminCtx.newPage();
    await admin.goto("/mensagens");
    const convItem = admin.locator("button", { hasText: ask }).first();
    await expect(convItem).toBeVisible({ timeout: 15_000 });
    await convItem.click();
    await admin.getByRole("textbox", { name: "Mensagem" }).fill(reply);
    await admin.getByRole("button", { name: "Enviar" }).click();
    await expect(admin.getByRole("log").getByText(reply).first()).toBeVisible({ timeout: 10_000 });

    // --- O tenant (página já aberta) recebe a resposta em tempo real (SSE) ---
    await expect(tenant.getByRole("log").getByText(reply)).toBeVisible({ timeout: 20_000 });

    await tenantCtx.close();
    await adminCtx.close();
  });

  test("o ícone do topbar leva às Mensagens", async ({ page, context }) => {
    await loginAs(context, "limited@e2e");
    await page.goto("/dashboard");
    // Topbar é o primeiro botão "Mensagens…" no DOM (a bolinha flutuante vem depois).
    await page.getByRole("button", { name: /^Mensagens/ }).first().click();
    await expect(page).toHaveURL(/\/mensagens$/);
  });

  test("a bolinha flutuante abre o mini-chat sobreposto", async ({ page, context }) => {
    await loginAs(context, "limited@e2e");
    await page.goto("/dashboard");
    // A bolinha (FAB) é o último botão "Mensagens…" no DOM.
    await page.getByRole("button", { name: /^Mensagens/ }).last().click();
    await expect(page.getByRole("dialog", { name: "Mensagens" })).toBeVisible();
    // Dentro do widget: o composer do tenant.
    await expect(page.getByRole("textbox", { name: "Mensagem" })).toBeVisible();
  });

  test("aviso (toast) de nova mensagem quando o tenant NÃO está nas Mensagens", async ({ browser }) => {
    const mark = `toast-${Date.now()}`;
    const reply = `aviso ${mark}`;

    // Tenant abre uma conversa e depois sai das Mensagens.
    const tenantCtx = await browser.newContext();
    await loginAs(tenantCtx, "limited@e2e");
    const tenant = await tenantCtx.newPage();
    await tenant.goto("/mensagens");
    await expect(tenant.getByText("Fala com o suporte")).toBeVisible({ timeout: 15_000 });
    await tenant.getByRole("textbox", { name: "Mensagem" }).fill(`abre ${mark}`);
    await tenant.getByRole("button", { name: "Enviar" }).click();
    await expect(tenant.getByRole("log").getByText(`abre ${mark}`)).toBeVisible({ timeout: 10_000 });
    await tenant.goto("/dashboard");

    // Admin responde.
    const adminCtx = await browser.newContext();
    await loginAs(adminCtx, "admin@e2e");
    const admin = await adminCtx.newPage();
    await admin.goto("/mensagens");
    await admin.locator("button", { hasText: `abre ${mark}` }).first().click();
    await admin.getByRole("textbox", { name: "Mensagem" }).fill(reply);
    await admin.getByRole("button", { name: "Enviar" }).click();

    // O tenant (no /dashboard) recebe o toast com a pré-visualização da mensagem.
    await expect(tenant.getByText(reply)).toBeVisible({ timeout: 20_000 });

    await tenantCtx.close();
    await adminCtx.close();
  });
});
