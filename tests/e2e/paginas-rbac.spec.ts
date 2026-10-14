import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./fixtures/login";
import { expectBlockedRedirect, withSessionRetry } from "./fixtures/session";

/**
 * RBAC do construtor de páginas (F10): item "Páginas" + rota `/paginas`.
 *
 * O gating é do `Shell` (`MODULE_PERM_TO_PATH`: VIEW_SITE_PAGES → /paginas): o item só entra
 * em `accessiblePaths` com a permissão, e o guard (useEffect) redirecciona para /dashboard
 * qualquer rota não acessível. O estado do construtor vem de `GET /cms/site-builder`:
 * `{ enabled:false }` (sem linha / desligado) → estado vazio; `enabled:true` → editor.
 *
 * Seed (`scripts/seedE2e.ts`):
 *  - `pages@e2e`   → só VIEW_SITE_PAGES, construtor ACTIVO (linha em `SiteBuilders`)
 *  - `admin@e2e`   → tem VIEW_SITE_PAGES (Admin = todos os componentes), SEM linha → desligado
 *  - `limited@e2e` / `noaccess@e2e` → sem VIEW_SITE_PAGES
 *
 * Três larguras (regra do BO: computador, tablet, telemóvel). A sidebar fixa só existe a
 * partir de `lg` (1024 px); abaixo disso vive num drawer aberto pelo hambúrguer da topbar.
 */

// Cada teste autentica o seu próprio tenant — começa sem sessão.
test.use({ storageState: { cookies: [], origins: [] } });

const VIEWPORTS = [
  { label: "computador 1440", width: 1440, height: 900 },
  { label: "tablet 834", width: 834, height: 1112 },
  { label: "telemóvel 390", width: 390, height: 844 },
] as const;

/** Sidebar actualmente visível: a fixa (≥ lg) ou o drawer (< lg). */
const sidebar = (page: Page) => page.locator("aside:visible nav").first();

const paginasItem = (page: Page) => sidebar(page).getByRole("button", { name: "Páginas", exact: true });

/** Abaixo de `lg` a sidebar só existe depois de abrir o drawer (hambúrguer `lg:hidden` da topbar). */
async function openSidebarIfDrawer(page: Page): Promise<void> {
  const width = page.viewportSize()!.width;
  if (width >= 1024) return;
  await page.locator("header button.lg\\:hidden").click();
  await expect(sidebar(page)).toBeVisible();
}

for (const vp of VIEWPORTS) {
  test.describe(`Páginas RBAC — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("pages@e2e (VIEW_SITE_PAGES): vê o item 'Páginas' e abre /paginas", async ({ page, context }) => {
      const user = "pages@e2e";
      await loginAs(context, user);
      await withSessionRetry(
        page,
        context,
        user,
        () => page.goto("/dashboard"),
        async () => {
          await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
          await openSidebarIfDrawer(page);
          await expect(paginasItem(page), `${user} devia ver o item "Páginas"`).toBeVisible({ timeout: 10_000 });
          // Não ganha módulos alheios nem Admin só por ter esta permissão.
          for (const alheio of ["Loja", "Agenda", "Ginásio", "Admin"]) {
            await expect(
              sidebar(page).getByRole("button", { name: alheio, exact: true }),
              `${user} NÃO devia ver "${alheio}"`,
            ).toHaveCount(0);
          }
          await paginasItem(page).click();
          await expect(page).toHaveURL(/\/paginas$/, { timeout: 15_000 });
          await expect(page.getByRole("heading", { name: "Páginas", level: 2 })).toBeVisible({ timeout: 10_000 });
        },
      );
    });

    test("pages@e2e: /paginas por deep-link fica na página (não redirecciona)", async ({ page, context }) => {
      const user = "pages@e2e";
      await loginAs(context, user);
      await withSessionRetry(
        page,
        context,
        user,
        () => page.goto("/paginas"),
        async () => {
          await expect(page, `${user} devia poder ficar em /paginas`).toHaveURL(/\/paginas$/, { timeout: 15_000 });
          await expect(page.getByRole("heading", { name: "Páginas", level: 2 })).toBeVisible({ timeout: 10_000 });
        },
      );
    });

    for (const user of ["limited@e2e", "noaccess@e2e"]) {
      test(`${user} (sem VIEW_SITE_PAGES): não vê o item 'Páginas'`, async ({ page, context }) => {
        await loginAs(context, user);
        await withSessionRetry(
          page,
          context,
          user,
          () => page.goto("/dashboard"),
          async () => {
            await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
            await openSidebarIfDrawer(page);
            // Confirma que a sidebar carregou (permissões ok) antes de afirmar a ausência.
            await expect(
              sidebar(page).getByRole("button", { name: "Dashboard", exact: true }),
            ).toBeVisible({ timeout: 10_000 });
            await expect(paginasItem(page), `${user} NÃO devia ver "Páginas"`).toHaveCount(0);
          },
        );
      });

      test(`${user} (sem VIEW_SITE_PAGES): /paginas por deep-link redirecciona para /dashboard`, async ({ page, context }) => {
        await loginAs(context, user);
        await expectBlockedRedirect(page, context, user, "/paginas");
        // Nem o estado vazio nem a barra do editor chegam a ser mostrados.
        await expect(page.getByText("O construtor de páginas ainda não está ativo")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Desfazer" })).toHaveCount(0);
      });
    }

    test("construtor DESLIGADO (admin@e2e, com a permissão): item visível e estado vazio", async ({ page, context }) => {
      const user = "admin@e2e";
      await loginAs(context, user);
      await withSessionRetry(
        page,
        context,
        user,
        () => page.goto("/paginas"),
        async () => {
          await expect(page).toHaveURL(/\/paginas$/, { timeout: 15_000 });
          await expect(
            page.getByText("O construtor de páginas ainda não está ativo"),
          ).toBeVisible({ timeout: 10_000 });
          // Sem editor: nada de barra de histórico/gravação.
          await expect(page.getByRole("button", { name: "Desfazer" })).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Guardar", exact: true })).toHaveCount(0);
          // O item continua na sidebar (a permissão existe; é o tenant que não tem o construtor).
          await openSidebarIfDrawer(page);
          await expect(paginasItem(page)).toBeVisible();
        },
      );
    });

    test("construtor LIGADO (pages@e2e): barra com Desfazer · Refazer · Guardar", async ({ page, context }) => {
      const user = "pages@e2e";
      await loginAs(context, user);
      await withSessionRetry(
        page,
        context,
        user,
        () => page.goto("/paginas"),
        async () => {
          await expect(page).toHaveURL(/\/paginas$/, { timeout: 15_000 });
          const barra = page.getByRole("group", { name: "Histórico" });
          await expect(barra.getByRole("button", { name: "Desfazer" })).toBeVisible({ timeout: 10_000 });
          await expect(barra.getByRole("button", { name: "Refazer" })).toBeVisible();
          await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeVisible();
          // Sem alterações: nada para desfazer/refazer/guardar, e o estado diz "Guardado".
          await expect(barra.getByRole("button", { name: "Desfazer" })).toBeDisabled();
          await expect(barra.getByRole("button", { name: "Refazer" })).toBeDisabled();
          await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeDisabled();
          await expect(page.getByRole("status").filter({ hasText: "Guardado" })).toBeVisible();
          // E já não aparece o estado vazio.
          await expect(page.getByText("O construtor de páginas ainda não está ativo")).toHaveCount(0);
        },
      );
    });
  });
}
