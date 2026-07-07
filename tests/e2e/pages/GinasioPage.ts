import { type Page, type Locator, expect } from "@playwright/test";

export class GinasioPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/ginasio");
    await this.page.waitForURL("**/ginasio", { timeout: 15_000 });
  }

  header() {
    // Título vive agora no topbar (Shell.tsx, h2).
    return this.page.getByRole("heading", { name: "Ginásio", level: 2 });
  }

  /**
   * Subitens da sidebar (T2.5): Exercícios · Dia de Treino · Planos ·
   * Progresso de clientes — botões do submenu, não `role="tab"`. O último NÃO
   * se chama "Clientes" de propósito (evita colidir com o item core
   * `/clientes` da sidebar quando o grupo Ginásio está expandido — ver
   * `src/lib/navigation.ts`).
   */
  private static PATH_BY_LABEL: Record<string, string> = {
    Exercícios: "/ginasio",
    "Dia de Treino": "/ginasio/treinos",
    Planos: "/ginasio/planos",
    "Progresso de clientes": "/ginasio/clientes",
  };

  tab(label: string) {
    return this.page.locator("nav").first().getByRole("button", { name: label, exact: true });
  }

  async goToTab(label: string) {
    await this.tab(label).first().click();
    const path = GinasioPage.PATH_BY_LABEL[label];
    if (path) await this.page.waitForURL(`**${path}`, { timeout: 10_000 });
    await this.page.waitForTimeout(200);
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
   * o modal já abre com 1 rascunho de preset pronto a preencher (T-preset-refino,
   * 2026-07-07) — só falta o nome do preset + séries/reps (gate novo: sem
   * reps+séries preenchidos o botão "Criar exercício" fica desativado) → Criar
   * exercício (o rascunho de preset aberto é comitado automaticamente pelo botão
   * final — UM só clique, não há "Guardar preset" separado).
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
    // O rascunho de preset já vem aberto — só preencher nome + séries + reps
    // (mínimo agora exigido pelo gate do botão "Criar exercício").
    await dialog.getByPlaceholder("Ex: Iniciante").fill(opts.preset ?? "Base");
    await dialog.getByLabel(/^séries$/i).fill("3");
    await dialog.getByLabel(/^reps$/i).fill("10");
    // Criar o exercício (botão único do footer — comita o preset + guarda).
    await dialog.getByRole("button", { name: /criar exercício/i }).click();
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
