import { type Page } from "@playwright/test";

export class WebsitePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/website");
    await this.page.waitForURL("**/website", { timeout: 15_000 });
  }

  header() {
    return this.page.getByRole("heading", { name: "Website", level: 1 });
  }

  /** Subitens da sidebar (T2.3): O meu site (âncora) · Template · Páginas · Marca · Rodapé & Nav · Domínio — botões do submenu, não role="tab". */
  private static PATH_BY_LABEL: Record<string, string> = {
    "O meu site": "/website",
    Template: "/website/template",
    Páginas: "/website/paginas",
    Marca: "/website/marca",
    "Rodapé & Nav": "/website/rodape-nav",
    Domínio: "/website/dominio",
  };

  tab(label: string) {
    return this.page.locator("nav").first().getByRole("button", { name: label, exact: true });
  }

  async goToTab(label: string) {
    await this.tab(label).first().click();
    const path = WebsitePage.PATH_BY_LABEL[label];
    if (path) await this.page.waitForURL(`**${path}`, { timeout: 10_000 });
    await this.page.waitForTimeout(200);
  }
}
