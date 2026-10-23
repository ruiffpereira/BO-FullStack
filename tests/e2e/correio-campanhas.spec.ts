import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { loginAs, nextClientIp, API, E2E_PASSWORD } from "./fixtures/login";

/**
 * Correio → Campanhas (B42 · fase 9), nas 3 larguras (1440 / 834 / 390).
 *
 * O tenant `correio@e2e.local` do seed só tem o endereço da plataforma (código `selo`) verificado (ou, no máximo, um domínio próprio
 * sem `news.` verificado — o `correio-contactos.spec.ts` regista um). Em qualquer dos casos as campanhas estão BLOQUEADAS
 * e é isso que se prova: a mensagem do `GET /mail/campaigns/status`, nenhum botão «Nova campanha», e a API a recusar a
 * criação de um rascunho com 409 `CAMPAIGNS_LOCKED`. Criar/enviar uma campanha precisa de domínio próprio + `news.`
 * verificados no Resend, coisa que o ambiente de teste não simula — essa cadeia fica nos testes unitários.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const DONO = "correio@e2e.local";
const BLOQUEIO = "Disponível quando o teu domínio estiver configurado.";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 834, h: 1112 },
  { w: 390, h: 844 },
];

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("a API recusa criar rascunhos sem domínio verificado (409 CAMPAIGNS_LOCKED) e o status explica", async () => {
  const anon = await pwRequest.newContext();
  const res = await anon.post(`${API}/users/login`, {
    data: { username: DONO, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${DONO} (${res.status()}) — falta o tenant no seed do e2e`).toBeTruthy();
  const { accessToken } = await res.json();
  await anon.dispose();

  const ctx = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` } });
  const status = await ctx.get(`${API}/mail/campaigns/status`);
  expect(status.status()).toBe(200);
  const body = await status.json();
  expect(body.available).toBe(false);
  expect(body.message).toBe(BLOQUEIO);

  const create = await ctx.post(`${API}/mail/campaigns`, { data: { name: "E2E bloqueada" } });
  expect(create.status()).toBe(409);
  expect((await create.json()).code).toBe("CAMPAIGNS_LOCKED");
  await ctx.dispose();
});

for (const { w, h } of SIZES) {
  test.describe(`Correio — Campanhas (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("sem domínio configurado: a mensagem de bloqueio, sem «Nova campanha» e sem scroll horizontal", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio/campanhas");
      const locked = page.getByTestId("campaigns-locked");
      await expect(locked).toBeVisible({ timeout: 15_000 });
      await expect(locked).toContainText(BLOQUEIO);
      await expect(page.getByRole("button", { name: "Nova campanha" })).toHaveCount(0);
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("a ligação directa ao assistente também fica bloqueada", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio/campanhas/nova");
      await expect(page.getByTestId("campaigns-locked")).toContainText(BLOQUEIO, { timeout: 15_000 });
      await expect(page.getByTestId("campaign-wizard")).toHaveCount(0);
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("o subitem «Campanhas» está no menu do Correio", async ({ page, context }) => {
      test.skip(w < 1024, "abaixo de lg o menu é uma gaveta (testa-se o acesso directo acima)");
      await loginAs(context, DONO);
      await page.goto("/correio");
      await expect(page.getByTestId("correio-caixa").or(page.getByTestId("mail-not-configured")).or(page.getByTestId("mail-no-mailbox"))).toBeVisible({ timeout: 15_000 });
      await page.getByRole("navigation").getByText("Campanhas", { exact: true }).first().click();
      await expect(page).toHaveURL(/\/correio\/campanhas$/);
      await expect(page.getByTestId("campaigns-locked")).toBeVisible({ timeout: 15_000 });
    });
  });
}
