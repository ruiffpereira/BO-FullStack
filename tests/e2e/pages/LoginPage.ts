import { type Page } from "@playwright/test";

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/");
  }

  async fillCredentials(username: string, password: string) {
    await this.page.fill('input[autocomplete="username"]', username);
    await this.page.fill('input[autocomplete="current-password"]', password);
  }

  async submit() {
    await this.page.click('button[type="submit"]');
  }

  async login(username: string, password: string) {
    await this.fillCredentials(username, password);
    await this.submit();
  }

  errorMessage() {
    return this.page.locator("p.text-red-500");
  }

  submitButton() {
    return this.page.locator('button[type="submit"]');
  }

  async waitForLoginForm() {
    await this.page.waitForSelector('input[autocomplete="username"]', { timeout: 15_000 });
  }
}
