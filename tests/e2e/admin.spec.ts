import { test, expect } from "./fixtures/auth";
import { AdminPage } from "./pages/AdminPage";

test.describe("Admin — Utilizadores", () => {
  test("tab Utilizadores carrega lista", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    // Default tab should show users
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10_000 });
  });

  test("criar utilizador com email duplicado → 409 → toast de erro", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();

    // Use test user's own email to force a duplicate
    const dupeEmail = `dup_${Date.now()}@example.com`;

    // Create first user
    await admin.createUser({ username: `user1_${Date.now()}`, email: dupeEmail });
    await page.waitForTimeout(1_000);

    // Create second user with same email
    await admin.createUser({ username: `user2_${Date.now()}`, email: dupeEmail });

    await admin.expectToastVisible();
  });
});

test.describe("Admin — Permissões", () => {
  test("tab Permissões lista permissões existentes", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Permissões");

    await expect(page.locator("table tbody tr, [data-testid='permission-row']").first()).toBeVisible({ timeout: 10_000 });
  });

  test("permissão Admin protegida — botão de eliminar ausente ou bloqueado", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Permissões");

    // The Admin permission row should not have a delete button or it should be disabled
    const adminRow = page.locator("tr").filter({ hasText: /^Admin$|VIEW_ADMIN/i }).first();
    if (await adminRow.isVisible()) {
      const deleteBtn = adminRow.locator('button[title*="elimin"], button[aria-label*="delete"]');
      const btnCount = await deleteBtn.count();
      if (btnCount > 0) {
        await deleteBtn.first().click();
        // Should show an error toast, not succeed
        await admin.expectToastVisible();
      }
    }
  });
});

test.describe("Admin — Audit Logs", () => {
  test("tab Atividade carrega logs", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Atividade");

    // Audit log table should have rows
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10_000 });
  });

  test("filtro por método HTTP restringe resultados", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Atividade");

    await admin.searchAuditLogs("POST");
    await page.waitForTimeout(800);

    // Each visible row should contain POST method
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count > 0) {
      const firstRowText = await rows.first().textContent();
      expect(firstRowText).toMatch(/POST/i);
    }
  });

  test("passwords nunca visíveis nos logs", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Atividade");

    const tableText = await page.locator("table").textContent() ?? "";
    expect(tableText).not.toMatch(/password|palavra.passe/i);
  });
});

test.describe("Admin — Sistema", () => {
  test("tab Sistema mostra status da BD", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Sistema");

    // Should show some health indicator
    await expect(page.locator("text=/ok|healthy|activo|database/i").first()).toBeVisible({ timeout: 10_000 });
  });
});
