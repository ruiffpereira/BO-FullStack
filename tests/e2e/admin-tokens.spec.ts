import { test, expect } from "./fixtures/auth"; // login como admin@e2e
import { AdminPage } from "./pages/AdminPage";

test.describe("Admin — Tokens de site", () => {
  test("gerar um token de site para um utilizador", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Tokens de site");

    // Escolher um utilizador no Combobox (o botão "Novo token" está disabled sem user).
    await page.getByRole("button", { name: /todos/i }).first().click();
    await page.locator('[role="option"]').nth(1).locator("button").click();

    await page.getByRole("button", { name: /novo token/i }).click();
    await page.locator('[role="dialog"] input').first().fill(`E2E ${Date.now()}`);
    await page.getByRole("button", { name: /gerar token/i }).click();

    // Modal "Token gerado" (o valor só é mostrado uma vez).
    await expect(page.getByText(/token gerado/i)).toBeVisible({ timeout: 10_000 });
  });
});
