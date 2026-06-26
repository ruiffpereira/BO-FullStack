import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Ginásio — catálogo e dados do tenant", () => {
  test("a tab Exercícios mostra o exercício semeado (Supino A)", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    await page.goto("/ginasio");
    await expect(page.getByText("Supino A")).toBeVisible({ timeout: 10_000 });
  });

  test("user só com VIEW_GYM acede ao Ginásio (página renderiza)", async ({ page, context }) => {
    // gym@e2e não tem dados próprios — valida só o acesso e a renderização.
    await loginAs(context, "gym@e2e");
    await page.goto("/ginasio");
    await expect(page).toHaveURL(/\/ginasio/);
    await expect(page.getByRole("button", { name: /novo exercício/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});
