import { test, expect } from "./fixtures/auth";
import { DEFAULT_TEST_USER } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { LojaPage } from "./pages/LojaPage";

test.describe("Loja — Navegação", () => {
  test("a página carrega com o cabeçalho e o submenu da sidebar", async ({ page, context }) => {
    const p = new LojaPage(page);
    await withSessionRetry(
      page,
      context,
      DEFAULT_TEST_USER,
      () => p.goto(),
      async () => {
        await expect(p.header()).toBeVisible();
        for (const label of ["Produtos", "Encomendas", "Categorias"]) {
          await expect(p.tab(label)).toBeVisible();
        }
      },
    );
  });

  test("alternar entre tabs mantém a página estável", async ({ page, context }) => {
    const p = new LojaPage(page);
    await withSessionRetry(
      page,
      context,
      DEFAULT_TEST_USER,
      () => p.goto(),
      () => expect(p.header()).toBeVisible(),
    );
    for (const label of ["Encomendas", "Categorias", "Produtos"]) {
      await p.goToTab(label);
      await expect(p.header()).toBeVisible();
    }
    await expect(page).toHaveURL(/\/loja/);
  });

  test("deep-link antigo /loja?tab=encomendas redireciona para /loja/encomendas", async ({ page, context }) => {
    const p = new LojaPage(page);
    await withSessionRetry(
      page,
      context,
      DEFAULT_TEST_USER,
      () => page.goto("/loja?tab=encomendas"),
      async () => {
        await page.waitForURL("**/loja/encomendas", { timeout: 15_000 });
        await expect(p.header()).toBeVisible();
      },
    );
  });
});

test.describe("Loja — Produtos", () => {
  test("a pesquisa de produtos está disponível", async ({ page, context }) => {
    const p = new LojaPage(page);
    await withSessionRetry(
      page,
      context,
      DEFAULT_TEST_USER,
      () => p.goto(),
      () => expect(p.header()).toBeVisible(),
    );
    await p.goToTab("Produtos");
    await expect(p.searchInput()).toBeVisible({ timeout: 8_000 });
  });

  test("abrir 'Novo produto' mostra o modal", async ({ page, context }) => {
    const p = new LojaPage(page);
    await withSessionRetry(
      page,
      context,
      DEFAULT_TEST_USER,
      () => p.goto(),
      () => expect(p.header()).toBeVisible(),
    );
    await p.goToTab("Produtos");
    await p.openNewProduct();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
