import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";

/**
 * R1.8 (B5) — Financeiro: visibilidade dos subitens por permissão.
 *
 * O submenu do Financeiro (`SUBMENU["/financeiro"]`, navigation.ts) mostra Agenda/Loja/Ginásio/Despesas só a quem
 * tem `VIEW_SCHEDULE`/`VIEW_PRODUCTS`/`VIEW_GYM`/`VIEW_EXPENSES`; "O Negócio" é de todos. Um deep-link a um subitem sem
 * permissão cai no 1.º subitem permitido do MESMO pai (`/financeiro`), nunca no dashboard (guard do Shell).
 * Tenants semeados com UMA só permissão (`scripts/seedE2e.ts`): limited=PRODUCTS, agenda=SCHEDULE, gym=GYM.
 *
 * Largura 1440: a sidebar fixa só existe em desktop (em 834/390 é um drawer); o guard por URL não depende da largura
 * e é provado também a 390 no último bloco.
 */

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });

const nav = (page: Page) => page.locator("nav").first();
const sub = (page: Page, nome: string) => nav(page).getByRole("button", { name: nome, exact: true });

const CASOS = [
  { user: "limited@e2e", tem: ["Loja"], nao: ["Agenda", "Ginásio", "Despesas"] },
  { user: "agenda@e2e", tem: ["Agenda"], nao: ["Loja", "Ginásio", "Despesas"] },
  { user: "gym@e2e", tem: ["Ginásio"], nao: ["Agenda", "Loja", "Despesas"] },
] as const;

for (const c of CASOS) {
  test.describe(`Financeiro — subitens de ${c.user}`, () => {
    test("a sidebar mostra O Negócio e só os subitens do seu módulo", async ({ page, context }) => {
      await loginAs(context, c.user);
      await withSessionRetry(
        page,
        context,
        c.user,
        () => page.goto("/financeiro"),
        async () => {
          await expect(sub(page, "O Negócio")).toBeVisible({ timeout: 15_000 });
        },
      );
      // O módulo próprio também é um botão de topo com o mesmo nome (Loja/Agenda/Ginásio): com o subitem do Financeiro
      // são 2; sem ele seria só 1. Os que ele não tem não aparecem em lado nenhum (0).
      for (const nome of c.tem) await expect.poll(() => sub(page, nome).count()).toBeGreaterThanOrEqual(2);
      for (const nome of c.nao) await expect(sub(page, nome)).toHaveCount(0);
    });
  });
}

test.describe("Financeiro — deep-link a um subitem sem permissão", () => {
  const bloqueados: { user: string; rota: string }[] = [
    { user: "limited@e2e", rota: "/financeiro/ginasio" }, // sem VIEW_GYM
    { user: "limited@e2e", rota: "/financeiro/agenda" }, // sem VIEW_SCHEDULE
    { user: "gym@e2e", rota: "/financeiro/agenda" }, // com VIEW_GYM mas sem VIEW_SCHEDULE
    { user: "agenda@e2e", rota: "/financeiro/ginasio" }, // com VIEW_SCHEDULE mas sem VIEW_GYM
    { user: "agenda@e2e", rota: "/financeiro/loja" },
  ];

  for (const b of bloqueados) {
    test(`${b.user}: ${b.rota} cai em /financeiro (não no dashboard)`, async ({ page, context }) => {
      await loginAs(context, b.user);
      await withSessionRetry(
        page,
        context,
        b.user,
        () => page.goto(b.rota),
        () => expect(page).toHaveURL(/\/financeiro$/, { timeout: 15_000 }),
      );
    });
  }

  test("o deep-link antigo ?vista=ginasio, sem VIEW_GYM, também acaba em /financeiro", async ({ page, context }) => {
    await loginAs(context, "limited@e2e");
    await withSessionRetry(
      page,
      context,
      "limited@e2e",
      () => page.goto("/financeiro?vista=ginasio"),
      () => expect(page).toHaveURL(/\/financeiro(\?|$)/, { timeout: 15_000 }),
    );
    await expect(page).not.toHaveURL(/\/financeiro\/ginasio/);
  });

  test("com a permissão o subitem abre (gym@e2e → /financeiro/ginasio)", async ({ page, context }) => {
    await loginAs(context, "gym@e2e");
    await withSessionRetry(
      page,
      context,
      "gym@e2e",
      () => page.goto("/financeiro/ginasio"),
      () => expect(page).toHaveURL(/\/financeiro\/ginasio/, { timeout: 15_000 }),
    );
  });
});

test.describe("Financeiro — guard por URL nas 3 larguras", () => {
  for (const vp of [
    { label: "1440", width: 1440, height: 900 },
    { label: "834", width: 834, height: 1112 },
    { label: "390", width: 390, height: 844 },
  ]) {
    test(`${vp.label}: limited@e2e em /financeiro/ginasio fica em /financeiro e a página renderiza`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginAs(context, "limited@e2e");
      await withSessionRetry(
        page,
        context,
        "limited@e2e",
        () => page.goto("/financeiro/ginasio"),
        async () => {
          await expect(page).toHaveURL(/\/financeiro$/, { timeout: 15_000 });
          await expect(page.getByRole("heading", { name: "Financeiro", level: 2 })).toBeVisible({ timeout: 10_000 });
        },
      );
      // Sem scroll horizontal da página.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
