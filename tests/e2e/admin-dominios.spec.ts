import { test as authTest, expect } from "./fixtures/auth"; // login como admin@e2e
import { test as base } from "@playwright/test";
import { AdminPage } from "./pages/AdminPage";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { expectBlockedRedirect, withSessionRetry } from "./fixtures/session";

/**
 * Admin → "Domínios permitidos" (`/admin/dominios`, `DominiosTab`): CORS dinâmico.
 *  - domínios extra (CRUD, sem ligação a clientes);
 *  - "Websites dos clientes" (só leitura, vem do `websiteDomain` do tenant);
 *  - "Definido no servidor" (só leitura, vem do env).
 * Mais: RBAC (sem VIEW_ADMIN não há item nem acesso por deep-link) e o campo
 * "Website do cliente (opcional)" na criação de utilizador.
 */

const EXTRA = "extra-e2e.pt";

authTest.describe("Admin — Domínios permitidos (admin@e2e)", () => {
  authTest("sidebar → Domínios permitidos: secções só-leitura visíveis", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Domínios permitidos");

    await expect(page).toHaveURL(/\/admin\/dominios$/);
    await expect(page.getByText("Domínios extra", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Websites dos clientes", { exact: true })).toBeVisible();
    await expect(page.getByText("Definido no servidor", { exact: true })).toBeVisible();
    await expect(page.getByText(/só leitura/i)).toBeVisible();
    // As secções só-leitura não têm botão de remover (só a lista de extras tem).
    await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(
      await admin.dominioExtraRow(EXTRA).count(),
    );
  });

  authTest("adicionar → duplicado → inválido → remover com confirmação", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Domínios permitidos");
    await expect(admin.dominioInput()).toBeVisible({ timeout: 10_000 });

    // Idempotente: um run anterior pode ter deixado o domínio na BD.
    await expect(page.getByText("A carregar…")).toHaveCount(0, { timeout: 10_000 });
    await admin.removeDominioIfPresent(EXTRA);
    await expect(admin.dominioExtraRow(EXTRA)).toHaveCount(0, { timeout: 10_000 });

    // 1) Adicionar → aparece na lista.
    await admin.addDominio(EXTRA);
    await expect(page.getByText("Domínio permitido", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(admin.dominioExtraRow(EXTRA)).toHaveCount(1, { timeout: 10_000 });
    await expect(admin.dominioInput()).toHaveValue(""); // o input limpa após sucesso

    // 2) Adicionar de novo → 409.
    await admin.addDominio(EXTRA);
    await expect(page.getByText("Esse domínio já está permitido.")).toBeVisible({ timeout: 10_000 });
    await expect(admin.dominioExtraRow(EXTRA)).toHaveCount(1); // sem duplicado na lista

    // 3) Inválido → 400.
    await admin.addDominio("isto não é um domínio!!");
    await expect(page.getByText("Domínio inválido.")).toBeVisible({ timeout: 10_000 });

    // 4) Cancelar a confirmação NÃO remove.
    await admin.dominioExtraRow(EXTRA).getByRole("button", { name: "Remover" }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toContainText(`Remover "${EXTRA}"?`);
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(admin.dominioExtraRow(EXTRA)).toHaveCount(1);

    // 5) Remover com confirmação → some.
    await admin.removeDominio(EXTRA);
    await expect(page.getByText("Domínio removido", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(admin.dominioExtraRow(EXTRA)).toHaveCount(0, { timeout: 10_000 });

    // Persistiu: após recarregar continua removido.
    await page.reload();
    await expect(admin.dominioInput()).toBeVisible({ timeout: 15_000 });
    await expect(admin.dominioExtraRow(EXTRA)).toHaveCount(0);
  });

  authTest("criar utilizador com 'Website do cliente' → domínio aparece em 'Websites dos clientes'", async ({ page }) => {
    const admin = new AdminPage(page);
    const stamp = Date.now();
    const username = `webcli_${stamp}`;
    const domain = `cliente-${stamp}.pt`;

    await admin.goto();
    await admin.openNewUserModal();

    // Os três campos antigos já não existem; o novo existe.
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.getByLabel("Website do cliente (opcional)")).toBeVisible();
    await expect(dialog.getByText("Nome de remetente")).toHaveCount(0);
    await expect(dialog.getByText("Email de envio")).toHaveCount(0);
    await expect(dialog.getByText("URL do site")).toHaveCount(0);

    await admin.fillUserForm({
      username,
      email: `webcli_${stamp}@example.com`,
      websiteDomain: domain,
    });
    await admin.submitUserForm();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 10_000 });

    // O utilizador aparece na lista e o domínio na secção só-leitura.
    await expect(await admin.findUserRow(username)).toBeVisible({ timeout: 10_000 });
    await admin.goToTab("Domínios permitidos");
    const tenantRow = page.locator("li").filter({ hasText: domain });
    await expect(tenantRow).toHaveCount(1, { timeout: 10_000 });
    await expect(tenantRow).toContainText(username);
    // Não é um domínio extra: sem botão "Remover".
    await expect(tenantRow.getByRole("button", { name: "Remover" })).toHaveCount(0);
  });
});

base.describe("Admin — Domínios permitidos: RBAC (limited@e2e)", () => {
  base.use({ storageState: { cookies: [], origins: [] } });

  base("sem VIEW_ADMIN: não vê o item e o deep-link /admin/dominios redirecciona para /dashboard", async ({ page, context }) => {
    await loginAs(context, "limited@e2e");
    await withSessionRetry(
      page,
      context,
      "limited@e2e",
      () => page.goto("/dashboard"),
      async () => {
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
        // A sidebar já carregou (item core visível) e não tem nada de Admin.
        await expect(page.locator("nav").first().getByRole("button", { name: "Financeiro", exact: true })).toBeVisible({ timeout: 10_000 });
        await expect(page.locator("nav").first().getByRole("button", { name: "Domínios permitidos", exact: true })).toHaveCount(0);
        await expect(page.locator("nav").first().getByRole("button", { name: "Admin", exact: true })).toHaveCount(0);
      },
    );

    await expectBlockedRedirect(page, context, "limited@e2e", "/admin/dominios");
    await expect(page.getByText("Domínios extra", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Websites dos clientes", { exact: true })).toHaveCount(0);
  });

  base("sem VIEW_ADMIN: a API recusa GET/POST/DELETE /admin/cors-origins com token válido (403)", async ({ request }) => {
    const login = await request.post(`${API}/users/login`, {
      data: { username: "limited@e2e", password: E2E_PASSWORD },
      headers: { "CF-Connecting-IP": nextClientIp() },
    });
    expect(login.ok()).toBeTruthy();
    const headers = { Authorization: `Bearer ${(await login.json()).accessToken as string}` };

    const get = await request.get(`${API}/admin/cors-origins`, { headers });
    expect(get.status(), "GET /admin/cors-origins devia ser 403 sem VIEW_ADMIN").toBe(403);

    const post = await request.post(`${API}/admin/cors-origins`, { headers, data: { domain: "intruso-e2e.pt" } });
    expect(post.status(), "POST /admin/cors-origins devia ser 403 sem VIEW_ADMIN").toBe(403);

    const del = await request.delete(`${API}/admin/cors-origins/00000000-0000-4000-8000-000000000000`, { headers });
    expect(del.status(), "DELETE /admin/cors-origins/:id devia ser 403 sem VIEW_ADMIN").toBe(403);
  });
});
