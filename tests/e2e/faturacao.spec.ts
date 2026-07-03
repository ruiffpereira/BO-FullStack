import { test, expect } from "./fixtures/auth";

/**
 * E2E da página Faturação (platform billing, T4). Cada tenant vê a SUA subscrição.
 *
 * A resposta de `GET /api/billing/subscription` é INTERCEPTADA no browser
 * (`page.route`) para exercitar cada estado sem precisar de uma subscrição real
 * semeada na BD — o objetivo é provar que a página renderiza cada estado. O login
 * é feito pela fixture `auth` (admin@e2e); o gate de billing deixa passar
 * (admin@e2e não tem subscrição → acesso total).
 */

type BillingState = {
  status: string;
  reason: string;
  modules: string[];
  monthlyTotalEur: number;
  readOnly: boolean;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  graceEndsAt: string | null;
};

const base: BillingState = {
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

const iso = (days: number) => new Date(Date.now() + days * 864e5).toISOString();

/** Interceta o endpoint de billing e serve o estado dado, depois abre a página. */
async function openWith(page: import("@playwright/test").Page, state: Partial<BillingState>) {
  await page.route("**/billing/subscription**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...base, ...state }),
    }),
  );
  await page.goto("/faturacao");
  // h1 do PageHeader (o topbar também tem um h2 "Faturação" → level:1 desambigua).
  await expect(page.getByRole("heading", { name: "Faturação", level: 1 })).toBeVisible();
}

test("aparece na sidebar como item core", async ({ page }) => {
  await openWith(page, {});
  // Os itens da sidebar são <button> (Shell navega por onClick), não links.
  await expect(page.getByRole("button", { name: /Faturação/i }).first()).toBeVisible();
});

test("estado: sem subscrição (none) mostra empty state", async ({ page }) => {
  await openWith(page, { status: "none", reason: "none" });
  await expect(page.getByText(/Sem subscrição ativa/i)).toBeVisible();
});

test("estado: período de teste (trialing) mostra fim do trial + total", async ({ page }) => {
  await openWith(page, {
    status: "trialing",
    reason: "trialing",
    modules: ["agenda"],
    monthlyTotalEur: 15,
    trialEnd: iso(10),
  });
  // Scope ao <main>: "Agenda" também é um item da sidebar (o admin tem o módulo).
  const main = page.getByRole("main");
  await expect(main.getByText(/Período de teste/i).first()).toBeVisible();
  await expect(main.getByText(/Agenda/)).toBeVisible();
  await expect(main.getByText(/15,00\s*€/)).toBeVisible();
});

test("estado: ativa (active) mostra módulos, total e próxima renovação", async ({ page }) => {
  await openWith(page, {
    status: "active",
    reason: "active",
    modules: ["agenda", "gym"],
    monthlyTotalEur: 45,
    currentPeriodEnd: iso(20),
  });
  const main = page.getByRole("main");
  await expect(main.getByText("Ativa").first()).toBeVisible();
  await expect(main.getByText(/Agenda/)).toBeVisible();
  await expect(main.getByText(/Ginásio/)).toBeVisible();
  await expect(main.getByText(/45,00\s*€/)).toBeVisible();
  await expect(main.getByText(/Próxima renovação/i)).toBeVisible();
});

test("estado: em atraso dentro do grace mostra aviso âmbar + regularizar", async ({ page }) => {
  await openWith(page, {
    status: "past_due",
    reason: "grace",
    modules: ["gym"],
    monthlyTotalEur: 30,
    graceEndsAt: iso(5),
  });
  await expect(page.getByText(/Pagamento em atraso/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Regularizar pagamento/i })).toBeVisible();
});

test("estado: acesso limitado (past_due_locked) mostra alerta vermelho", async ({ page }) => {
  await openWith(page, {
    status: "past_due",
    reason: "past_due_locked",
    modules: ["gym"],
    monthlyTotalEur: 30,
    readOnly: true,
  });
  await expect(page.getByText(/Acesso limitado a leitura/i).first()).toBeVisible();
});

test("estado: cancelada mostra alerta + acesso a leitura", async ({ page }) => {
  await openWith(page, {
    status: "canceled",
    reason: "canceled",
    modules: ["agenda"],
    monthlyTotalEur: 15,
    readOnly: true,
  });
  await expect(page.getByText(/Subscrição cancelada/i).first()).toBeVisible();
});
