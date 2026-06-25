import { type Page, expect } from "@playwright/test";

export class DespesasPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/despesas");
    await this.page.waitForURL("**/despesas", { timeout: 15_000 });
  }

  // ── Expense form ──────────────────────────────────────────────────────────

  openNewExpenseButton() {
    return this.page.locator('button', { hasText: /nova despesa/i });
  }

  async openNewExpenseModal() {
    await this.openNewExpenseButton().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }

  async fillExpenseForm(opts: {
    date?: string;
    description?: string;
    amount?: string;
    notes?: string;
  }) {
    if (opts.date) {
      await this.page.fill('input[type="date"]', opts.date);
    }
    if (opts.description !== undefined) {
      await this.page.locator('[role="dialog"] input[type="text"]').first().fill(opts.description);
    }
    if (opts.amount !== undefined) {
      await this.page.locator('[role="dialog"] input[type="number"]').first().fill(opts.amount);
    }
    if (opts.notes !== undefined) {
      await this.page.locator('[role="dialog"] textarea').first().fill(opts.notes).catch(() => {});
    }
  }

  async submitExpenseForm() {
    await this.page.locator('[role="dialog"] button[type="submit"], [role="dialog"] button', { hasText: /gravar|guardar|confirmar|criar|registar/i }).last().click();
  }

  async createExpense(opts: { date: string; description: string; amount: string }) {
    await this.openNewExpenseModal();
    await this.fillExpenseForm(opts);
    await this.submitExpenseForm();
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteExpense(description: string) {
    // Cada lançamento é um <div class="...group"> (não <tr>); o botão de eliminar
    // é um IconButton com aria-label="Eliminar".
    const row = this.page.locator("div.group").filter({ hasText: description }).first();
    await row.getByRole("button", { name: /eliminar/i }).click();
    // Confirmar no ConfirmDialog.
    await this.page.locator('[role="dialog"] button', { hasText: /eliminar|confirmar|apagar/i }).last().click();
  }

  // ── Categories ────────────────────────────────────────────────────────────

  openCategoriesButton() {
    return this.page.locator('button', { hasText: /categor/i });
  }

  async openCategoriesModal() {
    await this.openCategoriesButton().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }

  async createCategory(name: string) {
    await this.openCategoriesModal();
    await this.page.locator('[role="dialog"] input[type="text"]').first().fill(name);
    await this.page.locator('[role="dialog"] button', { hasText: /criar|adicionar|nova/i }).last().click();
  }

  // ── Month filter ──────────────────────────────────────────────────────────

  async filterByMonth(month: string) {
    await this.page.locator('input[type="month"]').fill(month);
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async expectExpenseVisible(description: string) {
    // A lista de lançamentos é um card (não uma <table>) — procurar na página.
    await expect(this.page.getByText(description, { exact: false }).first()).toBeVisible({ timeout: 8_000 });
  }

  async expectExpenseHidden(description: string) {
    await expect(this.page.getByText(description, { exact: false })).toHaveCount(0, { timeout: 5_000 });
  }

  toastLocator() {
    return this.page.locator('[data-sonner-toast]');
  }
}
