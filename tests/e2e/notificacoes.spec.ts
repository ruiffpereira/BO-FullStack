import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Notificações — sino em tempo real", () => {
  test("o sino mostra a notificação por ler do tenant", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    await page.goto("/dashboard");
    const bell = page.getByRole("button", { name: /notificações/i }).first();
    await expect(bell).toBeVisible({ timeout: 15_000 });
    // Badge de não lidas (aria-label inclui "(N não lidas)").
    await expect(page.getByRole("button", { name: /não lidas/i })).toBeVisible({ timeout: 15_000 });
    await bell.click();
    await expect(page.getByText("Nova marcação E2E")).toBeVisible({ timeout: 10_000 });
  });
});
