import { test, expect } from "./fixtures/auth"; // login como admin@e2e
import type { Page } from "@playwright/test";
import { AdminPage } from "./pages/AdminPage";

/**
 * Admin → Utilizadores → "Email" (B42 · fase 4, B55) e o cartão Email de Admin → Sistema.
 *
 * A API do e2e corre com `ENVIRONMENT=TEST`: os fornecedores de domínios e de caixas são os simuladores em memória
 * (`API-FullStack/src/mail/index.ts`) — NADA fala com o Resend nem com o Stalwart reais. O simulador não "põe o DNS",
 * por isso o domínio próprio nunca passa a verificado aqui (a verificação positiva fica no unit/API).
 * O `.env.e2e` da API define `EMAIL_PLATFORM_DOMAIN=e2e.test` (B55): os negócios sem domínio próprio têm um CÓDIGO no domínio
 * partilhado (`suporte.<código>@e2e.test`), pronto sem DNS nem verificação.
 *
 * Regras provadas: CR-24 (código único, muda-se com confirmação e os endereços antigos ficam como alias, nenhum código contém
 * «rufvision»), CR-26 (o endereço da plataforma não tem DNS nem «Verificar agora»; o domínio próprio continua igual).
 *
 * Um tenant NÃO-admin por largura (o botão "Email" só existe nas linhas sem o componente Admin; tenantA/B têm-no). Sem estado
 * partilhado entre larguras, e cada teste devolve o tenant ao estado inicial (sem endereço) no fim.
 */
const SIZES = [
  { w: 1440, h: 900, tenant: "agenda@e2e", code: "agenda-e2e" },
  { w: 834, h: 1112, tenant: "gym@e2e", code: "gym-e2e" },
  { w: 390, h: 844, tenant: "customers@e2e", code: "customers-e2e" },
];
const PLATFORM = "e2e.test";

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Abre o modal Email de um tenant. */
async function openEmail(page: Page, tenant: string) {
  const admin = new AdminPage(page);
  await admin.goto();
  const row = await admin.userRowFromStart(tenant);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByRole("button", { name: `Email de ${tenant}` }).click();
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toContainText("Email", { timeout: 10_000 });
  return dialog;
}

/** Idempotente: uma corrida anterior pode ter deixado domínio próprio e/ou endereço da plataforma. */
async function clean(page: Page, dialog: ReturnType<Page["locator"]>) {
  // O conteúdo vem da API: espera pelo formulário (sem endereço) ou pelo endereço, antes de procurar botões (isVisible não espera).
  await expect(dialog.getByLabel("Código do negócio").or(dialog.getByTestId("email-domain-name")).first()).toBeVisible({ timeout: 10_000 });
  for (const name of ["Remover domínio", "Remover endereço"]) {
    const btn = dialog.getByRole("button", { name });
    if (await btn.isVisible({ timeout: 2_500 }).catch(() => false)) {
      await btn.click();
      await page.locator('[role="dialog"]').last().getByRole("button", { name: "Remover", exact: true }).click();
      await expect(dialog.getByRole("button", { name })).toHaveCount(0, { timeout: 10_000 });
    }
  }
  await expect(dialog.getByLabel("Código do negócio")).toBeVisible({ timeout: 10_000 });
}

/** Configura o endereço da plataforma com o código dado (a partir do formulário «primeiro»). */
async function configurePlatform(page: Page, dialog: ReturnType<Page["locator"]>, code: string) {
  await expect(dialog.getByLabel("Nome do remetente")).not.toHaveValue(""); // o formulário já se preencheu (o efeito de arranque corre uma vez)
  await dialog.getByLabel("Código do negócio").fill(code);
  await dialog.getByRole("button", { name: "Configurar" }).click();
  await expect(page.getByText("Email do negócio guardado")).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByTestId("email-domain-name")).toHaveText(`suporte.${code}@${PLATFORM}`, { timeout: 10_000 });
}

