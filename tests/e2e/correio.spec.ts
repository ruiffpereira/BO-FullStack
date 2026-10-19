import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { loginAs, nextClientIp, API, E2E_PASSWORD } from "./fixtures/login";

/**
 * Correio → Caixa (B42 · fases 5 e 6), nas 3 larguras (1440 / 834 / 390).
 *
 * A API do e2e corre com `ENVIRONMENT=TEST`: o fornecedor da caixa é o SIMULADOR em memória
 * (`API-FullStack/src/mail/index.ts` → `MemoryMailbox` quando `config.isTest`) e o dos domínios também — nada fala com o
 * Stalwart nem com o Resend. Um email enviado para fora aparece na pasta Enviados da própria caixa, por isso o fluxo
 * (escrever → abrir → responder) não precisa de correio de entrada.
 *
 * ⚠ DEPENDE DO SEED (`API-FullStack/scripts/seedE2e.ts`), que hoje NÃO tem o módulo Correio. Para este spec correr:
 *   1. acrescentar `"VIEW_EMAIL"` ao array `COMPONENTS` (a role Admin liga-se-lhe sozinha);
 *   2. um tenant `correio@e2e` (Users.name) / `correio@e2e.local`, não-admin, com a permissão {VIEW_EMAIL, VIEW_CUSTOMERS},
 *      um `Customer` de nome "Cliente Correio" com email `cliente.correio@example.com`;
 *   3. um membro activo desse tenant, `correio.ver@e2e.local` (password E2ePass123!), com os grants
 *      `correio.caixa` view + `clientes.lista` view (e NADA de edit).
 * O resto (domínio de email + caixa do negócio) provisiona-se aqui por API, como o Admin faria.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const DONO = "correio@e2e.local";
const RUN = Date.now().toString(36);
const MEMBRO_VER = "correio.ver@e2e.local";
const SEM_MODULO = "limited@e2e";
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
  expect(res.ok(), `login de ${username} (${res.status()})`).toBeTruthy();
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
  test.describe(`Correio — Caixa (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h } });
    // Único por corrida: a caixa (Stalwart) não é reposta pelo seed, e um assunto repetido deixaria duas linhas («Re: …» da corrida anterior).
    const assunto = `Horários de verão ${w} ${RUN}`;

    test("sem o módulo não há «Correio» na sidebar e o URL directo redirecciona", async ({ page, context }) => {
      await loginAs(context, SEM_MODULO);
      await page.goto("/correio");
      await expect(page).not.toHaveURL(/\/correio/, { timeout: 10_000 });
      await expect(page.locator("nav").getByRole("button", { name: /^Correio/ })).toHaveCount(0);
    });

    test("o dono abre a Caixa, escreve um email e vê-o nos Enviados", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio");
      await expect(page.getByTestId("mail-split")).toBeVisible({ timeout: 15_000 });
      for (const pasta of ["Por ler", "Todas", "Arquivo", "Enviados"]) {
        await expect(page.getByRole("tab", { name: new RegExp(pasta) })).toBeVisible();
      }

      await page.getByRole("button", { name: "Novo email" }).click();
      const dialog = page.getByRole("dialog", { name: "Novo email" });
      // Destinatário obrigatório: sem ele não segue e diz porquê.
      await dialog.getByLabel("Mensagem").fill("Olá!");
      await dialog.getByRole("button", { name: "Enviar" }).click();
      await expect(dialog.getByRole("alert")).toContainText("destinatário");

      await dialog.getByLabel("Para").fill(CLIENTE_EMAIL);
      await dialog.getByLabel("Assunto").fill(assunto);
      await dialog.getByLabel("Mensagem").fill("Abrimos das 9h às 20h durante o verão.");
      await dialog.getByRole("button", { name: "Enviar" }).click();
      await expect(page.getByText("Email enviado.")).toBeVisible({ timeout: 15_000 });

      await page.getByRole("tab", { name: "Enviados" }).click();
      const linha = page.getByTestId("mail-thread-row").filter({ hasText: assunto });
      await expect(linha).toBeVisible({ timeout: 10_000 });
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("abrir a conversa e responder (no telemóvel: lista → conversa em ecrãs separados)", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio?pasta=sent");
      const linha = page.getByTestId("mail-thread-row").filter({ hasText: assunto });
      await expect(linha).toBeVisible({ timeout: 15_000 });
      await linha.click();

      await expect(page.getByTestId("mail-thread-subject")).toHaveText(assunto);
      await expect(page.getByTestId("mail-message").first()).toContainText("Abrimos das 9h");
      // O HTML recebido (se houver) nunca corre scripts.
      for (const frame of await page.getByTestId("mail-html-frame").all()) {
        expect((await frame.getAttribute("sandbox")) ?? "").not.toContain("allow-scripts");
      }
      if (w < 1024) {
        // Ecrãs separados: a lista some enquanto a conversa está aberta, e «Voltar» traz a lista de volta.
        await expect(page.getByTestId("mail-thread-row").first()).toBeHidden();
        await page.getByRole("button", { name: "Voltar" }).click();
        await expect(page.getByTestId("mail-thread-row").first()).toBeVisible();
        await page.getByTestId("mail-thread-row").filter({ hasText: assunto }).click();
      }

      await page.getByRole("button", { name: "Responder", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Responder" });
      await dialog.getByLabel("Mensagem").fill("Obrigado, até breve!");
      await dialog.getByRole("button", { name: "Enviar" }).click();
      await expect(page.getByText("Email enviado.")).toBeVisible({ timeout: 15_000 });
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("ficha do cliente → separador Emails leva à conversa na Caixa", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/clientes");
      await page.getByText(CLIENTE_NOME, { exact: false }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("tab", { name: "Emails" }).click();
      const linha = dialog.getByTestId("mail-thread-row").filter({ hasText: assunto });
      await expect(linha).toBeVisible({ timeout: 10_000 });
      await linha.click();
      await expect(page).toHaveURL(/\/correio\?.*conversa=/);
      await expect(page.getByTestId("mail-thread-subject")).toHaveText(assunto, { timeout: 10_000 });
    });

    test("membro só com «Ver»: lê a conversa mas não responde, não arquiva nem marca", async ({ page, context }) => {
      await loginAs(context, MEMBRO_VER);
      await page.goto("/correio?pasta=sent");
      const linha = page.getByTestId("mail-thread-row").filter({ hasText: assunto });
      await expect(linha).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Novo email" })).toBeDisabled();
      await linha.click();

      await expect(page.getByTestId("mail-message").first()).toContainText("Abrimos das 9h");
      for (const name of ["Responder", "Responder a todos", "Encaminhar", "Arquivar", "Marcar como não lido"]) {
        const btn = page.getByRole("button", { name, exact: true });
        await expect(btn).toBeDisabled();
        await expect(btn.locator("xpath=..")).toHaveAttribute("title", "Só tens permissão para ver");
      }
    });
  });
}
