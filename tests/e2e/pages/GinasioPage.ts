import { type Page } from "@playwright/test";

export class GinasioPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/ginasio");
    await this.page.waitForURL("**/ginasio", { timeout: 15_000 });
  }

  header() {
    return this.page.getByRole("heading", { name: "Ginásio", level: 1 });
  }

  searchInput() {
    return this.page.getByPlaceholder(/procurar exercício/i);
  }

  async openNewExercise() {
    await this.page.getByRole("button", { name: /novo exercício/i }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }
}
