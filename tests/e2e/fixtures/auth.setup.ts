import { test as setup } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, "../.auth/user.json");

// Ensure the .auth directory exists before saving storage state
fs.mkdirSync(path.dirname(authFile), { recursive: true });

setup("authenticate", async ({ page }) => {
  const user = process.env.TEST_USER ?? "admin";
  const pass = process.env.TEST_PASSWORD ?? "";

  await page.goto("/");

  // Wait for login form (app may show spinner while restoring session)
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 15_000 });

  await page.fill('input[autocomplete="username"]', user);
  await page.fill('input[autocomplete="current-password"]', pass);
  await page.click('button[type="submit"]');

  // Wait for dashboard — confirms login succeeded
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.context().storageState({ path: authFile });
});
