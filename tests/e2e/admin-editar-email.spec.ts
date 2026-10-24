import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/auth"; // login como admin@e2e
import { E2E_PASSWORD } from "./fixtures/login";
import { AdminPage } from "./pages/AdminPage";

/**
 * Admin → Utilizadores → «Editar utilizador» (B59 F1).
 *
 * CT-18: mudar o email pede a password ACTUAL de quem está ligado (o admin): o campo «A tua password» só aparece quando o
 * email muda; sem ela o «Guardar» fica desactivado (com a dica visível); errada → 401 `INVALID_PASSWORD` → toast
 * «Password atual incorreta» e nada gravado; certa → grava. Uma conta já activada só muda de email pelo próprio
 * (403 `EMAIL_CHANGE_FORBIDDEN` → toast com o motivo).
 *
 * Cada largura cria o seu tenant (conta por activar, editável pelo admin), por isso não há estado partilhado.
 */
const SIZES = [
  { w: 1440, h: 900 },
  { w: 834, h: 1112 },
  { w: 390, h: 844 },
];
const SHOTS = path.resolve(".capturas", "ronda-grande", "capturas");

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const { w, h } of SIZES) {
  test.describe(`Editar utilizador — email + password (${w})`, () => {
    test.use({ viewport: { width: w, height: h } });

    test(`CT-18: o email só se muda com a password do admin (${w})`, async ({ page }) => {
      const admin = new AdminPage(page);
      const stamp = Date.now();
      const name = `ct18_${w}_${stamp}`;
      const email = `ct18_${w}_${stamp}@example.com`;
      const novoEmail = `ct18_novo_${w}_${stamp}@example.com`;

      await admin.goto();
      await admin.createUser({ username: name, email });
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });

      const row = await admin.userRowFromStart(name);
      await row.getByRole("button", { name: "Editar", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Editar utilizador" });
      await expect(dialog).toBeVisible();
      const emailInput = dialog.getByLabel("Email", { exact: true });
      await expect(emailInput).toHaveValue(email);
      const pass = dialog.getByLabel("A tua password");
      const guardar = dialog.getByRole("button", { name: "Guardar" });

      // Email por mudar → sem campo.
      await expect(pass).toHaveCount(0);
      await expect(guardar).toBeEnabled();

      // Muda o email → aparece o campo, com a dica; sem password não se grava.
      await emailInput.fill(novoEmail);
      await expect(pass).toBeVisible();
      await expect(dialog.getByText("Para mudar o email pedimos a tua password actual.")).toBeVisible();
      await expect(guardar).toBeDisabled();

      // Volta ao email original → o campo some.
      await emailInput.fill(email);
      await expect(pass).toHaveCount(0);
      await emailInput.fill(novoEmail);
      await expect(pass).toBeVisible();

      // Cabe: nada cortado, sem scroll horizontal (página nem modal).
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      for (const el of [pass, guardar, dialog.getByRole("button", { name: "Cancelar" })]) {
        await el.scrollIntoViewIfNeeded();
        await expect(el).toBeInViewport();
      }
      await page.screenshot({ path: path.join(SHOTS, `b59f1-editar-email-${w}.png`) });

      // Password errada → 401 → mensagem visível, o modal fica aberto.
      await pass.fill("password-errada-123");
      await expect(guardar).toBeEnabled();
      await guardar.click();
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Password atual incorreta" }).first()).toBeVisible({
        timeout: 8_000,
      });
      await expect(dialog).toBeVisible();
      await expect(pass).toBeVisible();

      // Password certa → grava, o modal fecha.
      await pass.fill(E2E_PASSWORD);
      await guardar.click();
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Actualizado" }).first()).toBeVisible({ timeout: 8_000 });
      await expect(dialog).toHaveCount(0, { timeout: 10_000 });

      // O novo email ficou gravado (a coluna Email esconde-se a 390: confirma no modal).
      const row2 = await admin.userRowFromStart(name);
      await row2.getByRole("button", { name: "Editar", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Editar utilizador" }).getByLabel("Email", { exact: true })).toHaveValue(novoEmail, {
        timeout: 10_000,
      });
    });
  });
}

test.describe("Editar utilizador — conta activada", () => {
  test("CT-18: o admin não muda o email de uma conta já activada (403 com o motivo)", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    const row = await admin.userRowFromStart("agenda@e2e");
    await row.getByRole("button", { name: "Editar", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Editar utilizador" });
    const emailInput = dialog.getByLabel("Email", { exact: true });
    const original = await emailInput.inputValue();
    await emailInput.fill(`outro_${Date.now()}@example.com`);
    await dialog.getByLabel("A tua password").fill(E2E_PASSWORD);
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: "só pode ser alterado pelo próprio utilizador" }).first(),
    ).toBeVisible({ timeout: 8_000 });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    // Nada foi gravado.
    const row2 = await admin.userRowFromStart("agenda@e2e");
    await row2.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Editar utilizador" }).getByLabel("Email", { exact: true })).toHaveValue(original);
  });
});
