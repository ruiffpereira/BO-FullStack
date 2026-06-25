import { test, expect } from "./fixtures/auth";
import { AgendaPage } from "./pages/AgendaPage";

test.describe("Agenda — Navegação", () => {
  test("a página carrega com o cabeçalho e as tabs", async ({ page }) => {
    const p = new AgendaPage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
    for (const label of ["Calendário", "Marcações", "Serviços", "Configurações"]) {
      await expect(p.tab(label)).toBeVisible();
    }
  });

  test("alternar entre tabs mantém a página estável", async ({ page }) => {
    const p = new AgendaPage(page);
    await p.goto();
    for (const label of ["Marcações", "Serviços", "Configurações", "Calendário"]) {
      await p.goToTab(label);
      await expect(p.header()).toBeVisible();
    }
    await expect(page).toHaveURL(/\/agenda/);
  });
});
