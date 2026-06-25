import { type Page, expect } from "@playwright/test";

export class AgendaPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/agenda");
    await this.page.waitForURL("**/agenda", { timeout: 15_000 });
  }

  header() {
    return this.page.getByRole("heading", { name: "Agenda", level: 1 });
  }

  /** Tabs: Calendário · Marcações · Serviços · Configurações. */
  async goToTab(label: string) {
    await this.page.getByRole("button", { name: label, exact: true }).first().click();
    await this.page.waitForTimeout(400);
  }

  tab(label: string) {
    return this.page.getByRole("button", { name: label, exact: true });
  }
}
