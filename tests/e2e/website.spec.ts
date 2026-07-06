import { test, expect } from "./fixtures/auth";
import { WebsitePage } from "./pages/WebsitePage";

test.describe("Website — Navegação (submenu, T2.3)", () => {
  test("a página carrega com o cabeçalho e o submenu da sidebar", async ({ page }) => {
    const p = new WebsitePage(page);
    await p.goto();
    await expect(p.header()).toBeVisible();
    for (const label of ["O meu site", "Template", "Páginas", "Marca", "Rodapé & Nav", "Domínio"]) {
      await expect(p.tab(label)).toBeVisible();
    }
  });

  test("navegar para Template e Domínio muda a URL e mostra o conteúdo de cada vista", async ({ page }) => {
    const p = new WebsitePage(page);
    await p.goto();

    // A vista por defeito ("O meu site") só renderiza depois de `useSite()`
    // (GET /website) resolver — a página inteira fica presa num skeleton até lá
    // (ver `Website()`: `isLoading || !site`). Esperar aqui pelo "Estado" (único
    // nesta página, sempre presente na vista default) com margem generosa
    // (arranque da SPA + 1.º fetch, mais lento em CI) garante que os dados já
    // estão em cache do React Query ANTES de trocar de separador — assim as
    // vistas seguintes (SPA, sem reload) não voltam a depender de rede lenta.
    await expect(page.getByText("Estado", { exact: true })).toBeVisible({ timeout: 20_000 });

    await p.goToTab("Template");
    await expect(page).toHaveURL(/\/website\/template/);
    // Parágrafo estático (fora do `isLoading` de `useGetWebsiteTemplates`) —
    // não depende da resposta de `GET /website/templates`.
    await expect(page.getByText(/Escolhe um ponto de partida/i)).toBeVisible({ timeout: 8_000 });

    await p.goToTab("Domínio");
    await expect(page).toHaveURL(/\/website\/dominio/);
    // Placeholder do input — renderiza de imediato, sem fetch próprio no mount.
    await expect(page.getByPlaceholder("a-tua-marca")).toBeVisible({ timeout: 8_000 });
  });
});
