import { test, expect } from "./fixtures/auth";

/**
 * /perfil (T3.3, `.design/shell-nav-perfil/`) + menu do avatar no topbar.
 *
 * IMPORTANTE: `admin@e2e` é o utilizador seeded partilhado por praticamente
 * todos os outros specs (login via `./fixtures/auth`, `TEST_USER=admin@e2e`
 * por omissão) — e o campo "Nome do negócio" (`Users.name`) É o identificador
 * de login (`username`). Por isso o teste de persistência abaixo edita o
 * campo **"Telefone"** (`Users.phone`), não o nome: `phone` não é usado por
 * `loginAs`/login nenhum, por isso mesmo que o restore no `finally` falhe
 * (ex.: timeout do toast), a sessão de "admin@e2e" nunca fica envenenada para
 * os specs seguintes (rbac, isolamento, etc. — correm em serial, um nome
 * alterado aqui deixava-os todos a levar 401).
 */
test.describe("Perfil — menu do avatar", () => {
  test("abrir o menu do avatar navega para /perfil", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .waitForSelector(".animate-spin", { state: "detached", timeout: 10_000 })
      .catch(() => {});

    await page.getByRole("button", { name: "Menu da conta" }).click();
    await expect(page.getByRole("menu", { name: "Conta" })).toBeVisible({ timeout: 5_000 });

    await page.getByRole("menuitem", { name: "O meu perfil" }).click();
    await expect(page).toHaveURL(/\/perfil/);
    await expect(page.getByRole("heading", { name: "Perfil", level: 1 })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Esc fecha o menu do avatar", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .waitForSelector(".animate-spin", { state: "detached", timeout: 10_000 })
      .catch(() => {});

    await page.getByRole("button", { name: "Menu da conta" }).click();
    await expect(page.getByRole("menu", { name: "Conta" })).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "Conta" })).toHaveCount(0);
  });
});

test.describe("Perfil — Conta", () => {
  test("editar o telefone e guardar persiste (reload mantém o valor novo)", async ({ page }) => {
    await page.goto("/perfil");

    const phoneInput = page.getByLabel("Telefone");
    await expect(phoneInput).toBeVisible({ timeout: 10_000 });
    const original = await phoneInput.inputValue();
    const novoTelefone = "+351 912 345 678";

    // exact:true — sem isto "Guardar" também casa com "Guardar logótipo"
    // (Playwright faz substring match por omissão no `name` do getByRole).
    try {
      await phoneInput.fill(novoTelefone);
      const saveBtn = page.getByRole("button", { name: "Guardar", exact: true });
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 8_000 });

      // Persistência real: recarrega a página (novo GET /users/me) e confirma
      // que o telefone novo veio da API, não só do estado local do formulário.
      await page.reload();
      await expect(page.getByLabel("Telefone")).toHaveValue(novoTelefone, {
        timeout: 10_000,
      });
    } finally {
      await page.getByLabel("Telefone").fill(original);
      const saveBtn = page.getByRole("button", { name: "Guardar", exact: true });
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 8_000 });
    }
  });
});
