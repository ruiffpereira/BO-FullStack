import { test, expect } from "./fixtures/auth";
import { DespesasPage } from "./pages/DespesasPage";

/**
 * E2E do feedback REATIVO do gate read-only do platform billing.
 *
 * O interceptor de resposta do axios (AuthContext) mostra um toast quando uma
 * escrita de gestão é bloqueada com 402 (`billingGate` da API → subscrição por
 * regularizar). Aqui intercetamos o POST /expenses no browser (`page.route`,
 * escopo à escrita — os GETs passam) e devolvemos 402 `{ error, reason, graceEndsAt }`,
 * sem precisar de uma subscrição read-only semeada na BD. Login pela fixture
 * `auth` (admin@e2e).
 */

test("escrita bloqueada (402) mostra toast reativo com ação para Faturação", async ({ page }) => {
  const p = new DespesasPage(page);
  await p.goto();

  // O billingGate responde 402 a POSTs de gestão quando o tenant está read-only.
  await page.route("**/expenses**", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Payment Required",
          reason: "past_due_locked",
          graceEndsAt: null,
        }),
      });
    }
    return route.continue();
  });

  // Dispara uma escrita real (passa pelo cliente axios do Kubb → interceptor).
  await p.openNewExpenseModal();
  await p.fillExpenseForm({ description: "Teste 402 billing", amount: "12" });
  await p.submitExpenseForm();

  // Toast do interceptor (billing), escopado pela sua frase — evita colidir com
  // o item "Faturação" da sidebar e com o toast de erro genérico da página (o 402
  // NÃO é engolido: a mutação vê o erro e mostra o seu próprio toast; este só
  // ADICIONA o do billing com a ação de regularização).
  const billingToast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /regulariza o pagamento/i });
  await expect(billingToast).toBeVisible({ timeout: 8_000 });

  // A ação para a Faturação (caminho claro de regularização) está presente.
  // (O clique/navegação em si é coberto no unit test — aqui provamos o toast + CTA
  // sem depender do clique através de dois toasts sobrepostos e animados.)
  await expect(billingToast.getByRole("button", { name: "Faturação" })).toBeVisible();
});
