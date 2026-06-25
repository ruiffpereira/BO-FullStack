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
    await this.page.locator('[role="dialog"] button[type="submit"]').first().click();
  }

  async expectClientVisible(name: string) {
    await expect(this.page.locator("table, [data-testid='client-list']").getByText(name, { exact: false }))
      .toBeVisible({ timeout: 8_000 });
  }

  toastLocator() {
    return this.page.locator("[data-sonner-toast]");
  }
}
