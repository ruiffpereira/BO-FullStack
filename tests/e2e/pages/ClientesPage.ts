import { type Page, expect } from "@playwright/test";

export class ClientesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/clientes");
    await this.page.waitForURL("**/clientes", { timeout: 15_000 });
  }

  header() {
    return this.page.getByRole("heading", { name: "Clientes", level: 1 });
  }

  searchInput() {
    return this.page.getByPlaceholder(/procurar por nome/i);
  }

  async openNewModal() {
    await this.page.getByRole("button", { name: /novo cliente/i }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }

  async createClient(name: string) {
    await this.openNewModal();
    // O campo Nome é o primeiro input do modal (não tem type="text" explícito).
    await this.page.locator('[role="dialog"] input').first().fill(name);
    await this.submitModal();
  }

  /**
   * Cria um cliente com contribuinte na fatura: liga o toggle "Quer contribuinte
   * na fatura" e preenche o NIF. O modal (Novo cliente) tem: Nome, Email,
   * Telefone, NIF + um Toggle de wantsInvoice.
   */
  async createClientWithInvoice(name: string, nif: string) {
    await this.openNewModal();
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.locator("input").first().fill(name);
    // O campo NIF tem placeholder "123456789".
    await dialog.getByPlaceholder("123456789").fill(nif);
    // Liga o toggle de contribuinte (único role=switch no modal).
    await this.invoiceToggle().click();
    await expect(this.invoiceToggle()).toHaveAttribute("aria-checked", "true");
    await this.submitModal();
  }

  /** O botão de submit do modal (Criar cliente / Guardar) via form ref. */
  async submitModal() {
    await this.page.locator('[role="dialog"] button[type="submit"]').first().click();
  }

  /** Toggle "Quer contribuinte na fatura" (único role=switch nos modais). */
  invoiceToggle() {
    return this.page.locator('[role="dialog"]').getByRole("switch").first();
  }

  /** Abre a ficha de um cliente (clica na linha da tabela com o nome). */
  async openClient(name: string) {
    await this.page
      .locator("table tr")
      .filter({ hasText: name })
      .first()
      .click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }

  /** Na ficha aberta, clica "Editar" para abrir o modal de edição. */
  async openEditFromProfile() {
    await this.page.getByRole("button", { name: "Editar", exact: true }).first().click();
    // Espera o modal de edição (tem o título "Editar cliente").
    await expect(this.page.getByRole("heading", { name: "Editar cliente" })).toBeVisible({ timeout: 5_000 });
  }

  async expectClientVisible(name: string) {
    await expect(this.page.locator("table, [data-testid='client-list']").getByText(name, { exact: false }))
      .toBeVisible({ timeout: 8_000 });
  }

  /** Na ficha aberta, alterna Bloquear/Desbloquear e espera o toast. */
  async toggleBlockFromProfile() {
    await this.page
      .locator('[role="dialog"] button')
      .filter({ hasText: /^(Bloquear|Desbloquear)$/ })
      .first()
      .click();
    await expect(this.toastLocator().first()).toBeVisible({ timeout: 8_000 });
  }

  /** Fecha o modal aberto (ficha/edição) — botão "Fechar" ou Escape. */
  async closeModal() {
    const fechar = this.page.locator('[role="dialog"] button').filter({ hasText: /^Fechar$/ }).first();
    if (await fechar.count()) await fechar.click();
    else await this.page.keyboard.press("Escape");
    await expect(this.page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 5_000 });
  }

  /** Linha da tabela (tr) de um cliente pelo nome. */
  row(name: string) {
    return this.page.locator("table tbody tr").filter({ hasText: name }).first();
  }

  toastLocator() {
    return this.page.locator("[data-sonner-toast]");
  }
}
