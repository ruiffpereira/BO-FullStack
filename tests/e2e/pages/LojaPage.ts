import { type Page } from "@playwright/test";

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
}
