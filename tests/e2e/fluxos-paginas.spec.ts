import { test, expect } from "./fixtures/auth";
import { test as anon } from "@playwright/test";
import { loginAs } from "./fixtures/login";
import { LojaPage } from "./pages/LojaPage";
import { ClientesPage } from "./pages/ClientesPage";
import { DespesasPage } from "./pages/DespesasPage";
import { GinasioPage } from "./pages/GinasioPage";

/**
 * Fluxos ponta-a-ponta por página (lacunas ALTA da auditoria):
 *  - Loja: criar produto → aparece na lista.
 *  - Clientes: bloquear/desbloquear (efeito visível na lista) + editar.
 *  - Despesas: criar categoria + despesa com essa categoria → aparece.
 *  - Ginásio: criar exercício completo (nome + grupo + preset) → aparece.
 *
 * Os blocos que usam `test` (fixture auth) correm como admin@e2e (TEST_USER).
 * O bloco do Ginásio usa o tenantA (que tem grupo muscular semeado, necessário
 * para criar um exercício).
 */

const uniq = () => Date.now().toString().slice(-7);

test.describe("Loja — fluxo criar produto", () => {
  test("criar produto → aparece na lista com nome e referência", async ({ page }) => {
    const p = new LojaPage(page);
    await p.goto();

    const name = `Produto E2E ${uniq()}`;
    const ref = `E2E-${uniq()}`;
    await p.createProduct({ name, reference: ref, price: "24.90", stock: "7" });

    // O card mostra nome (h3) + referência.
    await p.expectProductVisible(ref);
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Clientes — bloquear/desbloquear + editar", () => {
  test("bloquear cliente → badge 'Bloqueado' na lista; desbloquear → some", async ({ page }) => {
    const p = new ClientesPage(page);
    await p.goto();

    const name = `Cliente Bloq ${uniq()}`;
    await p.createClient(name);
    await p.expectClientVisible(name);

    // Abre a ficha e bloqueia.
    await p.searchInput().fill(name);
    await page.waitForTimeout(500);
    await p.openClient(name);
    await p.toggleBlockFromProfile();
    await p.closeModal();

    // A linha da lista mostra o badge "Bloqueado".
    await expect(p.row(name).getByText("Bloqueado")).toBeVisible({ timeout: 8_000 });

    // Reabre e desbloqueia → o badge desaparece.
    await p.openClient(name);
    await p.toggleBlockFromProfile();
    await p.closeModal();
    await expect(p.row(name).getByText("Bloqueado")).toHaveCount(0, { timeout: 8_000 });
  });
});

test.describe("Despesas — criar categoria + despesa ligada", () => {
  test("criar categoria e despesa com essa categoria → despesa aparece", async ({ page }) => {
    const p = new DespesasPage(page);
    const today = new Date().toISOString().slice(0, 10);
    await p.goto();

    const cat = `Cat Fluxo ${uniq()}`;
    await p.createCategory(cat);
    await page.keyboard.press("Escape");

    // Cria a despesa e associa a categoria criada.
    const desc = `Despesa c/ cat ${uniq()}`;
    await p.openNewExpenseModal();
    await p.fillExpenseForm({ date: today, description: desc, amount: "33.33" });
    // Seleciona a categoria no Combobox (opções num portal).
    await page.getByRole("button", { name: /sem categoria/i }).click();
    await page.getByRole("option", { name: cat }).first().click();
    await p.submitExpenseForm();

    await p.expectExpenseVisible(desc);
  });
});

// O Ginásio precisa de um grupo muscular existente para criar um exercício — usa o
// tenantA (que tem "Peito A" semeado). Login próprio, sem sessão partilhada.
anon.describe("Ginásio — fluxo criar exercício", () => {
  anon.use({ storageState: { cookies: [], origins: [] } });

  anon("criar exercício (nome + grupo Peito A + preset) → aparece na lista", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    const g = new GinasioPage(page);
    await g.goto();
    await expect(g.header()).toBeVisible({ timeout: 12_000 });

    const name = `Exercício E2E ${uniq()}`;
    await g.createExercise({ name, group: "Peito A", preset: "Base" });
    await g.expectExerciseVisible(name);
  });
});
