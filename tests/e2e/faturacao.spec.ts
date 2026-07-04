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
  hasStripeSubscription: boolean;
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
  // T9 (self-serve): a maioria destes estados de teste representa uma
  // subscrição Stripe-backed (o "Gerir pagamento" do portal só aparece quando
  // true) — ver `hasStripeSubscription` no BillingSubscription do backend.
  hasStripeSubscription: true,
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

// ── Portal de pagamento (des-stub T5) ─────────────────────────────────────────
test("portal: 'Gerir pagamento' faz POST /billing/portal", async ({ page }) => {
  await openWith(page, {
    status: "active",
    reason: "active",
    modules: ["agenda"],
    monthlyTotalEur: 15,
    currentPeriodEnd: iso(20),
  });

  // Devolve um URL same-origin para o redirect não sair da app (fica intercetado).
  const origin = new URL(page.url()).origin;
  await page.route("**/billing/portal", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: `${origin}/faturacao?portal=stub` }),
    }),
  );

  const main = page.getByRole("main");
  const [req] = await Promise.all([
    page.waitForRequest("**/billing/portal"),
    main.getByRole("button", { name: /gerir pagamento/i }).click(),
  ]);
  expect(req.method()).toBe("POST");
});

// ── Banner de billing no Shell (T5) ───────────────────────────────────────────
// A faixa vive no Shell (todas as páginas menos /faturacao). Testamos em /dashboard.
async function routeBilling(page: import("@playwright/test").Page, state: Partial<BillingState>) {
  // Padrão exato (sem sufixo) para NÃO colidir com /admin/billing/subscriptions.
  await page.route("**/billing/subscription", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...base, ...state }),
    }),
  );
}

test("banner: estado grace mostra a faixa fora da faturação", async ({ page }) => {
  await routeBilling(page, {
    status: "past_due",
    reason: "grace",
    modules: ["gym"],
    monthlyTotalEur: 30,
    graceEndsAt: iso(5),
  });
  await page.goto("/dashboard");
  await expect(page.getByText(/Pagamento em atraso.*regulariza até/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /ver faturação/i })).toBeVisible();
});

test("banner: estado past_due_locked mostra alerta vermelho", async ({ page }) => {
  await routeBilling(page, {
    status: "past_due",
    reason: "past_due_locked",
    modules: ["gym"],
    monthlyTotalEur: 30,
    readOnly: true,
  });
  await page.goto("/dashboard");
  await expect(page.getByText(/Acesso limitado a leitura/i)).toBeVisible();
});

test("banner: some quando a subscrição está ativa", async ({ page }) => {
  await routeBilling(page, {
    status: "active",
    reason: "active",
    modules: ["agenda"],
    monthlyTotalEur: 15,
    currentPeriodEnd: iso(20),
  });
  const resp = page.waitForResponse("**/billing/subscription");
  await page.goto("/dashboard");
  await resp;
  // Tudo pago → a faixa é invisível (nenhuma das frases do banner presente).
  await expect(page.getByText(/regulariza até/i)).toHaveCount(0);
  await expect(page.getByText(/Acesso limitado a leitura/i)).toHaveCount(0);
});
