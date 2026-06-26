import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./fixtures/login";

// Cada teste autentica o seu próprio tenant — começa sem sessão.
test.use({ storageState: { cookies: [], origins: [] } });

const nav = (page: Page) => page.locator("nav").first();

// Matriz de permissões: cada user só tem 1 componente. Core (Clientes/Financeiro/
// Conteúdos) é acessível a todos; os módulos (Loja/Agenda/Ginásio) são por permissão.
const MATRIX = [
  { user: "limited@e2e", modulo: "Loja", path: "/loja", esconde: ["Agenda", "Ginásio", "Admin"], bloqueadas: ["/agenda", "/ginasio", "/admin"] },
  { user: "agenda@e2e", modulo: "Agenda", path: "/agenda", esconde: ["Loja", "Ginásio", "Admin"], bloqueadas: ["/loja", "/ginasio", "/admin"] },
  { user: "gym@e2e", modulo: "Ginásio", path: "/ginasio", esconde: ["Loja", "Agenda", "Admin"], bloqueadas: ["/loja", "/agenda", "/admin"] },
];

test.describe("RBAC — matriz de permissões na UI", () => {
  for (const m of MATRIX) {
    test(`${m.user}: sidebar mostra ${m.modulo} + core, esconde ${m.esconde.join("/")}`, async ({ page, context }) => {
      await loginAs(context, m.user);
      await page.goto(m.path);
      // Vê o seu módulo + os core (Clientes, Financeiro, Conteúdos).
      await expect(nav(page).getByRole("button", { name: m.modulo, exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(nav(page).getByRole("button", { name: "Clientes", exact: true })).toBeVisible();
      // Não vê os módulos sem permissão.
      for (const hidden of m.esconde) {
        await expect(nav(page).getByRole("button", { name: hidden, exact: true })).toHaveCount(0);
      }
    });

    test(`${m.user}: bloqueado em ${m.bloqueadas.join(", ")} (→ dashboard)`, async ({ page, context }) => {
      await loginAs(context, m.user);
      for (const route of m.bloqueadas) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
      }
    });
  }

  test("admin vê todos os módulos e acede a /admin", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    await page.goto("/dashboard");
    for (const name of ["Loja", "Agenda", "Ginásio", "Clientes", "Conteúdos", "Admin"]) {
      await expect(nav(page).getByRole("button", { name, exact: true })).toBeVisible({ timeout: 10_000 });
    }
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10_000 });
  });
});
