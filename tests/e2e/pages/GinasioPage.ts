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

  // ── Financeiro do ginásio (menu lateral "Financeiro"; mostra ginásio com VIEW_GYM) ──
  async gotoFinanceiro() {
    await this.page.goto("/financeiro");
    await this.page.waitForURL("**/financeiro", { timeout: 15_000 });
    // Se o KPI do ginásio já estiver visível (tenant só-ginásio), nada a fazer.
    // Caso contrário (VIEW_STATS + VIEW_GYM) há um toggle Geral · Ginásio: o botão
    // "Ginásio" do toggle está no conteúdo (depois da nav lateral) → usa o último.
    if (!(await this.kpiRecebido().isVisible().catch(() => false))) {
      await this.page.getByRole("button", { name: "Ginásio", exact: true }).last().click().catch(() => {});
    }
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
