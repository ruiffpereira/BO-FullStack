import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { loginAs, API } from "./fixtures/login";

/**
 * B59 F7 — BI-04 (os dias grátis vêm da API) e CR-34 (texto do segmento «Sócios activos»).
 *
 * ⚠ O registo self-serve está escondido por decisão do dono (`FEATURES.signup = false`, lib/features.ts): `/signup`
 * redirecciona para o login, por isso o texto «N dias grátis» do `Signup.tsx` não é alcançável na UI de teste.
 * Prova-se aqui o que é alcançável: o contrato `GET /billing/trial` (a fonte do número) e que a rota escondida
 * continua escondida sem mostrar texto de trial. Quando `signup` voltar a `true`, acrescentar os casos de UI.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const SIZES = [
  { w: 1440, h: 900 },
  { w: 834, h: 1112 },
  { w: 390, h: 844 },
];
const noHScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("BI-04: GET /billing/trial é público e devolve trialDays inteiro >= 0", async () => {
  const anon = await pwRequest.newContext();
  const res = await anon.get(`${API}/billing/trial`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Number.isInteger(body.trialDays)).toBe(true);
  expect(body.trialDays).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(body)).not.toMatch(/undefined|null/);
});

for (const { w, h } of SIZES) {
  test.describe(`B59 F7 (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("BI-04: /signup está escondido (redirecciona para o login) e não mostra texto de trial", async ({ page }) => {
      await page.goto("/signup");
      await expect(page.getByRole("button", { name: /entrar/i }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/dias? grátis|Experimenta grátis|undefined/)).toHaveCount(0);
      expect(await noHScroll(page)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `.capturas/ronda-grande/capturas/b59f7-signup-${w}.png` });
    });

    test("CR-34: o segmento «Sócios activos» diz «Subscritos com subscrição activa e conta confirmada»", async ({ page, context }) => {
      test.skip(true, "FEATURES.campaigns = false (dono 2026-10-24)");
      await loginAs(context, "correio@e2e.local");
      // O seed não tem domínio verificado (assistente bloqueado): abre-se o assistente com o estado simulado.
      await page.route("**/mail/campaigns/status", (route) =>
        route.fulfill({ json: { available: true, paused: false, testDailyLimit: 10, fromDomain: "e2e.test" } }),
      );
      await page.goto("/correio/campanhas/nova");
      await expect(page.getByTestId("campaign-wizard")).toBeVisible({ timeout: 15_000 });
      await page.getByLabel("Quem recebe").selectOption("members_active");
      const body = page.getByTestId("campaign-step-body-destinatarios");
      await expect(body.getByText("Subscritos com subscrição activa e conta confirmada.")).toBeVisible();
      await expect(body.getByText(/Subscritos com subscrição activa e conta confirmada\./)).toHaveCount(1);
      expect(await noHScroll(page)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `.capturas/ronda-grande/capturas/b59f7-segmento-${w}.png` });
    });
  });
}
