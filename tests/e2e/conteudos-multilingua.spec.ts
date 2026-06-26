import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Conteúdos (CMS) — multi-língua", () => {
  test("mostra a entrada na língua padrão (PT: Bem-vindo A)", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    await page.goto("/conteudos");
    await expect(page.getByText("Bem-vindo A").first()).toBeVisible({ timeout: 10_000 });
  });
});
