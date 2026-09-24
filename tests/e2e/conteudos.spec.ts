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
    "limited@e2e (só VIEW_PRODUCTS) em /conteudos/ginasio redireciona ao 1.º subitem permitido (/conteudos/produtos)",
    async ({ page, context }) => {
      await loginAs(context, "limited@e2e");
      await page.goto("/conteudos/ginasio");
      // O guard do Shell.tsx não escolhe o "mais relevante" para o utilizador:
      // percorre SUBMENU["/conteudos"] por ordem e pega o 1.º PERMITIDO.
      //
      // Até 2026-09-24 isso dava sempre "Site público" (`/conteudos`), que não
      // tinha `perm`. Ganhou `perm: "VIEW_CMS"` — a API gateia `/cms/entries`
      // por essa permissão, e sem ela o utilizador via a aba só para levar 403.
      // O `limited@e2e` não tem VIEW_CMS, por isso o 1.º permitido passou a ser
      // "Produtos". Se este teste voltar a esperar `/conteudos`, é sinal de que
      // o gate do "Site público" caiu — verificar contra `routes/index.ts` da
      // API antes de mudar o teste.
      await expect(page).toHaveURL(/\/conteudos\/produtos$/, { timeout: 15_000 });
    },
  );

  guest(
    "limited@e2e vê Produtos mas não Site público/Serviços/Ginásio (nomes) no submenu",
    async ({ page, context }) => {
      await loginAs(context, "limited@e2e");
      await page.goto("/conteudos");
      const p = new ConteudosPage(page);
      await expect(p.tab("Produtos")).toBeVisible({ timeout: 10_000 });
      // "Site público" entrou aqui em 2026-09-24 com o `perm: "VIEW_CMS"`. É o
      // único destes três que gateia uma aba que ANTES era visível a toda a
      // gente — sem esta asserção, cair o gate não partia teste nenhum.
      await expect(p.tab("Site público")).toHaveCount(0);
      await expect(p.tab("Serviços")).toHaveCount(0);
      await expect(p.tab("Ginásio (nomes)")).toHaveCount(0);
    },
  );
});
