import { type Page, expect } from "@playwright/test";

export class AdminPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/admin");
    await this.page.waitForURL("**/admin", { timeout: 15_000 });
  }

  async goToTab(name: string) {
    await this.page.locator('button[role="tab"], button', { hasText: name }).first().click();
    await this.page.waitForTimeout(500);
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async openNewUserModal() {
    await this.page.locator('button', { hasText: /novo utilizador|criar utilizador/i }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }

  async fillUserForm(opts: { username?: string; email?: string; phone?: string; password?: string }) {
    const dialog = this.page.locator('[role="dialog"]');
    if (opts.username) await dialog.locator('input').filter({ hasText: /utilizador/i }).or(dialog.locator('input[placeholder*="utilizador"], input[autocomplete="username"]')).first().fill(opts.username);
    if (opts.email)    await dialog.locator('input[type="email"], input[placeholder*="email"]').first().fill(opts.email);
    if (opts.phone)    await dialog.locator('input[type="tel"], input[placeholder*="telef"]').first().fill(opts.phone).catch(() => {});
    if (opts.password) await dialog.locator('input[type="password"]').first().fill(opts.password).catch(() => {});
  }

  async submitUserForm() {
    await this.page.locator('[role="dialog"] button', { hasText: /criar|guardar|confirmar/i }).last().click();
  }

  async createUser(opts: { username: string; email: string; password?: string }) {
    await this.openNewUserModal();
    await this.fillUserForm(opts);
    await this.submitUserForm();
  }

  // ── Permissions ───────────────────────────────────────────────────────────

  async deletePermission(name: string) {
    const row = this.page.locator("tr").filter({ hasText: name }).first();
    await row.locator('button[title*="elimin"], button[aria-label*="delete"]').first().click();
    await this.page.locator('[role="dialog"] button', { hasText: /eliminar|confirmar/i }).last().click().catch(() => {});
  }

  // ── Audit logs ────────────────────────────────────────────────────────────

  async searchAuditLogs(method: string) {
    await this.page.locator('select, [role="combobox"]').filter({ hasText: /método|todos/i }).first().selectOption(method).catch(async () => {
      await this.page.locator('select').first().selectOption(method);
    });
    await this.page.waitForTimeout(500);
  }

  auditLogsTable() {
    return this.page.locator("table tbody tr");
  }

  // ── Health ────────────────────────────────────────────────────────────────

  healthStatus() {
    return this.page.locator('text=/ok|healthy|activo/i').first();
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  toastLocator() {
    return this.page.locator('[data-sonner-toast]');
  }

  async expectToastVisible() {
    await expect(this.toastLocator().first()).toBeVisible({ timeout: 8_000 });
  }
}
