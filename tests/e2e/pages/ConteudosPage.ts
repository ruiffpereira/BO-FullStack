import { type Page } from "@playwright/test";

export class ConteudosPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/conteudos");
    await this.page.waitForURL("**/conteudos", { timeout: 15_000 });
  }

  header() {
    // Título vive agora no topbar (Shell.tsx, h2).
    return this.page.getByRole("heading", { name: "Conteúdos", level: 2 });
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

  /**
   * Subitens da sidebar (T2.6): Site público · Produtos* · Serviços* ·
   * Ginásio (nomes)* · Línguas · Emails · Notificações (*gated por permissão,
   * como as tabs antigas). Nenhum dos 4 primeiros pôde manter o nome "óbvio"
   * (Website/Loja/Agenda/Ginásio): colidiam com o nome acessível dos itens
   * homónimos da sidebar sempre que o subitem também está visível — mesmo
   * problema e solução do "Progresso de clientes" no Ginásio (T2.5). Ver
   * `src/lib/navigation.ts`.
   */
  private static PATH_BY_LABEL: Record<string, string> = {
    "Site público": "/conteudos",
    Produtos: "/conteudos/produtos",
    Serviços: "/conteudos/servicos",
    "Ginásio (nomes)": "/conteudos/ginasio",
    Línguas: "/conteudos/linguas",
    Emails: "/conteudos/emails",
    Notificações: "/conteudos/notificacoes",
  };

  tab(label: string) {
    return this.page.locator("nav").first().getByRole("button", { name: label, exact: true });
  }

  async goToTab(label: string) {
    await this.tab(label).first().click();
    const path = ConteudosPage.PATH_BY_LABEL[label];
    if (path) await this.page.waitForURL(`**${path}`, { timeout: 10_000 });
    await this.page.waitForTimeout(200);
  }
}
