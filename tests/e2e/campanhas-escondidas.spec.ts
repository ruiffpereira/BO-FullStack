import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";

/**
 * FEATURES.campaigns = false (dono 2026-10-24): o Correio não tem o separador «Campanhas» e as rotas
 * `/correio/campanhas*` redireccionam para o Correio. Nas 3 larguras, com captura.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const SIZES = [
  { w: 1440, h: 900 },
  { w: 834, h: 1112 },
  { w: 390, h: 844 },
];

for (const { w, h } of SIZES) {
  test.describe(`Correio sem Campanhas (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("/correio/campanhas e /nova redireccionam para o Correio, sem scroll horizontal", async ({ page, context }) => {
      await loginAs(context, "correio@e2e.local");
      for (const r of ["/correio/campanhas", "/correio/campanhas/nova"]) {
        await page.goto(r);
        await expect(page).toHaveURL(/\/correio$/, { timeout: 15_000 });
        await expect(page.getByTestId("campaigns-locked")).toHaveCount(0);
      }
      await expect(page.getByTestId("correio-caixa").or(page.getByTestId("mail-not-configured")).or(page.getByTestId("mail-no-mailbox"))).toBeVisible({ timeout: 15_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `.capturas/ronda-grande/capturas/campanhas-escondidas-${w}.png` });
    });

    test("o menu do Correio não tem «Campanhas»; Contactos continua", async ({ page, context }) => {
      test.skip(w < 1024, "abaixo de lg o menu é uma gaveta (o redirect acima cobre o acesso directo)");
      await loginAs(context, "correio@e2e.local");
      await page.goto("/correio");
      await expect(page.getByRole("navigation").getByText("Contactos", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("navigation").getByText("Campanhas", { exact: true })).toHaveCount(0);
    });
  });
}
