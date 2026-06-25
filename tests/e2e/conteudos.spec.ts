import { test, expect } from "./fixtures/auth";
import { ConteudosPage } from "./pages/ConteudosPage";

test.describe("Conteúdos (CMS) — Smoke", () => {
  test("a página carrega com o cabeçalho e a pesquisa", async ({ page }) => {
    const p = new ConteudosPage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
    await expect(p.searchInput()).toBeVisible({ timeout: 8_000 });
  });

  test("abrir 'Nova entrada' mostra o modal", async ({ page }) => {
    const p = new ConteudosPage(page);
    await p.goto();
    await p.openNewEntry();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test("o botão de importar CSV/Excel está disponível", async ({ page }) => {
    // O botão abre o seletor de ficheiros nativo; o modal de importação só
    // aparece depois de escolher um ficheiro. Aqui validamos a sua presença.
    const p = new ConteudosPage(page);
    await p.goto();
    await expect(p.importButton()).toBeVisible({ timeout: 8_000 });
  });
});
