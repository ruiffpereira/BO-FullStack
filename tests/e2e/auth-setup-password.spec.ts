import { test, expect } from "@playwright/test";

// Token semeado em scripts/seedE2e.ts (E2E_SETUP_TOKEN) para o user "novo@e2e".
const TOKEN = "e2e-setup-token-fixed-0001";
const NEW_PW = "NovaPass123!";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth — definir password no 1º acesso", () => {
  test("user novo define a password via /setup-password e depois faz login", async ({ page }) => {
    await page.goto(`/setup-password?token=${TOKEN}`);

    const pw = page.locator('input[type="password"]');
    await expect(pw.first()).toBeVisible({ timeout: 10_000 });
    await pw.first().fill(NEW_PW);
    await pw.nth(1).fill(NEW_PW);
    await page.getByRole("button", { name: /definir password/i }).click();

    // Após definir, faz login com a nova password → dashboard.
    await page.waitForTimeout(1_500);
    await page.goto("/");
    await page.waitForSelector('input[autocomplete="username"]', { timeout: 10_000 });
    await page.fill('input[autocomplete="username"]', "novo@e2e");
    await page.fill('input[autocomplete="current-password"]', NEW_PW);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  // B5: token inexistente/expirado — a API responde 400 "Token inválido ou
  // expirado" (`setupPassword`, userController.ts). A UI só mostra o ecrã
  // "Link inválido" quando falta o parâmetro `token` na URL (SetupPassword.tsx);
  // com um token PRESENTE mas rejeitado pelo servidor, o formulário fica
  // visível e submete — o erro tem de aparecer no próprio formulário (getApiError),
  // sem crash, e SEM avançar para o estado "Password definida!".
  test("token inválido/expirado → mostra erro no formulário, não crasha, não deixa definir password", async ({ page }) => {
    await page.goto("/setup-password?token=e2e-token-inexistente-9999");

    const pw = page.locator('input[type="password"]');
    await expect(pw.first()).toBeVisible({ timeout: 10_000 });
    await pw.first().fill(NEW_PW);
    await pw.nth(1).fill(NEW_PW);
    await page.getByRole("button", { name: /definir password/i }).click();

    await expect(page.getByText(/token inválido ou expirado/i)).toBeVisible({ timeout: 10_000 });
    // Continua no formulário — não avançou para o ecrã de sucesso.
    await expect(page.getByText("Password definida!")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /definir password/i })).toBeVisible();
  });
});
