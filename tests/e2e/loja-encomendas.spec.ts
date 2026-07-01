import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Loja — encomendas", () => {
  test("a tab Encomendas carrega e mostra a encomenda do tenant", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    await page.goto("/loja");
    await page.getByRole("tab", { name: "Encomendas", exact: true }).click();
    // A encomenda (€39,80) aparece. Isolamento: o total faturado é só o do próprio
    // tenant — se visse a de B (também €39,80) o total seria €79,60.
    await expect(page.getByText("Total faturado")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("€39,80").first()).toBeVisible();
    await expect(page.getByText("€79,60")).toHaveCount(0);
  });
});
