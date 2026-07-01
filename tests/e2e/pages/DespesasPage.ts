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
    // Pode haver mais do que um CTA "Nova despesa" (header + empty-state) — usa o 1.º.
    await this.openNewExpenseButton().first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }

  /**
   * Escolhe uma data ISO (yyyy-MM-dd) no DatePicker da app (react-day-picker) dentro
   * do modal. O form já faz default a HOJE (emptyForm), por isso só é preciso para
   * datas diferentes de hoje. Navega o calendário e clica o dia por `data-day`.
   */
  async pickDate(iso: string) {
    // Trigger do DatePicker: mostra a data actual (dd/MM/yyyy) ou "Escolher data…".
    await this.page
      .locator('[role="dialog"] button')
      .filter({ hasText: /\d{2}\/\d{2}\/\d{4}|escolher data/i })
      .first()
      .click();
    const cal = this.page.locator(".rdp-root").last();
    await expect(cal).toBeVisible({ timeout: 5_000 });
    const targetYm = iso.slice(0, 7);
    const dayCell = () => cal.locator(`td[data-day="${iso}"]:not([data-outside]) button`);
    for (let i = 0; i < 24; i++) {
      if (await dayCell().count()) break;
      const shownDay = await cal.locator('td[data-day]:not([data-outside])').first().getAttribute("data-day");
      const shown = shownDay ? shownDay.slice(0, 7) : targetYm;
      await cal.locator(targetYm < shown ? ".rdp-button_previous" : ".rdp-button_next").click();
      await this.page.waitForTimeout(150);
    }
    await dayCell().first().click();
    await expect(cal).toBeHidden({ timeout: 5_000 });
  }

  async fillExpenseForm(opts: {
    date?: string;
    description?: string;
    amount?: string;
    notes?: string;
  }) {
    // A data faz default a HOJE no form (emptyForm) — só interagir com o DatePicker
    // se for pedida uma data diferente de hoje. Os campos são localizados por
    // placeholder (o <Input> da app nem sempre emite type="text").
    const today = new Date().toISOString().slice(0, 10);
    if (opts.date && opts.date !== today) {
      await this.pickDate(opts.date);
    }
    if (opts.description !== undefined) {
      await this.page.getByPlaceholder("Ex: Fatura eletricidade").fill(opts.description);
    }
    if (opts.amount !== undefined) {
      await this.page.getByPlaceholder("0.00").fill(opts.amount);
    }
    if (opts.notes !== undefined) {
      await this.page.getByPlaceholder("Detalhes adicionais").fill(opts.notes).catch(() => {});
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
