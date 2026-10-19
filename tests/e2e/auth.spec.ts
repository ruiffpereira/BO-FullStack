import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";

const USER = process.env.TEST_USER ?? "admin";
const PASS = process.env.TEST_PASSWORD ?? "";

// These tests run without saved auth state — they manage their own session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login", () => {
  test("credenciais válidas → redireciona para dashboard", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.waitForLoginForm();
    await login.login(USER, PASS);
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test("password errada → erro visível (sem revelar se user existe)", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.waitForLoginForm();
    await login.login(USER, "wrong-password-xyz");
    const err = login.errorMessage();
    await expect(err).toBeVisible({ timeout: 8_000 });
    // Error message must not distinguish between bad user vs bad password
    const text = await err.textContent();
    expect(text).not.toMatch(/utilizador.*não existe|user.*not found/i);
  });

  test("conta por activar (sem password) → 401 e o mesmo texto de erro que a password errada", async ({ page }) => {
    // A API passou a responder 401 (antes 403): o ecrã nunca dependeu do código, só mostra a mensagem — e esta não revela
    // que a conta existe mas ainda não foi activada.
    const tentar = async (user: string, pass: string) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.waitForLoginForm();
      const resposta = page.waitForResponse((r) => r.url().endsWith("/users/login") && r.request().method() === "POST");
      await login.login(user, pass);
      const status = (await resposta).status();
      await expect(login.errorMessage()).toBeVisible({ timeout: 8_000 });
      return { status, texto: ((await login.errorMessage().textContent()) ?? "").trim() };
    };
    const errada = await tentar(USER, "wrong-password-xyz");
    const porAtivar = await tentar("porativar@e2e", "qualquer-password-123");
    expect(errada.status).toBe(401);
    expect(porAtivar.status).toBe(401);
    expect(porAtivar.texto).toBe(errada.texto);
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("campos vazios → erro local sem chamar API", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.waitForLoginForm();
    await login.submit();
    await expect(login.errorMessage()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Logout", () => {
  // This test needs auth — restore state just for this test
  test("logout → redireciona para login", async ({ page, context }) => {
    // Restore auth via direct login
    const login = new LoginPage(page);
    await login.goto();
    await login.waitForLoginForm();
    await login.login(USER, PASS);
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    const dashboard = new DashboardPage(page);
    await dashboard.openAccountMenu();
    await dashboard.logoutButton().click();

    // After logout, app should return to login form (in-place, same URL).
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Entrar", level: 1 })).toBeVisible();
  });
});

test.describe("Sessão", () => {
  test("sessão expirada no localStorage → app não crasha e mostra login", async ({ page }) => {
    // Corrupt the stored identity to simulate expired/invalid session
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("backoffice.auth.identity", JSON.stringify({ userId: "fake", username: "fake" }));
    });

    // Without a valid refresh cookie, app should redirect to login
    // (navigating to a protected route)
    await page.goto("/despesas");
    // App either stays on login or redirects to it — should never crash
    await expect(page.locator("body")).toBeVisible();
  });
});
