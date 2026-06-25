import { type Page } from "@playwright/test";

export class ConteudosPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/conteudos");
    await this.page.waitForURL("**/conteudos", { timeout: 15_000 });
  }

  header() {
    return this.page.getByRole("heading", { name: "Conteúdos", level: 1 });
  }

  searchInput() {
    return this.page.getByPlaceholder(/pesquisar por key/i);
  }

  async openNewEntry() {
    await this.page.getByRole("button", { name: /nova entrada/i }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }

  importButton() {
    return this.page.getByRole("button", { name: /importar/i });
  }
}
