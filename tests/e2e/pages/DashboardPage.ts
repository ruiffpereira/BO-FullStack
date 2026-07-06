import { type Page, expect } from "@playwright/test";

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/dashboard");
  }

  async waitForLoad() {
    await this.page.waitForURL("**/dashboard", { timeout: 15_000 });
    // Wait for spinner to disappear (auth initializing)
    await this.page.waitForSelector(".animate-spin", { state: "detached", timeout: 10_000 }).catch(() => {});
  }

  sidebar() {
    return this.page.locator("aside").first();
  }

  navItem(name: string) {
    return this.page.locator(`nav button`, { hasText: name });
  }

  async expectNavVisible(name: string) {
    await expect(this.navItem(name)).toBeVisible();
  }

  async expectNavHidden(name: string) {
    await expect(this.navItem(name)).not.toBeVisible();
  }

  // Terminar sessão vive só no menu do avatar (topbar) — a sidebar deixou de
  // ter um botão de logout próprio (era duplicado com o AvatarMenu, T3.3).
  // Abrir o menu é um passo prévio explícito porque o item só existe no DOM
  // enquanto o menu está aberto (portal condicional).
  async openAccountMenu() {
    await this.page.getByRole("button", { name: "Menu da conta" }).click();
  }

  logoutButton() {
    return this.page.getByRole("menuitem", { name: "Terminar sessão" });
  }
}
