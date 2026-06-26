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

  // ── Mensalidades (tab dentro do Ginásio) ──
  async openMensalidades() {
    await this.goto();
    await this.page.getByRole("button", { name: /mensalidades/i }).first().click();
  }

  async openSubscricoesSubtab() {
    await this.page.getByRole("button", { name: /^subscrições$/i }).first().click();
  }

  kpiRecebido() {
    return this.page.getByText(/recebido este mês/i);
  }

  async createSubscription(name: string, price: string) {
    await this.page.getByRole("button", { name: /nova subscrição/i }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
    await this.page.getByLabel(/nome/i).fill(name);
    await this.page.getByLabel(/preço/i).fill(price);
    await this.page.getByRole("button", { name: /^criar$/i }).click();
    await this.page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8_000 });
  }
}
