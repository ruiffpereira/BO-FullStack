import { test, expect } from "./fixtures/auth";
import { GinasioPage } from "./pages/GinasioPage";

test.describe("Ginásio — Navegação", () => {
  test("a página carrega com o cabeçalho e o submenu da sidebar", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
    for (const label of ["Exercícios", "Dia de Treino", "Planos", "Progresso de clientes"]) {
      await expect(p.tab(label)).toBeVisible();
    }
  });

  test("alternar entre subitens mantém a página estável", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.goto();
    for (const label of ["Dia de Treino", "Planos", "Progresso de clientes", "Exercícios"]) {
      await p.goToTab(label);
      await expect(p.header()).toBeVisible();
    }
    await expect(page).toHaveURL(/\/ginasio/);
  });
});

test.describe("Ginásio — Smoke", () => {
  test("a página carrega com o cabeçalho", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
  });

  test("abrir 'Novo exercício' mostra o modal", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.goto();
    await p.openNewExercise();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test("a pesquisa de exercícios está disponível", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.goto();
    await expect(p.searchInput()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Ginásio — Mensalidades", () => {
  test("a tab Mensalidades mostra os KPIs", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.openMensalidades();
    await expect(p.kpiRecebido()).toBeVisible({ timeout: 8_000 });
  });

  test("criar uma subscrição no catálogo", async ({ page }) => {
    const p = new GinasioPage(page);
    await p.openMensalidades();
    await p.openSubscricoesSubtab();
    const nome = `E2E ${Date.now()}`;
    await p.createSubscription(nome, "25");
    await expect(page.getByRole("heading", { name: nome })).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Ginásio — Membro: só paga (payOnly)", () => {
  test("ligar 'Só paga (sem app)' num membro persiste após reabrir a ficha", async ({ page }) => {
    const p = new GinasioPage(page);
    const nome = `Membro PayOnly ${Date.now()}`;

    // Abre a vista de mensalidade do membro (ficha do cliente → tab Ginásio).
    await p.openMemberMensalidade(nome);

    // O toggle começa desligado; liga-o.
    await expect(p.payOnlyToggle()).toHaveAttribute("aria-checked", "false");
    await p.setPayOnly(true);

    // Reabre a ficha do zero: o estado tem de persistir (veio do backend).
    await p.reopenMemberMensalidade(nome);
    await expect(p.payOnlyToggle()).toHaveAttribute("aria-checked", "true", { timeout: 8_000 });
  });
});

test.describe("Ginásio — Membro: mensalidade/estado visível", () => {
  test("a ficha do membro mostra o estado da mensalidade", async ({ page }) => {
    const p = new GinasioPage(page);
    const nome = `Membro Mensalidade ${Date.now()}`;

    await p.openMemberMensalidade(nome);

    // Sem subscrição atribuída, o painel mostra "Sem mensalidade" (KPI/estado),
    // com o CTA para atribuir uma subscrição — confirma que a vista renderiza.
    await expect(p.semMensalidade()).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[role="dialog"]').getByRole("button", { name: /atribuir subscrição/i }),
    ).toBeVisible();
  });
});
