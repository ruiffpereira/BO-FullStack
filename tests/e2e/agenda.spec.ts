import { test, expect } from "./fixtures/auth";
import { test as anon } from "@playwright/test";
import { AgendaPage } from "./pages/AgendaPage";
import { loginAs } from "./fixtures/login";

test.describe("Agenda — Navegação (submenu + deep-links legacy, T2.7)", () => {
  test("a página carrega com o cabeçalho e o submenu da sidebar", async ({ page }) => {
    const p = new AgendaPage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
    for (const label of ["Calendário", "Marcações", "Serviços", "Configurações"]) {
      await expect(p.tab(label)).toBeVisible();
    }
  });

  test("alternar entre tabs mantém a página estável e muda a URL", async ({ page }) => {
    const p = new AgendaPage(page);
    await p.goto();
    for (const label of ["Marcações", "Serviços", "Configurações", "Calendário"]) {
      await p.goToTab(label);
      await expect(p.header()).toBeVisible();
    }
    await expect(page).toHaveURL(/\/agenda$/);
  });

  test("Marcações/Serviços/Configurações vivem em rotas próprias", async ({ page }) => {
    const p = new AgendaPage(page);
    await p.goto();
    await p.goToTab("Marcações");
    await expect(page).toHaveURL(/\/agenda\/marcacoes/);
    await p.goToTab("Serviços");
    await expect(page).toHaveURL(/\/agenda\/servicos/);
    await p.goToTab("Configurações");
    await expect(page).toHaveURL(/\/agenda\/config/);
    await p.goToTab("Calendário");
    await expect(page).toHaveURL(/\/agenda$/);
  });

  test("deep-link antigo /agenda?openService=<id> redireciona para /agenda/servicos preservando o parâmetro", async ({ page }) => {
    await page.goto("/agenda?openService=algum-id-inexistente");
    await page.waitForURL(/\/agenda\/servicos\?openService=algum-id-inexistente/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/agenda\/servicos\?openService=algum-id-inexistente/);
    const p = new AgendaPage(page);
    await expect(p.header()).toBeVisible();
  });
});

// Este bloco usa o tenantA (que TEM marcações semeadas, todas em 2026-06-20),
// para exercitar o filtro por intervalo de datas de forma determinística.
anon.describe("Agenda — Marcações: filtro por intervalo (De/Até)", () => {
  anon.use({ storageState: { cookies: [], origins: [] } });

  anon("um intervalo que inclui a data mostra as marcações; um intervalo posterior esvazia a lista", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    const p = new AgendaPage(page);
    await p.openMarcacoes();

    // As 3 marcações semeadas estão todas em 2026-06-20.
    const seededRow = p.row("Ag A • PAGA");
    await expect(seededRow).toBeVisible({ timeout: 10_000 });
    const totalInicial = await p.count();
    expect(totalInicial).toBeGreaterThanOrEqual(3);

    // (1) Intervalo que INCLUI 2026-06-20 → as marcações continuam visíveis.
    await p.applyRange("2026-06-01", "2026-06-30");
    await expect(seededRow).toBeVisible({ timeout: 8_000 });
    const dentro = await p.count();
    expect(dentro).toBeGreaterThanOrEqual(3);

    // (2) Intervalo POSTERIOR (julho) → nada em 2026-06-20 → lista vazia.
    await p.clearFilters();
    await p.applyRange("2026-07-01", "2026-07-31");
    await expect(seededRow).toHaveCount(0, { timeout: 8_000 });
    await expect(p.emptyState()).toBeVisible({ timeout: 8_000 });
  });
});
