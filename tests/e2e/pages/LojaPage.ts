import { type Page, expect } from "@playwright/test";

export class LojaPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/loja");
    await this.page.waitForURL("**/loja", { timeout: 15_000 });
  }

  header() {
    return this.page.getByRole("heading", { name: "Loja", level: 1 });
  }

  /** Tabs: Produtos · Encomendas · Categorias. Renderizadas com role="tab" (ui/Tabs). */
  tab(label: string) {
    return this.page.getByRole("tab", { name: label, exact: true });
  }

  async goToTab(label: string) {
    await this.tab(label).first().click();
    await this.page.waitForTimeout(400);
  }

  searchInput() {
    return this.page.getByPlaceholder(/procurar produto/i);
  }

  async openNewProduct() {
    await this.page.getByRole("button", { name: /novo produto/i }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }

  /**
   * Cria um produto: o Nome é um CmsCombo (input de texto) — escrever um nome novo
   * cria a entrada CMS ao Guardar. Preenche Referência/Preço/Stock e clica
   * "Adicionar" (o botão do footer, não é type=submit).
   */
  async createProduct(opts: { name: string; reference: string; price: string; stock: string }) {
    await this.goToTab("Produtos");
    await this.openNewProduct();
    const dialog = this.page.locator('[role="dialog"]');
    // O modal tem 2 CmsCombo com o mesmo placeholder (Nome + Descrição). O Nome é
    // o primeiro.
    await dialog.getByPlaceholder(/pesquisar ou escrever um nome/i).first().fill(opts.name);
    await dialog.getByPlaceholder("PM-001").fill(opts.reference);
    await dialog.getByPlaceholder("14.90").fill(opts.price);
    await dialog.getByPlaceholder("0", { exact: true }).first().fill(opts.stock);
    await dialog.getByRole("button", { name: /^adicionar$/i }).click();
    // O modal fecha ao criar com sucesso.
    await expect(dialog).toHaveCount(0, { timeout: 12_000 });
  }

  /** Card do produto (por referência ou nome). */
  productCard(text: string) {
    return this.page.locator("h3, p").filter({ hasText: text }).first();
  }

  async expectProductVisible(text: string) {
    await this.goToTab("Produtos");
    await expect(this.page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  }

  toastLocator() {
    return this.page.locator("[data-sonner-toast]");
  }
}
