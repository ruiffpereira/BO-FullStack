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

  logoutButton() {
    return this.page.locator('button', { hasText: "Terminar sessão" });
  }
}
