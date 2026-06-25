import { test, expect } from "./fixtures/auth";
import { DespesasPage } from "./pages/DespesasPage";

const today = new Date().toISOString().slice(0, 10);
const currentMonth = new Date().toISOString().slice(0, 7);

test.describe("Despesas — CRUD", () => {
  test("criar despesa → aparece na lista", async ({ page }) => {
    const p = new DespesasPage(page);
    await p.goto();

    const desc = `Teste E2E ${Date.now()}`;
    await p.createExpense({ date: today, description: desc, amount: "49.99" });

    await p.expectExpenseVisible(desc);
  });

  test("apagar despesa → removida da lista", async ({ page }) => {
    const p = new DespesasPage(page);
    await p.goto();

    const desc = `Para apagar ${Date.now()}`;
    await p.createExpense({ date: today, description: desc, amount: "10.00" });
    await p.expectExpenseVisible(desc);

    await p.deleteExpense(desc);
    await p.expectExpenseHidden(desc);
  });

  test("filtro de mês → lista actualiza", async ({ page }) => {
    const p = new DespesasPage(page);
    await p.goto();

    // Filter to a far-future month with no expenses
    await p.filterByMonth("2099-01");
    await page.waitForTimeout(1_000);

    // Should show empty state or zero items
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    // Either 0 rows or an empty state message
    if (count > 0) {
      const text = await page.locator("tbody").textContent();
      expect(text).not.toMatch(/\d+,\d{2}/); // no amounts visible for empty month
    }
  });
});

test.describe("Despesas — Validação", () => {
  test("submeter sem descrição → form não submete / erro visível", async ({ page }) => {
    const p = new DespesasPage(page);
    await p.goto();
    await p.openNewExpenseModal();
    // Fill amount and date but leave description empty
    await p.fillExpenseForm({ date: today, amount: "20.00" });
    await p.submitExpenseForm();

    // Modal should still be open (form didn't submit)
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3_000 });
  });

  test("submeter sem valor → form não submete", async ({ page }) => {
    const p = new DespesasPage(page);
    await p.goto();
    await p.openNewExpenseModal();
    await p.fillExpenseForm({ date: today, description: "Sem valor" });
    await p.submitExpenseForm();

    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3_000 });
  });
});

test.describe("Despesas — Categorias", () => {
  test("criar categoria → disponível no dropdown", async ({ page }) => {
    const p = new DespesasPage(page);
    await p.goto();

    const catName = `Cat E2E ${Date.now()}`;
    await p.createCategory(catName);

    // Close modal and open expense form — category should be selectable.
    await page.keyboard.press("Escape");
    await p.openNewExpenseModal();
    // O seletor de categoria é um Combobox (opções num portal, fora do dialog).
    await page.getByRole("button", { name: /sem categoria/i }).click();
    await expect(page.getByRole("option", { name: catName })).toBeVisible({ timeout: 5_000 });
  });

  test("criar categoria com nome duplicado → 409 → toast de erro", async ({ page }) => {
    const p = new DespesasPage(page);
    await p.goto();

    const catName = `Cat Dup ${Date.now()}`;
    // Create first time
    await p.createCategory(catName);
    await page.keyboard.press("Escape");

    // Try to create again with same name
    await p.createCategory(catName);

    await expect(p.toastLocator().first()).toBeVisible({ timeout: 8_000 });
  });
});
