import { type Page, type Locator, expect } from "@playwright/test";

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

  /**
   * Cria um exercício completo. Requer que exista pelo menos um grupo muscular no
   * tenant (o seed cria "Peito A"/"Peito B"). Passos: Nome (CmsCombo) → grupo →
   * adicionar 1 preset (força, só precisa de nome) → Guardar.
   * Usar com o tenantA/tenantB (que têm grupo semeado).
   */
  async createExercise(opts: { name: string; group: string; preset?: string }) {
    await this.openNewExercise();
    const dialog = this.page.locator('[role="dialog"]');
    // Nome do exercício (CmsCombo — input com placeholder "Escrever nome…").
    await dialog.getByPlaceholder(/escrever nome/i).fill(opts.name);
    // Grupo muscular: Combobox (botão que abre opções num portal).
    await dialog.getByRole("button", { name: /escolher grupo/i }).click();
    await this.page.getByRole("option", { name: opts.group }).first().click();
    // Adicionar um preset de força (basta o nome).
    await dialog.getByRole("button", { name: /adicionar preset/i }).click();
    await dialog.getByPlaceholder("Ex: Iniciante").fill(opts.preset ?? "Base");
    await dialog.getByRole("button", { name: /guardar preset/i }).click();
    // Guardar o exercício (botão do footer principal).
    await dialog.getByRole("button", { name: /^guardar$/i }).click();
    await expect(dialog).toHaveCount(0, { timeout: 12_000 });
  }

  async expectExerciseVisible(name: string) {
    await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 12_000 });
  }

  toastLocator() {
    return this.page.locator("[data-sonner-toast]");
  }

  // ── Mensalidades (cobranças do ginásio — vive na página Financeiro) ──
  // O menu "Mensalidades" foi movido para Financeiro → tab Ginásio
  // (/financeiro/ginasio, T1.2 — rota real); o `?vista=ginasio` legacy só
  // existe como deep-link de redirect (teste dedicado em financeiro.spec.ts).
  // O cockpit de Cobranças mostra os KPIs e o botão "Subscrições" abre o
  // catálogo numa modal.
  async openMensalidades() {
    await this.page.goto("/financeiro/ginasio");
    await this.page.waitForURL("**/financeiro**", { timeout: 15_000 });
    // Espera o cockpit de cobranças carregar (deixa de mostrar "A carregar…").
    await this.page.getByText(/cobranças das mensalidades/i).waitFor({ timeout: 10_000 });
  }

  async openSubscricoesSubtab() {
    await this.page.getByRole("button", { name: /^subscrições$/i }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  }

  /** KPI "Recebido" do cockpit de cobranças (recebido / previsto do mês). */
  kpiRecebido() {
    return this.page.getByText(/^recebido$/i).first();
  }

  async createSubscription(name: string, price: string) {
    // Abre a modal aninhada "Nova subscrição" (dentro da modal Subscrições).
    await this.page.getByRole("button", { name: /nova subscrição/i }).first().click();
    // A modal aninhada tem o título "Nova subscrição" — espera por ela.
    await expect(
      this.page.getByRole("heading", { name: /nova subscrição/i }),
    ).toBeVisible({ timeout: 5_000 });
    await this.page.getByLabel(/nome/i).fill(name);
    await this.page.getByLabel(/preço/i).fill(price);
    await this.page.getByRole("button", { name: /^criar$/i }).click();
    // A modal aninhada fecha; a modal Subscrições (exterior) fica aberta e mostra
    // o novo cartão. Espera o título da modal aninhada desaparecer.
    await expect(
      this.page.getByRole("heading", { name: /nova subscrição/i }),
    ).toBeHidden({ timeout: 8_000 });
  }

  // ── Mensalidade por membro (painel ClienteMensalidade) ──────────────────────
  // O painel de mensalidade de um cliente (subscrição + mês corrente + toggles
  // "Bloqueado"/"Só paga") vive na ficha do cliente, na tab Ginásio. É o mesmo
  // componente que a vista de membro dentro de Mensalidades.

  /**
   * Cria um cliente (na página Clientes), abre a ficha e vai à tab Ginásio, onde
   * aparece o painel de mensalidade do membro. Devolve o nome criado.
   */
  async openMemberMensalidade(name: string): Promise<void> {
    await this.page.goto("/clientes");
    await this.page.waitForURL("**/clientes", { timeout: 15_000 });
    // Cria o cliente (o tenant admin do e2e começa sem clientes).
    await this.page.getByRole("button", { name: /novo cliente/i }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
    await this.page.locator('[role="dialog"] input').first().fill(name);
    await this.page.locator('[role="dialog"] button[type="submit"]').first().click();
    await this.page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8_000 });
    // Abre a ficha do cliente e a tab Ginásio.
    await this.page.getByPlaceholder(/procurar por nome/i).fill(name);
    await this.page.waitForTimeout(400);
    await this.page.locator("table tr").filter({ hasText: name }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
    await this.page.getByRole("tab", { name: /ginásio/i }).click();
    // Espera o painel de mensalidade carregar (deixa de mostrar "A carregar").
    await expect(
      this.page.locator('[role="dialog"]').getByText(/sem mensalidade|mês corrente/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** Reabre a ficha do cliente `name` na tab Ginásio (sem recriar). */
  async reopenMemberMensalidade(name: string): Promise<void> {
    await this.page.goto("/clientes");
    await this.page.waitForURL("**/clientes", { timeout: 15_000 });
    await this.page.getByPlaceholder(/procurar por nome/i).fill(name);
    await this.page.waitForTimeout(400);
    await this.page.locator("table tr").filter({ hasText: name }).first().click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
    await this.page.getByRole("tab", { name: /ginásio/i }).click();
    await expect(
      this.page.locator('[role="dialog"]').getByText(/sem mensalidade|mês corrente/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Toggle "Só paga (sem app)" no painel de mensalidade do membro. Localiza a
   * linha pelo texto e o switch adjacente (o painel tem 2 switches: Bloqueado e
   * Só paga — este é o segundo, junto ao texto "Só paga").
   */
  payOnlyToggle(): Locator {
    return this.page
      .locator('[role="dialog"] div')
      .filter({ hasText: /Só paga \(sem app\)/ })
      .getByRole("switch")
      .last();
  }

  async setPayOnly(on: boolean): Promise<void> {
    const t = this.payOnlyToggle();
    const isOn = (await t.getAttribute("aria-checked")) === "true";
    if (isOn !== on) {
      await t.click();
      await expect(t).toHaveAttribute("aria-checked", String(on), { timeout: 6_000 });
    }
  }

  /** Localiza o painel "Mês corrente" (KPI de mensalidade do membro). */
  mesCorrente(): Locator {
    return this.page.locator('[role="dialog"]').getByText(/mês corrente/i).first();
  }

  semMensalidade(): Locator {
    return this.page.locator('[role="dialog"]').getByText(/sem mensalidade/i).first();
  }
}
