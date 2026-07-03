import { test, expect } from "./fixtures/auth";

/**
 * E2E do painel admin de subscrições da plataforma (Admin → tab "Faturação", T6).
 * O dono (admin@e2e tem VIEW_ADMIN) vê a lista de tenants + o estado da subscrição
 * e pode criar uma subscrição. A resposta de `GET /api/admin/billing/subscriptions`
 * é INTERCETADA no browser (`page.route`) para servir uma lista determinística sem
 * depender de subscrições reais semeadas.
 */

const TENANTS = [
  {
    userId: "11111111-1111-1111-1111-111111111111",
    name: "Barbearia Teste",
    email: "barber@e2e",
    subscription: null,
  },
  {
    userId: "22222222-2222-2222-2222-222222222222",
    name: "Ginásio Teste",
    email: "gym@e2e",
    subscription: { status: "active", modules: ["agenda", "gym"], monthlyTotalEur: 45 },
  },
];

const NO_SUB = {
  status: "none",
  reason: "none",
  modules: [],
  monthlyTotalEur: 0,
  readOnly: false,
  trialEnd: null,
  currentPeriodEnd: null,
  cancelAt: null,
  graceEndsAt: null,
};

/** Intercepta o billing do Shell (none → sem banner) + a lista admin, e abre a tab. */
async function openAdminBilling(page: import("@playwright/test").Page) {
  // Padrão exato para não colidir com a lista admin (subscriptionS, no plural).
  await page.route("**/billing/subscription", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(NO_SUB) }),
  );
  await page.route("**/admin/billing/subscriptions", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(TENANTS),
      });
    }
    return route.continue();
  });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible();
  // A tab "Faturação" (role=tab) desambigua do item da sidebar (role=button).
  await page.getByRole("tab", { name: /Faturação/i }).click();
}

test("tab Faturação lista os tenants com estado, módulos e total", async ({ page }) => {
  await openAdminBilling(page);
  const main = page.getByRole("main");

  await expect(main.getByText("Barbearia Teste")).toBeVisible();
  await expect(main.getByText("Ginásio Teste")).toBeVisible();
  // Tenant sem subscrição
  await expect(main.getByText("Sem subscrição")).toBeVisible();
  // Tenant com subscrição ativa
  await expect(main.getByText("Ativa")).toBeVisible();
  await expect(main.getByText(/45,00\s*€/)).toBeVisible();
});

test("abre o modal de criar subscrição com os módulos cobráveis", async ({ page }) => {
  await openAdminBilling(page);
  const main = page.getByRole("main");

  await main.getByRole("button", { name: /criar subscrição/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Módulos a cobrar")).toBeVisible();
  await expect(dialog.getByText("Agenda")).toBeVisible();
  await expect(dialog.getByText("Ginásio")).toBeVisible();
  await expect(dialog.getByText("Loja")).toBeVisible();
});
