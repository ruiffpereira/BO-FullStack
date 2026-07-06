import { test, expect } from "./fixtures/auth";

/**
 * /perfil (T3.3, `.design/shell-nav-perfil/`) + menu do avatar no topbar.
 *
 * IMPORTANTE: `admin@e2e` é o utilizador seeded partilhado por praticamente
 * todos os outros specs (login via `./fixtures/auth`, `TEST_USER=admin@e2e`
 * por omissão) — e o campo "Nome do negócio" (`Users.name`) É o identificador
 * de login (`username`). O teste que edita o nome tem de o RESTAURAR no fim
 * (`finally`), senão qualquer spec a seguir nesta run que faça login como
 * "admin@e2e" deixa de autenticar.
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
  test("editar o nome e guardar persiste (reload mantém o valor novo)", async ({ page }) => {
    await page.goto("/perfil");

    const nameInput = page.getByLabel("Nome do negócio");
    await expect(nameInput).toHaveValue(/.+/, { timeout: 10_000 });
    const original = await nameInput.inputValue();
    const novoNome = `Perfil E2E ${Date.now()}`;

    // exact:true — sem isto "Guardar" também casa com "Guardar logótipo"
    // (Playwright faz substring match por omissão no `name` do getByRole).
    try {
      await nameInput.fill(novoNome);
      const saveBtn = page.getByRole("button", { name: "Guardar", exact: true });
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 8_000 });

      // Persistência real: recarrega a página (novo GET /users/me) e confirma
      // que o nome novo veio da API, não só do estado local do formulário.
      await page.reload();
      await expect(page.getByLabel("Nome do negócio")).toHaveValue(novoNome, {
        timeout: 10_000,
      });
    } finally {
      await page.getByLabel("Nome do negócio").fill(original);
      const saveBtn = page.getByRole("button", { name: "Guardar", exact: true });
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 8_000 });
    }
  });
});
