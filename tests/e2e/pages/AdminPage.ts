import { type Page, expect } from "@playwright/test";

export class AdminPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/admin");
    await this.page.waitForURL("**/admin", { timeout: 15_000 });
  }

  /** Subitens da sidebar (T2.4): Utilizadores (âncora, `/admin`) · Permissões · Componentes · Tokens de site · Faturação · Integrações · Atividade · Sistema — botões do submenu, não mais role="tab". */
  private static PATH_BY_LABEL: Record<string, string> = {
    Utilizadores: "/admin",
    Permissões: "/admin/permissoes",
    Componentes: "/admin/componentes",
    "Tokens de site": "/admin/tokens",
    Faturação: "/admin/faturacao",
    Integrações: "/admin/integracoes",
    Atividade: "/admin/atividade",
    Sistema: "/admin/sistema",
  };

  tab(label: string) {
    return this.page.locator("nav").first().getByRole("button", { name: label, exact: true });
  }

  async goToTab(name: string) {
    await this.tab(name).first().click();
    const path = AdminPage.PATH_BY_LABEL[name];
    if (path) await this.page.waitForURL(`**${path}`, { timeout: 10_000 });
    await this.page.waitForTimeout(200);
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async openNewUserModal() {
    await this.page.locator('button', { hasText: /novo utilizador|criar utilizador/i }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }

  async fillUserForm(opts: { username?: string; email?: string; phone?: string; password?: string }) {
    const dialog = this.page.locator('[role="dialog"]');
    // O "username" no formulário é o campo "Nome" (primeiro input do modal).
    if (opts.username) await dialog.locator("input").first().fill(opts.username);
    if (opts.email)    await dialog.locator('input[type="email"]').first().fill(opts.email);
    if (opts.phone)    await dialog.locator('input[placeholder*="912"]').first().fill(opts.phone).catch(() => {});
    if (opts.password) await dialog.locator('input[type="password"]').first().fill(opts.password).catch(() => {});
    // Permissão é obrigatória (validação client-side). O seletor é um Combobox
    // custom (opções num portal); escolher a 1ª permissão real (índice 1; o 0 é
    // o placeholder "Seleccionar permissão").
    await dialog.getByRole("button", { name: /seleccionar permissão/i }).click();
    await this.page.locator('[role="option"]').nth(1).locator("button").click();
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
    // O filtro de método é um Combobox custom (botão + opções), não um <select>.
    await this.page.getByRole("button", { name: /todos os métodos/i }).click();
    await this.page.getByRole("button", { name: new RegExp(`^${method}`, "i") }).first().click();
    await this.page.waitForTimeout(400);
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
