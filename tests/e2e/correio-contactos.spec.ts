import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { loginAs, nextClientIp, API, E2E_PASSWORD } from "./fixtures/login";

/**
 * Correio → Contactos, password da app da Caixa e «Aceita novidades» na ficha do cliente (B42 · fases 7 e 8),
 * nas 3 larguras (1440 / 834 / 390).
 *
 * A API do e2e corre com `ENVIRONMENT=TEST`: caixas e domínios são SIMULADOS (nada fala com o Stalwart nem com o Resend).
 *
 * ⚠ DEPENDE DO SEED (`API-FullStack/scripts/seedE2e.ts`): o tenant `correio@e2e.local` (VIEW_EMAIL + VIEW_CUSTOMERS, com o
 * cliente «Cliente Correio» / cliente.correio@example.com). É o mesmo do `correio.spec.ts`. Sem ele, o `beforeAll`
 * falha no login do dono — é de propósito: o motivo aparece logo e claro.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const DONO = "correio@e2e.local";
const ADMIN = "admin@e2e.local";
const CLIENTE_NOME = "Cliente Correio";
const CLIENTE_EMAIL = "cliente.correio@example.com";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 834, h: 1112 },
  { w: 390, h: 844 },
];

type Login = { userId: string; accessToken: string };

async function apiLogin(username: string): Promise<Login> {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/users/login`, {
    data: { username, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(
    res.ok(),
    `login de ${username} (${res.status()}) — falta o tenant «${DONO}» no seed do e2e (ver o cabeçalho deste spec)`,
  ).toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return { userId: body.userId, accessToken: body.accessToken };
}

/** O que o Admin faria: domínio de email do negócio + caixa do negócio (ambos idempotentes). */
test.beforeAll(async () => {
  const admin = await apiLogin(ADMIN);
  const dono = await apiLogin(DONO);
  const ctx = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${admin.accessToken}` } });
  const dom = await ctx.put(`${API}/admin/users/${dono.userId}/email-domain`, { data: { domain: "correio-e2e.example.pt" } });
  expect([200, 201, 409]).toContain(dom.status());
  const box = await ctx.post(`${API}/admin/users/${dono.userId}/mailboxes/business`, { data: {} });
  expect([200, 201], `caixa do negócio (${box.status()})`).toContain(box.status());
  await ctx.dispose();
});

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const { w, h } of SIZES) {
  test.describe(`Correio — Contactos e consentimento (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h } });
    const email = `importado-${w}-${Date.now()}@example.com`;

    test("Contactos: a página abre, com contadores e sem scroll horizontal", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio/contactos");
      await expect(page.getByTestId("correio-contactos")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("contacts-count-subscribed")).toBeVisible();
      await expect(page.getByRole("button", { name: "Importar CSV" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Exportar" })).toBeVisible();
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("importar CSV: só avança com o consentimento confirmado e mostra o relatório das recusadas", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio/contactos");
      await page.getByRole("button", { name: "Importar CSV" }).click();
      const dialog = page.getByRole("dialog", { name: "Importar contactos" });
      await dialog.getByLabel("Conteúdo do CSV").fill(`email,nome,etiquetas\n${email},Importado ${w},e2e\nnao-e-um-email,Falha,\n`);
      await dialog.getByRole("button", { name: "Continuar" }).click();

      // Passo de confirmação: sem a caixa marcada o botão Importar não se activa.
      const importar = dialog.getByRole("button", { name: "Importar", exact: true });
      await expect(importar).toBeDisabled();
      await dialog.getByRole("checkbox", { name: /Confirmo que estes contactos deram consentimento/ }).check();
      await expect(importar).toBeEnabled();
      await importar.click();

      const relatorio = dialog.getByTestId("import-report");
      await expect(relatorio).toBeVisible({ timeout: 15_000 });
      await expect(relatorio.getByTestId("import-skipped-row")).toHaveCount(1);
      await expect(relatorio.getByTestId("import-skipped-row")).toContainText("Email inválido");
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      await dialog.getByRole("button", { name: "Fechar" }).first().click();

      // O novo contacto está na lista: Subscrito, origem Importação, com a etiqueta.
      await page.getByLabel("Pesquisar contactos").fill(email);
      const linha = page.getByTestId("contact-row").filter({ hasText: email });
      await expect(linha).toBeVisible({ timeout: 10_000 });
      await expect(linha.getByTestId("contact-status")).toContainText("Subscrito");
      await expect(linha).toContainText("Importação");
      await expect(linha.getByTestId("contact-tags")).toContainText("e2e");
    });

    test("editar etiquetas e anular a subscrição (com confirmação)", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio/contactos");
      await page.getByLabel("Pesquisar contactos").fill(email);
      const linha = page.getByTestId("contact-row").filter({ hasText: email });
      await expect(linha).toBeVisible({ timeout: 15_000 });

      await linha.getByRole("button", { name: `Etiquetas de ${email}` }).click();
      const edit = page.getByRole("dialog", { name: "Etiquetas e dados" });
      await edit.getByLabel("Etiquetas").fill("e2e, vip");
      await edit.getByRole("button", { name: "Guardar" }).click();
      await expect(linha.getByTestId("contact-tags")).toContainText("vip", { timeout: 10_000 });

      await linha.getByRole("button", { name: `Anular subscrição de ${email}` }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Anular subscrição" }).click();
      await expect(linha.getByTestId("contact-status")).toContainText("Não subscrito", { timeout: 10_000 });
    });

    test("Exportar descarrega um CSV", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio/contactos");
      await expect(page.getByTestId("correio-contactos")).toBeVisible({ timeout: 15_000 });
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar" }).click();
      expect((await download).suggestedFilename()).toMatch(/^contactos-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    test("ficha do cliente: «Aceita novidades por email» entra nos Contactos com origem Balcão", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/clientes");
      await page.getByText(CLIENTE_NOME, { exact: false }).first().click();
      const dialog = page.getByRole("dialog");
      const sw = dialog.getByRole("switch", { name: "Aceita novidades por email" });
      await expect(sw).toBeVisible({ timeout: 15_000 });

      // Parte sempre de «desligado» (as larguras anteriores podem tê-lo deixado ligado).
      if ((await sw.getAttribute("aria-checked")) === "true") {
        await sw.click();
        await expect(sw).toHaveAttribute("aria-checked", "false", { timeout: 10_000 });
      }
      await sw.click();
      await expect(sw).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });
      await expect(dialog.getByTestId("customer-newsletter-detail")).toContainText("Balcão");
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);

      await page.goto("/correio/contactos");
      await page.getByLabel("Pesquisar contactos").fill(CLIENTE_EMAIL);
      const linha = page.getByTestId("contact-row").filter({ hasText: CLIENTE_EMAIL });
      await expect(linha).toBeVisible({ timeout: 15_000 });
      await expect(linha.getByTestId("contact-status")).toContainText("Subscrito");
      await expect(linha).toContainText("Balcão");
    });

    test("Caixa: a password da app aparece uma vez e não volta; revogar limpa", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio");
      await expect(page.getByTestId("mail-split")).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Configurar no telemóvel" }).click();
      const dialog = page.getByRole("dialog", { name: "Configurar no telemóvel" });
      await expect(dialog.getByTestId("app-password-settings")).toBeVisible({ timeout: 10_000 });

      // Começa limpo: revoga as que houver (idempotente).
      const revogar = dialog.getByRole("button", { name: "Revogar passwords da app" });
      if (await revogar.isVisible()) {
        await revogar.click();
        await page.getByRole("dialog").last().getByRole("button", { name: "Revogar" }).click();
        await expect(dialog.getByText("Sem passwords da app")).toBeVisible({ timeout: 10_000 });
      }

      await dialog.getByRole("button", { name: "Gerar password da app" }).click();
      const pass = dialog.getByTestId("app-password-value");
      await expect(pass).toBeVisible({ timeout: 10_000 });
      expect(((await pass.textContent()) ?? "").trim().length).toBeGreaterThanOrEqual(16);
      await expect(dialog.getByTestId("app-password-warning")).toContainText("não volta a aparecer");
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);

      // Fechar e reabrir: a password já não está lá, só o estado (1 activa).
      await dialog.getByRole("button", { name: "Fechar" }).first().click();
      await page.getByRole("button", { name: "Configurar no telemóvel" }).click();
      await expect(page.getByTestId("app-password-value")).toHaveCount(0);
      await expect(page.getByText("1 password da app activa")).toBeVisible({ timeout: 10_000 });

      await page.getByRole("button", { name: "Revogar passwords da app" }).click();
      await page.getByRole("dialog").last().getByRole("button", { name: "Revogar" }).click();
      await expect(page.getByText("Sem passwords da app")).toBeVisible({ timeout: 10_000 });
    });
  });
}
