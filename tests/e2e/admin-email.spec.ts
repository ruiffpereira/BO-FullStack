import { test, expect } from "./fixtures/auth"; // login como admin@e2e
import { AdminPage } from "./pages/AdminPage";

/**
 * Admin → Utilizadores → "Email" (B42 · fase 4) e o cartão Email de Admin → Sistema.
 *
 * A API do e2e corre com `ENVIRONMENT=TEST`, onde o fornecedor de domínios é o simulador em memória
 * (`API-FullStack/src/mail/index.ts` → `MemoryDomainProvider`): NADA fala com o Resend real. O simulador não
 * "põe o DNS", por isso o domínio nunca passa a verificado aqui — a verificação positiva fica no unit/API.
 * `EMAIL_PLATFORM_DOMAIN` não está no `.env.e2e`: não há `suggestedDomain`, escreve-se o domínio à mão.
 */
// Um tenant NÃO-admin: o botão "Email" só existe nas linhas que não têm o componente Admin (tenantA/B têm-no).
const TENANT = "agenda@e2e";
const SIZES = [
  { w: 1440, h: 900 },
  { w: 834, h: 1112 },
  { w: 390, h: 844 },
];

for (const { w, h } of SIZES) {
  test.describe(`Admin — Email do tenant (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("configurar → tabela de registos → verificar → remover", async ({ page }) => {
      const domain = `email-e2e-${w}.example.pt`;
      const admin = new AdminPage(page);
      await admin.goto();
      const row = await admin.userRowFromStart(TENANT);
      await expect(row).toBeVisible({ timeout: 10_000 });
      await row.getByRole("button", { name: `Email de ${TENANT}` }).click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toContainText("Email", { timeout: 10_000 });

      // Idempotente: uma corrida anterior pode ter deixado o domínio.
      const remover = dialog.getByRole("button", { name: "Remover domínio" });
      if (await remover.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await remover.click();
        await page.locator('[role="dialog"]').last().getByRole("button", { name: "Remover" }).click();
        await expect(page.getByText("Domínio de email removido")).toBeVisible({ timeout: 10_000 });
      }

      // 1) Sem domínio → formulário de configuração.
      await expect(dialog.getByLabel("Domínio de email")).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByLabel("Parte local do endereço")).toHaveValue("geral");
      await dialog.getByLabel("Domínio de email").fill(domain);
      await dialog.getByLabel("Nome do remetente").fill("Tenant A");
      // Domínio próprio: a UI pergunta se já há email nele (sem resposta o botão fica desactivado).
      await expect(dialog.getByRole("button", { name: "Configurar" })).toBeDisabled();
      await dialog.getByLabel("Não, o domínio ainda não tem email").check();
      await dialog.getByRole("button", { name: "Configurar" }).click();
      await expect(page.getByText("Domínio de email guardado")).toBeVisible({ timeout: 10_000 });

      // 2) Estado "Não verificado" + tabela de registos (3 do simulador).
      await expect(dialog.getByTestId("email-domain-state")).toContainText("Não verificado", { timeout: 10_000 });
      await expect(dialog.getByTestId("email-domain-name")).toHaveText(domain);
      await expect(dialog.getByTestId("dns-record-row")).toHaveCount(3);
      await expect(dialog.getByRole("button", { name: "Copiar nome" }).first()).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Copiar valor" }).first()).toBeVisible();

      // A tabela é legível: o scroll horizontal é só dela, a página não ganha scroll.
      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(pageOverflow, "sem scroll horizontal na página").toBeLessThanOrEqual(0);

      // 3) Verificar agora — o simulador não põe o DNS, continua por verificar.
      await dialog.getByRole("button", { name: "Verificar agora" }).click();
      await expect(page.getByText(/Ainda há registos por verificar/)).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByTestId("email-domain-state")).toContainText("Não verificado");

      // 4) Voltar ao envio da plataforma → passa a oferecer "Usar o domínio do negócio", desactivado (não verificado).
      await dialog.getByRole("button", { name: "Voltar ao envio da plataforma" }).click();
      const useOwn = dialog.getByRole("button", { name: "Usar o domínio do negócio" });
      await expect(useOwn).toBeVisible({ timeout: 10_000 });
      await expect(useOwn).toBeDisabled();

      // 5) Cancelar a confirmação NÃO remove; confirmar remove.
      await dialog.getByRole("button", { name: "Remover domínio" }).click();
      const confirm = page.locator('[role="dialog"]').last();
      await expect(confirm).toContainText("Remover o domínio de email?");
      await confirm.getByRole("button", { name: "Cancelar" }).click();
      await expect(dialog.getByTestId("email-domain-name")).toHaveText(domain);

      await dialog.getByRole("button", { name: "Remover domínio" }).click();
      await page.locator('[role="dialog"]').last().getByRole("button", { name: "Remover" }).click();
      await expect(page.getByText("Domínio de email removido")).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByLabel("Domínio de email")).toBeVisible({ timeout: 10_000 });
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
});