for (const { w, h, tenant, code } of SIZES) {
  test.describe(`Admin — Email do tenant (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("CR-24/CR-26: código sugerido, pré-visualização, «Pronto» e nenhuma tabela de DNS", async ({ page }) => {
      const dialog = await openEmail(page, tenant);
      await clean(page, dialog);

      // Código sugerido a partir do nome do negócio + pré-visualização do endereço (sem escrever nada).
      await expect(dialog.getByLabel("Código do negócio")).toHaveValue(code);
      await expect(dialog.getByTestId("platform-address-preview")).toContainText(`suporte.${code}@${PLATFORM}`);
      await expect(dialog.getByText("Pronto a usar: não é preciso DNS nem verificar nada.")).toBeVisible();
      // O domínio próprio não é pedido aqui: a primeira escolha é o código.
      await expect(dialog.getByLabel("Domínio de email")).toHaveCount(0);

      // A pré-visualização acompanha o que se escreve (e a parte local).
      await dialog.getByLabel("Código do negócio").fill(`${code}-x`);
      await expect(dialog.getByTestId("platform-address-preview")).toContainText(`suporte.${code}-x@${PLATFORM}`);
      await dialog.getByLabel("Parte local do endereço").fill("geral");
      await expect(dialog.getByTestId("platform-address-preview")).toContainText(`geral.${code}-x@${PLATFORM}`);
      await dialog.getByLabel("Parte local do endereço").fill("suporte");
      await dialog.getByLabel("Código do negócio").fill(code);
      expect(await noOverflow(page), "sem scroll horizontal na página").toBeLessThanOrEqual(0);

      await dialog.getByRole("button", { name: "Configurar" }).click();
      await expect(page.getByText("Email do negócio guardado")).toBeVisible({ timeout: 10_000 });

      // «Pronto» (nunca «Não verificado»), o endereço, e NENHUMA tabela de DNS nem «Verificar agora».
      await expect(dialog.getByTestId("email-domain-state")).toContainText("Pronto", { timeout: 10_000 });
      await expect(dialog.getByTestId("email-domain-state")).not.toContainText("Não verificado");
      await expect(dialog.getByTestId("email-domain-name")).toHaveText(`suporte.${code}@${PLATFORM}`);
      await expect(dialog.getByTestId("platform-code-line")).toContainText(code);
      await expect(dialog.getByTestId("platform-code-line")).toContainText("os endereços antigos continuam a receber");
      await expect(dialog.getByTestId("dns-record-row")).toHaveCount(0);
      await expect(dialog.getByTestId("dns-records")).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Verificar agora" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Copiar nome" })).toHaveCount(0);
      expect(await noOverflow(page), "sem scroll horizontal na página").toBeLessThanOrEqual(0);

      await clean(page, dialog);
    });

    test("CR-24: mudar o código pede confirmação e diz que os antigos continuam a receber", async ({ page }) => {
      const dialog = await openEmail(page, tenant);
      await clean(page, dialog);
      await configurePlatform(page, dialog, code);

      await dialog.getByRole("button", { name: "Alterar código e remetente" }).click();
      await expect(dialog.getByLabel("Código do negócio")).toHaveValue(code); // o formulário acabou de se preencher: só então se escreve
      const novo = `${code}-novo`;
      await dialog.getByLabel("Código do negócio").fill(novo);
      await dialog.getByRole("button", { name: "Guardar" }).click();

      // Confirmação: o texto diz que os endereços antigos continuam a receber na mesma caixa.
      const confirm = page.locator('[role="dialog"]').last();
      await expect(confirm).toContainText("Mudar o código do negócio?");
      await expect(confirm).toContainText(`suporte.${novo}@${PLATFORM}`);
      await expect(confirm).toContainText(`…${code}@) continuam a receber na mesma caixa`);
      await expect(confirm).toContainText("ficam reservados para este negócio");

      // Cancelar NÃO muda nada.
      await confirm.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByText("Email do negócio guardado")).toHaveCount(0);
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(dialog.getByTestId("email-domain-name")).toHaveText(`suporte.${code}@${PLATFORM}`);

      // Confirmar muda.
      await dialog.getByRole("button", { name: "Alterar código e remetente" }).click();
      await expect(dialog.getByLabel("Código do negócio")).toHaveValue(code); // o formulário acabou de se preencher: só então se escreve
      await dialog.getByLabel("Código do negócio").fill(novo);
      await dialog.getByRole("button", { name: "Guardar" }).click();
      await page.locator('[role="dialog"]').last().getByRole("button", { name: "Mudar código" }).click();
      await expect(page.getByText("Email do negócio guardado")).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByTestId("email-domain-name")).toHaveText(`suporte.${novo}@${PLATFORM}`, { timeout: 10_000 });
      await expect(dialog.getByTestId("platform-code-line")).toContainText(novo);
      expect(await noOverflow(page), "sem scroll horizontal na página").toBeLessThanOrEqual(0);

      await clean(page, dialog);
    });

    test("CR-24: erros com texto claro — código ocupado (409), «rufvision» e formato inválido", async ({ page }) => {
      const dialog = await openEmail(page, tenant);
      await clean(page, dialog);
      const code$ = dialog.getByLabel("Código do negócio");
      const guardar = dialog.getByRole("button", { name: "Configurar" });
      await expect(code$).toHaveValue(code);

      // Código de OUTRO negócio (`selo` é o da Papelaria Selo, no seed) → 409.
      await code$.fill("selo");
      await guardar.click();
      await expect(page.getByText("Esse código já é de outro negócio. Escolhe outro.").first()).toBeVisible({ timeout: 10_000 });

      // Nenhum código contém o nome da casa (nem com hífens pelo meio).
      await code$.fill("meu-rufvision");
      await guardar.click();
      await expect(page.getByText("Esse código está reservado. Escolhe outro.").first()).toBeVisible({ timeout: 10_000 });
      await code$.fill("ruf-vision");
      await guardar.click();
      await expect(page.getByText("Esse código está reservado. Escolhe outro.").first()).toBeVisible({ timeout: 10_000 });

      // Formato inválido (ponto, espaço, acento) → 400 com a regra por extenso.
      await code$.fill("tem.ponto");
      await guardar.click();
      await expect(page.getByText("Código inválido: só letras, números e hífen (1 a 30), sem pontos.").first()).toBeVisible({ timeout: 10_000 });

      // Nada foi guardado: o formulário continua aberto e o tenant sem endereço.
      await expect(dialog.getByTestId("email-domain-name")).toHaveCount(0);
      await expect(code$).toBeVisible();
      expect(await noOverflow(page), "sem scroll horizontal na página").toBeLessThanOrEqual(0);
    });

    test("CR-26: o domínio próprio continua igual — tabela de registos, verificar, voltar à plataforma, remover", async ({ page }) => {
      const domain = `email-e2e-${w}.example.pt`;
      const dialog = await openEmail(page, tenant);
      await clean(page, dialog);
      await configurePlatform(page, dialog, code);

      // 1) Com o endereço da plataforma já feito, oferece adicionar o domínio próprio.
      await dialog.getByRole("button", { name: "Adicionar domínio próprio" }).click();
      await expect(dialog.getByLabel("Domínio de email")).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByLabel("Nome do remetente")).toHaveValue(tenant); // o formulário já se preencheu: só então se escreve
      await expect(dialog.getByLabel("Parte local do endereço")).toHaveValue("suporte");
      await dialog.getByLabel("Domínio de email").fill(domain);
      await dialog.getByLabel("Nome do remetente").fill("Tenant A");
      // Domínio próprio: a UI pergunta se já há email nele (sem resposta o botão fica desactivado).
      await expect(dialog.getByRole("button", { name: "Configurar" })).toBeDisabled();
      await dialog.getByLabel("Não, o domínio ainda não tem email").check();
      await dialog.getByRole("button", { name: "Configurar" }).click();
      await expect(page.getByText("Email do negócio guardado")).toBeVisible({ timeout: 10_000 });

      // 2) Estado "Não verificado" + tabela de registos (3 do simulador) SÓ no bloco do domínio próprio.
      const own = dialog.getByTestId("email-domain-block-own");
      const plat = dialog.getByTestId("email-domain-block-platform");
      await expect(own.getByTestId("email-domain-state")).toContainText("Não verificado", { timeout: 10_000 });
      await expect(own.getByTestId("email-domain-name")).toHaveText(domain);
      await expect(own.getByTestId("dns-record-row")).toHaveCount(3);
      await expect(plat.getByTestId("dns-record-row")).toHaveCount(0);
      await expect(plat.getByTestId("email-domain-state")).toContainText("Pronto");
      await expect(own.getByRole("button", { name: "Copiar nome" }).first()).toBeVisible();
      await expect(own.getByRole("button", { name: "Copiar valor" }).first()).toBeVisible();

      // A tabela é legível: o scroll horizontal é só dela, a página não ganha scroll.
      expect(await noOverflow(page), "sem scroll horizontal na página").toBeLessThanOrEqual(0);

      // 3) Verificar agora — o simulador não põe o DNS, continua por verificar.
      await own.getByRole("button", { name: "Verificar agora" }).click();
      await expect(page.getByText(/Ainda há registos por verificar/)).toBeVisible({ timeout: 10_000 });
      await expect(own.getByTestId("email-domain-state")).toContainText("Não verificado");

      // 4) Voltar ao envio da plataforma → passa a oferecer "Usar o domínio do negócio", desactivado (não verificado).
      await own.getByRole("button", { name: "Voltar ao envio da plataforma" }).click();
      const useOwn = own.getByRole("button", { name: "Usar o domínio do negócio" });
      await expect(useOwn).toBeVisible({ timeout: 10_000 });
      await expect(useOwn).toBeDisabled();

      // 5) Cancelar a confirmação NÃO remove; confirmar remove (o endereço da plataforma fica).
      await own.getByRole("button", { name: "Remover domínio" }).click();
      const confirm = page.locator('[role="dialog"]').last();
      await expect(confirm).toContainText("Remover o domínio de email?");
      await confirm.getByRole("button", { name: "Cancelar" }).click();
      await expect(own.getByTestId("email-domain-name")).toHaveText(domain);

      await own.getByRole("button", { name: "Remover domínio" }).click();
      await page.locator('[role="dialog"]').last().getByRole("button", { name: "Remover", exact: true }).click();
      await expect(page.getByText("Domínio de email removido")).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByTestId("email-domain-block-own")).toHaveCount(0);
      await expect(dialog.getByTestId("email-domain-name")).toHaveText(`suporte.${code}@${PLATFORM}`);

      // 6) Remover o endereço da plataforma (sem caixas): pede confirmação e devolve o tenant ao estado inicial.
      await dialog.getByRole("button", { name: "Remover endereço" }).click();
      const c2 = page.locator('[role="dialog"]').last();
      await expect(c2).toContainText("Remover o endereço da plataforma?");
      await c2.getByRole("button", { name: "Remover", exact: true }).click();
      await expect(dialog.getByLabel("Código do negócio")).toBeVisible({ timeout: 10_000 });
    });
  });
}

test.describe("Admin — Sistema: cartão Email", () => {
  test("mostra o Resend e o Stalwart 'Por configurar'", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Sistema");
    const card = page.getByTestId("email-status-card");
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByTestId("email-resend")).toContainText("Resend");
    await expect(card.getByTestId("email-stalwart")).toContainText("Por configurar", { timeout: 10_000 });
  });

  test("CR-24: o registo MX da plataforma aparece com o estado ❌ (sem DNS no e2e)", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Sistema");
    const card = page.getByTestId("email-status-card");
    await expect(card).toContainText(`Domínio da plataforma: ${PLATFORM}`, { timeout: 10_000 });
    const row = card.getByTestId("email-platform-dns-row");
    await expect(row).toHaveCount(1);
    // MX · e2e.test → mail.e2e.test · prioridade 10: o domínio de teste não resolve, por isso «Por pôr».
    await expect(row).toContainText(`MX · ${PLATFORM} → mail.${PLATFORM} · prioridade 10`);
    await expect(row).toContainText("❌ Por pôr");
    await expect(row).not.toContainText("✅");
  });

  test("CR-24: com o MX já a apontar para o nosso servidor o estado passa a ✅", async ({ page }) => {
    // O e2e não tem DNS: a resposta do estado troca-se para provar o ✅ (o cálculo do `ok` é da API, provado no teste de integração).
    await page.route("**/api/admin/email/status", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.platformDns = { records: [{ type: "MX", name: PLATFORM, value: `mail.${PLATFORM}`, priority: 10, ok: true }] };
      await route.fulfill({ response: res, json: body });
    });
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.goToTab("Sistema");
    const row = page.getByTestId("email-status-card").getByTestId("email-platform-dns-row");
    await expect(row).toContainText("✅ A apontar para nós", { timeout: 10_000 });
    await expect(row).not.toContainText("❌");
  });
});
