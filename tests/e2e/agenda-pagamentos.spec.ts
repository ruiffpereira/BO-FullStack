import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";

// Cada teste autentica o tenantA (que tem marcações semeadas em 3 estados).
test.use({ storageState: { cookies: [], origins: [] } });

async function abrirMarcacoes(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext) {
  await loginAs(context, "tenantA@e2e");
  await page.goto("/agenda");
  await page.getByRole("button", { name: "Marcações", exact: true }).click();
}

test.describe("Agenda — estados de pagamento das marcações", () => {
  test("marcação concluída com pagamento parcial aparece EM DÍVIDA (15,00 €)", async ({ page, context }) => {
    await abrirMarcacoes(page, context);
    const row = page.locator("tr").filter({ hasText: "Ag A • DÍVIDA" });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(/Dívida\s*15[.,]00/);
  });

  test("marcação totalmente paga aparece como PAGO", async ({ page, context }) => {
    await abrirMarcacoes(page, context);
    const row = page.locator("tr").filter({ hasText: "Ag A • PAGA" });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("Pago");
    await expect(row).not.toContainText("Dívida");
  });

  test("marcação pendente não mostra dívida nem pago", async ({ page, context }) => {
    await abrirMarcacoes(page, context);
    const row = page.locator("tr").filter({ hasText: "Ag A • PENDENTE" });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).not.toContainText("Dívida");
    await expect(row).not.toContainText("Pago");
  });

  test("Agenda respeita isolamento — A não vê marcações de B", async ({ page, context }) => {
    await abrirMarcacoes(page, context);
    await expect(page.getByText("Ag A • PAGA")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Ag B •/)).toHaveCount(0);
  });
});
