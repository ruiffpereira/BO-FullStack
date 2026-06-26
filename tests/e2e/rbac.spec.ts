import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";

// Cada teste autentica o seu próprio tenant — começa sem sessão.
test.use({ storageState: { cookies: [], origins: [] } });

const nav = (page: import("@playwright/test").Page) => page.locator("nav").first();

test.describe("RBAC — a UI respeita as permissões", () => {
  test("user limitado (só VIEW_PRODUCTS): sidebar mostra Loja + core, esconde Agenda/Ginásio/Admin", async ({ page, context }) => {
    await loginAs(context, "limited@e2e");
    await page.goto("/loja");
    await expect(page.getByRole("heading", { name: "Loja", level: 1 })).toBeVisible({ timeout: 10_000 });

    // Permitidos: Loja (VIEW_PRODUCTS) + core (Clientes/Financeiro/Conteúdos).
    await expect(nav(page).getByRole("button", { name: "Loja" })).toBeVisible();
    await expect(nav(page).getByRole("button", { name: "Clientes" })).toBeVisible();
    // Escondidos: módulos sem permissão.
    await expect(nav(page).getByRole("button", { name: "Agenda" })).toHaveCount(0);
    await expect(nav(page).getByRole("button", { name: "Ginásio" })).toHaveCount(0);
    await expect(nav(page).getByRole("button", { name: "Admin" })).toHaveCount(0);
  });

  test("user limitado é bloqueado em rotas sem permissão (→ redireciona p/ dashboard)", async ({ page, context }) => {
    await loginAs(context, "limited@e2e");
    for (const route of ["/admin", "/agenda", "/ginasio"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    }
  });

  test("admin vê todos os módulos na sidebar", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    await page.goto("/dashboard");
    for (const name of ["Loja", "Agenda", "Ginásio", "Clientes", "Conteúdos", "Admin"]) {
      await expect(nav(page).getByRole("button", { name, exact: true })).toBeVisible({ timeout: 10_000 });
    }
  });

  test("admin acede a /admin (vê a tabela de utilizadores)", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10_000 });
  });
});
