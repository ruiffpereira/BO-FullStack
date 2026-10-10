import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";

// O nome do serviço é guardado nos Conteúdos (PUT /cms/entries, VIEW_CMS). Um tenant com a Agenda
// mas sem Conteúdos levava 403 aí e o modal ficava aberto sem nenhum aviso.
test.use({ storageState: { cookies: [], origins: [] } });

test("guardar um serviço sem acesso a Conteúdos mostra o motivo e não fica em silêncio", async ({ context, page }) => {
  await loginAs(context, "agenda@e2e"); // só VIEW_SCHEDULE
  await page.goto("/agenda/servicos");
  await page.getByRole("button", { name: "Novo serviço" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Pesquisar ou escrever um nome…").first().fill(`Serviço sem CMS ${Date.now()}`);
  await dialog.locator('input[type="number"]').nth(1).fill("10");
  await dialog.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText(/Sem permissão para editar Conteúdos/)).toBeVisible({ timeout: 10_000 });
  // Nada foi criado: o modal continua aberto para o utilizador perceber o que se passou.
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Serviço criado")).toHaveCount(0);
});
