import { type Page, type Locator, expect } from "@playwright/test";

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

  // ── Marcações (lista + filtro por intervalo de datas) ───────────────────────

  /** Abre a página da Agenda e vai à tab Marcações. */
  async openMarcacoes(): Promise<void> {
    await this.goto();
    await this.goToTab("Marcações");
    // Espera a barra de filtros (label "De"/"Até") aparecer.
    await expect(this.page.getByText("De", { exact: true })).toBeVisible({ timeout: 10_000 });
  }

  /** Locator do contador "N marcações"/"N marcação" acima da tabela. */
  countLabel(): Locator {
    return this.page.getByText(/\d+\s+marcaç(ão|ões)/i).first();
  }

  /** Lê o número de marcações mostrado no contador. */
  async count(): Promise<number> {
    const txt = await this.countLabel().textContent();
    const m = txt?.match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  /** Linha da tabela (tr) que contém o texto dado. */
  row(text: string): Locator {
    return this.page.locator("tr").filter({ hasText: text });
  }

  emptyState(): Locator {
    return this.page.getByText(/nenhuma marcação encontrada/i);
  }

  /**
   * Escolhe uma data ISO (yyyy-MM-dd) num DatePicker do filtro.
   * `which` = "de" (primeiro picker) ou "ate" (segundo). Navega o calendário
   * (react-day-picker) até ao mês certo e clica o dia por `data-day` (robusto).
   */
  async setRangeDate(which: "de" | "ate", iso: string): Promise<void> {
    // O picker "De"/"Até" está no container do respetivo label: um <div> com o
    // <p> do label + o DatePicker. Sobe do label ao container e clica o botão.
    const label = which === "de" ? "De" : "Até";
    const field = this.page
      .getByText(label, { exact: true })
      .locator("xpath=..");
    await field.getByRole("button").first().click();

    const cal = this.page.locator(".rdp-root").last();
    await expect(cal).toBeVisible({ timeout: 5_000 });

    const [y, mo] = iso.split("-").map(Number);
    const targetYm = `${y}-${String(mo).padStart(2, "0")}`;

    // Navega até o dia-alvo estar visível como célula do próprio mês (não outside).
    const dayCell = () => cal.locator(`td[data-day="${iso}"]:not([data-outside]) button`);
    for (let i = 0; i < 24; i++) {
      if (await dayCell().count()) break;
      // Mês visível = data-day da 1.ª célula do próprio mês (ignora outside days).
      const shownDay = await cal
        .locator("td[data-day]:not([data-outside])")
        .first()
        .getAttribute("data-day");
      const shown = shownDay ? shownDay.slice(0, 7) : targetYm;
      const goBack = targetYm < shown;
      await cal
        .locator(goBack ? ".rdp-button_previous" : ".rdp-button_next")
        .click();
      await this.page.waitForTimeout(150);
    }
    await dayCell().first().click();
    // O calendário fecha ao escolher; espera o portal desaparecer.
    await expect(cal).toBeHidden({ timeout: 5_000 });
  }

  /** Aplica um intervalo De/Até (ambos ISO yyyy-MM-dd). */
  async applyRange(from: string, to: string): Promise<void> {
    await this.setRangeDate("de", from);
    await this.setRangeDate("ate", to);
    await this.page.waitForTimeout(300);
  }

  /** Botão "Limpar filtros" (só aparece com filtros ativos). */
  async clearFilters(): Promise<void> {
    await this.page.getByRole("button", { name: /limpar filtros/i }).click();
    await this.page.waitForTimeout(300);
  }
}
