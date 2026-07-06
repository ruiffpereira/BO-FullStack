import { test, expect } from "./fixtures/auth";
import { test as guest } from "@playwright/test";
import { ConteudosPage } from "./pages/ConteudosPage";
import { loginAs } from "./fixtures/login";

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

test.describe("Conteúdos — Navegação (submenu da sidebar, T2.6)", () => {
  // admin@e2e (fixtures/auth) tem todas as permissões — os 7 subitens ficam
  // todos visíveis (nenhum gated escondido).
  test("a página carrega com o cabeçalho e o submenu da sidebar", async ({ page }) => {
    const p = new ConteudosPage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
    for (const label of ["Site público", "Produtos", "Serviços", "Ginásio (nomes)", "Línguas", "Emails", "Notificações"]) {
      await expect(p.tab(label)).toBeVisible();
    }
  });

  test("alternar entre subitens muda a URL e mantém a página estável", async ({ page }) => {
    const p = new ConteudosPage(page);
    await p.goto();
    for (const label of ["Produtos", "Serviços", "Ginásio (nomes)", "Línguas", "Emails", "Notificações", "Site público"]) {
      await p.goToTab(label);
      await expect(p.header()).toBeVisible();
    }
    await expect(page).toHaveURL(/\/conteudos$/);
  });
});

guest.describe("Conteúdos — gating por subitem (T2.6)", () => {
  guest.use({ storageState: { cookies: [], origins: [] } });

  guest(
    "limited@e2e (só VIEW_PRODUCTS) em /conteudos/ginasio redireciona ao 1.º subitem permitido (/conteudos)",
    async ({ page, context }) => {
      await loginAs(context, "limited@e2e");
      await page.goto("/conteudos/ginasio");
      // "Site público" (sem perm) é sempre o 1.º subitem — mesmo para quem só
      // tem VIEW_PRODUCTS, é ele que o guard do Shell.tsx escolhe (nunca
      // "Produtos": o guard não sabe qual seria "mais relevante" para o user,
      // só percorre SUBMENU["/conteudos"] por ordem e pega o 1.º permitido).
      await expect(page).toHaveURL(/\/conteudos$/, { timeout: 15_000 });
    },
  );

  guest(
    "limited@e2e vê Produtos mas não Serviços/Ginásio (nomes) no submenu",
    async ({ page, context }) => {
      await loginAs(context, "limited@e2e");
      await page.goto("/conteudos");
      const p = new ConteudosPage(page);
      await expect(p.tab("Produtos")).toBeVisible({ timeout: 10_000 });
      await expect(p.tab("Serviços")).toHaveCount(0);
      await expect(p.tab("Ginásio (nomes)")).toHaveCount(0);
    },
  );
});
