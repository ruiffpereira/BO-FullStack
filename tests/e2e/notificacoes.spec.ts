import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Notificações — sino em tempo real", () => {
  test("o sino mostra a notificação por ler do tenant", async ({ page, context }) => {
    await loginAs(context, "tenantA@e2e");
    const bell = page.getByRole("button", { name: /notificações/i }).first();
    await withSessionRetry(
      page,
      context,
      "tenantA@e2e",
      () => page.goto("/dashboard"),
      () => expect(bell).toBeVisible({ timeout: 15_000 }),
    );
    // Badge de não lidas do SINO (aria-label "Notificações (N não lidas)"). Evita
    // colidir com os botões de Mensagens/chat, que também mostram "(N não lidas)".
    await expect(page.getByRole("button", { name: /notificações.*não lida/i })).toBeVisible({ timeout: 15_000 });
    await bell.click();
    await expect(page.getByText("Nova marcação E2E")).toBeVisible({ timeout: 10_000 });
  });
});
