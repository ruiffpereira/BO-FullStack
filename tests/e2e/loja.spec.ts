import { test, expect } from "./fixtures/auth";
import { LojaPage } from "./pages/LojaPage";

test.describe("Loja — Navegação", () => {
  test("a página carrega com o cabeçalho e as tabs", async ({ page }) => {
    const p = new LojaPage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
    for (const label of ["Produtos", "Encomendas", "Categorias"]) {
      await expect(p.tab(label)).toBeVisible();
    }
  });

  test("alternar entre tabs mantém a página estável", async ({ page }) => {
    const p = new LojaPage(page);
    await p.goto();
    for (const label of ["Encomendas", "Categorias", "Produtos"]) {
      await p.goToTab(label);
      await expect(p.header()).toBeVisible();
    }
    await expect(page).toHaveURL(/\/loja/);
  });
});

test.describe("Loja — Produtos", () => {
  test("a pesquisa de produtos está disponível", async ({ page }) => {
    const p = new LojaPage(page);
    await p.goto();
    await p.goToTab("Produtos");
    await expect(p.searchInput()).toBeVisible({ timeout: 8_000 });
  });

  test("abrir 'Novo produto' mostra o modal", async ({ page }) => {
    const p = new LojaPage(page);
    await p.goto();
    await p.goToTab("Produtos");
    await p.openNewProduct();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
